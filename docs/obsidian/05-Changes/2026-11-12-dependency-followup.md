---
date: 2026-11-12
type: change
area: [web, auth, reports, dependencies, testing, docs]
status: locally-verified
updated: 2026-11-12
related: [Web, Reports, AWS-Deployment]
tags: [change, dependencies, verification]
---

# Dependency patch follow-up after demo integration

## What changed

Pair Tailwind and its Vite compiler at 4.3.5, update Lucide to 1.70.0, and update Reports AWS SDK core/config/credentials/S3 to 1.47.8/1.33.16/1.20.16/1.114.9 together. Preserve the patched quic-go and x/crypto versions. Correct Web's language inventory and record merged-main verification.

## Why

PR #71 merged the redesigned TypeScript/MFA frontend and coordinated dependency/security fixes as `868c51c`. Its merged-main CI and security workflows passed. Dependabot closed 22 superseded PRs but renewed #63–#68 with newer patches, so their old PR numbers no longer identify the updates incorporated in #71. This batch validates those six current proposals together. Do not close them based only on their old titles or merge individual stale bases.

## MFA fixture repair

The first hosted batch failed in the browser Auth interception bridge with `route.fulfill: Route is already handled!` after the gateway/API and initial browser checks passed. Replace the asynchronous Playwright Auth proxy with a disposable Node HTTP gateway bound to loopback. It forwards real Auth/rollback/Web traffic and preserves separate Set-Cookie headers; unrelated service responses remain explicit fixtures. Web moves to fixture port 8182 while the browser keeps origin localhost:8088. External browser traffic remains blocked.

Probe the real fixture listeners before browser assertions because Compose only waits for the running state of containers without health checks. A cancellation regression checks that an interrupted request does not break later calls, cookies retain their attributes, rollback routing preserves bodies, and data fixtures remain scoped. Test failures are not retried or ignored. This gateway is test infrastructure, not a production proxy or auth bypass.

## Verification

- Strict Web production build passed; npm audit reported zero vulnerabilities.
- All ten deterministic browser groups passed at 320/768/1440 pixels; the tested public/account/workspace states reported no axe A/AA violation groups. Fixtures made no backend writes or provider calls. This is automated coverage, not accessibility certification.
- The fixture-gateway cancellation/cookie regression passed; two consecutive complete local MFA runs passed all five groups with zero browser runtime errors and disposable-state cleanup.
- Reports Go route tests passed; the module graph retains the prior security patches.
- Hosted checks for this patch revision are required before merge; its PR checks are the canonical result. No branch-protection bypass or new suppression is introduced.
- [Merged-main CI for PR #71](https://github.com/M33HA1/ForgeHarbor/actions/runs/42985159308) and [security workflow](https://github.com/M33HA1/ForgeHarbor/actions/runs/42985159338) passed before this follow-up.

## Follow-ups

Close the six renewed PRs only after the combined patch merges with all required checks passing. [[AWS-Deployment]] remains a plan; provider verification, credential rotation and cloud provisioning remain external gates. Future dependency releases are separate work rather than an unbounded completion target.

- [[Web]]
- [[Reports]]
- [[2026-11-11-demo-finalisation]]
- [[Security-Review]]
- [[Change-Log]]
