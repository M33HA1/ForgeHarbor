---
type: reference
status: active
updated: 2026-11-02
tags: [reference, ports]
---

# Ports

## Application ports

| Host port | Container port | Service | Public path | Notes |
|---:|---:|---|---|---|
| 8088 | 80 | Traefik | `/` | Real gateway entrypoint |
| 8000 | 8000 | Traefik dashboard | N/A | Insecure dashboard in dev |
| 3000 | 3000 | Web | `/` | Direct frontend access |
| 8080 | 8080 | Auth | `/auth` | Also published directly |
| 8081 | 8081 | Phishing | `/phishing` | Also published directly |
| 8082 | 8082 | Malware | `/malware` | Also published directly |
| 8083 | 8083 | History | `/history` | Also published directly |
| 8084 | 8084 | Reports | `/reports` | Also published directly |
| 8085 | 8085 | Notify | `/notify` | Service route is `/notifications` |

## Infrastructure ports

| Host port | Component | Purpose |
|---:|---|---|
| 27017 | MongoDB | Database |
| 6379 | Redis | Provisioned cache; currently unused by service code |
| 5672 | RabbitMQ | AMQP |
| 15672 | RabbitMQ management | Web UI, `guest` / `guest` |
| 9000 | MinIO API | S3-compatible endpoint |
| 9001 | MinIO console | Web UI |
| 27123 | Obsidian Local REST API | MCP endpoint when the plugin is enabled |

## Conflicts and drift

- The README says the gateway is port 80 and Traefik is 8080. The Compose file maps 8088 and 8000.
- Every service is published on the host, which bypasses the gateway. This is convenient for local debugging but weakens the production-like boundary.
- `fh-web` is reachable at `http://localhost:3000` but the intended public entrypoint is `http://localhost:8088`.

## Related notes

- [[Service-Map]]
- [[Gateway-Routing]]
- [[Environment]]
- [[Run]]
