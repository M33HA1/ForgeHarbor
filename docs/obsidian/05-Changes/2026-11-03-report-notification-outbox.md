---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [reports, messaging, reliability]
tags: [change, outbox, reports]
---

# Durable report notification publication

## What changed

- New reports atomically store a pending notification flag in their metadata document; callers cannot set or see this internal state.
- A separate bounded relay publishes the existing v1 event through its own connection/channel, requires mandatory routing and positive broker confirmation, and then marks the record published.
- Failed or ambiguous publication retains pending work. The relay reconnects with bounded backoff and operation deadlines. Multiple relay attempts retain stable event identity for Notify idempotency.
- Removed direct publication from HTTP handlers and RabbitMQ startup coupling from Reports code and Compose. Existing reports are not automatically replayed.
- Added confirmation outcome tests and extended the disposable report integration fixture to replay pending work after prior delivery and check for duplicate notifications.

## Verification

- Reports image build and Go tests passed, including ACK, NACK, mandatory return, closed confirmation channel, write error, and confirmation timeout cases.
- The deployed integrity fixture checks normal confirmation markers, hidden outbox fields, pending-record replay, notification idempotency, artifact ownership/integrity, and scoped cleanup.
- Deployed replay fixture passed with verified S3/MongoDB cleanup. Gateway route/CORS/tooling checks and all eight HTTP health probes passed after deployment; `git diff --check` passed.

## Follow-ups

- Perform live broker outage/restart and producer process-crash drills. Current evidence includes unit failure cases and real pending-record replay; it does not prove recovery from every infrastructure failure.
- Add outbox backlog monitoring/retention and artifact compensation on metadata-write failure.
- Classic retry redrive safety, dead-message retention/replay, provider credentials, production configuration, and Web automation remain release work.

## Related notes

- [[ADR-0007-report-notification-outbox]]
- [[ADR-0006-report-notification-events]]
- [[Reports]]
- [[Notify]]
- [[Backlog]]
- [[Test-Matrix]]
- [[Change-Log]]
