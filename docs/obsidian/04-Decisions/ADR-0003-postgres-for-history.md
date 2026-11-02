---
type: adr
status: proposed
date: 2026-11-02
tags: [adr, data, postgres]
---

# ADR-0003: PostgreSQL for history and relational records

## Status

Proposed.

## Context

Users, scans, reports, and audit records are relational and ownership-sensitive. The current MongoDB queries already need filters, pagination, sorting, and per-user scoping. Those requirements are easier to reason about with a relational schema, foreign keys, and explicit indexes.

MongoDB is still reasonable for flexible provider payloads. The problem is using it as the primary store for every record.

## Decision

Use PostgreSQL for:

- Users and identities
- Scan jobs and scan results
- Report metadata
- Audit events
- Notification state

Use JSONB for provider-specific or evolving result payloads. Keep MongoDB only if a future requirement genuinely needs schema-free documents.

## Proposed schema sketch

```sql
create table users (
  id uuid primary key,
  email citext unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table scans (
  id uuid primary key,
  user_id uuid not null references users(id),
  scan_type text not null check (scan_type in ('url', 'file')),
  input text not null,
  status text not null,
  verdict jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index scans_user_created_idx on scans (user_id, created_at desc);
create index scans_type_created_idx on scans (scan_type, created_at desc);
```

## Consequences

### Positive

- Ownership checks become explicit joins and constraints.
- Filters and pagination have predictable indexes.
- Transactions make report and audit writes safer.
- SQL is a stronger fifth resume signal than another service language.

### Negative

- Requires a migration and a data-copy plan.
- Adds a new infrastructure dependency.
- JSONB queries can become slow without indexes.

### Follow-ups

- Add a migration tool and versioned migrations.
- Write a data migration from `scans` and `reports`.
- Add query tests for user scoping and filters.
- Update [[History]] and [[Reports]] after the migration.

## Alternatives considered

| Alternative | Why not |
|---|---|
| Keep MongoDB for everything | Relational ownership and reporting queries remain awkward |
| Use SQLite | Weak fit for a multi-service deployment |
| Add a search engine first | Solves search, not ownership or transactional integrity |

## Related notes

- [[ADR-0001-polyglot-boundaries]]
- [[History]]
- [[Reports]]
- [[Backlog]]
- [[Roadmap]]
