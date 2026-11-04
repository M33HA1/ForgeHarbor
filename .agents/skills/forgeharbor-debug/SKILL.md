---
name: forgeharbor-debug
description: Diagnose ForgeHarbor bugs and failing commands from reproducible evidence before changing code. Use when a service, route, build, test, or MCP integration fails.
metadata:
  short-description: Debug ForgeHarbor with evidence
---

# ForgeHarbor Debug

Follow an evidence-first debugging loop: capture the exact failure, reproduce it with the smallest relevant command, trace the request/config/dependency path, and identify the first incorrect state before proposing a fix.

- Read `AGENTS.md`, the affected service note, and `docs/obsidian/03-Runbooks/Debug.md`.
- Separate infrastructure, gateway, service, and client failures. Check the route contract and live service state before changing route code.
- Change one causal factor at a time, then repeat the failing check and a nearby regression check.
- Never print `config/.env`, credentials, JWTs, or connection strings. Do not treat a skipped check as a pass.
- Record unresolved causes and verification limits in the change note.
