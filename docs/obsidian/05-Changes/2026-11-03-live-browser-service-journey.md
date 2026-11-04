---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [web, integration, reports, auth]
tags: [change, browser, integration, ownership]
---

# Verify the real local browser service journey

## What changed

- Added `scripts/check-web-live.js` for a real browser-to-backend journey using disposable accounts. It creates and closes fresh contexts, blocks external/provider requests, and never reads signing keys or prints session tokens.
- Added `scripts/web-live-fixture.py` to preflight local infrastructure, seed uniquely scoped owned scans, render browser phases, and verify removal of test users, scans, reports, notifications, S3 objects, and account rate-limit buckets.
- Extracted the existing local S3 signing/cleanup helper for reuse by browser and report integrity fixtures. Storage defaults match development Compose and do not import live storage credentials from `config/.env`.

## Verification

- Real UI signup created two accounts; login used Auth-issued sessions and returned to the dashboard or requested History page. Logout cleared the session.
- Both owners saw only their own stored scan. Session and saved report restoration survived page refresh.
- A report generated through the UI carried trusted provenance; its downloaded JSON matched the stored malicious scan evidence. Its outbox notification appeared through the real Notify API.
- The second user's browser received 404 for the first user's scan, report metadata/download, and report creation against the foreign scan.
- The initial fixture incorrectly used MongoDB `_id` for ownership. Inspection showed Auth issues its distinct `user_id` in JWT `sub`; correcting the fixture made the real journey pass. The failed run was also cleaned and verified.
- Final lifecycle cleanup verified no scoped users, scans, reports, notifications, or report objects remained. No Gemini/VirusTotal calls were made.
- Existing report integrity/outbox replay coverage was rerun after extracting the storage helper.
- Final route/CORS/tooling checks passed, all eight health probes returned HTTP 200, and fixture syntax plus `git diff --check` passed. No application source/image changes were needed for this verification pass.

## Repeat the journey

1. Run `python scripts/web-live-fixture.py init` and retain its nonsecret run ID.
2. Run `python scripts/web-live-fixture.py render-create <run-id>`. Pass the returned JSON `code` string to Playwright MCP `browser_run_code_unsafe`.
3. Run `python scripts/web-live-fixture.py seed <run-id>`.
4. Run `python scripts/web-live-fixture.py render-verify <run-id>` and execute its returned code through the same Playwright tool.
5. Always run `python scripts/web-live-fixture.py cleanup <run-id>` in the orchestrator's `finally` block, including on browser failure. Cleanup preserves records for retry if outbox/notification draining or object removal fails.

This test writes only local disposable fixtures. Use the deterministic mocked browser suite for UI-only checks. This live journey seeds scan evidence; it does not verify external provider analysis.

## Follow-ups

- Provider-backed scans, CI automation, production deployment configuration, session storage, and infrastructure failure drills remain release gates.

## Related notes

- [[Web]]
- [[Auth]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Test-Matrix]]
- [[Backlog]]
- [[Change-Log]]
