# ForgeHarbor Agent Guide

This file is the persistent source of truth for agents working in this repository. Read it before changing code, docs, or configuration.

## Start here

1. Read `docs/obsidian/00-Home.md`.
2. Check `git status --short` and the current branch.
3. Read the affected service note in `docs/obsidian/02-Services/`.
4. Use the matching `forgeharbor-*` skill when the task fits.
5. For any bug or failing command, use `systematic-debugging` before proposing a fix.

## Project overview

ForgeHarbor is a polyglot threat-detection platform. A React frontend talks to backend services through Traefik. The services use MongoDB, Redis, RabbitMQ, and MinIO, and call Gemini and VirusTotal.

The polyglot architecture is intentional. Each language must have a credible specialty; do not add a language just to increase the count.

## Service map

| Service | Language | Port | Public path | Status |
|---|---|---:|---|---|
| Auth | Rust | 8080 | `/auth` | Build broken |
| Phishing | Rust | 8081 | `/phishing` | Unverified |
| Malware | Rust | 8082 | `/malware` | Unverified |
| History | TypeScript | 8083 | `/history` | Security defects |
| Reports | Go | 8084 | `/reports` | Auth/routing defects |
| Notify | Python | 8085 | `/notify` | Auth/queue defects |
| Web | React + Vite | 3000 | `/` | Build broken |

Infrastructure: Traefik on host port 8088 (dashboard 8000), MongoDB 27017, Redis 6379, RabbitMQ 5672/15672, MinIO 9000/9001.

## Language boundaries

- **Rust** — CPU-heavy, memory-safe analysis. Keep it for the malware engine and existing analysis services until deliberately migrated.
- **Go** — control-plane APIs and orchestration. Default for new backend services, the scan orchestrator, and the target Auth/History/Notify direction.
- **Python** — AI, threat intelligence, feed normalization, ML. Use it for the future threat-intelligence service.
- **TypeScript** — UI and API integration. React + TypeScript is the target for the frontend.
- **SQL/PostgreSQL** — relational data, ownership, filtering, reporting. Target store for users, scans, reports, and audit records.

See `docs/obsidian/04-Decisions/ADR-0001-polyglot-boundaries.md` and `ADR-0002-go-control-plane.md`.

## Build and run

```powershell
.\scripts\dev.ps1 build
.\scripts\dev.ps1 up
.\scripts\dev.ps1 status
.\scripts\dev.ps1 health
.\scripts\dev.ps1 logs
.\scripts\dev.ps1 test
.\scripts\dev.ps1 down
```

Direct Compose equivalent:

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml up -d --build
docker compose -f deploy/compose/docker-compose.dev.yml ps
docker compose -f deploy/compose/docker-compose.dev.yml logs -f fh-auth
```

The real gateway is `http://localhost:8088`, not port 80. The Traefik dashboard is `http://localhost:8000`.

## Definition of done

A change is done only when all of these are true:

- [ ] The affected build passes.
- [ ] Tests pass, or the change includes a test that failed first and now passes.
- [ ] Security checks pass for the touched surface.
- [ ] `CHANGELOG.md` has an entry under `Unreleased`.
- [ ] A change note exists in `docs/obsidian/05-Changes/` for meaningful work.
- [ ] The affected service note and `docs/obsidian/00-Home.md` reflect the new state.
- [ ] No secrets, tokens, private keys, or live-looking credentials are committed.
- [ ] The diff is limited to the intended files.

## Security rules

- Never print or commit `config/.env`, JWTs, API keys, private keys, or connection strings with credentials.
- Enforce JWT verification and per-user ownership on every protected read and write.
- Fail closed: missing auth configuration must reject requests, not silently allow them.
- Use read-only MCP access for MongoDB unless a task explicitly requires a write.
- Do not use production keys for tests.
- Treat `config/.env` as compromised-looking local data; rotate keys before publishing the repo.
- Do not add wildcard CORS, permissive auth bypasses, or "temporary" admin routes without a tracked security note.

## Change tracking

Every meaningful change updates three layers:

1. `CHANGELOG.md` — release-level summary.
2. `docs/obsidian/05-Changes/YYYY-MM-DD-<slug>.md` — what changed, why, verification, follow-ups.
3. `docs/obsidian/00-Home.md` — current phase, status, risks, and next actions.

Use `docs/obsidian/10-Templates/Change.md` as the note template. Link the affected service and decision notes.

## Documentation conventions

- Use `[[wikilinks]]` for internal references.
- Use frontmatter with `type`, `status`, `updated`, and tags.
- Keep Mermaid diagrams in notes; keep interactive maps in `docs/obsidian/Canvas/`.
- Every service note links to a runbook, relevant ADR, and recent change.
- Every ADR links to the services and roadmap items it affects.
- Do not commit `docs/obsidian/.obsidian/workspace*.json`; commit `app.json`, `appearance.json`, `core-plugins.json`, and `graph.json`.

## MCP

The MCP layer is split by scope:

- Global: Context7, Playwright.
- Project-local: GitHub, Obsidian, MongoDB.

Use the `forgeharbor-mcp` skill for setup, health checks, and key rotation. Never embed secrets in `.opencode/opencode.jsonc`; use environment variables.

## Current blockers

- Auth fails to compile with the current `mongodb` dependency.
- Web Dockerfile uses Node 14; Vite 7 needs Node 20.19+ or 22.12+.
- MinIO image pull fails.
- Traefik cannot read the Docker provider.
- Compose passes blank provider keys.
- History, Reports, and Notify have auth and ownership defects.
- The frontend misreads file-scan results and calls the wrong notification path.

Do not claim the stack is working while these are unresolved. Track progress in `docs/obsidian/06-Roadmap/Backlog.md`.

## Useful skills

- `forgeharbor-build` — build, run, test, clean.
- `forgeharbor-debug` — triage failures with evidence.
- `forgeharbor-architecture` — service map, data flow, routing.
- `forgeharbor-change-tracker` — changelog, change note, dashboard.
- `forgeharbor-roadmap` — phases, backlog, milestones.
- `forgeharbor-security` — auth, ownership, secrets.
- `forgeharbor-obsidian` — vault conventions and graph.
- `forgeharbor-service-scaffold` — add a service consistently.
- `forgeharbor-release` — release checklist.
- `forgeharbor-mcp` — MCP configuration and health.
