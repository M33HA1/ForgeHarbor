---
date: 2026-11-13
type: change
area: [reports, aws, deployment]
status: locally-verified
updated: 2026-11-13
related: [Reports, AWS-Deployment, Backlog]
tags: [change, service/reports, aws]
---

# Reports AWS storage prerequisite

## What changed

- Add explicit `S3_MODE=aws` using the SDK default credential chain, refreshing role credentials and regional S3 addressing. The existing local RustFS mode remains the default.
- Reject mixed local/AWS configuration and missing bucket, region or credentials. AWS mode does not create buckets; it checks an existing bucket with bounded startup retries.
- Replace the legacy global endpoint resolver with the S3 BaseEndpoint option for compatible storage. AWS ignores shared-profile endpoint overrides and rejects explicit endpoint environment overrides.
- Include CA certificates in the unprivileged scratch image for HTTPS to S3 and credential endpoints. Startup logs omit SDK configuration/credential-source details.
- Document configuration, runtime IAM scope and shared EC2 role limitations in [[AWS-Deployment]]. No new dependency, auth/owner change, cloud deployment or spending.

## Why

The resume-demo AWS plan requires regional S3 and temporary role credentials. The old Reports setup always used a custom endpoint and static credentials and its runtime lacked HTTPS trust roots.

## Verification

| Check | Evidence | Result |
|---|---|---|
| Go race tests | `go test -race ./...` in pinned Go 1.27.3 container | Pass |
| Build and module consistency | `go build -buildvcs=false ./...`; `go mod tidy -diff` | Pass |
| SDK fixtures | Regional HTTPS signing/session token; refreshing local role provider; upload/download/delete; compatible bucket creation; AWS 403/404 no-create; unsafe/missing configuration | Pass; synthetic credentials and local transports only |
| Runtime image | `docker build --tag fh-report-aws-test:local apps/report-go` | Pass; unprivileged scratch runtime includes CA roots |
| Security | Trivy 0.76.1 Reports filesystem scan, vulnerability/secret/misconfiguration scanners, HIGH/CRITICAL | Pass; no findings at these severities |
| Documentation | `node scripts/check-links.mjs`; `git diff --check` | Pass; 98 vault notes |

The first SDK transport fixture failed because it returned before draining the upload body/checksum stream; the transport now consumes the body like a real HTTP client. No checksum behavior was disabled. The initial Docker test command used a login shell that replaced the Go PATH; the corrected non-login shell uses the pinned toolchain.

## Follow-ups

- Verify exact-head hosted security and full-stack owner/browser/MFA checks before merging; PR checks are canonical for hosted evidence.
- Continue FH-032 with reviewed Terraform and separate HTTPS demo Compose configuration.
- Actual AWS account/domain, current cost estimate, fresh provider keys/rotation, real IAM/IMDSv2/S3 verification and restore drills remain open. Existing P0 gates are not marked complete.

## Related notes

- [[Reports]]
- [[AWS-Deployment]]
- [[Roadmap]]
- [[Backlog]]
- [[Security-Review]]
- [[Change-Log]]
