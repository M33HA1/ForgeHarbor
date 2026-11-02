---
type: service
status: security-defects
priority: P0
language: typescript
updated: 2026-11-02
tags: [service/history, status/p0, area/security, language/typescript]
---

# History

## Responsibility

Reads scan records from MongoDB and exposes a paginated history API.

## Ownership

| Field | Value |
|---|---|
| Language | TypeScript, Fastify |
| Direct port | 8083 |
| Public route | `/history` through Traefik |
| Data store | MongoDB (`forgeharbor.scans`) |
| Auth | Optional parser; not enforced |

## Endpoints

| Method | Path | Auth | Ownership | Notes |
|---|---|---|---|---|
| GET | `/health` | None | N/A | Includes MongoDB ping status |
| GET | `/history` | Optional | Broken | Returns all users' scans when no token is present |
| GET | `/history/:scan_id` | Optional | Broken | No owner check; invalid ID returns 500 |

## Query parameters

| Parameter | Current behavior | Problem |
|---|---|---|
| `limit` | Applied | No maximum; a large value can return everything |
| `cursor` | Base64 ObjectId cursor | Invalid cursor is silently ignored |
| `type` | Filters `q.type` | Records use `scan_type`, so the filter returns nothing |
| `risk` | Filters `result.risk_level` | Does not match the stored result shape reliably |

## Security findings

1. The `preHandler` hook returns without error when the `Authorization` header is missing. The route then runs unauthenticated.
2. If `JWT_PUBLIC_KEY` is not set, the service calls `jwt.decode` instead of `jwt.verify`. A forged unsigned token with `sub: user-a` was accepted in testing.
3. The user filter is only applied when a decoded user exists. Unauthenticated requests therefore return all scans.
4. `GET /history/:scan_id` fetches by `_id` only. It does not compare the record's `user_id` with the caller.
5. `new ObjectId(scan_id)` throws on malformed input, producing HTTP 500 instead of 400.

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `MONGO_DB` | No | Defaults to `forgeharbor` |
| `JWT_PUBLIC_KEY` | Yes | RSA public key for verification; without it, tokens are only decoded |
| `HISTORY_PORT` | No | Defaults to 8083 |

## Build and test

```powershell
Push-Location apps/history-ts
npm install
npm run build
npm test
Pop-Location
```

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P0 | Unauthenticated history returns all users' scans | Data disclosure |
| P0 | Unsigned or forged JWT is accepted when `JWT_PUBLIC_KEY` is absent | Identity spoofing |
| P0 | Detail route has no ownership check | IDOR |
| P1 | `type` and `risk` filters do not match stored fields | Broken filters |
| P1 | Invalid scan ID returns 500 | Error handling and log noise |
| P2 | No maximum page size | Resource exhaustion |

## Related notes

- [[Data-Flow]]
- [[Gateway-Routing]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[ADR-0003-postgres-for-history]]
