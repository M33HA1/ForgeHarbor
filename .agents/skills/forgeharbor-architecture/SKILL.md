---
name: forgeharbor-architecture
description: Trace or change ForgeHarbor service boundaries, routing, data flow, event contracts, or language choices. Use for design reviews and cross-service changes.
metadata:
  short-description: Apply ForgeHarbor architecture
---

# ForgeHarbor Architecture

Use `docs/obsidian/01-Architecture/`, ADRs in `docs/obsidian/04-Decisions/`, and the service notes as the source of truth.

- Preserve the polyglot boundaries: Rust for analysis, Go for control-plane services, Python for intelligence/ML, TypeScript for UI integration, PostgreSQL for relational ownership and reporting.
- Keep public paths aligned with service paths under the D1=B contract; do not add prefix stripping without a new decision.
- For cross-service changes, identify request, data, and event contracts and update every affected service note.
- Prefer incremental migrations behind existing contracts. Record a new durable architectural choice as an ADR.
