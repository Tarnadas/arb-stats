use crate::{ArbEvent, ArbStatus};
use anyhow::Result;
use async_stream::stream;
use futures_util::future::{join_all, try_join_all};
use itertools::Itertools;
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

pub async fn poll_block<'a>(
    rpc_client: &'a JsonRpcClient,
    fallback_rpc_client: &'a JsonRpcClient,
) -> Result<(
    impl Stream<Item = (BlockHeight, u64, Vec<ArbEvent>)> + 'a,
    BlockHeight,
)> {
    let block_height = get_current_block_height().await?;
    let max_concurrency = env::var("MAX_CONCURRENCY").unwrap().parse::<usize>()?;

    Ok((
        stream! {
            for chunk in (block_height..).chunks(max_concurrency).into_iter() {
                let block_results: Vec<_> = join_all(chunk.map(|block_height| async move {
                    let block = match rpc_client
                        .call(methods::block::RpcBlockRequest {
                            block_reference: BlockReference::BlockId(BlockId::Height(block_height)),
                        })
                        .await
                        .map_err(|_| {
                            fallback_rpc_client.call(methods::block::RpcBlockRequest {
                                block_reference: BlockReference::BlockId(BlockId::Height(block_height)),
                            })
                        }) {
                        Ok(block) => Some((block, false)),
                        Err(res) => match res.await {
                            Ok(block) => Some((block, true)),
                            Err(_) => {
                                None
                            }
                        },
                    };
                    match block {
                        Some((block, use_fallback)) => {
                            let timestamp = block.header.timestamp_nanosec;

                            Some((
                                block_height,
                                timestamp,
                                handle_block(
                                    block,
                                    if use_fallback {
                                        fallback_rpc_client
                                    } else {
                                        rpc_client
                                    },
                                )
                                .await
                                .unwrap(),
                            ))
                        }
                        None => {
                            None
                        }
                    }
                }))
                .await
                .into_iter()
                .flatten()
                .collect();

                for block_result in block_results {
                    yield block_result;
                }
            }
        },
        block_height,
    ))
}

async fn handle_block(block: BlockView, rpc_client: &JsonRpcClient) -> Result<Vec<ArbEvent>> {
    let arb_bots: Vec<_> = env::var("ARB_BOTS")
        .unwrap()
        .split(',')
        .map(|account_id| AccountId::from_str(account_id).unwrap())
        .collect();
    let swapped_from_regex = Regex::new("Swapped ([0-9]*) wrap.near").unwrap();
    let swapped_to_regex = Regex::new(" for ([0-9]*) wrap.near").unwrap();

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

    let events = try_join_all(
        tx_hashes
            .iter()
            .cloned()
            .map(|(tx_hash, sender_account_id)| {
                let rpc_client = rpc_client.clone();
                async move {
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
                }
            }),
    )
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
                    outcome.receipts_outcome[0]
                        .outcome
                        .logs
                        .iter()
                        .filter_map(|logs| swapped_from_regex.captures(logs))
                        .filter_map(|captures| captures.get(1))
                        .filter_map(|m| m.as_str().parse::<u128>().ok())
                        .sum::<u128>(),
                );
                let amount_out = NearToken::from_yoctonear(
                    outcome.receipts_outcome[0]
                        .outcome
                        .logs
                        .iter()
                        .filter_map(|logs| swapped_to_regex.captures(logs))
                        .filter_map(|captures| captures.get(1))
                        .filter_map(|m| m.as_str().parse::<u128>().ok())
                        .sum::<u128>(),
                );
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
