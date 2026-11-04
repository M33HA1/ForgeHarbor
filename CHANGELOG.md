# Changelog

All notable changes to ForgeHarbor are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project does not have a released version yet.

## [Unreleased]

### Added

- Report-only Gitleaks, Semgrep, Trivy, and Syft workflow plus weekly Dependabot updates; Gitleaks is pinned to the verified v2.3.8 commit and the workflow runs on `main` and `devsecops-baseline`.

- Auth rejects passwords found in HIBP Pwned Passwords using a padded five-character SHA-1 k-anonymity query, fails closed with a retryable response, and explains the privacy behavior on signup. See [the Auth screening change note](docs/obsidian/05-Changes/2026-11-03-auth-breached-password-screening.md).

- Auth logout now revokes token IDs in Redis through expiry; Auth and ForwardAuth reject revoked tokens and fail closed if Redis is unavailable. See [session revocation](docs/obsidian/05-Changes/2026-11-03-auth-session-revocation.md).

- Auth normalizes new email identities to lowercase and enforces case-insensitive uniqueness and login lookup in MongoDB.

- Auth `/auth/jwks` now serves a standards-compatible RS256 JWK with modulus, exponent, and a stable thumbprint key ID; issued JWT headers carry that matching `kid`.

- Auth signup now uses an atomic Redis counter limited to 20 valid attempts per trusted client IP per 15 minutes; overload returns 429 with `Retry-After`, and limiter outages fail closed.

- Browser sessions now use an HttpOnly, SameSite=Strict Auth cookie instead of storing JWTs in Web storage. Auth, the edge gate, and all protected services accept the cookie; logout clears it, and bearer clients remain supported.

- Auth now accepts forwarded login IPs only from its explicit peer allowlist; the dev stack isolates Traefik/Auth on a fixed edge network and includes a loopback-only proxy profile for real IP-threshold regression coverage.

- Auth now validates new email/password input, caps JSON bodies at 8 KiB, and runs Argon2 through a two-slot blocking pool that rejects overload with a retryable 503; local API and browser regression checks cover the policy and Unicode lengths.

- GitHub Actions language build/test matrix, strict stack/API/browser integration entry points, and a HIGH/CRITICAL dependency, secret, and configuration security gate. Hosted execution remains pending.

- Real local browser signup/login, History ownership, report generation/download, outbox notification, refresh, and cross-user denial checks with verified disposable fixture cleanup.

- Roadmap FH-040 for parallel Go migrations of Auth, History, and Notify, with contract-first parity gates and staged cutover while hardening continues.
- `scripts/setup-jwt-keys.mjs` for clean-clone RS256 key setup; it generates missing keys, validates existing key pairs, and refuses to overwrite mismatches.
- Root `AGENTS.md` with build commands, language boundaries, security rules, and definition of done.
- Repo-local Obsidian knowledge base under `docs/obsidian/`, including architecture, service, runbook, decision, security, testing, and reference notes.
- Mermaid architecture and data-flow diagrams plus Obsidian Canvas maps.
- Project-local `forgeharbor-*` skills for coding, build, debug, architecture, change tracking, roadmap, security, Obsidian, service scaffolding, release, and MCP.
- `forgeharbor-context` skill to restore and maintain project state across sessions.
- Codex project MCP configuration includes Context7, Playwright, GitHub, Obsidian, source filesystem, and read-only MongoDB; the OpenCode config remains during transition.
- Project-scoped source filesystem MCP for `apps/`, `deploy/`, `scripts/`, and `pkg/`.
- PowerShell and POSIX build/status scripts.
- `.tool-versions` for reproducible local toolchains.
- `config/.env.example` with placeholders only.
- Architecture review note with eight findings, a target architecture, and three open decisions.
- Gateway route-contract test (`scripts/check-routes.mjs`).
- ADR-0004 for the gateway prefix contract.

### Changed

- Malware now admits at most two file scans at once and returns 503 with `Retry-After` when capacity is full, bounding simultaneous 32 MiB upload buffers while VirusTotal processes scans. See [the Malware scan-capacity change](docs/obsidian/05-Changes/2026-11-05-malware-scan-capacity.md).

- Reports retries RustFS bucket discovery/creation for up to 30 seconds at startup, absorbing brief storage readiness delays and honoring cancellation. See [the Reports bucket startup change](docs/obsidian/05-Changes/2026-11-05-reports-bucket-startup-retry.md).

- Reports downloads now require `stored-scan-v1` provenance; legacy or unknown artifacts return 410 with regeneration guidance. The Web History view surfaces that recovery message. See [the legacy report provenance change](docs/obsidian/05-Changes/2026-11-04-legacy-report-download-provenance.md).

- Fixed the mocked browser session fixture to establish and clear HttpOnly cookies in the isolated Playwright context; all seven UI scenarios pass.

- Web protected pages now use `/app/...` to avoid the History API collision; login return/session cleanup, accessible controls, pending submissions, and malformed scan handling are covered by a seven-scenario browser regression suite.

- Reports now commits notification intent with metadata and relays pending events with mandatory routing and publisher confirmations; broker failure no longer blocks the report HTTP startup or loses publication intent between separate writes.

- Reports readiness now checks MongoDB and the RustFS bucket concurrently, returns retryable `503` when either dependency is unavailable, and keeps dependency error details out of the public health response.

- Reports emits versioned persistent notification events; Notify adds idempotent storage, validated ownership, confirmed retry/dead-letter handoffs, bounded storage retries, reconnect/backoff, and dependency readiness checks.

- Auth login now uses Redis-backed atomic per-account and per-IP rate limits (5 and 60 attempts per 15 minutes), fails closed when Redis is unavailable, and reports throttling through 429 plus `Retry-After`; integration coverage exercises both limits.
- Argon2 hashing and verification run outside asynchronous HTTP workers with bounded concurrency; canceled requests retain their work slot until hashing actually finishes.
- History report actions now restore owner-scoped report IDs and show success/failure feedback with download access from scan rows.
- Added regression fixtures for concurrent Auth signup, History/Reports ownership and malformed IDs, and provider-free Phishing/Malware JWT gates: [[2026-11-03-scanner-and-owner-regression-coverage]].
- Phishing and Malware scan records now persist `risk_level`; History supports canonical and legacy high/low filters, and the History page exposes type/risk selectors. The History integration check covers owner isolation for list and detail routes.
- Malware rejects uploads over 32 MiB before extending the in-memory file buffer; boundary unit tests cover the exact limit and overflow cases.
- Auth, Phishing, and Malware now allow only configured exact browser origins and restrict methods/headers; the example config lists local development origins.
- Phishing sends the Gemini API key in `x-goog-api-key` instead of the URL query string; a unit test checks the request shape.
- Auth no longer logs signup/login email addresses or the MongoDB URI, ensures unique account emails, and maps duplicate-key races to 409; added an integration check for signup, password hashing, login, `/me`, and forged-token rejection.
- Refreshed the web scanner dashboard with a task-first layout, quieter dark surfaces, teal focus accents, and clearer URL/file analysis controls.
- `.gitignore` now excludes Obsidian workspace state, installed vault plugins, and Superpowers scratch files.
- The Obsidian vault is the project's living knowledge base; `00-Home.md` is the dashboard.
- Updated History, Reports, security, and test notes to match implemented pagination, JSON validation, and recorded verification evidence.
- Rewrote the README setup, ports, and route guidance to match the current Compose stack and dev scripts (FH-019).
- Architecture and routing notes now document the History, Reports, and Notify prefix conflicts and the inconsistent gateway contract.
- Auth, Phishing, and Malware build on pinned stable Rust 1.90.0 instead of nightly.
- Every service registers its full public prefix; the gateway no longer strips it (D1=B).
- Health probes in the dev scripts use the prefixed paths.
- Replaced the unavailable MinIO development image with the pinned native AMD64 RustFS image; Reports now waits for S3 storage health before starting.
- Web now builds on Node 22.12; local provider values come from `env_file` instead of blank Compose overrides.
- History now uses Node 22 and deterministic `npm ci` installs; Web uses `npm ci`, removes unused Firebase, and upgrades React Router to v7. Both npm dependency trees audit with zero vulnerabilities.
- Reports and Notify now use the same configured notifications queue; report notifications carry the authenticated owner.
- Fixed report downloads to copy and close the RustFS object body once instead of continuing the Gin stream after EOF.
- Verified authenticated report creation, metadata retrieval, download contents, and cross-user denial through the gateway with disposable accounts; test records and object were removed.

### Security

- Reports now exports evidence from an owned stored scan, ignores caller-supplied report content, records new-artifact provenance, and bounds creation payloads; Web sends only scan IDs.

- Kept edge authentication registered independently of Auth container availability and verified rejection plus automatic recovery in a controlled local outage drill.

- Added a shared Traefik ForwardAuth JWT gate for protected service routes with exact health and CORS preflight exemptions; Auth now rejects empty token subjects. Service ownership checks remain enforced.

- Documented the current auth, ownership, routing, and secret-management findings in `docs/obsidian/07-Security/Security-Review.md`.
- The Auth image no longer copies `config`; Phishing and Malware copy only `jwt-public.pem`.
- Added `.dockerignore` to the Rust apps so `.env`, the private key, and `target` stay out of build contexts.
- History, Reports, and Notify require RS256 JWTs and scope reads to the verified subject; Auth public keys are mounted read-only.
- Bound published development app and infrastructure ports to `127.0.0.1`.
- Added `.dockerignore` coverage for every app build context and removed Notify's unused PyYAML dependency.

### Fixed

- Reports list and metadata reads now have five-second deadlines; report downloads use a twenty-second end-to-end database/object deadline. Timeout and infrastructure errors return generic 503 responses, while missing or foreign reports remain 404.
- Reports now verifies ambiguous MongoDB insert outcomes before cleanup and attempts a bounded RustFS delete only when metadata is confirmed absent; cleanup failure retains generic logging.
- Auth, Phishing, and Malware images build; the `E0391` nightly async-drop cycle is gone.
- The Docker cache no longer ships a dummy binary when the real source is copied after the dependency build.
- History, Reports, and Notify data routes no longer 404 through the gateway because of a prefix mismatch.
- Notify now exposes `/notify`, which is the path the frontend already calls.
- History list/detail routes enforce ownership and reject malformed cursors/IDs; History and Notify now have valid-token cross-user integration checks; Reports create, read, and download routes enforce ownership.
- File scan results now map VirusTotal's nested response; unknown confidence is not replaced with a fabricated score. Malware upload buffering now has a 32 MiB cap.
- Expanded gateway checks to assert anonymous and forged-token rejection for History, Reports, and Notify.
- Fixed PowerShell health/status argument forwarding; `dev.ps1 health` now probes all services successfully.
- Restricted Compose host bindings to loopback and switched the PowerShell endpoint probe to `curl.exe` so it works with those bindings.
- OpenCode MCP connections were verified before the Codex migration: Obsidian uses a local filesystem server over `docs/obsidian`, and MongoDB uses the globally installed `mongodb-mcp-server` binary.

### Known issues

- The local provider keys were not inspected or validated; users must ensure valid credentials exist in `config/.env`.
- Centralized edge auth, production exposure policy, report ownership backfill, and valid-token cross-user integration coverage remain open.
- Scans still run synchronously; a fully versioned shared result schema and query-index policy remain open.
- `config/.env` contains live-looking keys and must be rotated before publication.

### Documentation

- See `docs/obsidian/05-Changes/2026-11-03-project-context-skill-and-doc-alignment.md` for the context skill, current-state note corrections, and README update.
- See `docs/obsidian/05-Changes/2026-11-02-initial-audit.md` for the audit record.
- See `docs/obsidian/05-Changes/2026-11-02-architecture-review.md` for the review.
- See `docs/obsidian/05-Changes/2026-11-02-phase-0-auth-build-and-routes.md` for the build and routing change.
- See `docs/obsidian/01-Architecture/Architecture-Review.md` for the findings and target shape.
- See `docs/obsidian/05-Changes/2026-11-02-project-operating-system.md` for the tooling change.
- See `docs/obsidian/05-Changes/2026-11-02-codex-migration.md` for the Codex setup migration.
- See `docs/obsidian/06-Roadmap/Roadmap.md` for the Phase 0–4 plan.
