---
date: 2026-11-03
updated: 2026-11-03
type: change
status: verified
area: [reports, notify, messaging]
tags: [change, messaging, reliability]
---

# Notification delivery hardening

## What changed

- Reports emits a persistent versioned report-created event with a stable event ID and verified owner.
- Notify validates and normalizes events, persists identical deliveries once, rejects ownership collisions, and sends malformed messages to a durable dead queue.
- MongoDB failures retry at five-second intervals up to three times; exhausted failures go to the dead queue. Retry/dead handoffs are confirmed before ACK of the original.
- Added consumer reconnect/backoff, bounded prefetch, finite MongoDB/socket timeouts, and readiness-aware health. Worker logs no longer print message contents or exception URLs.
- Added six worker tests, a real local broker/Mongo fixture on disposable queues, and a Go event-contract test.

## Verification

- Worker tests pass for poison routing, ACK ordering, failed handoff without ACK, bounded retries, legacy normalization, duplicate/colliding identities, and reconnect attempts.
- The isolated broker/Mongo fixture passes duplicate and legacy idempotency, poison/collision dead-lettering, transient recovery on the third attempt, exhaustion after three retries, and fixture cleanup.
- Reports and Notify images rebuilt and restarted; Go unit tests passed.
- Deployed report integrity/storage/notification fixture and Notify owner-isolation fixture pass. All eight health probes return HTTP 200.

## Follow-ups

- FH-036 remains in progress: producer outbox/confirmation, classic retry redrive safety under broker failure, dead-message retention/replay, and a live broker restart drill remain open.
- Provider verification, production configuration, and Web automation remain release blockers.

## Related notes

- [[ADR-0006-report-notification-events]]
- [[Reports]]
- [[Notify]]
- [[Backlog]]
- [[Test-Matrix]]
- [[Change-Log]]
