use anyhow::Result;
use async_stream::stream;
use near_jsonrpc_client::{methods, JsonRpcClient};
use near_primitives::{
    types::{BlockHeight, BlockReference, Finality},
    views::BlockView,
};
use reqwest::{
    header::{HeaderMap, AUTHORIZATION},
    Client, Url,
};
use serde::Deserialize;
use std::{env, time::Duration};
use tokio::time::sleep;
use tokio_stream::Stream;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    last_block_height: u64,
}

pub async fn poll_block(
    rpc_client: &JsonRpcClient,
) -> Result<impl Stream<Item = (BlockHeight, u64, Vec<()>)> + '_> {
    let mut last_block_height = get_current_block_height().await?;

    Ok(stream! {
        loop {
            if let Ok(block) = rpc_client
                .call(methods::block::RpcBlockRequest {
                    block_reference: BlockReference::Finality(Finality::Final),
                })
                .await
            {
                if block.header.height > last_block_height {
                    last_block_height = block.header.height;
                    let timestamp = block.header.timestamp_nanosec;

                    yield (last_block_height, timestamp, handle_block(block));
                }
            }
            sleep(Duration::from_millis(50)).await;
        }
    })
}

fn handle_block(_block: BlockView) -> Vec<()> {
    Vec::new()
}

async fn get_current_block_height() -> anyhow::Result<u64> {
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
    if info.last_block_height > 0 {
        Ok(info.last_block_height + 1)
    } else {
        Ok(env::var("START_BLOCK_HEIGHT").unwrap().parse()?)
    }
}
