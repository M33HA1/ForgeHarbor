---
name: forgeharbor-dev
description: Implement or refactor ForgeHarbor application code across Rust, Go, Python, TypeScript, and Compose. Use for ordinary feature work and bug fixes within an existing service.
metadata:
  short-description: Develop ForgeHarbor services
---

# ForgeHarbor Development

Start with `AGENTS.md`, `docs/obsidian/00-Home.md`, the current branch/worktree state, and the affected service note. Read relevant ADRs when a change crosses service boundaries.

- Follow the documented language boundaries and existing API/data/event contracts; keep changes within the intended service unless evidence requires a cross-service fix.
- Inspect existing local edits before touching shared files and preserve unrelated work.
- Keep auth fail-closed, enforce ownership on protected data, and keep secrets out of code, logs, images, and MCP configuration.
- Add or update focused checks for behavior changed, and report what ran. Update the changelog, dated change note, dashboard, and service note for meaningful work.
- Do not claim the whole stack works while tracked blockers remain.
