---
name: forgeharbor-obsidian
description: Create or maintain ForgeHarbor's Obsidian vault notes, links, frontmatter, canvases, and dashboard. Use for project knowledge-base changes.
metadata:
  short-description: Maintain ForgeHarbor docs
---

# ForgeHarbor Obsidian

Follow `docs/obsidian/00-Home.md` and `docs/obsidian/09-Reference/MCP.md`.

- Use `[[wikilinks]]`, existing note folders, and frontmatter fields `type`, `status`, `updated`, and `tags` where applicable.
- Update the home dashboard when current state or next actions change.
- Keep Mermaid diagrams in Markdown and interactive diagrams in `docs/obsidian/Canvas/`.
- Do not commit `.obsidian/workspace*.json`; preserve the tracked app, appearance, plugin, and graph settings.
- Check vault links with the repository's `scripts/dev.ps1 test` or `scripts/dev.sh test` workflow when requested.
