FROM rust:bookworm AS chef

WORKDIR /app
RUN cargo install cargo-chef 


FROM chef AS planner

COPY crates crates
COPY Cargo.toml Cargo.toml
COPY Cargo.lock Cargo.lock
COPY rust-toolchain.toml rust-toolchain.toml
RUN cargo chef prepare --recipe-path recipe.json


FROM chef AS builder

RUN apt update && \
  apt install -y libssl-dev pkg-config

COPY --from=planner /app/recipe.json recipe.json
COPY rust-toolchain.toml rust-toolchain.toml
RUN cargo chef cook --release --recipe-path recipe.json

COPY crates crates
COPY Cargo.toml Cargo.toml
COPY Cargo.lock Cargo.lock
RUN cargo build --release


FROM debian:bookworm-slim

WORKDIR /app
RUN apt update && \
  apt install -y openssl ca-certificates

COPY --from=builder /app/target/release/indexer /usr/local/bin
ENTRYPOINT ["indexer"]
