---
type: runbook
status: active
updated: 2026-11-02
tags: [runbook, debug]
---

# Debug

## When to use

Use this runbook when a build fails, a container restarts, a route returns 404/500, a scan fails, or auth behaves unexpectedly.

## Method

1. Reproduce the failure with the smallest command that shows it.
2. Capture the exact error, container status, and relevant log lines.
3. Identify the failing layer: source, image build, Compose interpolation, container network, Traefik routing, service auth, or data.
4. Form one hypothesis and test it.
5. Fix the root cause, not the symptom.
6. Add or update a smoke test so the failure cannot silently return.
7. Record the change in [[Change-Log]] and the affected service note.

Do not skip step 1. A fix based on a remembered error is a guess.

## Failure table

| Symptom | Likely layer | First command |
|---|---|---|
| Rust build fails with `E0391` async-drop cycle | Nightly toolchain | The Dockerfile must use `rust:1.90.0-bookworm`, not `rustlang/rust:nightly` |
| Web build fails on `??=` | Node version | Check `apps/web/Dockerfile`; it must use Node 22 |
| MinIO pull denied | Image reference/registry | `docker pull minio/minio:latest` |
| Traefik logs Docker provider error | Docker socket/API | `docker compose ... logs traefik` |
| Gateway returns 404 for every route | Traefik provider | `Invoke-WebRequest http://localhost:8000/api/rawdata` |
| A documented route returns 404 through the gateway | Route contract | `node scripts/check-routes.mjs`; compare the service route with [[API-Contracts]] |
| History returns other users' scans | Missing auth/ownership | Test without a token and with a forged token |
| File scan shows "Clean" for a malicious file | Frontend result shape | Inspect `apps/web/src/components/Scan/Result.jsx` |
| `GEMINI_API_KEY`/`VIRUSTOTAL_API_KEY` warnings | Compose interpolation | Check `config/.env` and `docker compose config` |

## Container evidence

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml ps
docker compose -f deploy/compose/docker-compose.dev.yml logs --tail=200 fh-auth
docker compose -f deploy/compose/docker-compose.dev.yml logs --tail=200 traefik
docker inspect fh-auth --format '{{.State.Status}} {{.State.ExitCode}}'
```

## Route evidence

```powershell
Invoke-WebRequest http://localhost:8000/api/rawdata -UseBasicParsing
Invoke-WebRequest http://localhost:8088/auth/health -UseBasicParsing
Invoke-WebRequest http://localhost:8083/history/health -UseBasicParsing
node scripts/check-routes.mjs
```

## Data evidence

Use the MongoDB MCP server in read-only mode for inspection. Do not mutate shared data during debugging unless you created it and will clean it up.

```text
mongodb_find: database=forgeharbor, collection=scans
mongodb_find: database=forgeharbor, collection=notifications
```

## Browser evidence

Use the Playwright MCP server to reproduce UI failures, capture the failing request, and take a screenshot. Check the browser console and network panel before changing frontend code.

## Security rules

- Never print `config/.env`, JWTs, private keys, or API keys.
- Redact tokens as `<redacted>` in notes and logs.
- Use a disposable user and scan record for auth tests.
- Clean up test records and containers when finished.

## Related notes

- [[Build]]
- [[Run]]
- [[Test]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Test-Matrix]]
