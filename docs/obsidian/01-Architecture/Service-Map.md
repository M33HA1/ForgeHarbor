---
type: architecture
status: active
updated: 2026-11-02
tags: [forgeharbor, architecture, services]
---

# Service Map

## Services

| Service | Language | Direct port | Public route | Primary data | Status | Note |
|---|---|---:|---|---|---|---|
| Auth | Rust | 8080 | `/auth` | MongoDB | Build and health verified | [[Auth]] |
| Phishing | Rust | 8081 | `/phishing` | MongoDB | Unverified | [[Phishing]] |
| Malware | Rust | 8082 | `/malware` | MongoDB | Unverified | [[Malware]] |
| History | TypeScript | 8083 | `/history` | MongoDB | RS256 auth and ownership enforced; risk filter remains | [[History]] |
| Reports | Go | 8084 | `/reports` | MongoDB, RustFS, RabbitMQ | RS256 auth and ownership verified; artifact create/download verified | [[Reports]] |
| Notify | Python | 8085 | `/notify` | MongoDB, RabbitMQ | RS256 auth and owner filtering enforced; worker hardening remains | [[Notify]] |
| Web | React + Vite | 3000 | `/` | Browser storage | Node 22 image builds; frontend regression coverage absent | [[Web]] |

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
