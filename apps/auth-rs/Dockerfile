# Stage 1: Build with a pinned stable toolchain.
# Use a pinned stable toolchain for reproducible builds.
FROM rust:1.90.0-bookworm AS builder

WORKDIR /app

# Copy the dependency manifests first so the dependency layer is cached.
COPY ./Cargo.toml ./Cargo.lock ./

# Build a dummy binary to cache the dependency graph.
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release --locked

# Copy the real source and build the service.
# Touch main.rs so Cargo does not reuse the dummy binary from the cache layer.
COPY ./src ./src
RUN touch ./src/main.rs && cargo test --release --locked && cargo build --release --locked

# Stage 2: Minimal runtime image.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# JWT keys and configuration are mounted at runtime, never baked into the image.
COPY --from=builder /app/target/release/auth-rs /usr/local/bin/auth-rs

EXPOSE 8080

ENV RUST_BACKTRACE=1 \
    RUST_LOG=info

USER 65532:65532

CMD ["/usr/local/bin/auth-rs"]
