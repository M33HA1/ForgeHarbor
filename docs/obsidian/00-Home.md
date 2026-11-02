---
type: dashboard
status: active
updated: 2026-11-02
tags: [forgeharbor, dashboard, moc]
---

# ForgeHarbor — Project Home

> [!summary] Current phase
> **Phase 0 — Stabilize.** The repository is a polyglot security platform with a documented architecture, but the full stack does not start cleanly yet.

## Status

| Area | State | Evidence |
|---|---|---|
| Repository | Active | Branch `main` |
| Knowledge base | In place | This vault, linked from this dashboard |
| Developer tooling | In place | `scripts/dev.ps1`, `scripts/dev.sh`, `.tool-versions` |
| Application stack | Partial | All Rust images build; all 15 documented routes pass through the gateway; Web and MinIO remain |
| Architecture | Reviewed | [[Architecture-Review]] — contracts, routing, auth boundary, events, secrets |
| Routing | Contract fixed | D1=B in [[ADR-0004-gateway-prefix-contract]]; `scripts/check-routes.mjs` |
| Security | P0 open | [[Security-Review]] |
| MCP tooling | Configured | Verify with `opencode mcp list`; see [[MCP]] |

## Top risks

| Risk | Impact | Tracked in |
|---|---|---|
| MinIO image pull fails | Reports cannot store artifacts; the route still passes | [[Reports]] |
| Service auth and ownership are inconsistent | Unauthorized access and IDOR | [[Gateway-Routing]], [[Security-Review]] |
| Services share infrastructure but not contracts | Routing, data, and event drift | [[Architecture-Review]] |
| Scans run synchronously in the request | Timeouts, duplicate cost, no retries | [[Architecture-Review]] |
| Web Dockerfile uses Node 14 | Vite 7 cannot build | [[Web]] |
| Live-looking API keys in local config | Credential exposure risk | [[Security-Review]] |

## Next three actions

1. Use a pullable MinIO image and verify report storage end to end.
2. Move the web image to Node 22 and use a pullable MinIO image.
3. Add edge auth (ForwardAuth or the Go BFF) and enforce ownership in History, Reports, and Notify.

See [[Roadmap]] for the full sequence.

## Architecture

- [[Architecture-Review]]
- [[System-Overview]]
- [[Service-Map]]
- [[Data-Flow]]
- [[Gateway-Routing]]
- [[System-Architecture.canvas]]

## Services

- [[Auth]]
- [[Phishing]]
- [[Malware]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Web]]

## Runbooks

- [[Build]]
- [[Run]]
- [[Debug]]
- [[Test]]
- [[Deploy]]

## Decisions

- [[ADR-0001-polyglot-boundaries]]
- [[ADR-0002-go-control-plane]]
- [[ADR-0003-postgres-for-history]]
- [[ADR-0004-gateway-prefix-contract]]

## Changes

- [[Change-Log]]
- [[2026-11-02-phase-0-auth-build-and-routes]]
- [[2026-11-02-initial-audit]]
- [[2026-11-02-architecture-review]]
- [[2026-11-02-project-operating-system]]

## Roadmap

- [[Roadmap]]
- [[Backlog]]
- [[Milestones]]
- [[Roadmap.canvas]]

## Security

- [[Security-Review]]
- [[Threat-Model]]

## Testing

- [[Test-Matrix]]

## Reference

- [[Ports]]
- [[Environment]]
- [[MCP]]
- [[API-Contracts]]
- [[Glossary]]

## Templates

- [[Service]]
- [[ADR]]
- [[Change]]
- [[Runbook]]

## MCP status

| Server | Scope | Purpose | State as of 2026-11-02 |
|---|---|---|---|
| Context7 | Global | Current library documentation | Connected |
| Playwright | Global | Browser smoke tests and screenshots | Connected |
| GitHub | Project | Issues, PRs, Actions, repository metadata | Needs OAuth |
| Obsidian | Project | Search and update this vault | Not installed; see [[MCP]] |
| MongoDB | Project | Read-only inspection of local data | Needs `MDB_MCP_CONNECTION_STRING` |

Use the `forgeharbor-mcp` skill for setup and troubleshooting. Secrets belong in environment variables, never in this vault or in `opencode.jsonc`. Full setup: [[MCP]].

## Conventions

- Every service note links to its runbook, relevant ADRs, and recent changes.
- Every change note links to the affected service and the decision it implements.
- Use `[[wikilinks]]` for internal references and tags for cross-cutting status.
- Update this dashboard after every meaningful change.
- Keep Mermaid diagrams in notes so GitHub readers see the same architecture as Obsidian readers.
- Keep interactive maps in `Canvas/` and commit the `.canvas` files.
