---
name: forgeharbor-security
description: Implement or review ForgeHarbor authentication, authorization, ownership, secret handling, CORS, and exposure boundaries. Use when code touches protected data or credentials.
metadata:
  short-description: Secure ForgeHarbor services
---

# ForgeHarbor Security

Read `AGENTS.md`, `docs/obsidian/07-Security/Security-Review.md`, and the affected service note.

- Verify JWT signatures and required claims; fail closed when auth configuration is absent or invalid.
- Enforce per-user ownership on every protected read, update, delete, and download. Do not trust caller-supplied owner IDs.
- Keep credentials out of source, logs, images, test fixtures, and MCP configuration. Never print `config/.env`.
- Keep MongoDB MCP access read-only. Do not add auth bypasses, wildcard CORS, or public admin paths.
- Add or update regression checks for both allowed and denied access, and document residual risks.
