---
date: 2026-11-09
type: change
area: [backend, auth, history, notify, ci]
status: in-review
updated: 2026-11-09
related: [Auth, History, Notify, ADR-0002-go-control-plane]
tags: [change, backend, go, mfa, ci]
---

# Backend control plane and MFA API PR

## Scope

- Add independent Go Auth, History and Notify processes in one shared module and select them in development Compose. Preserve existing public paths, MongoDB identities, RS256/JWKS/cookie contracts, owner scoping and event compatibility.
- Preserve bounded password work, HIBP screening, Redis throttles/revocation and trusted-peer handling. Add backend TOTP enrollment/verification/disable APIs, owner-bound AES-GCM seed encryption, hashed single-use recovery codes, bounded Redis challenges and atomic proof consumption.
- Rotate the auth session version on factor changes. The updated Rust rollback checks session versions and refuses password-only login for enrolled accounts.
- Add non-root runtime images, a legacy runtime overlay, focused Go CI builds, and a race-enabled MongoDB/Redis/RabbitMQ contract job. Generate the ignored MFA runtime key with restricted hosted-runner group access.
- Keep all frontend files unchanged. The browser on main supports unenrolled accounts only; deploy its separate MFA screens before enrolling browser accounts. API clients can complete the MFA flow directly.

## Verification

Passed locally on this isolated branch: `go mod tidy -diff`, `go test ./...`, `go vet -tags=integration ./...`, the race-enabled MongoDB/Redis/RabbitMQ parity suite, and the 92-note link check. Hosted checks and their logs are authoritative for this PR revision. Existing full-stack/API/browser CI remains enabled with the unchanged frontend. Security scanning remains a gate; no findings are suppressed by this change.

## Rollout and limitations

- API and data compatibility does not establish production readiness. TLS/private backend ports, provider credentials and MFA encryption-key custody remain deployment gates.
- Keep the MFA encryption key separate from signing-key rotation. Restore Go Auth to support enrolled login after a legacy rollback.
- This repository defines CI and a report-only DevSecOps workflow. It has no production deployment/promotion workflow or configured deployment target; passing CI is not evidence of CD or production deployment.
- Frontend TypeScript migration, MFA screens and visual changes remain on codex/language-revamp for a separate PR.

## Related notes

- [[Auth]]
- [[History]]
- [[Notify]]
- [[ADR-0001-polyglot-boundaries]]
- [[ADR-0002-go-control-plane]]
- [[Security-Review]]
- [[Change-Log]]
