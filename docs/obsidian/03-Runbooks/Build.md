---
type: runbook
status: active
updated: 2026-11-02
tags: [runbook, build]
---

# Build

## When to use

Use this runbook to build images, compile services locally, or reproduce a build failure.

## Prerequisites

| Tool | Required version | Current machine |
|---|---|---|
| Docker | 24+ with Compose v2 | 29.4.3 |
| Node.js | 22.12+ for Vite 7 | 22.20.0 |
| Rust | Stable 1.90.0, pinned in every Rust Dockerfile | 1.90.0 |
| Go | 1.22+ for local Report builds | Not on PATH |
| Python | 3.11 in the container | 3.13.7 locally |

Install Go if you want local Report builds:

```powershell
winget install GoLang.Go
```

The scripts fall back to Docker when Go is unavailable.

Tool versions are pinned in `.tool-versions` for asdf or mise users. The Dockerfiles remain the authoritative build environment.

## First-time setup

1. Create the shared environment file from the safe example:
   ```powershell
   Copy-Item config/.env.example config/.env
   ```
2. Fill in `GEMINI_API_KEY`, `VIRUSTOTAL_API_KEY`, and a strong `JWT_SECRET`.
3. Generate the local RSA keys and verifier copies. The command keeps matching keys unchanged, refuses incomplete or mismatched pairs, and never overwrites an existing key:
   ```powershell
   node scripts/setup-jwt-keys.mjs
   ```
4. Never commit the generated keys or `config/.env`.

## Build the stack

```powershell
.\scripts\dev.ps1 build
```

Equivalent direct command:

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml build
```

## Build one service

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml build fh-auth
docker compose -f deploy/compose/docker-compose.dev.yml build fh-phishing
docker compose -f deploy/compose/docker-compose.dev.yml build fh-malware
docker compose -f deploy/compose/docker-compose.dev.yml build fh-history
docker compose -f deploy/compose/docker-compose.dev.yml build fh-report
docker compose -f deploy/compose/docker-compose.dev.yml build fh-notify
docker compose -f deploy/compose/docker-compose.dev.yml build fh-web
```

## Local builds

```powershell
# Web
Push-Location apps/web
npm install
npm run build
Pop-Location

# History
Push-Location apps/history-ts
npm install
npm run build
Pop-Location

# Reports
Push-Location apps/report-go
go build ./...
Pop-Location

# Rust services
Push-Location apps/auth-rs
cargo build --release
Pop-Location
```

## Known blockers

| Symptom | Cause | Workaround |
|---|---|---|
| `cycle detected when computing when error::GridFsErrorKind needs async drop` | `mongodb-3.2.5` with the current dependency resolution | Pin a compatible `mongodb` version or move Auth to Go |
| `UnhandledPromiseRejectionWarning: SyntaxError: Unexpected token '??='` | Node 14 running Vite 7 | Change the web Dockerfile to `node:22` |
| `pull access denied for minio/minio` | The old MinIO image is no longer available | The development Compose stack now pins RustFS; verify report artifact operations separately |
| `Failed to retrieve information of the docker client and server host` | Traefik cannot reach the Docker socket/API | Recreate the Traefik container and verify the socket mount |
| `The "GEMINI_API_KEY" variable is not set` | Compose interpolation cannot see the key | Put the key in `config/.env` and recreate the containers |

## Verification

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml config --quiet
docker compose -f deploy/compose/docker-compose.dev.yml build
```

`docker compose config --quiet` should exit 0. The build is only successful when every service image is created; do not treat a partial build as green.

For the documentation, vault, and script checks that do not build application images, run:

```powershell
.\scripts\dev.ps1 test
```

## Related notes

- [[Run]]
- [[Debug]]
- [[Test]]
- [[Environment]]
- [[Auth]]
- [[Web]]
