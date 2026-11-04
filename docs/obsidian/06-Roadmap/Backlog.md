---
type: backlog
status: active
updated: 2026-11-05
tags: [roadmap, backlog]
---

# Backlog

## P0 — Blocking or security-critical

| ID | Area | Item | Why | Status |
|---|---|---|---|---|
| FH-001 | Build | Fix Auth dependency resolution or replace Auth with Go | Login is unavailable | Done — all Rust services build on pinned stable 1.90.0 |
| FH-002 | Build | Move web Dockerfile to Node 22 | Vite 7 cannot build | Done — Docker image built on Node 22.12 |
| FH-003 | Build | Use a pullable, pinned S3-compatible object-store image | Reports cannot start | Done — pinned native AMD64 RustFS image; authenticated create/download and ownership verified end to end |
| FH-004 | Routing | Fix Traefik Docker provider | No gateway routes load; blocked end-to-end route verification | Done — upgraded to `traefik:v3.7`, which supports Docker Engine 29's API |
| FH-005 | Config | Provide non-blank provider keys through local config | Scans fail at runtime | Open |
| FH-006 | Routing | Resolve the `/reports` prefix strip conflict | Report routes 404 | Superseded by FH-033 |
| FH-007 | Security | Enforce JWT verification in History | Anonymous reads and forged tokens | Done — RS256, issuer, audience, and expiry required; gateway rejects missing and forged tokens |
| FH-008 | Security | Scope History list and detail to the caller | Data disclosure and IDOR | Done — RS256 integration fixture confirms another user's detail returns 404 and the list stays owner-scoped |
| FH-009 | Security | Add auth and ownership to Reports | Anyone can create/read/download reports | Owner checks and trusted stored-scan provenance are enforced; 410 blocks unverifiable legacy downloads. Legacy ownership backfill and artifact retention/regeneration remain |
| FH-010 | Security | Add auth and ownership to Notify | Anyone can read notifications | Done — RS256 owner-isolation integration passes; legacy ownership backfill remains |
| FH-011 | Security | Rotate exposed-looking keys and clean test data | Credential exposure | Open |
| FH-012 | Frontend | Fix file-scan result mapping | Malicious files show as clean | Done — maps nested VirusTotal result fields |
| FH-033 | Routing | Align all service routes with one gateway convention; add a route-contract test | History, Reports, and Notify 404 through Traefik | Done — D1=B applied; `scripts/check-routes.mjs` added |
| FH-034 | Security | Centralize JWT validation at the edge (ForwardAuth or BFF) | Shared validation before service dispatch | Done in dev: shared file-provider gate, token/health/preflight/owner checks, and controlled Auth outage rejection/recovery verified; production TLS/exposure and latency review remain release gates |
| FH-035 | Build | Add `.dockerignore` and stop copying `.env` and keys into images | Secrets ship in build contexts and the Auth image | Done — all application build contexts exclude `.env`, PEMs, and generated dependencies |

## P1 — Important before release

| ID | Area | Item | Why | Status |
|---|---|---|---|---|
| FH-013 | Data | Fix History `type` and `risk` filters | Filters return empty results | Done — validates URL/file and high/low values, maps stored fields, and supports legacy scan records |
| FH-014 | Data | Return 400 for malformed IDs | Avoid 500s and log noise | Done — History and Reports validate IDs before querying |
| FH-015 | Messaging | Align Report and Notify queue names | Notifications never arrive | Done — Reports publishes user-scoped messages to the configured notifications queue |
| FH-016 | Frontend | Fix notification path and report/history state | Broken UI flows | Done: owned report restoration, creation by scan ID, download/error feedback, and History filters are covered by the fixture browser suite |
| FH-017 | Frontend | Remove `|| 85` confidence fallback | Misleading scores | Done — unknown file confidence is shown as vendor counts |
| FH-018 | Build | Add clean-clone bootstrap and key generation | Clone does not start | Done — `node scripts/setup-jwt-keys.mjs` safely generates or validates the Auth pair and verifier copies |
| FH-019 | Docs | Correct README paths, ports, and endpoints | Setup instructions are wrong | Done — README now uses the current config path, dev scripts, loopback ports, RustFS, and registered routes |
| FH-020 | Testing | Add auth and ownership regression tests | Prevent recurrence | In progress: backend auth/owner fixtures, seven mocked browser scenarios, and a real local signup/History/report/notification/two-user-denial journey pass; provider-backed scans, pagination races, and CI remain |
| FH-021 | Architecture | Add Go scan orchestrator | Synchronous scans do not scale | Open |
| FH-022 | Data | Add PostgreSQL for relational records | Ownership and filters are awkward in Mongo | Open |
| FH-023 | Observability | Add request IDs and structured logs | Hard to debug across services | Open |
| FH-036 | Messaging | Standardize the event envelope and add a dead-letter queue | Prevent notification loss, drift, and stuck messages | In progress: v1 event, consumer idempotency/retry/dead storage, and producer outbox with mandatory confirms/replay verified; broker/producer outage drills, quorum redrive, backlog monitoring, and reviewed dead-message replay remain |
| FH-037 | Data | Define one scan result schema and add query indexes | Filters and history pagination are unreliable | Open |
| FH-038 | Testing | Add OpenAPI contracts and schema validation for every service | Hand-written calls drift from behavior | Open |
| FH-041 | Security | Bound Auth credential and password-hashing work; reject known compromised passwords | Oversized inputs, parallel Argon2 requests, and reused breached passwords increase account risk | In progress: validated credentials, 8 KiB body cap, two-job Argon2 pool, retryable overload, atomic 20/IP/15-minute signup throttle, and HIBP k-anonymity screening pass locally; production outbound policy and hosted regression coverage remain |

## P2 — Hardening and polish

| ID | Area | Item | Why | Status |
|---|---|---|---|---|
| FH-024 | Security | Add login rate limiting | Brute-force resistance | In progress — Redis enforces 5/account and 60/IP per 15 minutes; untrusted forwarded headers are ignored and dev Traefik peer trust is verified; configure production proxy peers |
| FH-025 | Security | Replace wildcard CORS in production | Reduce browser exposure | In progress — Rust services allow configured exact origins; deployment origin still needs configuration and verification |
| FH-026 | Scanning | Add file-size and archive-bomb limits | DoS resistance | In progress — Malware rejects files over 32 MiB and limits concurrent scans to two; archive-bomb inspection and disk streaming remain |
| FH-027 | Scanning | Add ClamAV and YARA | Deeper file analysis | Open |
| FH-028 | Intelligence | Add Python threat-intelligence service | Better AI/feed integration | Open |
| FH-029 | CI | Add language matrix and security scans | Prevent regressions | In progress: seven-service build/test matrix, strict API/browser runner, and HIGH/CRITICAL security gate implemented; fixed an invalid job-level runner context; fresh hosted run, finding triage, and required-check configuration remain |
| FH-030 | Testing | Add k6 load tests | Measure performance claims | Open |
| FH-031 | Docs | Add demo video and screenshots | Portfolio presentation | Open |
| FH-032 | Infra | Add Terraform or Kubernetes manifests | Deployment maturity | Open |
| FH-039 | Security | Move the Gemini key out of the query string and tokens out of `localStorage` | Key leakage and XSS token theft | Done in the browser path — Gemini uses `x-goog-api-key`; Web uses an HttpOnly Strict cookie, never stores JWTs in Web storage, clears the cookie and revokes its token ID on logout; API bearer support remains |

| FH-040 | Architecture | Migrate Auth, History, and Notify to Go in parallel with hardening | Align control-plane services with the target Go boundary while keeping the running stack available | Planned â€” contracts first; Auth, then History, then Notify; MongoDB retained until a separate database migration |

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
