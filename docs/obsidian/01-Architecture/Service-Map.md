---
type: architecture
status: active
updated: 2026-11-09
tags: [forgeharbor, architecture, services]
---

# Service Map

## Services

| Service | Language | Direct port | Public route | Primary data | Status | Note |
|---|---|---:|---|---|---|---|
| Auth | Go | 8080 | `/auth` | MongoDB | Build and health verified | [[Auth]] |
| Phishing | Rust | 8081 | `/phishing` | MongoDB | Unverified | [[Phishing]] |
| Malware | Rust | 8082 | `/malware` | MongoDB | Unverified | [[Malware]] |
| History | Go | 8083 | `/history` | MongoDB | Owner/risk/cursor and legacy rollback verified locally | [[History]] |
| Reports | Go | 8084 | `/reports` | MongoDB, RustFS, RabbitMQ | RS256 auth and ownership verified; artifact create/download verified | [[Reports]] |
| Notify | Go | 8085 | `/notify` | MongoDB, RabbitMQ | Owner API and Go broker contracts pass; operational drills remain | [[Notify]] |
| Web | React + Vite | 3000 | `/` | Browser storage | Unchanged in the backend PR; frontend migration is separate | [[Web]] |

Auth, History, and Notify share `apps/controlplane-go` and run as separate processes. The language rollback overlay selects the retained Rust/TypeScript/Python implementations against the same data and keys. Backend verification: [[2026-11-09-backend-control-plane-pr]].

Every service registers its full public prefix, and the gateway does not rewrite paths (D1=B, [[ADR-0004-gateway-prefix-contract]]). The public route, direct-port path, and service route are identical; `scripts/check-routes.mjs` enforces the contract.

## Infrastructure

| Component | Image | Host port | Purpose |
|---|---|---:|---|
| Traefik | `traefik:v3.7` | 8088 (HTTP), 8000 (dashboard) | Edge proxy and path routing |
| MongoDB | `mongo:6.0` | 27017 | Primary document store |
| Redis | `redis:7-alpine` | 6379 | Cache and session support |
| RabbitMQ | `rabbitmq:3-management` | 5672, 15672 | Asynchronous events |
| RustFS | `ghcr.io/rustfs/rustfs:1.0.1-glibc` (AMD64 digest pinned in Compose) | 9000, 9001 | S3-compatible report object storage |

## Dependency direction

```mermaid
flowchart TD
    Web[Web] --> Auth
    Web --> Phishing
    Web --> Malware
    Web --> History
    Web --> Reports
    Web --> Notify

    Auth --> Mongo
    Phishing --> Mongo
    Malware --> Mongo
    History --> Mongo
    Reports --> Mongo
    Reports --> MinIO
    Reports --> Rabbit
    Notify --> Rabbit
    Notify --> Mongo
```

## Status legend

| Status | Meaning |
|---|---|
| Healthy | Builds, starts, and passes its smoke test |
| Unverified | No reliable build or smoke test evidence yet |
| Broken build | Does not compile or image does not build |
| Security defects | Starts, but auth or ownership checks are missing or incorrect |
| Routing defects | Gateway and service disagree about paths |

## Related notes

- [[Architecture-Review]]
- [[System-Overview]]
- [[Data-Flow]]
- [[Gateway-Routing]]
- [[Ports]]
- [[Test-Matrix]]
