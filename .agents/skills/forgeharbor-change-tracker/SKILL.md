---
name: forgeharbor-change-tracker
description: Record a meaningful ForgeHarbor code, infrastructure, or documentation change consistently. Use when a task changes tracked project behavior or status.
metadata:
  short-description: Track ForgeHarbor changes
---

# ForgeHarbor Change Tracker

For meaningful changes, update all three project records:

1. Add a concise entry under `Unreleased` in `CHANGELOG.md`.
2. Create `docs/obsidian/05-Changes/YYYY-MM-DD-<slug>.md` from `docs/obsidian/10-Templates/Change.md`, including evidence and follow-ups.
3. Update `docs/obsidian/00-Home.md` and the affected service/decision notes so they describe the current state.

Use Obsidian wikilinks, required frontmatter, and existing note conventions. Preserve unrelated user edits and do not claim checks that were not run.
