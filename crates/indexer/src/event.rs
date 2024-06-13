use near_primitives::{hash::CryptoHash, types::AccountId};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArbEvent {
    pub sender_id: AccountId,
    pub tx_hash: CryptoHash,
    pub gas_burnt: u64,
    #[serde(flatten)]
    pub event: ArbStatus,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", content = "profit")]
#[serde(rename_all = "camelCase")]
pub enum ArbStatus {
    Success(String),
    Failure,
}
