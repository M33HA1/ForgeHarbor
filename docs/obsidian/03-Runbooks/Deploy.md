---
type: runbook
status: draft
updated: 2026-11-09
tags: [runbook, deploy]
---

# Deploy

## When to use

Use this runbook for a local demo or when preparing a production-like deployment. The repository is not production-ready yet.

## Current deployment model

- Docker Compose for local development.
- Traefik as the edge proxy.
- MongoDB, Redis, RabbitMQ, and RustFS as stateful dependencies.
- No TLS termination, secrets manager, backup policy, or infrastructure-as-code yet.

CI builds and tests changes but does not deploy them. PR #69 passed [CI run #209](https://github.com/M33HA1/ForgeHarbor/actions/runs/42642752091) on `9d41051` and merged as `bbb8055`; subsequent revisions need their own checks. No production CD/promotion workflow or target exists.

For the resume/demo scope, use [[AWS-Deployment]]. No cloud target or automatic CD is implemented yet.

## Pre-deploy checklist

- [ ] All seven services build.
- [ ] `docker compose config --quiet` passes.
- [ ] Every service health endpoint returns success.
- [ ] Auth signup, login, and `/me` work through the gateway.
- [ ] MFA encryption key is backed up independently of signing keys; restore is rehearsed.
- [ ] Deploy separate frontend MFA screens before enrolling browser accounts; main currently supports unenrolled browser login only.
- [ ] Auth can reach `https://api.pwnedpasswords.com`; known compromised passwords are rejected and checker outages return retryable 503.
- [ ] History is scoped to the authenticated user.
- [ ] Reports require authentication and enforce ownership.
- [ ] Notifications require authentication and enforce ownership.
- [ ] No secrets, JWTs, or private keys are in git.
- [ ] `CHANGELOG.md` and the relevant change note are updated.
- [ ] `docs/obsidian/00-Home.md` reflects the current state.

## Local demo sequence

```powershell
.\scripts\dev.ps1 build
.\scripts\dev.ps1 up
.\scripts\dev.ps1 health
```

Open `http://localhost:8088` and run the critical path:

1. Sign up.
2. Log in.
3. Scan a URL.
4. Scan a file.
5. Open history.
6. Create and download a report.
7. Open notifications.

## Production gaps

| Gap | Risk | Next step |
|---|---|---|
| No production CD/promotion workflow | No automated production release or rollback | Define the target, environments, deployment credentials and release gates |
| No TLS | Credentials and tokens in clear text | Terminate TLS at Traefik or a load balancer |
| Secrets in a local `.env` | Leakage and rotation difficulty | Use a secrets manager |
| No backups | Data loss | Add MongoDB, RustFS and MFA encryption-key backup/restore procedures |
| No resource limits | Noisy-neighbor failures | Add Compose limits, then Kubernetes requests/limits |
| No observability | Slow diagnosis | Add OpenTelemetry and structured logs |
| No migrations | Schema drift | Add versioned database migrations |
| No infrastructure-as-code | Manual drift | Add Terraform or Kubernetes manifests |
| Auth password-screening egress is not configured | Signup fails closed if the external range service is unavailable | Allow outbound HTTPS to `api.pwnedpasswords.com` and monitor the dependency |

## Release note

Update [[Change-Log]] and create a dated note in `05-Changes/` for every deployment-affecting change.

## Related notes

- [[Build]]
- [[Run]]
- [[Test]]
- [[Roadmap]]
- [[Security-Review]]
