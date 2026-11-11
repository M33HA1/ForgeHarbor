---
date: 2026-11-11
type: change
status: locally-verified
updated: 2026-11-11
area: [web, auth, ci, docs]
related: [Web, Auth, AWS-Deployment]
tags: [change, frontend, mfa, testing, demo]
---

# Resume-demo integration and interface finalisation

## Scope

Integrate the existing TypeScript/MFA frontend with merged main; retain backend contracts, auth/ownership, report provenance, bounded inputs and the rollback overlay. Rework the landing/workspace hierarchy, fix fixture races, update CI action pins, add MFA to the required integration job and plan the AWS resume/demo deployment. Do not label future orchestration, PostgreSQL, production HA or unverified providers complete.

## UI research and design rationale

Current-run screenshots showed a large dense assessment panel competing with entry actions, plain sign-in styling, and weak distinction between public and signed-in navigation. The chosen direction uses Manrope Variable bundled locally; white #ffffff and light #f6f8f8 surfaces; ink #1c3035; workspace #173239; accent #087f75; borders #e0e7e7. Public content is centered with a contained product evidence preview; the functional workspace is left-aligned with persistent navigation. Borders group related evidence, not identical decorative cards. No invented customer/accuracy/uptime numbers, decorative animation or AI imagery.

- [Manus](https://manus.im/) was inspected live for focused task-entry hierarchy; its branding and interaction purpose are not copied.
- [Watermelon](https://ui.watermelon.sh/) and its [public source](https://github.com/WatermelonCorp/watermelon-platform) informed composition/reference selection; no unreviewed registry code was installed.
- [Cult UI](https://www.cult-ui.com/) was reviewed for restrained interactive component ideas. The existing application components remain the implementation base.
- [Refero](https://refero.design/) was checked as a reference index; readable page content was unavailable, so no specific private design is claimed as inspected.

## Behavior and fixes

- Keep API contracts, cookie sessions, ownership and honest evidence states. Integrate enrollment, authenticator/recovery login and factor disable without browser credential storage.
- Unload the old fixture document before changing its cookies. Old pending History/report work must not inherit the next scenario's authentication.
- Drain active MFA Auth proxy route handlers before closing their request context; this addresses the reproduced disposed-response failure.
- Add an accessible unknown-page recovery route and readable report-action feedback.
- Update immutable action pins from Dependabot PRs #41/#42/#44. Real MFA now runs inside the existing required full-stack integration job after its disposable stack is stopped.

## Verification

- Frontend strict checking and production build passed; npm audit reported zero vulnerabilities.
- Nine browser groups passed three consecutive runs; ten groups passed after adding unknown-page recovery. Layouts checked at 320/768/1440 pixels.
- Real MongoDB/Redis/RabbitMQ Go contracts passed with the race detector.
- Real MFA verification passed five end-to-end groups after reproducing and fixing the disposed-response teardown race; zero browser runtime errors.
- Repository baseline passed Compose/configuration, source syntax and internal-link checks; live gateway checks were skipped when the disposable stack was stopped. [PR #71](https://github.com/M33HA1/ForgeHarbor/pull/71) is the canonical hosted-check record; merge requires all 11 checks under the active main ruleset.
- Axe WCAG A/AA checks found no violation groups in the tested public/account/workspace states at 320/768/1440 pixels; this is automated coverage, not full conformance certification.
- Coordinated Vite 8/React plugin 6/Tailwind 4 migration builds and passes the ten UI groups. Remove unused floating decoration and v3 configuration; bundle the font locally.
- Reports AWS SDK dependencies updated together; Go route tests pass. Remove the redundant legacy History dotenv type stub; History builds.
- Select the AWS-LC cryptography provider explicitly for JWT 11 in all Rust services; retain RS256 validation and test the rollback path. Replace unbounded scanner requirements with compatible version ranges. Rust Auth passed 25 tests. The Phishing request-header test reproduced missing TLS-provider initialization after the Reqwest upgrade; the shared Gemini client now explicitly initializes Ring and bounds requests to 30 seconds, and that test passes. Malware passed all three upload/concurrency tests. The final dependency set also passed all five real MFA groups with zero runtime errors and automatic disposable-state cleanup. Hosted full-stack verification is tracked in PR #71.
- Full-severity Trivy artifact review found 11 medium, 3 low and 1 unknown-severity dependency alerts beyond the passing HIGH/CRITICAL gate. Update Rust bytes/rand/serde_with/time/OpenSSL and Reports quic-go/x/crypto to fixed versions; the x/crypto fix is the exact advisory-listed pseudo-version because no newer tagged release was available. Fresh scanner and regression results are recorded on PR #71.
- Inspection of the apparently green Semgrep job found its legacy action rejected the registry severity format and never created SARIF. Replace it with pinned Semgrep CLI 1.185.0 and the explicit `p/default` ruleset (auto requires metrics), disable metrics, fail on scan/config errors and preserve the actual SARIF artifact; do not treat the old job badge as a completed scan.
- The repaired Semgrep scanner ran 610 rules on 253 files. Review all 16 audit matches in [[Security-Review]]; retain them visibly without suppressions. No exposed application vulnerability was identified in those exact reviewed matches.
- Local screenshots are ignored artifacts under `.playwright-mcp/final-review`; historical screenshot evidence is not substituted for this run.

## Remaining external and future work

Fresh non-production provider keys and provider verification; credential rotation; AWS account/domain/region/budget confirmation and provisioning. [[AWS-Deployment]] supersedes the earlier $500/month managed production proposal because the user clarified this is a resume project. No cloud resources or schedules were created.

- [[Web]]
- [[Auth]]
- [[Security-Review]]
- [[AWS-Deployment]]
- [[Backlog]]
- [[Change-Log]]
