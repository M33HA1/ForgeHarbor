---
date: 2026-11-02
type: change
area: [tooling, mcp, codex]
status: in-progress
related: [[MCP]], [[Environment]]
tags: [change, codex, mcp]
---

# Prepare ForgeHarbor for Codex

## What changed

- Added a project-scoped `.codex/config.toml` with Context7, Playwright, read-only GitHub, Obsidian vault, scoped source filesystem, and read-only MongoDB MCP servers.
- Kept MCP credentials out of the checked-in config; MongoDB inherits `MDB_MCP_CONNECTION_STRING` from the user's environment.
- Set filesystem MCP write tools to prompt for approval and limited their roots to the vault or source directories.
- Updated `AGENTS.md`, the MCP skill, MCP reference, dashboard, and changelog for Codex.
- Retained `.opencode/opencode.jsonc` during the transition.

## Why

The project is moving from OpenCode to Codex. The project skills are already under `.agents/skills/`, which Codex discovers, so they do not need to be copied or rewritten.

## Verification

| Check | Command | Result |
|---|---|---|
| Skill discovery | Codex available-skills catalog | All 11 project skills listed |
| Codex TOML syntax | Python standard-library `tomllib` parse | Passed; six project MCP servers parsed |
| MCP connections | `codex mcp list` from a trusted project | Pending; requires Codex to load project config |

Codex loads project config only for trusted repositories. GitHub will also need OAuth in Codex; the previous OpenCode login does not transfer.

## Follow-ups

- Open ForgeHarbor in Codex and trust the repository so `.codex/config.toml` is loaded.
- Run `codex mcp list` or `/mcp` and confirm the project servers connect.
- Authenticate GitHub from Codex if needed.
- Remove the legacy OpenCode config only after the migration is complete and the user requests cleanup.

## Related notes

- [[MCP]]
- [[Environment]]
- [[00-Home]]
