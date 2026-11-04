# ForgeHarbor Agent Guide

This file is the persistent source of truth for agents working in this repository. Read it before changing code, docs, or configuration.

## Start here

1. Read `docs/obsidian/00-Home.md`.
2. Check `git status --short` and the current branch.
3. Use `forgeharbor-context` to restore roadmap and working-tree context when continuing work.
4. Read the affected service note in `docs/obsidian/02-Services/`.
5. Use the matching `forgeharbor-*` skill when the task fits.
6. For any bug or failing command, use `systematic-debugging` before proposing a fix.

## Project overview

ForgeHarbor is a polyglot threat-detection platform. A React frontend talks to backend services through Traefik. The services use MongoDB, Redis, RabbitMQ, and RustFS (S3-compatible storage), and call Gemini and VirusTotal.

The polyglot architecture is intentional. Each language must have a credible specialty; do not add a language just to increase the count.

## Service map

| Service | Language | Port | Public path | Status |
|---|---|---:|---|---|
| Auth | Rust | 8080 | `/auth` | Build and health verified; security review remains |
| Phishing | Rust | 8081 | `/phishing` | Unverified |
| Malware | Rust | 8082 | `/malware` | Unverified |
| History | TypeScript | 8083 | `/history` | RS256 auth/ownership enforced; risk filter and integration tests remain |
| Reports | Go | 8084 | `/reports` | RS256 auth/ownership enforced; artifact flow unverified |
| Notify | Python | 8085 | `/notify` | RS256 auth/ownership enforced; worker hardening remains |
| Web | React + Vite | 3000 | `/` | Node 22 image builds; UI regression coverage remains |

Infrastructure: Traefik on host port 8088 (dashboard 8000), MongoDB 27017, Redis 6379, RabbitMQ 5672/15672, RustFS S3 storage 9000/9001.

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

Codex project MCP servers are configured in `.codex/config.toml`; Codex project settings load only for trusted projects. The previous OpenCode config is retained during migration.

Project servers: Context7, Playwright, GitHub (read-only), Obsidian vault, scoped source filesystem, and MongoDB (read-only).

Use the `forgeharbor-mcp` skill for setup, health checks, and key rotation. Never embed secrets in `.codex/config.toml` or legacy `.opencode/opencode.jsonc`; use environment variables.

## Current blockers

- Auth build is fixed; auth and ownership behavior still needs security review.
- Local provider credentials must be verified and rotated before publication.
- RustFS has been wired as the S3-compatible dev store; report artifact storage still needs end-to-end verification.
- Centralized edge auth remains open; development ports are loopback-bound and production service ports should stay internal-only.
- History's risk filter and the shared scan result schema still need alignment.
- The frontend needs report/history state and auth-flow regression coverage.
- Traefik Docker provider and gateway prefix contract are fixed and route-verified.

Do not claim the stack is working while these are unresolved. Track progress in `docs/obsidian/06-Roadmap/Backlog.md`.

## Project skills (`.agents/skills/`)

- `forgeharbor-dev` — implement or refactor service code consistently.
- `forgeharbor-build` — build, run, and verify services.
- `forgeharbor-debug` — triage failures with evidence.
- `forgeharbor-architecture` — service map, data flow, routing.
- `forgeharbor-change-tracker` — changelog, change note, dashboard.
- `forgeharbor-roadmap` — phases, backlog, milestones.
- `forgeharbor-security` — auth, ownership, secrets.
- `forgeharbor-obsidian` — vault conventions and graph.
- `forgeharbor-service-scaffold` — add a service consistently.
- `forgeharbor-release` — release checklist.
- `forgeharbor-mcp` — MCP configuration and health.
- `forgeharbor-context` — restore roadmap, repository, and working-tree context across sessions.
