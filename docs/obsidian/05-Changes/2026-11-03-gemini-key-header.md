---
date: 2026-11-03
type: change
area: [phishing, security, testing]
status: complete
related: [[00-Home]], [[Phishing]], [[Security-Review]], [[Test-Matrix]], [[Backlog]]
tags: [change, security, credentials]
---

# Send Gemini API key in a header

## What changed

- Phishing now sends `GEMINI_API_KEY` in Google's `x-goog-api-key` header and omits it from the request URL.
- Added a unit test that constructs the request and verifies there is no query string and the key is in the header.

## Why

Query parameters can be copied into proxy and request logs. Google's REST API supports the dedicated API-key header.

## Verification

| Check | Command | Result |
|---|---|---|
| Unit test | `cargo test --offline` in `apps/phishing-rs` | Pass; request header and URL checked without calling Gemini |
| Release build | `docker compose -f deploy/compose/docker-compose.dev.yml build fh-phishing` | Pass |
| Runtime health and route/auth checks | `scripts/dev.ps1 health` and `scripts/dev.ps1 test` | Pass |

## Follow-ups

- Rotate the configured Gemini key if prior request URLs may have been captured in logs.
- Live Gemini analysis remains unverified until provider credentials are confirmed.
- Browser tokens have moved out of Web storage under [[2026-11-03-http-only-browser-sessions]].

## Related notes

- [[Change-Log]]
- [[Phishing]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[Backlog]]
