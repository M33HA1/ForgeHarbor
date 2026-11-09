---
type: reference
status: active
updated: 2026-11-09
tags: [reference, api]
---

# API Contracts

## Gateway behavior

Public requests go to `http://localhost:8088`. The gateway does not rewrite paths; each service registers its full public prefix (D1=B, [[ADR-0004-gateway-prefix-contract]]):

| Public path | Service path |
|---|---|
| `/auth/*` | `/auth/*` |
| `/phishing/*` | `/phishing/*` |
| `/malware/*` | `/malware/*` |
| `/history/*` | `/history/*` |
| `/reports/*` | `/reports/*` |
| `/notify/*` | `/notify/*` |

`scripts/check-routes.mjs` probes every route below through the gateway and fails on 404. See [[Gateway-Routing]].

## Auth

Auth public `user_id` is the JWT `sub` and the ownership value used by scan/report/notification records. Treat it as an opaque string. MongoDB user `_id` is an internal storage identity and must not be substituted for the public user ID. The real browser fixture verifies this boundary; see [[2026-11-03-live-browser-service-journey]].

| Method | Public path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/auth/health` | None | — | `Service is Healthy!` |
| POST | `/auth/signup` | None | `{ "email": "...", "password": "..." }` | Mailbox identity is lowercased; `201` with `message` and `user_id` |
| POST | `/auth/login` | None | `{ "email": "...", "password": "..." }` | Case-insensitive mailbox lookup; sets `fh_access` as HttpOnly/SameSite=Strict; its RS256 token includes the JWKS `kid`; JSON `{ "expires_in": 3600 }` for unenrolled users; enrolled accounts instead receive `mfa_required`, `challenge_token`, `expires_in: 300` and no access cookie |
| POST | `/auth/logout` | None | — | Revokes the current token ID through expiry and clears the session cookie; returns 503 if Redis cannot persist revocation |
| GET | `/auth/jwks` | None | — | RFC 7517 JWKS with RSA `n`, `e`, `kid`, `use`, and `alg` fields |
| GET | `/auth/me` | HttpOnly session cookie or Bearer RS256 | — | Current user |

MFA API routes are implemented in Go Auth. See [[Auth]] for requirements and key handling. Challenge tokens cannot authorize protected APIs; successful MFA verification issues the session cookie. Browser MFA screens remain separate from main.

| Method | Public path | Requirement |
|---|---|---|
| GET | `/auth/mfa` | Current session; returns enabled/available/recovery count |
| POST | `/auth/mfa/setup` | Session and password; returns enrollment token, seed and provisioning URI |
| POST | `/auth/mfa/enable` | Same session, enrollment token and authenticator code; returns recovery codes once |
| POST | `/auth/mfa/verify` | Password-login challenge and authenticator or recovery code |
| POST | `/auth/mfa/disable` | Session, password and authenticator or recovery code |

## Phishing

The browser's same-origin requests send the HttpOnly `fh_access` cookie automatically. The edge validates it through Auth ForwardAuth, and service handlers continue RS256 and ownership validation. API clients may continue to send Bearer RS256 tokens.

| Method | Public path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/phishing/health` | None | — | `phishing-rs is healthy` |
| POST | `/phishing/v1/url/check` | HttpOnly cookie or Bearer RS256 | `{ "url": "https://..." }` | Analysis result |

## Malware

| Method | Public path | Auth | Request | Response |
|---|---|---|---|---|
| GET | `/malware/health` | None | — | `malware-rs is healthy` |
| POST | `/malware/v1/file/analyze` | HttpOnly cookie or Bearer RS256 | Multipart field `file` | Analysis result |

## History

| Method | Public path | Auth | Notes |
|---|---|---|---|
| GET | `/history/health` | None | MongoDB status |
| GET | `/history?limit=20&cursor=...&type=url&risk=high` | HttpOnly cookie or Bearer RS256 | Subject-scoped; limit is clamped to 1–100; malformed cursors return 400 |
| GET | `/history/:scan_id` | HttpOnly cookie or Bearer RS256 | Subject-scoped; malformed IDs return 400 |

History registers `/history/*`, so the public and direct-port paths match. Missing and forged-token rejection is covered by the gateway route/auth check; valid-token cross-user fixtures remain open.

## Reports

| Method | Public path | Auth | Request |
|---|---|---|---|
| GET | `/reports/health` | None | — |
| POST | `/reports` | HttpOnly cookie or Bearer RS256 | `{ "scanId": "<ObjectId>" }`; scan must exist and belong to the JWT subject; caller content is ignored |
| GET | `/reports?scan_id=a&scan_id=b` | HttpOnly cookie or Bearer RS256 | Lists matching reports for the authenticated owner; accepts 1–100 repeated scan IDs |
| GET | `/reports/:id` | HttpOnly cookie or Bearer RS256 | Returns only metadata owned by the subject |
| GET | `/reports/:id/download` | HttpOnly cookie or Bearer RS256 | Streams only an owned report |

Reports registers `/reports/*`, so the public and direct-port paths match. Report list lookup is authenticated, limited to 100 repeated scan IDs, and owner-scoped. Create, metadata, download, and scan-list ownership have disposable integration coverage.

Reports creation returns 400 for malformed scan IDs, 404 for absent/foreign scans, 409 for incomplete stored results, and 413 for bodies over 64 KiB. New metadata carries `source: stored-scan-v1`; downloads contain an allowlisted stored-scan snapshot in MongoDB Extended JSON. Legacy reports without this provenance remain unverified. See [[2026-11-03-trusted-scan-reports]].

## Notify

Health returns 200 when MongoDB responds and the notification consumer is connected, otherwise 503. API notification ownership is unchanged. Event payload/queue semantics are defined in [[ADR-0006-report-notification-events]].

| Method | Public path | Auth | Notes |
|---|---|---|---|
| GET | `/notify/health` | None | — |
| GET | `/notify` | HttpOnly cookie or Bearer RS256 | Returns up to 100 notifications scoped to the subject |

## Contract alignment and remaining drift

| Producer | Consumer | Current status |
|---|---|---|
| Malware result `{ status, result: { malicious, ... } }` | Dashboard adapter and `Result.jsx` | Dashboard maps nested malware fields; unknown confidence remains unknown |
| Reports notification producer | Notify `notifications` queue | Both use the configured queue; a versioned shared event schema and DLQ remain open |
| History records `scan_type` | History query `type` | Query maps `type` to `scan_type` |
| Phishing and Malware result records | History query `result.risk_level` | Both writers persist `high` or `low`; History supports legacy booleans and rejects unsupported filter values |

## Status code expectations

| Case | Expected | Current |
|---|---|---|
| Missing token on protected route | 401 | Verified for History, Reports, and Notify by gateway route/auth check |
| Invalid or forged token | 401 | Verified for History, Reports, and Notify by gateway route/auth check |
| Another user's resource | 404 | Reports cross-user denial verified; History and Notify fixtures remain open |
| Malformed ObjectId | 400 | Validation implemented in History and Reports; persistent request tests remain open |
| Missing resource | 404 | Owner-scoped read routes return not found |

## Related notes

- [[Architecture-Review]]
- [[Gateway-Routing]]
- [[Web]]
- [[History]]
- [[Reports]]
- [[Notify]]
- [[Test-Matrix]]
