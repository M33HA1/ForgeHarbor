---
type: service
status: unverified
priority: P1
language: rust
updated: 2026-11-02
tags: [service/phishing, status/p1, area/scanning, language/rust]
---

# Phishing

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
| Auth | Bearer RS256 on `/v1/url/check` |

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/phishing/health` | None | Returns `phishing-rs is healthy` |
| POST | `/phishing/v1/url/check` | Bearer RS256 | Body: `{ "url": "https://..." }` |

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
| P1 | Compose passes a blank `GEMINI_API_KEY` when the variable is not set | Service starts but analysis fails |
| P1 | No timeout, retry, or circuit breaker around Gemini | Slow or failed provider calls block the request |
| P1 | The Gemini API key is passed in the URL query string | The key can leak through logs and proxies |
| P1 | The URL is interpolated directly into the model prompt | Prompt-injection risk |
| P1 | The error path returns `phishing: true` with confidence `0` | A failure is indistinguishable from a verdict |
| P1 | No cache of repeated URLs | Duplicate provider cost and latency |
| P2 | No unit or integration tests in the repository | Behavior is unverified |
| P2 | CORS allows any origin | Broad browser exposure |
| P2 | Redis is provisioned in Compose but not used by this service | Unused infrastructure in the current path |

## Related notes

- [[Architecture-Review]]
- [[Data-Flow]]
- [[Build]]
- [[Test]]
- [[Security-Review]]
- [[ADR-0001-polyglot-boundaries]]
