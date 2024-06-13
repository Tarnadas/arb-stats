use crate::{ArbEvent, ArbStatus};
use anyhow::Result;
use async_stream::stream;
use futures_util::future::try_join_all;
use near_jsonrpc_client::{
    methods::{self, chunk::ChunkReference, tx::TransactionInfo},
    JsonRpcClient,
};
use near_primitives::{
    types::{AccountId, BlockHeight, BlockId, BlockReference},
    views::{ActionView, BlockView, FinalExecutionOutcomeViewEnum, TxExecutionStatus},
};
use near_token::NearToken;
use rayon::prelude::*;
use regex::Regex;
use reqwest::{
    header::{HeaderMap, AUTHORIZATION},
    Client, Url,
};
use serde::Deserialize;
use std::{env, str::FromStr};
use tokio_stream::Stream;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    last_block_height: u64,
}

pub async fn poll_block(
    rpc_client: &JsonRpcClient,
) -> Result<impl Stream<Item = (BlockHeight, u64, Vec<ArbEvent>)> + '_> {
    let mut block_height = get_current_block_height().await?;

    let arb_bots: Vec<_> = env::var("ARB_BOTS")
        .unwrap()
        .split(',')
        .map(|account_id| AccountId::from_str(account_id).unwrap())
        .collect();

    let swapped_from_regex = Regex::new("Swapped ([0-9]*) wrap.near").unwrap();
    let swapped_to_regex = Regex::new(" for ([0-9]*) wrap.near").unwrap();

    Ok(stream! {
        loop {
            match rpc_client
            .call(methods::block::RpcBlockRequest {
                block_reference: BlockReference::BlockId(BlockId::Height(block_height)),
            })
            .await {
                Ok(block) => {
                    block_height += 1;
                    let timestamp = block.header.timestamp_nanosec;

                    yield (
                        block_height,
                        timestamp,
                        handle_block(block, &arb_bots, &swapped_from_regex, &swapped_to_regex, rpc_client)
                            .await
                            .unwrap(),
                    );
                },
                Err(err) => {
                    dbg!(err);
                    block_height += 1;
                },
            }
        }
    })
}

async fn handle_block(
    block: BlockView,
    arb_bots: &[AccountId],
    swapped_from_regex: &Regex,
    swapped_to_regex: &Regex,
    rpc_client: &JsonRpcClient,
) -> Result<Vec<ArbEvent>> {
    let tx_hashes: Vec<_> = try_join_all(block.chunks.iter().map(|chunk| async {
        rpc_client
            .call(methods::chunk::RpcChunkRequest {
                chunk_reference: ChunkReference::ChunkHash {
                    chunk_id: chunk.chunk_hash,
                },
            })
            .await
    }))
    .await?
    .par_iter()
    .flat_map(|chunk| {
        chunk
            .transactions
            .par_iter()
            .filter(|tx| arb_bots.contains(&tx.signer_id))
            .map(|tx| {
                tx.actions.iter().filter_map(|action| {
                    if let ActionView::FunctionCall { method_name, .. } = action {
                        if method_name == "swap" {
                            Some((tx.hash, tx.signer_id.clone()))
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                })
            })
            .flatten_iter()
    })
    .collect();

    let events = try_join_all(tx_hashes.iter().cloned().map(
        |(tx_hash, sender_account_id)| async move {
            rpc_client
                .call(
                    methods::EXPERIMENTAL_tx_status::RpcTransactionStatusRequest {
                        transaction_info: TransactionInfo::TransactionId {
                            tx_hash,
                            sender_account_id,
                        },
                        wait_until: TxExecutionStatus::Final,
                    },
                )
                .await
        },
    ))
    .await?
    .into_iter()
    .enumerate()
    .filter_map(|(index, tx)| {
        tx.final_execution_outcome.map(|final_execution_outcome| {
            (
                tx_hashes[index].1.clone(),
                tx_hashes[index].0,
                final_execution_outcome,
            )
        })
    })
    .filter_map(|(sender_id, tx_hash, outcome)| {
        if let FinalExecutionOutcomeViewEnum::FinalExecutionOutcome(outcome) = outcome {
            Some((sender_id, tx_hash, outcome))
        } else {
            None
        }
    })
    .filter_map(|(sender_id, tx_hash, outcome)| {
        let gas_burnt = outcome.transaction_outcome.outcome.gas_burnt
            + outcome
                .receipts_outcome
                .iter()
                .map(|outcome| outcome.outcome.gas_burnt)
                .sum::<u64>();
        match outcome.status {
            near_primitives::views::FinalExecutionStatus::SuccessValue(_) => {
                if outcome.receipts_outcome[0].outcome.executor_id.as_str() != "v2.ref-finance.near"
                {
                    return None;
                }
                let amount_in = NearToken::from_yoctonear(
                    swapped_from_regex
                        .captures(&outcome.receipts_outcome[0].outcome.logs[0])
                        .unwrap()
                        .get(1)
                        .unwrap()
                        .as_str()
                        .parse::<u128>()
                        .unwrap(),
                );
                let amount_out = outcome.receipts_outcome[0]
                    .outcome
                    .logs
                    .iter()
                    .rev()
                    .find_map(|log| swapped_to_regex.captures(log))
                    .map(|swapped_to| {
                        NearToken::from_yoctonear(
                            swapped_to.get(1).unwrap().as_str().parse::<u128>().unwrap(),
                        )
                    })
                    .unwrap();
                Some((
                    ArbStatus::Success(
                        amount_out
                            .saturating_sub(amount_in)
                            .as_yoctonear()
                            .to_string(),
                    ),
                    gas_burnt,
                ))
            }
            _ => Some((ArbStatus::Failure, gas_burnt)),
        }
        .map(|(event, gas_burnt)| ArbEvent {
            sender_id,
            tx_hash,
            event,
            gas_burnt,
        })
    })
    .collect();

    Ok(events)
}

async fn get_current_block_height() -> anyhow::Result<u64> {
    if let Ok(block_height) = env::var("START_BLOCK_HEIGHT") {
        Ok(block_height.parse()?)
    } else {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            format!("Bearer {}", env::var("INDEXER_SECRET")?).parse()?,
        );
        let client = Client::builder().default_headers(headers).build()?;
        let base_url = Url::parse(&env::var("API_BASE_URL")?)?;
        let info: Info = client
            .get(base_url.join("info")?)
            .send()
            .await?
            .json()
            .await?;
        Ok(info.last_block_height + 1)
    }
}
