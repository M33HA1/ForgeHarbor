---
type: adr
status: accepted
date: 2026-11-03
updated: 2026-11-03
tags: [adr, messaging, reports, notifications]
---

# ADR-0006: Report notification events

## Context

FH-036 tracks event drift and poison delivery. The existing durable queue has no dead-letter arguments, so changing its declaration would require a queue migration. Reports is the current notification producer.

## Decision

Reports emits JSON with `schema_version: 1`, `event_type: report.created`, `event_id: report.created:<report ObjectId>`, `occurred_at` as a timezone-qualified UTC timestamp, verified `user_id`, and `data` containing `report_id`, `scan_id`, and `message`. AMQP messages are persistent and carry the same stable message ID.

Notify validates this contract and stores notifications under a deterministic event ID with insert-only upsert semantics. Identical redeliveries do not create duplicates. Conflicting reuse of an event identity is preserved in the dead queue and cannot change the stored owner. Legacy Reports messages with reportId/scanId/user/message are normalized deterministically during rolling upgrades; other unversioned messages are rejected.

The main queue stays unchanged. Notify declares durable `<queue>.dead` and `<queue>.retry` queues. Invalid messages go directly to dead storage. MongoDB failures receive at most three retries (four total attempts), separated by a five-second retry-queue TTL. Retry exhaustion goes to dead storage. Handoffs use mandatory routing, persistent messages, and publisher confirms before acknowledging the original delivery. Failed handoffs leave the original unacknowledged and reconnect the consumer.

The worker reconnects with bounded backoff and a prefetch limit of ten. Health includes MongoDB and consumer readiness. Payloads, owners, and connection URLs are excluded from worker logs.

## Limits and follow-ups

- Reports now uses an embedded outbox and mandatory publisher confirmations under [[ADR-0007-report-notification-outbox]]. Pending-record replay is verified; live broker and producer-crash drills remain open.
- Classic-queue TTL redrive uses broker dead-lettering. [RabbitMQ's safety guidance](https://www.rabbitmq.com/docs/3.13/dlx#safety) describes loss scenarios when the destination is unavailable. Evaluate quorum queues with at-least-once dead-lettering before production.
- Dead-message retention, monitoring, reviewed replay, and a live broker restart drill remain operational work. Do not purge existing queues to apply these changes.

## Related notes

- [[Reports]]
- [[Notify]]
- [[Data-Flow]]
- [[Backlog]]
- [[2026-11-03-notification-delivery-hardening]]
