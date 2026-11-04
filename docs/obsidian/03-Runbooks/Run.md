---
type: runbook
status: active
updated: 2026-11-03
tags: [runbook, run]
---

# Run

## When to use

Use this runbook to start, stop, or inspect the local ForgeHarbor stack.

## Start

```powershell
.\scripts\dev.ps1 up
```

Equivalent direct command:

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml up -d
```

Add `--build` on the first run or after a Dockerfile change:

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml up -d --build
```

## Entry points

| URL | Purpose |
|---|---|
| `http://localhost:8088` | Traefik gateway; use this for API calls |
| `http://localhost:8000` | Traefik dashboard |
| `http://localhost:3000` | Web container directly |
| `http://localhost:8081` | Phishing direct |
| `http://localhost:8082` | Malware direct |
| `http://localhost:8083` | History direct |
| `http://localhost:8084` | Reports direct |
| `http://localhost:8085` | Notify direct |
| `http://localhost:15672` | RabbitMQ management, `guest` / `guest` |
| `http://localhost:9001` | RustFS console |

The README documents the same gateway and dashboard ports. Use `http://localhost:8088` as the application entrypoint.

## Status

```powershell
.\scripts\dev.ps1 status
docker compose -f deploy/compose/docker-compose.dev.yml ps
```

## Health

```powershell
.\scripts\dev.ps1 health
```

The script probes direct service health endpoints and the gateway. A service is not healthy just because its container is running.

## Logs

```powershell
.\scripts\dev.ps1 logs
docker compose -f deploy/compose/docker-compose.dev.yml logs -f fh-auth
docker compose -f deploy/compose/docker-compose.dev.yml logs -f traefik
```

## Stop

```powershell
.\scripts\dev.ps1 down
```

This stops containers but keeps named volumes. To remove volumes as well, use the explicit destructive command only when you intend to delete local data:

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml down -v
```

## Last recorded verification (2026-11-02)

The change record [[2026-11-02-phase-0-core-security]] reports all eight health probes and 20 gateway route/auth probes passing. The report artifact E2E is recorded in [[2026-11-02-report-download-e2e]]. This is historical evidence; check the live stack with `dev.ps1 health` before relying on its current state.

## Related notes

- [[Build]]
- [[Debug]]
- [[Gateway-Routing]]
- [[Ports]]
