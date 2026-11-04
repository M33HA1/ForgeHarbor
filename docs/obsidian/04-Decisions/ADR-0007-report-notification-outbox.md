---
type: adr
status: accepted
date: 2026-11-03
updated: 2026-11-03
tags: [adr, reports, messaging, outbox]
---

# ADR-0007: Embedded report notification outbox

## Context

Reports previously inserted metadata and then published to RabbitMQ. A crash or broker error between those operations could permanently omit a notification. The development MongoDB deployment is standalone, so a separate transactional outbox collection would require infrastructure changes.

## Decision

Commit `notification_pending: true` in the same report document as its metadata. This single-document write atomically records the report and its publication intent. Internal outbox fields are omitted from HTTP metadata. A partial pending/creation-time index supports relay queries. Existing reports without the flag are not automatically replayed.

A background relay owns its AMQP connection/channel, polls bounded batches, publishes persistent v1 events with mandatory routing, and clears the flag only after a positive broker confirmation with no mandatory return. It records `notification_published_at` as an internal timestamp. Network/confirmation/database failures retain pending work and reconnect with bounded backoff. Socket deadlines bound publication and connection operations. Reports no longer requires RabbitMQ during HTTP startup or in its Compose startup dependencies.

The same stored report produces the same event ID and payload on retry. A crash after confirmation but before the MongoDB marker can publish twice. Notify's insert-only event identity makes repeated delivery idempotent; this is at-least-once publication, not exactly-once transport. Concurrent relay replicas may also duplicate publication safely under this contract.

## Limits

- A broker confirmation proves broker acceptance, not notification consumption. See [RabbitMQ's confirmation scope](https://www.rabbitmq.com/docs/3.13/confirms).
- Live broker outage/restart and producer process-crash drills, backlog monitoring, pending-record retention, and multi-replica load remain operational verification work.
- Classic retry redrive safety and dead-message replay remain open under [[ADR-0006-report-notification-events]].
- Artifact upload and metadata insertion remain separate operations; after an insert error, Reports checks for a committed document before deleting the object. Confirmed absence triggers a bounded RustFS delete; an unknown outcome retains the object to avoid breaking a possibly committed report. Orphan reconciliation remains required: [[2026-11-03-report-artifact-compensation]].

## Related notes

- [[Reports]]
- [[Notify]]
- [[Backlog]]
- [[2026-11-03-report-notification-outbox]]
