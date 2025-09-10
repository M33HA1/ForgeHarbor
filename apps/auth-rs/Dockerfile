# Stage 1: Build the application using the nightly Rust toolchain
FROM rustlang/rust:nightly as builder

WORKDIR /app

# Copy the dependency manifests first
# Using a wildcard to handle both "cargo.toml" and "Cargo.toml"
COPY ./*argo.toml ./
COPY ./Cargo.lock ./

# Create a dummy main.rs file to build and cache only the dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo build --release

# Now, copy the actual application source code, replacing the dummy file
COPY ./src ./src

# Build the application for release, which will now use the cached dependencies
RUN cargo build --release

# Stage 2: Create the final, minimal production image
FROM debian:bookworm-slim

# Copy the compiled binary from the builder stage (FIXED: use correct binary name)
COPY --from=builder /app/target/release/auth-rs /usr/local/bin/auth-rs

# Expose the correct port for each service
# For auth-rs: EXPOSE 8080
# For phishing-rs: EXPOSE 8081
# For malware-rs: EXPOSE 8082
EXPOSE 8080

# Set the startup command to run the binary (FIXED: use correct binary name)
CMD ["/usr/local/bin/auth-rs"]