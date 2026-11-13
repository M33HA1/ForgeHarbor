---
type: plan
status: in-progress
updated: 2026-11-13
tags: [roadmap, aws, demo]
---

# AWS resume-demo deployment

## Scope correction

ForgeHarbor is a resume project, not a customer SaaS launch. The earlier managed Fargate/Atlas/MQ recommendation near $500/month is withdrawn for this scope. Build a reproducible, secure demonstration that can be shut down when not needed. No cloud spending or account changes are approved by this document.

## Recommended architecture

One Linux x86-64 EC2 host runs the existing application, MongoDB, Redis and RabbitMQ through an explicit production/demo Compose configuration. Recommend Mumbai (`ap-south-1`) for the initial India-facing demo, with `t3.large` (2 vCPU / 8 GiB) and a 60 GiB encrypted gp3 volume as the initial sizing candidate; validate memory, Argon2, disk growth and concurrent scan measurements before launch; build images in CI, not on the demo host. Use encrypted EBS for state. All backend and data ports stay unpublished; only Traefik HTTPS and the ACME HTTP challenge/redirect are public. Disable the insecure dashboard and prefer static file-provider routing over a Docker socket mount.

Use ECR for immutable images, a private encrypted/versioned S3 bucket for report objects, Secrets Manager for fresh cloud secrets, SSM for administration without SSH, and CloudWatch with short retention for logs/health/cost alarms. Keep MongoDB/Redis/RabbitMQ local to this demo host; single-host downtime and data recovery limitations must be stated openly.

```mermaid
flowchart LR
    Browser --> HTTPS[Traefik HTTPS on EC2]
    HTTPS --> Apps[Existing application containers]
    Apps --> State[(Private MongoDB Redis RabbitMQ)]
    Apps --> S3[(Private S3 reports)]
    GitHub[GitHub Actions OIDC] --> ECR[Image digests]
    ECR --> Apps
```

## Preparation progress

The Reports storage prerequisite is implemented on `codex/aws-reports-storage`; see [[2026-11-13-aws-report-storage]]. Local race tests, SDK request/refresh fixtures and the minimal image build pass. Terraform, demo HTTPS Compose, deployment automation and real AWS validation remain undelivered. This is preparation progress, not a running AWS environment.

## Ordered AWS work

1. Reports credential-chain implementation and local SDK fixtures are complete; AWS role permissions and real owner-authorized create/download/cleanup remain to verify on the provisioned environment. Model the EC2 role as a shared host permission boundary; it is not per-service IAM isolation.
2. Add Terraform for the dedicated VPC/subnet, security groups, EC2/EBS, S3/ECR, IAM/OIDC, secret references, logs and budget alarms. Use a nonoverlapping Docker/VPC CIDR. Select supported pinned MongoDB/Redis/RabbitMQ images and verify upgrades separately.
3. Add a demo Compose configuration with real hostname, HTTPS, Secure cookies, exact origins, stable trusted proxy peer, resource limits and safe key mounts. Do not inherit development ports, localhost routing or insecure dashboards. Prove spoofed forwarding headers cannot bypass rate limits.
4. Build/scan once in GitHub Actions; push commit-tagged ECR images and record digests. Use OIDC roles scoped to this repository and environment. Deploy approved release manifests through a restricted SSM document; retain the previous compatible release for rollback. No permanent AWS keys in GitHub.
5. Verify signup/login/MFA/recovery, owner isolation, report storage and notifications on AWS. Use new test keys and bounded provider calls; do not copy local secrets or real user data. Rehearse restoration of MongoDB, report objects and MFA key; record Redis revocation-loss and broker-recovery limitations.
6. Produce the resume evidence: architecture diagram, CI/deployment/rollback run links, sanitized screenshots, cost notes and a concise demo recording. Describe verified capabilities and limitations; make no uptime, accuracy or scalability claims without measurements.

## Reports storage configuration

For AWS, supply `S3_MODE=aws`, `S3_BUCKET=<precreated-private-bucket>` and `S3_REGION=ap-south-1` (or use the SDK region configuration). Omit `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` and `S3_SESSION_TOKEN`; reusing the development environment file fails startup deliberately. Standard `AWS_ENDPOINT_URL`/`AWS_ENDPOINT_URL_S3` overrides are rejected, and shared-profile S3 endpoint settings are ignored. Use the SDK role chain rather than permanent keys; environment credentials and session tokens remain supported by that chain for isolated testing. Missing credentials, region or bucket prevent startup. Do not enable SDK request/credential debug logging.

For RustFS, omit `S3_MODE` or set `compatible`, retain the explicit endpoint and both local credentials, and keep the local region default. The custom endpoint must be an HTTP(S) origin without embedded credentials, path, query or fragment. Plain HTTP is for the private local store only. Neither mode changes JWT, ownership, provenance, report deadlines or compensation semantics.

Provision a private general-purpose S3 bucket before starting Reports. The runtime needs `s3:ListBucket` on that bucket for `HeadBucket`, and `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on its `report-*.json` objects. Keep bucket creation, policy updates, public-access settings and version deletion with the provisioning role. This assumes bucket-default SSE-S3; SSE-KMS needs separately reviewed key permissions. With versioning, compensating `DeleteObject` creates a delete marker rather than erasing retained versions; configure a lifecycle and recovery policy. IAM grants bucket access to the host role, while application JWT/ownership checks isolate users. Containers sharing an EC2 instance role do not have independent IAM identities.

Local fixtures cover regional signing with temporary tokens, role-provider refresh, upload/download/delete requests, local path-style bucket creation and refusal to create AWS buckets after 403/404. They do not establish real S3 permissions, EC2 metadata reachability from Docker, AWS bucket encryption, IAM isolation or cloud recovery. Verify IMDSv2 and an appropriate container hop limit during deployment without publishing metadata proxy endpoints.

Implementation references checked 2026-11-13: [SDK credential chain](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/configure-gosdk.html), [S3 endpoint configuration](https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/configure-endpoints.html), [S3 operation permissions](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-with-s3-policy-actions.html).

## Cost and run policy

Plan roughly $100–150/month for continuous light usage, subject to a selected-region estimate and workload sizing. This is an engineering allowance, not an AWS quote or approved budget. Prefer on-demand demonstration windows; stopping compute does not remove EBS, S3, snapshots, retained IPs, secrets or logs charges. Do not schedule automatic startup/shutdown until explicitly requested.

For comparison only, the official T3 table publishes US East Linux rates; it is not a Mumbai quote. Model 730 monthly hours, one public IPv4, EBS, backup retention, ECR/S3, logs, secrets and transfer in AWS Pricing Calculator. Exclude provider API usage, taxes and domain registration from any infrastructure-only subtotal. Set alerts and request/provider quotas: budget alerts do not enforce a hard spending cap. Avoid always-on ALB/NAT/managed database baseline costs for this single-host demonstration unless a measured requirement justifies them.

Sources researched 2026-11-11: [EC2 T3](https://aws.amazon.com/ec2/instance-types/t3/), [VPC/IPv4 pricing](https://aws.amazon.com/vpc/pricing/), [EBS pricing](https://aws.amazon.com/ebs/pricing/), [AWS Pricing Calculator](https://calculator.aws/), [SSM](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html), [GitHub OIDC](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html).

## Acceptance and remaining inputs

The recommended region and starting host are above. The actual AWS account/domain, a current regional cost estimate, fresh provider test credentials and data scope remain inputs before provisioning. Successful local/hosted CI is not an AWS deployment. A resume demo does not establish production HA, compliance or security certification.

- [[Deploy]]
- [[Backlog]]
- [[Security-Review]]
