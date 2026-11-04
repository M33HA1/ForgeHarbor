---
date: 2026-11-03
updated: 2026-11-03
type: change
status: partially-verified
area: [ci, testing, security, web]
tags: [change, ci, integration, security]
---

# Add the CI matrix and strict integration entry points

## What changed

- Added `.github/workflows/ci.yml` for pull requests, pushes to main, and manual dispatch. Seven matrix entries build/test Rust Auth/Phishing/Malware, TypeScript History/Web, Go Reports, and Python Notify with bounded concurrency and timeouts.
- Added a separate Trivy filesystem gate for HIGH/CRITICAL dependency vulnerabilities, secrets, and configuration findings. Findings fail the job, including unfixed vulnerabilities. The summary prints finding IDs/counts without secret matches or source snippets; raw reports are not uploaded.
- Pinned every referenced Action to a commit hash, disabled checkout credential persistence, and granted only `contents: read`.
- Added exclusive CI environment preparation: it refuses existing configuration, generates an ephemeral JWT secret, disables external provider keys, and uses only development storage settings. JWT signing keys are generated on the runner. No GitHub production secrets are required.
- Added `scripts/ci/integration.sh` for health, tooling, routes/CORS, edge/scanner authentication, Auth flow/rate limits, History filters/ownership, report ownership/integrity/outbox, and Notify ownership/delivery checks.
- Added `scripts/ci/browser.mjs` to execute the same mocked and real local browser suites headlessly with fixture cleanup in `finally`. An optional installed browser channel supports local use; hosted CI installs Chromium through Playwright.
- Route/CORS checks now fail on unreachable services when `FH_REQUIRE_RUNNING=1` or `CI=true`. Offline developer invocations retain their skip behavior.
- Fixed POSIX helper dispatch to invoke `status.sh` through Bash, since tracked shell files lack executable permission. Both helpers syntax-check the new integration script, and the POSIX baseline now includes CORS.
- The hosted job builds images sequentially, waits for health, then runs the strict API and browser suites. Its final cleanup removes only its ephemeral runner services/volumes; reusable local scripts preserve stack data.

## Why

FH-029 had no automated language or security gate. Existing route checks could report a successful skip when the intended integration stack was unavailable. The new entry points make local regression evidence repeatable and give hosted CI explicit failures instead of silent omissions.

## Verification

| Check | Result |
|---|---|
| Workflow YAML, seven matrix entries, read-only token, immutable Action refs, failure/time-limit settings | Passed local structural assertions |
| CI environment generation and existing-file refusal | Passed in an isolated temporary repository copy; local configuration untouched |
| Scanner summary | Synthetic secret-match text absent from output; finding ID/count retained |
| Unreachable route/CORS services in strict mode | Both checks returned failure |
| `bash scripts/ci/integration.sh` with local Python override | Passed health, tooling, routes/CORS, edge/scanner gates, Auth credential/signup/rate-limit checks, History, Reports, and Notify integration checks |
| Headless `node scripts/ci/browser.mjs` | Passed seven mocked scenarios and both real browser phases using Playwright 1.64.1 and installed Chrome |
| Live browser fixture cleanup | Verified for run `ce7253c45df94081856c6e95b1af6ab4` |
| Hosted GitHub workflow, fresh runner images, bundled Chromium, Trivy scan | Not executed; no hosted green result or clean scan claimed |

Local headless startup initially lacked the version-matched Playwright Chromium binary. The runner now permits an existing local Chrome/Edge channel. Hosted CI installs its own matching Chromium before running tests.

## Follow-ups

- Run the workflow on GitHub, triage actual HIGH/CRITICAL findings, and configure required checks on the protected branch. FH-029 remains in progress.
- Verify hosted Linux dependency installation/build duration and bundled Chromium results; local Windows/Chrome coverage does not establish these.
- Provider-backed scans, production TLS/exposure/proxy trust, credential rotation, session storage, and messaging failure drills remain release gates.

## Pin sources

- [Checkout v4.3.1 commit](https://github.com/actions/checkout/commit/34e114876b0b11c390a56381ad16ebd13914f8d5)
- [Setup Node v4.4.0 commit](https://github.com/actions/setup-node/commit/49933ea5288caeca8642d1e84afbd3f7d6820020)
- [Trivy Action v0.35.0](https://github.com/aquasecurity/trivy-action/releases/tag/v0.35.0)
- [Trivy v0.76.1](https://github.com/aquasecurity/trivy/releases/tag/v0.76.1)
- [Playwright v1.64.1](https://github.com/microsoft/playwright/releases/tag/v1.64.1)

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Backlog]]
- [[Test]]
- [[Test-Matrix]]
- [[Web]]
- [[Auth]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Security-Review]]
