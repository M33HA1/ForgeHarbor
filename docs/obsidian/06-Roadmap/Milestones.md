---
type: milestones
status: active
updated: 2026-11-02
tags: [roadmap, milestones]
---

# Milestones

## M0 — Local stack starts

**Outcome:** A clean clone can build and start the documented local stack.

Acceptance criteria:

- [ ] `docker compose config --quiet` passes.
- [ ] All seven service images build.
- [ ] All seven services and Traefik are running.
- [ ] Every `/health` endpoint returns success through the gateway.
- [ ] Every documented data route returns its expected status through the gateway, not 404.
- [ ] README commands match the real ports and paths.

## M1 — Secure core

**Outcome:** Authentication and ownership are enforced consistently.

Acceptance criteria:

- [ ] History rejects anonymous and forged-token requests.
- [ ] History list and detail are scoped to the caller.
- [ ] Reports require auth and enforce report ownership.
- [ ] Notify requires auth and enforces notification ownership.
- [ ] JWT validation happens once at the edge; services receive a trusted identity.
- [ ] No `.env` or private key is present in any built image.
- [ ] Malformed IDs return 400.
- [ ] The security regression tests in [[Test-Matrix]] pass.

## M2 — Async scan flow

**Outcome:** Scans are queued, retried, and observable.

Acceptance criteria:

- [ ] A scan request creates a durable job.
- [ ] The orchestrator enforces timeouts, retries, and idempotency.
- [ ] A `scan.completed` event reaches History, Reports, and Notify.
- [ ] Events use one versioned envelope and a dead-letter queue.
- [ ] The UI shows queued, running, failed, and complete states.
- [ ] Dead-letter handling is documented and tested.

## M3 — Intelligence and hardening

**Outcome:** Enrichment is resilient and the platform is observable.

Acceptance criteria:

- [ ] Python threat-intelligence service normalizes provider results.
- [ ] Caching and rate limits are in place.
- [ ] ClamAV and YARA are part of the file-analysis path.
- [ ] OpenTelemetry traces cross service boundaries.
- [ ] CI runs tests and security scans for all four languages.
- [ ] k6 load test results are documented.

## M4 — Portfolio ready

**Outcome:** The project is easy to run, explain, and evaluate.

Acceptance criteria:

- [ ] One-command demo works from a clean clone.
- [ ] README has an architecture diagram and language rationale.
- [ ] ADRs are linked from the README.
- [ ] Demo video and screenshots exist.
- [ ] Resume bullets and interview story are written.
- [ ] The "what I would consolidate in production" section is present.

## Related notes

- [[Roadmap]]
- [[Backlog]]
- [[Change-Log]]
- [[00-Home]]
