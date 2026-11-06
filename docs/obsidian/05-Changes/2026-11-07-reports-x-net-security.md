---
type: change
status: implemented
updated: 2026-11-07
tags: [change, area/security, service/reports, area/ci]
---

# Reports x/net security update

## What changed

Upgrade Reports from golang.org/x/net v0.60.0 to v0.62.0 and align its required crypto, sys, and text modules. Refresh checksums using the upstream Trivy module records; hosted Go builds verify downloaded module contents.

## Why

Post-merge [ForgeHarbor CI run #171](https://github.com/M33HA1/ForgeHarbor/actions/runs/42283258324) failed the security gate on CVE-2026-78661. Its seven service builds, full stack health, API/ownership checks, and browser journeys passed. The [Go advisory](https://pkg.go.dev/vuln/GO-2026-6860) identifies versions before v0.62.0 as affected. Keep the security gate active; no findings are suppressed.

## Verification

- Run #171: one HIGH finding in apps/report-go/go.mod.
- Fresh HIGH/CRITICAL Trivy gate, report-only Trivy, Gitleaks, Semgrep, and SBOM checks passed on PR #40's initial revision.
- Service builds and full stack/API/browser results for the final revision are recorded in [PR #40 checks](https://github.com/M33HA1/ForgeHarbor/pull/40/checks). Require these checks before merge.
- Local Go/Docker tooling unavailable; no local service build claimed.

## Follow-ups

- Require hosted security, service, and integration checks before merging.
- Existing provider configuration and production readiness gates remain in [[Security-Review]] and [[Backlog]].

## Related

- [[Reports]]
- [[2026-11-06-trivy-finding-details]]
