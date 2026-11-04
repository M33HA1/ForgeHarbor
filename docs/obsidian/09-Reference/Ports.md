---
type: reference
status: active
updated: 2026-11-03
tags: [reference, ports]
---

# Ports

## Application ports

| Local host port | Container port | Service | Public path | Notes |
|---:|---:|---|---|---|
| 127.0.0.1:8088 | 80 | Traefik | `/` | Real gateway; loopback only |
| 127.0.0.1:8000 | 8000 | Traefik dashboard | N/A | Insecure dashboard in dev; loopback only |
| 127.0.0.1:3000 | 3000 | Web | `/` | Direct frontend access; loopback only |
| 127.0.0.1:8080 | 8080 | Auth | `/auth` | Direct debug access; loopback only |
| 127.0.0.1:8081 | 8081 | Phishing | `/phishing` | Direct debug access; loopback only |
| 127.0.0.1:8082 | 8082 | Malware | `/malware` | Direct debug access; loopback only |
| 127.0.0.1:8083 | 8083 | History | `/history` | Direct debug access; loopback only |
| 127.0.0.1:8084 | 8084 | Reports | `/reports` | Direct debug access; loopback only |
| 127.0.0.1:8085 | 8085 | Notify | `/notify` | Direct debug access; loopback only |

## Infrastructure ports

| Local host port | Component | Purpose |
|---:|---|---|
| 127.0.0.1:27017 | MongoDB | Database |
| 127.0.0.1:6379 | Redis | Provisioned cache; currently unused by service code |
| 127.0.0.1:5672 | RabbitMQ | AMQP |
| 127.0.0.1:15672 | RabbitMQ management | Web UI, `guest` / `guest` |
| 127.0.0.1:9000 | RustFS API | S3-compatible endpoint |
| 127.0.0.1:9001 | RustFS console | Web UI |
| 27123 | Obsidian Local REST API | MCP endpoint when the plugin is enabled |

## Conflicts and drift

- The README now documents gateway port 8088 and Traefik dashboard port 8000 (FH-019).
- All development host bindings are restricted to loopback. Direct local service ports still bypass Traefik; production deployments should keep services internal-only.
- `fh-web` is reachable at `http://localhost:3000` but the intended public entrypoint is `http://localhost:8088`.

## Related notes

- [[Service-Map]]
- [[Gateway-Routing]]
- [[Environment]]
- [[Run]]
