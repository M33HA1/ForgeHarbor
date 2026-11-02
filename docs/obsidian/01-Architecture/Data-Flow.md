---
type: architecture
status: active
updated: 2026-11-02
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
    T->>P: POST /v1/url/check
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
    T->>V: POST /v1/file/analyze
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
    participant S as MinIO
    participant Q as RabbitMQ

    U->>T: POST /reports
    T->>R: POST / (after prefix strip)
    R->>M: Read scan data
    R->>S: Store JSON report
    R->>Q: Publish report event
    R-->>U: Report metadata
```

## Notification flow

```mermaid
sequenceDiagram
    participant Q as RabbitMQ
    participant N as Notify (Python)
    participant M as MongoDB
    participant U as Browser

    Q->>N: Consume scan or report event
    N->>M: Persist notification
    U->>N: GET /notify (gateway) or /notifications (service)
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

## Current gaps

- Scans are synchronous and can block on Gemini or VirusTotal.
- There is no reliable `scan.completed` event between scan services, History, Reports, and Notify.
- Queue names and event shapes are not consistent across producers and consumers.
- History has no enforced ownership filter; see [[Security-Review]].
- Report creation is not authenticated, and the gateway path rewrite conflicts with the service routes.

## Related notes

- [[Service-Map]]
- [[Gateway-Routing]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[ADR-0002-go-control-plane]]
