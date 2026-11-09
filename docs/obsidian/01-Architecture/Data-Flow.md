---
type: architecture
status: active
updated: 2026-11-09
tags: [forgeharbor, architecture, data-flow]
---

# Data Flow

## URL scan

```mermaid
sequenceDiagram
    participant U as Browser
    participant T as Traefik
    participant P as Phishing (Rust)
    participant G as Gemini
    participant M as MongoDB

    U->>T: POST /phishing/v1/url/check
    T->>P: POST /phishing/v1/url/check
    P->>G: Analyze URL
    G-->>P: Verdict
    P->>M: Persist scan metadata
    P-->>T: JSON result
    T-->>U: JSON result
```

## File scan

```mermaid
sequenceDiagram
    participant U as Browser
    participant T as Traefik
    participant V as Malware (Rust)
    participant VT as VirusTotal
    participant M as MongoDB

    U->>T: POST /malware/v1/file/analyze
    T->>V: POST /malware/v1/file/analyze
    V->>VT: Submit hash or file
    VT-->>V: Vendor verdict
    V->>M: Persist scan metadata
    V-->>T: JSON result
    T-->>U: JSON result
```

## Report flow

```mermaid
sequenceDiagram
    participant U as Browser
    participant T as Traefik
    participant R as Reports (Go)
    participant M as MongoDB
    participant S as RustFS
    participant Q as RabbitMQ

    U->>T: POST /reports
    T->>R: POST /reports
    R->>M: Read scan data
    R->>S: Store JSON report
    R->>Q: Publish report event
    R-->>U: Report metadata
```

## Notification flow

Reports commits publication intent inside its metadata document and a separate relay clears it only after routed broker confirmation. Failed or ambiguous sends retain pending state. See [[ADR-0007-report-notification-outbox]].

Reports now emits the versioned report-created envelope in [[ADR-0006-report-notification-events]]. Notify validates ownership, persists each event once, confirms retry/dead handoffs before ACK, and reconnects with backoff. Three delayed retries precede dead storage; producer outbox replay is verified; broker-failure redrive guarantees remain open.

```mermaid
sequenceDiagram
    participant Q as RabbitMQ
    participant N as Notify (Go)
    participant M as MongoDB
    participant U as Browser

    Q->>N: Consume scan or report event
    N->>M: Persist notification
    U->>N: GET /notify (gateway and service)
    N-->>U: Notification list
```

## Data ownership

| Data | Current owner | Intended owner |
|---|---|---|
| Users and credentials | Auth | Auth |
| URL scan results | Phishing and History | Scan orchestrator, then History |
| File scan results | Malware and History | Scan orchestrator, then History |
| Report metadata and objects | Reports | Reports |
| Notifications | Notify | Notify |
| Audit events | None | Audit service |

## Target flow — asynchronous scans

```mermaid
sequenceDiagram
    participant U as Browser
    participant B as Go BFF / Orchestrator
    participant Q as RabbitMQ
    participant W as Scan worker
    participant DB as PostgreSQL
    participant N as Notify

    U->>B: POST /v1/scans
    B->>DB: Insert scan (queued)
    B->>Q: Publish scan.requested
    B-->>U: 202 {scan_id, status}
    Q->>W: Consume scan.requested
    W->>DB: Update scan (running, verdict)
    W->>Q: Publish scan.completed
    Q->>N: Consume scan.completed
    U->>B: GET /v1/scans/{id}
    B-->>U: status and verdict
```

The orchestrator owns the scan lifecycle. Workers own provider calls. History reads the completed record instead of being written by each scanner.

## Current gaps

- Scans are synchronous and can block on Gemini or VirusTotal. Malware sleeps 20 seconds inside the request (`apps/malware-rs/src/main.rs:161`).
- There is no reliable `scan.completed` event between scan services, History, Reports, and Notify.
- **Resolved 2026-11-02:** Reports publishes user-scoped report messages to the configured `notifications` queue consumed by Notify. A versioned event envelope, retries, and dead-letter handling remain open.
- Phishing and Malware result bodies still have service-specific fields, but both now persist `result.risk_level` (`high` or `low`). History reads that field and supports legacy boolean records; a fully versioned cross-service scan schema remains open in [[Backlog]] (FH-037).
- History has no enforced ownership filter; see [[Security-Review]].
- Report creation is not authenticated, and the gateway path rewrite conflicts with the service routes.
- Notify never nacks a failed message, so a poison message is redelivered forever with no dead-letter queue.

## Related notes

- [[Architecture-Review]]
- [[Service-Map]]
- [[Gateway-Routing]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[ADR-0002-go-control-plane]]
