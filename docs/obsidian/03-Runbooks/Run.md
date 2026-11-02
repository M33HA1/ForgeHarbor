---
type: runbook
status: active
updated: 2026-11-02
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
| `http://localhost:9001` | MinIO console |

The README currently says port 80 and 8080 for the gateway; those values are stale. Use 8088 and 8000.

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

## Current expected state

As of 2026-11-02:

- `fh-mongo`, `fh-redis`, `fh-rabbit`, `fh-history`, `fh-notify`, and `traefik` are up.
- `fh-auth`, `fh-web`, and `fh-report` are not healthy.
- The gateway has no working routes because Traefik cannot read the Docker provider.
- Do not describe the stack as "running" until all seven services and the gateway pass health checks.

## Related notes

- [[Build]]
- [[Debug]]
- [[Gateway-Routing]]
- [[Ports]]
