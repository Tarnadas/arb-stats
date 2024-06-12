use near_primitives::{hash::CryptoHash, types::AccountId};
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ArbEvent {
    pub sender_id: AccountId,
    pub tx_hash: CryptoHash,
    pub event: ArbStatus,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", content = "data")]
#[serde(rename_all = "camelCase")]
pub enum ArbStatus {
    Success(String),
    Failure,
}
