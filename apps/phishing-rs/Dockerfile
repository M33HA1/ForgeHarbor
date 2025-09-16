# Stage 1: Build the application using the nightly Rust toolchain
FROM rustlang/rust:nightly AS builder

WORKDIR /app

# Copy the dependency manifests first
COPY Cargo.toml ./
COPY Cargo.lock ./

# Create a dummy main.rs file to build and cache only the dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release

# Remove the dummy file and copy actual source code
RUN rm -rf src
COPY ./src ./src

# Build the application for release
RUN cargo build --release

# Stage 2: Create the final, minimal production image
FROM debian:bookworm-slim

# Install required runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy the compiled binary from the builder stage
COPY --from=builder /app/target/release/malware-rs /usr/local/bin/phishing-rs

# Set ownership and make executable
RUN chmod +x /usr/local/bin/malware-rs

# Expose the port
EXPOSE 8081

# Set the startup command
CMD ["/usr/local/bin/malware-rs"]