---
type: service
status: partially-verified
priority: P1
language: rust
updated: 2026-11-03
tags: [service/phishing, status/p1, area/scanning, language/rust]
---

# Phishing

Protected gateway requests use the shared Auth ForwardAuth gate; service JWT and ownership checks remain active. Exact GET health paths and CORS preflights remain public. See [[ADR-0005-shared-edge-auth]] and [[2026-11-03-shared-edge-auth]].

## Responsibility

Analyzes a URL for phishing indicators using Google Gemini and persists the result to the shared `scans` collection.

## Ownership

| Field | Value |
|---|---|
| Language | Rust, Actix Web |
| Direct port | 8081 |
| Public route | `/phishing` through Traefik |
| Data store | MongoDB (`forgeharbor.scans`) |
| External dependency | Google Gemini |
| Auth | HttpOnly browser session cookie or Bearer RS256 on `/v1/url/check` |

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/phishing/health` | None | Returns `phishing-rs is healthy` |
| POST | `/phishing/v1/url/check` | HttpOnly cookie or Bearer RS256 | Body: `{ "url": "https://..." }` |

## Request and response shape

The service returns a Gemini-derived analysis with a phishing flag, confidence, and reason, and writes a record shaped like:

```json
{
  "user_id": "user-id-from-jwt",
  "scan_type": "url",
  "input": "https://example.com",
  "result": {
    "phishing": false,
    "confidence": 0.92,
    "reason": "..."
  }
}
```

## Configuration

| Variable or file | Required | Purpose |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `GEMINI_API_KEY` | Yes | Gemini API access |
| `JWT_ISSUER` | Recommended | Expected issuer |
| `JWT_AUDIENCE` | Recommended | Expected audience |
| `./config/jwt-public.pem` | Yes | JWT verification key |
| `PHISHING_PORT` | No | Documented as 8081; the code binds 8081 directly |

## Build and test

```powershell
docker compose -f deploy/compose/docker-compose.dev.yml build fh-phishing
docker compose -f deploy/compose/docker-compose.dev.yml up -d fh-phishing
Invoke-WebRequest http://localhost:8081/phishing/health -UseBasicParsing
```

## Known issues

| Severity | Issue | Impact |
|---|---|---|
| P1 | A valid `GEMINI_API_KEY` must be configured in the local env file | Provider analysis fails when credentials are missing or invalid |
| P1 | No timeout, retry, or circuit breaker around Gemini | Slow or failed provider calls block the request |
| P1 | Rotate the Gemini key if previous request URLs were captured in logs | The API key is now sent in `x-goog-api-key`; credential rotation is not locally verified |
| P1 | The URL is interpolated directly into the model prompt | Prompt-injection risk |
| P1 | The error path returns `phishing: true` with confidence `0` | A failure is indistinguishable from a verdict |
| P1 | No cache of repeated URLs | Duplicate provider cost and latency |
| P1 | Production CORS origin still needs deployment configuration | Browser requests from the deployed web origin will be denied until `CORS_ALLOWED_ORIGINS` is set |
| P2 | Redis is provisioned in Compose but not used by this service | Unused infrastructure in the current path |

## Recent changes

- [[2026-11-03-configured-cors-origins]]
- [[2026-11-03-scanner-and-owner-regression-coverage]]

## Related notes

- [[Architecture-Review]]
- [[Data-Flow]]
- [[Build]]
- [[Test]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
- [[2026-11-03-gemini-key-header]]
