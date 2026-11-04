---
date: 2026-11-02
type: change
area: [build, routing, security]
status: complete
related: ["[[Auth]]", "[[Phishing]]", "[[Malware]]", "[[History]]", "[[Reports]]", "[[Notify]]", "[[ADR-0004-gateway-prefix-contract]]"]
tags: [change]
---

# Phase 0 — Auth build and gateway prefix contract

## What changed

### Build

- Auth, Phishing, and Malware now build on pinned stable `rust:1.90.0-bookworm` instead of `rustlang/rust:nightly`. The nightly compiler triggered `E0391: cycle detected when computing when error::GridFsErrorKind needs async drop` in `mongodb` 3.2.5.
- `apps/auth-rs/Cargo.toml` pins every dependency; the lock file is unchanged.
- All three Rust Dockerfiles build with `--locked` and touch `src/main.rs` after copying the real source. Without the touch, Cargo reused the dummy binary from the dependency-cache layer and shipped a no-op image.
- The Auth image no longer copies `config`; the JWT keys and `.env` are mounted at runtime. Phishing and Malware copy only `jwt-public.pem`.
- Added `.dockerignore` to Auth, Phishing, and Malware so `.env`, the private key, and `target` stay out of build contexts.

### Routing (D1=B)

- [[ADR-0004-gateway-prefix-contract]] records the decision: the gateway does not rewrite paths, and every service owns its full public prefix.
- Auth registers `/auth/health`, `/auth/signup`, `/auth/login`, `/auth/jwks`, and `/auth/me`.
- Phishing registers `/phishing/health` and `/phishing/v1/url/check`.
- Malware registers `/malware/health` and `/malware/v1/file/analyze`.
- History registers `/history/health`; Reports registers `/reports/health`; Notify registers `/notify/health` and `/notify`.
- Removed every `stripprefix` middleware label from `deploy/compose/docker-compose.dev.yml`.\n- Upgraded Traefik from `traefik:v2.10` to `traefik:v3.7`. The older images cannot talk to Docker Engine 29 (minimum API 1.41), so no routes loaded; v3.7 loads all six service routers.
- Updated the health probes in `scripts/status.ps1` and `scripts/status.sh` to use prefixed paths.
- Added `scripts/check-routes.mjs`, which probes every documented route through the gateway and fails on 404. `dev.ps1 test` and `dev.sh test` run it; it skips when the gateway is unreachable.

## Why

The Auth image could not build, so login and every protected flow were unavailable. Phishing and Malware had the same nightly failure and would have shipped a dummy binary even if the build had passed.

The gateway stripped prefixes for six services while only three services expected that. History, Reports, and Notify returned 404 for data routes while `/health` kept passing, so the smoke tests hid the defect. D1=B makes the public path, the direct-port path, and the service route identical, and the contract test makes a regression visible.

## Verification

| Check | Command | Result |
|---|---|---|
| Auth compile | `cargo check` in `apps/auth-rs` | Passed; lock unchanged |
| Auth image | `docker compose ... build fh-auth` | Passed; image runs the real binary (panics on missing `MONGO_URI`, as expected) |
| Phishing compile | `cargo check` in `apps/phishing-rs` | Passed |
| Phishing image | `docker compose ... build fh-phishing` | Passed |
| Malware compile | `cargo check` in `apps/malware-rs` | Passed (one pre-existing unused-import warning) |
| Malware image | `docker compose ... build fh-malware` | Passed |
| History image | `docker compose ... build fh-history` | Passed |
| Reports image | `docker compose ... build fh-report` | Passed |
| Notify image | `docker compose ... build fh-notify` | Passed |
| Notify syntax | `python -m compileall apps/notify-py` | Passed |
| Route-test syntax | `node --check scripts/check-routes.mjs` | Passed |
| Route contract through the gateway | `node scripts/check-routes.mjs` | Passed - all 15 documented routes return the expected status |
| Tooling and links | `.\scripts\dev.ps1 test` | Passed (42 notes, zero broken links) |

## Follow-ups

- Add edge authentication (ForwardAuth or the Go BFF) and stop publishing service ports; D1=B makes the direct-port bypass less confusing but does not secure it.
- Add ownership checks to History, Reports, and Notify.
- Fix the web Dockerfile (Node 22) and verify report artifact storage against RustFS.
- Add `.dockerignore` and runtime secrets to Notify (SEC-015 remains partial).

## Related notes

- [[ADR-0004-gateway-prefix-contract]]
- [[Gateway-Routing]]
- [[API-Contracts]]
- [[Architecture-Review]]
- [[Auth]]
- [[Phishing]]
- [[Malware]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Change-Log]]
