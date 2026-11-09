---
type: architecture
status: active
updated: 2026-11-09
tags: [forgeharbor, architecture, overview]
---

# System Overview

ForgeHarbor is a polyglot threat-detection platform. A React frontend talks to backend services through Traefik. The services use MongoDB, Redis, RabbitMQ, and RustFS, and call external threat-intelligence providers.

## Current shape

```mermaid
flowchart LR
    Browser[React + Vite] --> Traefik[Traefik v3.7]
    Traefik --> Auth[Auth<br/>Go]
    Traefik --> Phishing[Phishing<br/>Rust]
    Traefik --> Malware[Malware<br/>Rust]
    Traefik --> History[History<br/>Go]
    Traefik --> Reports[Reports<br/>Go]
    Traefik --> Notify[Notify<br/>Go]
    Traefik --> Web[Web<br/>React]

    Phishing --> Gemini[Google Gemini]
    Malware --> VirusTotal[VirusTotal]

    Auth --> Mongo[(MongoDB)]
    History --> Mongo
    Reports --> Mongo
    Reports --> RustFS[(RustFS S3 API)]
    Reports --> Rabbit[(RabbitMQ)]
    Notify --> Rabbit
    Notify --> Mongo
```

Auth uses Redis for distributed login/signup throttling, session revocation, and bounded MFA challenges. Go Auth/History/Notify are the merged development defaults; retained Rust/TypeScript/Python versions are selected only by the rollback overlay. See [[2026-11-09-backend-control-plane-pr]].

## Assessment

The 2026-11-02 review found that the services share infrastructure but not contracts: routing conventions differ per service, auth is re-implemented per service, three services write the same collection with different shapes, and the queue producer and consumer never meet. The full findings, evidence, target shape, and decisions are in [[Architecture-Review]].

## Language boundaries

| Language | Specialty | Current services | Target direction |
|---|---|---|---|
| Rust | CPU-heavy, memory-safe analysis | Phishing, Malware; legacy Auth | Keep for the malware analysis engine; move ordinary I/O services to Go if they are rewritten |
| Go | Control-plane APIs and orchestration | Auth, History, Reports, Notify | Add the scan orchestrator and make Go the default for ordinary backend services |
| Python | AI, threat intelligence, feed normalization | Legacy Notify only | Add a threat-intelligence service and use Python for AI-heavy enrichment |
| TypeScript | User interface and API integration | Legacy History; React Web is JavaScript on main | Frontend TypeScript migration remains separate on codex/language-revamp |
| SQL | Relational data and reporting | Not used yet | Move users, scans, reports, and audit records to PostgreSQL |

The polyglot split is intentional. The goal is credible specialty, not language count. See [[ADR-0001-polyglot-boundaries]] and [[ADR-0002-go-control-plane]].

## Current versus target

| Concern | Current | Target |
|---|---|---|
| Scan execution | Synchronous request path | Asynchronous orchestrator with retries and timeouts |
| Data store | MongoDB for most records | PostgreSQL for relational records; MongoDB only for flexible documents |
| Threat intelligence | Direct calls from scan services | Dedicated Python service with caching and rate limits |
| Notifications | Owner-scoped consumer with versioned events, bounded retries and dead storage | Authenticated consumer with retries and a dead-letter queue |
| Observability | Logs only | OpenTelemetry traces and structured logs |
| Contracts | Hand-written frontend calls | OpenAPI or protobuf contracts checked in |
| Routing | One prefix convention (D1=B); Traefik provider fixed | All documented routes and anonymous-auth checks pass the contract test |
| Auth boundary | Shared Auth ForwardAuth plus per-service JWT and ownership checks | Retain defense in depth; configure production HTTPS/proxy trust |
| Secrets | Every application context excludes `.env` and PEMs; public JWT key is mounted read-only; provider credential validity is unverified | Runtime secrets, rotated local credentials, and closed infrastructure ports |

## Known blockers

- Reports uses the pinned RustFS S3-compatible development image; authenticated artifact create/download has been verified end to end.
- History, Reports, and Notify verify RS256 tokens and scope reads to the token subject; the dev gateway uses shared Auth ForwardAuth. Development host ports are loopback-only; production deployment exposure is not defined.
- Compose no longer overrides provider keys with blanks; local credential validity has not been checked.
- Reports and Notify share the `notifications` queue, with a v1 envelope, bounded retries, dead storage and a Reports outbox. Broker outage/redrive/retention operations remain open.

## Resolved in Phase 0

- All three Rust services build on pinned stable Rust 1.90.0; the nightly async-drop cycle is gone.
- The gateway prefix contract is decided and applied (D1=B); a route-contract test exists.
- The Auth image no longer copies `config`; Phishing and Malware copy only the public key.

## Related notes

- [[Architecture-Review]]
- [[Service-Map]]
- [[Data-Flow]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Roadmap]]
