---
type: backlog
status: active
updated: 2026-11-02
tags: [roadmap, backlog]
---

# Backlog

## P0 — Blocking or security-critical

| ID | Area | Item | Why | Status |
|---|---|---|---|---|
| FH-001 | Build | Fix Auth dependency resolution or replace Auth with Go | Login is unavailable | Done — all Rust services build on pinned stable 1.90.0 |
| FH-002 | Build | Move web Dockerfile to Node 22 | Vite 7 cannot build | Open |
| FH-003 | Build | Use a pullable, pinned MinIO image | Reports cannot start | Open |
| FH-004 | Routing | Fix Traefik Docker provider | No gateway routes load; blocked end-to-end route verification | Done — upgraded to `traefik:v3.7`, which supports Docker Engine 29's API |
| FH-005 | Config | Provide non-blank provider keys through local config | Scans fail at runtime | Open |
| FH-006 | Routing | Resolve the `/reports` prefix strip conflict | Report routes 404 | Superseded by FH-033 |
| FH-007 | Security | Enforce JWT verification in History | Anonymous reads and forged tokens | Open |
| FH-008 | Security | Scope History list and detail to the caller | Data disclosure and IDOR | Open |
| FH-009 | Security | Add auth and ownership to Reports | Anyone can create/read/download reports | Open |
| FH-010 | Security | Add auth and ownership to Notify | Anyone can read notifications | Open |
| FH-011 | Security | Rotate exposed-looking keys and clean test data | Credential exposure | Open |
| FH-012 | Frontend | Fix file-scan result mapping | Malicious files show as clean | Open |
| FH-033 | Routing | Align all service routes with one gateway convention; add a route-contract test | History, Reports, and Notify 404 through Traefik | Done — D1=B applied; `scripts/check-routes.mjs` added |
| FH-034 | Security | Centralize JWT validation at the edge (ForwardAuth or BFF) | Four different auth postures; no single audit point | Open |
| FH-035 | Build | Add `.dockerignore` and stop copying `.env` and keys into images | Secrets ship in build contexts and the Auth image | Partial — Rust apps done; Notify still copies the build context |

## P1 — Important before release

| ID | Area | Item | Why | Status |
|---|---|---|---|---|
| FH-013 | Data | Fix History `type` and `risk` filters | Filters return empty results | Open |
| FH-014 | Data | Return 400 for malformed IDs | Avoid 500s and log noise | Open |
| FH-015 | Messaging | Align Report and Notify queue names | Notifications never arrive | Open |
| FH-016 | Frontend | Fix notification path and report/history state | Broken UI flows | Open |
| FH-017 | Frontend | Remove `|| 85` confidence fallback | Misleading scores | Open |
| FH-018 | Build | Add clean-clone bootstrap and key generation | Clone does not start | Open |
| FH-019 | Docs | Correct README paths, ports, and endpoints | Setup instructions are wrong | Open |
| FH-020 | Testing | Add auth and ownership regression tests | Prevent recurrence | Open |
| FH-021 | Architecture | Add Go scan orchestrator | Synchronous scans do not scale | Open |
| FH-022 | Data | Add PostgreSQL for relational records | Ownership and filters are awkward in Mongo | Open |
| FH-023 | Observability | Add request IDs and structured logs | Hard to debug across services | Open |
| FH-036 | Messaging | Standardize the event envelope and add a dead-letter queue | Poison messages loop forever; events do not connect | Open |
| FH-037 | Data | Define one scan result schema and add query indexes | Filters and history pagination are unreliable | Open |
| FH-038 | Testing | Add OpenAPI contracts and schema validation for every service | Hand-written calls drift from behavior | Open |

## P2 — Hardening and polish

| ID | Area | Item | Why | Status |
|---|---|---|---|---|
| FH-024 | Security | Add login rate limiting | Brute-force resistance | Open |
| FH-025 | Security | Replace wildcard CORS in production | Reduce browser exposure | Open |
| FH-026 | Scanning | Add file-size and archive-bomb limits | DoS resistance | Open |
| FH-027 | Scanning | Add ClamAV and YARA | Deeper file analysis | Open |
| FH-028 | Intelligence | Add Python threat-intelligence service | Better AI/feed integration | Open |
| FH-029 | CI | Add language matrix and security scans | Prevent regressions | Open |
| FH-030 | Testing | Add k6 load tests | Measure performance claims | Open |
| FH-031 | Docs | Add demo video and screenshots | Portfolio presentation | Open |
| FH-032 | Infra | Add Terraform or Kubernetes manifests | Deployment maturity | Open |
| FH-039 | Security | Move the Gemini key out of the query string and tokens out of `localStorage` | Key leakage and XSS token theft | Open |

## Definition of ready

- The problem and user impact are clear.
- The affected service and contract are known.
- There is a verification command or test.
- Secrets and test data are handled safely.

## Definition of done

- Build passes.
- Tests pass.
- Security checks pass.
- `CHANGELOG.md` and a change note are updated.
- The service note and [[00-Home]] reflect the new state.

## Related notes

- [[Roadmap]]
- [[Milestones]]
- [[Test-Matrix]]
- [[Security-Review]]
