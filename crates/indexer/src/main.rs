mod event;
mod indexer;
mod send;

pub use event::*;
pub use indexer::*;
pub use send::*;

use near_jsonrpc_client::JsonRpcClient;
use std::env;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv()?;

    let rpc_url = env::var("RPC_URL")?;
    let rpc_client = JsonRpcClient::connect(&rpc_url);
    let fallback_rpc_url = env::var("FALLBACK_RPC_URL")?;
    let fallback_rpc_client = JsonRpcClient::connect(&fallback_rpc_url);

    let (stream, block_height) = poll_block(&rpc_client, &fallback_rpc_client).await?;
    send_data(stream, block_height).await?;

    Ok(())
}
