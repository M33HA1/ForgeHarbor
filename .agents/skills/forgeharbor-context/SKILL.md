---
name: forgeharbor-context
description: Restore and maintain ForgeHarbor project context across sessions. Use at the start of ForgeHarbor work or when asked to continue.
metadata:
  short-description: Restore ForgeHarbor context
---

# ForgeHarbor Context

Use the repository's current files as the durable project memory. Do not rely on an old chat summary when the working tree or project notes provide newer evidence.

## Restore context

1. Read `AGENTS.md` and `docs/obsidian/00-Home.md`.
2. Check the current branch and `git status --short`. Treat every existing edit as user work: inspect relevant diffs before changing a shared file and preserve unrelated changes.
3. Read `docs/obsidian/06-Roadmap/Roadmap.md`, `Backlog.md`, and the latest relevant change note to identify the active phase, blockers, and next tracked work.
4. Read the affected service note and relevant ADRs before editing code or contracts.
5. Build a brief working picture: current state, known blockers, existing local edits, and the next action that matches the user's request. If asked to continue without a more specific objective, use the highest-priority actionable roadmap item that does not depend on missing credentials or approval.

## Maintain context

- Update existing service, architecture, security, roadmap, or runbook notes when implementation evidence changes their claims. Keep verified, inferred, and pending states distinct.
- For meaningful project changes, follow `forgeharbor-change-tracker`: update `CHANGELOG.md`, add a dated note under `docs/obsidian/05-Changes/`, and update the home dashboard and affected notes.
- Prefer correcting the canonical note over creating a new note that repeats existing context. Do not create chat transcripts or speculative plans as project memory.
- Preserve unresolved risks and follow-ups in the relevant backlog or security notes. Never label the whole stack complete while tracked blockers remain.
- Keep secrets, tokens, private keys, and live credentials out of notes and summaries.

## Useful references

- `docs/obsidian/00-Home.md` — current project dashboard
- `docs/obsidian/06-Roadmap/Backlog.md` — prioritized work and status
- `docs/obsidian/05-Changes/` — dated evidence and follow-ups
- `docs/obsidian/09-Reference/MCP.md` — project integration setup and live-state expectations
