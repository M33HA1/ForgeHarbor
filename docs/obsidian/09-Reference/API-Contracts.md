---
type: reference
status: active
updated: 2026-11-02
tags: [reference, api]
---

# API Contracts

## Gateway behavior

Public requests go to `http://localhost:8088`. Traefik strips the service prefix before forwarding:

| Public path | Service path |
|---|---|
| `/auth/*` | `/*` |
| `/phishing/*` | `/*` |
| `/malware/*` | `/*` |
| `/history/*` | `/*` |
| `/reports/*` | `/*` |
| `/notify/*` | `/*` |

The table describes the gateway rule, not whether the service matches it. History, Reports, and Notify currently register the full prefix and therefore 404 through the gateway. See [[Gateway-Routing]].

## Auth

| Method | Public path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/auth/health` | None | — | `Service is Healthy!` |
| POST | `/auth/signup` | None | `{ "email": "...", "password": "..." }` | `201` with `message` and `user_id` |
| POST | `/auth/login` | None | `{ "email": "...", "password": "..." }` | `{ "access_token": "...", "expires_in": 3600 }` |
| GET | `/auth/jwks` | None | — | Public key material |
| GET | `/auth/me` | Bearer RS256 | — | Current user |

## Phishing

| Method | Public path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/phishing/health` | None | — | `phishing-rs is healthy` |
| POST | `/phishing/v1/url/check` | Bearer RS256 | `{ "url": "https://..." }` | Analysis result |

## Malware

| Method | Public path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/malware/health` | None | — | `malware-rs is healthy` |
| POST | `/malware/v1/file/analyze` | Bearer RS256 | Multipart field `file` | Analysis result |

## History

| Method | Public path | Auth | Notes |
|---|---|---|---|
| GET | `/history/health` | None | MongoDB status |
| GET | `/history?limit=20&cursor=...&type=url&risk=high` | Should be Bearer | Current code allows anonymous access |
| GET | `/history/:scan_id` | Should be Bearer | Current code has no ownership check |

The gateway strips `/history`, but the service registers `/history` and `/history/:scan_id`, so these routes return 404 through the gateway.

## Reports

| Method | Public path | Auth | Request |
|---|---|---|---|
| GET | `/reports/health` | None | — |
| POST | `/reports` | Should be Bearer | `{ "scanId": "...", "content": "..." }` |
| GET | `/reports/:id` | Should be Bearer | — |
| GET | `/reports/:id/download` | Should be Bearer | — |

The gateway prefix strip currently prevents these routes from matching. See [[Gateway-Routing]].

## Notify

| Method | Public path | Auth | Notes |
|---|---|---|---|
| GET | `/notify/health` | None | — |
| GET | `/notify/notifications` | Should be Bearer | Frontend calls `/notify`; service exposes `/notifications` |

## Contract mismatches

| Producer | Consumer | Mismatch |
|---|---|---|
| Malware result `{ status, result: { malicious, ... } }` | `Result.jsx` | Reads top-level `is_malicious` and `is_phishing` |
| Notify `/notifications` | `api.js` | Calls `/notify` |
| Reports `report_events` queue | Notify `notifications` queue | No consumer for report events |
| History records `scan_type` | History query `type` | Filter uses the wrong field |
| History records `result` shape | History query `result.risk_level` | Filter assumes a field that may not exist |

## Status code expectations

| Case | Expected | Current |
|---|---|---|
| Missing token on protected route | 401 | Often 200 |
| Invalid or forged token | 401 | Sometimes accepted |
| Another user's resource | 403 or 404 | Often 200 |
| Malformed ObjectId | 400 | 500 |
| Missing resource | 404 | 404 in some routes |

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[Web]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Test-Matrix]]
