use crate::ArbEvent;
use anyhow::Result;
use futures_util::pin_mut;
use near_primitives::types::BlockHeight;
use reqwest::{
    header::{HeaderMap, AUTHORIZATION},
    Client, Url,
};
use serde::Serialize;
use std::env;
use tokio_stream::{Stream, StreamExt};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BlockEvent {
    pub block_height: BlockHeight,
    pub timestamp: u64,
    pub events: Vec<ArbEvent>,
}

pub async fn send_data(
    stream: impl Stream<Item = (BlockHeight, u64, Vec<ArbEvent>)>,
) -> Result<()> {
    let mut headers = HeaderMap::new();
    headers.insert(
        AUTHORIZATION,
        format!("Bearer {}", env::var("INDEXER_SECRET")?).parse()?,
    );
    let client = Client::builder().default_headers(headers).build()?;
    let base_url = Url::parse(&env::var("API_BASE_URL")?)?;
    pin_mut!(stream);

    let mut last_block_height = 0;
    const MAX_BLOCK_HEIGHT_DIFF: BlockHeight = 500;
    let mut batch_event = vec![];
    while let Some((block_height, timestamp, events)) = stream.next().await {
        let block_event = BlockEvent {
            block_height,
            timestamp,
            events,
        };
        batch_event.push(block_event);

        if block_height - last_block_height >= MAX_BLOCK_HEIGHT_DIFF {
            println!("block_height: {}", block_height);
            if !batch_event.is_empty() {
                println!(
                    "found events: {}",
                    batch_event.iter().map(|ev| ev.events.len()).sum::<usize>()
                );
            }
            last_block_height = block_height;
            match client
                .post(base_url.join("batch")?)
                .json(&batch_event)
                .send()
                .await?
                .error_for_status()
            {
                Ok(_) => {}
                Err(err) => {
                    panic!(
                        "{}\n\nSent data:\n{:#?}",
                        err,
                        serde_json::to_value(batch_event)
                    );
                }
            }
        }
    }

    Ok(())
}
