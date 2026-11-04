---
date: 2026-11-03
type: change
area: [roadmap, architecture]
status: planned
related: [[Roadmap]], [[Backlog]], [[ADR-0002-go-control-plane]]
tags: [change, migration]
---

# Parallel Go migration plan

## What changed

- Added FH-040 and a roadmap workstream to migrate Auth, History, and Notify to Go alongside current hardening.
- Set the order to contracts first, then Auth, History, and Notify. Each replacement remains off live traffic until parity, security, health, and rollback checks pass.
- Kept MongoDB in place during language migration; PostgreSQL remains a separate planned change.

## Why

- The target architecture assigns Go to control-plane APIs while the existing polyglot stack still needs hardening. Parallel, staged replacements let both efforts proceed without interrupting the current path.

## Verification

| Check | Command | Result |
|---|---|---|
| Documentation diff review | `git diff --check` | Passed |

## Follow-ups

- Add contract and security regression coverage before implementing the Go Auth replacement.
- Update FH-040 as each service migration begins and passes its cutover gates.

## Related notes

- [[Change-Log]]
- [[Roadmap]]
- [[Backlog]]
- [[ADR-0002-go-control-plane]]
