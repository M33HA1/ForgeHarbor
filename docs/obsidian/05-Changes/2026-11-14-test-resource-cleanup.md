---
date: 2026-11-14
type: change
area: [testing, docker, auth]
status: locally-verified
updated: 2026-11-14
related: [Auth, Test]
tags: [change, testing, docker]
---

# Isolated test resource cleanup

## What changed

- MFA and Go parity runners remove their exact per-run application image tags after successful Compose teardown. A shared helper validates the generated project name and service suffix allowlist; it never uses global prune or forced removal.
- A teardown failure fails the suite. MFA preserves its temporary configuration/keys for scoped recovery; both runners restore temporary environment variables even when cleanup throws.
- Regression checks cover MFA/parity allowlists, unrelated images, absent images, invalid project names and Docker inventory/removal failures. Both real runners execute these checks before creating fixtures.

## Why

Docker inspection found no MFA containers, but 33 uniquely named MFA images and seven parity images remained from previous test runs. Existing `compose down --volumes --remove-orphans` cleaned runtime resources without removing those image tags. The 40 unused per-run images and two unreferenced historical MFA image tags were removed individually after checking container references and current script usage. Development containers and their attached MongoDB/Redis/RabbitMQ/RustFS volumes were preserved.

## Verification

| Check | Evidence | Result |
|---|---|---|
| Cleanup safety regression | `scripts/ci/test-resources.test.ps1` | Pass |
| PowerShell syntax | Parse both runners and both new helper/test files | Pass |
| Real MFA browser journey | `scripts/check-mfa.ps1` with local Playwright | Five groups pass, zero runtime errors; run's three image tags removed |
| Real Go parity | `scripts/check-go-parity.ps1` | Race-enabled store/API contracts pass; run's contracts image tag removed |
| Documentation | `node scripts/check-links.mjs`; `git diff --check` | Pass; 99 notes |
| Runtime cleanup | Docker project/container/image inventory after MFA | No MFA project, containers or generated tags; temporary directory removed |

The first separately invoked proxy regression was run in the restricted sandbox and could not use loopback networking. Its test processes were stopped; the real elevated MFA runner repeated the proxy regression successfully. No test assertion or gateway behavior was weakened.

## Follow-ups

- Hosted exact-head required checks must pass before merge; PR checks hold hosted evidence.
- Forced process termination or a Docker outage can still leave resources. Recover only the identified fixture project; retain shared development data and reusable build caches.
- AWS preparation remains the next implementation workstream under [[AWS-Deployment]]. No cloud resources changed.

## Related notes

- [[Auth]]
- [[Test]]
- [[00-Home]]
- [[Change-Log]]
