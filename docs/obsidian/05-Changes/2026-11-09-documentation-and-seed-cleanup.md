---
date: 2026-11-09
type: change
area: [documentation, cleanup]
status: verified
updated: 2026-11-09
related: [Auth, History, Notify, Web]
tags: [change, docs, cleanup]
---

# Documentation alignment and unused seed cleanup

## What changed

- Record PR #69 merged as `bbb8055`, with all 11 CI jobs and four report-only DevSecOps jobs passing on PR head `9d41051` (run #209).
- Align the README, current architecture diagrams, agent handoff, service notes, API/MFA/environment references, build/test/deploy runbooks and backlog with Go development defaults. Preserve dated audit history and production rollout gates.
- Distinguish the separate frontend TypeScript/MFA/redesign branch from main. Main's browser supports unenrolled accounts only; deploy MFA screens before enrolling browser accounts. Production CD is not configured.
- Remove unused `apps/notify-py/vuln_demo.py`, `apps/notify-py/aws_creds.txt`, `apps/notify-py/config.txt` and `apps/web/Dockerfile.seed`. No active imports, build steps, tests or workflow references use them. Historical docs may still name removed files as audit evidence.
- Retain legacy Auth/History/Notify code, rollback overlays, historical change notes, local settings and generated keys. No application behavior or workflow configuration changes.

## Why

Current documentation still described pre-migration services and pending CI, despite the merged and verified backend. Unused security seed/demo artifacts do not belong in active application directories.

## Verification

- Passed: 93-note wikilink validation, JSON/Canvas parsing, shell/Python syntax, Compose configuration with a disposable placeholder environment, local Markdown link checks, and diff/reference checks.
- `scripts/dev.ps1 test` passed in offline mode with `GATEWAY_URL` pointing to an unused loopback port. Gateway and CORS probes skipped; this is tooling validation, not a live integration pass. The first default run failed because port 8088 serves the separate Node UI preview (HTML at `/auth/me`), rather than the backend gateway. The preview was preserved. Temporary configuration was removed.
- Runtime build/test evidence belongs to PR #69; no new runtime build claim is made for this documentation-only cleanup.

## Follow-ups

- Keep frontend MFA deployment, credential rotation, production HTTPS/private ports/proxy trust, MFA-key backup and broker operations open.
- Removing files does not remove Git history or rotate credentials.
- Define a production deployment target and CD/promotion workflow separately.

## Related notes

- [[2026-11-09-backend-control-plane-pr]]
- [[00-Home]]
- [[Auth]]
- [[History]]
- [[Notify]]
- [[Security-Review]]
- [[Change-Log]]
