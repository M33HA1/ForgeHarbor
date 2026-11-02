---
date: 2026-11-02
type: change
area: [audit, security, build, routing, frontend]
status: complete
related: ["[[Auth]]", "[[History]]", "[[Reports]]", "[[Notify]]", "[[Web]]", "[[Security-Review]]", "[[Roadmap]]"]
tags: [change, audit, security]
---

# Initial functional and security audit

## What changed

No application code was changed. This note records the initial audit that established the project's Phase 0 backlog and the operating-system baseline.

## Scope

- Compose startup and image builds
- Traefik routing
- Auth, History, Reports, and Notify behavior
- Frontend API calls and result rendering
- Configuration and documentation drift

## Findings

### Build and startup

| Finding | Evidence | Impact |
|---|---|---|
| Auth fails to compile | `mongodb-3.2.5` async-drop cycle (`E0391`) | Login and protected flows unavailable |
| Web image uses Node 14 | Vite 7 requires Node 20.19+ or 22.12+ | Web image cannot build |
| MinIO image pull fails | `pull access denied for minio/minio` | Reports cannot store objects |
| Traefik Docker provider fails | Docker client/server host error | No gateway routes load |
| Compose passes blank API keys | `GEMINI_API_KEY` and `VIRUSTOTAL_API_KEY` warnings | Scan services start without usable providers |

### Routing

- The gateway is mapped to host port 8088, but the README says port 80.
- Traefik strips `/reports`, while the Report service registers `/reports` and `/reports/:id`.
- The frontend calls `/notify`, but the Notify service exposes `/notifications`.
- Every service is published directly on the host, bypassing the gateway.

### Security and data access

| Finding | Evidence | Impact |
|---|---|---|
| History accepts anonymous reads | `GET /history` without a token returned scans from multiple users | Data disclosure |
| History accepts forged tokens | An unsigned token with `sub: user-a` was accepted when no public key was configured | Identity spoofing |
| History has an IDOR | `GET /history/:id` returned another user's scan | Unauthorized object access |
| Report routes are unauthenticated | No JWT middleware in the Go routes | Anyone can create, read, or download reports |
| Notify is unauthenticated | `GET /notifications` returned another user's notification | Data disclosure |
| History filters are broken | `?type=url` and `?risk=high` returned empty results | Incorrect product behavior |
| Invalid IDs return 500 | Malformed ObjectId reached the database call | Error handling and log noise |

### Frontend

- File scans render as clean because `Result.jsx` reads top-level `is_malicious`/`is_phishing`, while the API returns nested `status` and `result`.
- Confidence fallback `|| 85` converts a real zero into 85.
- History ignores report IDs and malware status.
- Notification calls target the wrong path.

### Documentation and configuration

- README setup paths and ports are stale.
- `config/.env` contains live-looking keys and must be rotated before publication.
- JWT keys and `.env` are ignored, so a clean clone cannot start without a setup step.
- `dist/`, `target/`, and JWT keys are ignored; this is correct for generated files but must be paired with a documented bootstrap.

## Verification

This audit used manual container probes and API calls against the local stack. The security tests used disposable records. No secret values are reproduced in this note.

## Follow-ups

1. Fix the auth build and add a compile smoke test.
2. Fix the web Dockerfile and build the frontend.
3. Fix Traefik routing and remove the report prefix conflict.
4. Enforce JWT verification and ownership checks in History, Reports, and Notify.
5. Fix the frontend result mapping and notification path.
6. Rotate the exposed-looking keys and clean up test records.
7. Correct the README and add a clean-clone smoke test.

Track these in [[Backlog]] and [[Roadmap]].

## Related notes

- [[Change-Log]]
- [[Security-Review]]
- [[Threat-Model]]
- [[Test-Matrix]]
- [[ADR-0001-polyglot-boundaries]]
