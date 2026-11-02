---
type: architecture
status: active
updated: 2026-11-02
tags: [forgeharbor, architecture, overview]
---

# System Overview

ForgeHarbor is a polyglot threat-detection platform. A React frontend talks to backend services through Traefik. The services use MongoDB, Redis, RabbitMQ, and MinIO, and call external threat-intelligence providers.

## Current shape

```mermaid
flowchart LR
    Browser[React + Vite] --> Traefik[Traefik v2.10]
    Traefik --> Auth[Auth<br/>Rust]
    Traefik --> Phishing[Phishing<br/>Rust]
    Traefik --> Malware[Malware<br/>Rust]
    Traefik --> History[History<br/>TypeScript]
    Traefik --> Reports[Reports<br/>Go]
    Traefik --> Notify[Notify<br/>Python]
    Traefik --> Web[Web<br/>React]

    Phishing --> Gemini[Google Gemini]
    Malware --> VirusTotal[VirusTotal]

    Auth --> Mongo[(MongoDB)]
    History --> Mongo
    Reports --> Mongo
    Reports --> MinIO[(MinIO)]
    Reports --> Rabbit[(RabbitMQ)]
    Notify --> Rabbit
    Notify --> Mongo
```

Redis is provisioned in Compose but is not used by the current service code. Treat it as reserved capacity for caching, sessions, or rate limiting.

## Language boundaries

| Language | Specialty | Current services | Target direction |
|---|---|---|---|
| Rust | CPU-heavy, memory-safe analysis | Auth, Phishing, Malware | Keep for the malware analysis engine; move ordinary I/O services to Go if they are rewritten |
| Go | Control-plane APIs and orchestration | Reports | Add the scan orchestrator and make Go the default for ordinary backend services |
| Python | AI, threat intelligence, feed normalization | Notify | Add a threat-intelligence service and use Python for AI-heavy enrichment |
| TypeScript | User interface and API integration | Web, History | Keep React + TypeScript for the UI; TypeScript is acceptable for read-heavy CRUD |
| SQL | Relational data and reporting | Not used yet | Move users, scans, reports, and audit records to PostgreSQL |

The polyglot split is intentional. The goal is credible specialty, not language count. See [[ADR-0001-polyglot-boundaries]] and [[ADR-0002-go-control-plane]].

## Current versus target

| Concern | Current | Target |
|---|---|---|
| Scan execution | Synchronous request path | Asynchronous orchestrator with retries and timeouts |
| Data store | MongoDB for most records | PostgreSQL for relational records; MongoDB only for flexible documents |
| Threat intelligence | Direct calls from scan services | Dedicated Python service with caching and rate limits |
| Notifications | Queue consumer with auth and naming gaps | Authenticated consumer with retries and a dead-letter queue |
| Observability | Logs only | OpenTelemetry traces and structured logs |
| Contracts | Hand-written frontend calls | OpenAPI or protobuf contracts checked in |

## Known blockers

- The Rust auth service fails to compile with `mongodb-3.2.5` and an async-drop cycle.
- The web image uses Node 14, while Vite 7 requires Node 20.19+ or 22.12+.
- The MinIO image reference does not pull.
- Traefik cannot read the Docker provider and loads no routes.
- Compose passes blank `GEMINI_API_KEY` and `VIRUSTOTAL_API_KEY` values.
- History, Reports, and Notify do not enforce authentication and ownership consistently.

## Related notes

- [[Service-Map]]
- [[Data-Flow]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Roadmap]]
