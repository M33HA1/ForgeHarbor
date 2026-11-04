---
name: forgeharbor-release
description: Prepare a ForgeHarbor release by checking build, route, security, documentation, configuration, and known-blocker evidence. Use for release readiness.
metadata:
  short-description: Check ForgeHarbor releases
---

# ForgeHarbor Release

Read `AGENTS.md`, `docs/obsidian/03-Runbooks/Deploy.md`, and `docs/obsidian/06-Roadmap/Backlog.md`.

- Verify affected builds and relevant test/security checks; distinguish local checks from CI or deployment evidence.
- Confirm the changelog, dated change notes, service notes, dashboard, and release version agree.
- Scan the proposed diff for credentials, generated files, unrelated edits, and stale status claims without opening or printing `config/.env`.
- Do not describe the stack as healthy while tracked blockers remain; list what passed and what remains.
