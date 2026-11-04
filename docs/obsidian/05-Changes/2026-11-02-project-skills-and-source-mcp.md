---
date: 2026-11-02
type: change
area: [tooling, developer-experience, mcp]
status: complete
related: [[MCP]], [[Environment]], [[Backlog]]
tags: [change, tooling, skills, mcp]
---

# Add project skills and a scoped source MCP

## What changed

- Added eleven project-local `forgeharbor-*` skills under `.agents/skills/` for coding, builds, debugging, architecture, change tracking, roadmap planning, security, Obsidian, service scaffolding, release readiness, and MCP.
- Added a source filesystem MCP scoped to `apps/`, `deploy/`, `scripts/`, and `pkg/` for coding tasks.
- Pinned the filesystem MCP package and provisioned its Node 24 runtime through `npx`; the app toolchain remains on its existing Node version.
- Updated `AGENTS.md`, the MCP reference, the home dashboard, and the changelog.

## Why

The repository described project skills that were not present in the checkout. Coding agents also lacked a project-scoped way to inspect implementation files. The new skill set carries ForgeHarbor-specific boundaries into future tasks, while the MCP exposes only the code and deployment directories needed for development.

## Verification

| Check | Command | Result |
|---|---|---|
| Skill inventory | `Get-ChildItem .agents/skills -Recurse -Filter SKILL.md` | Eleven skills found |
| MCP configuration JSON | `node -e "JSON.parse(require('fs').readFileSync('.opencode/opencode.jsonc','utf8'))"` | Passed |
| MCP server status | OpenCode `mcp list` | Context7, Playwright, Obsidian, source, and MongoDB connected; GitHub requires authentication |
| Skill frontmatter | Local structural validation | Passed |

## Follow-ups

- Reload OpenCode and confirm the `source` and `obsidian` filesystem servers connect.
- Authenticate the existing GitHub server if repository issue/PR access is needed.

## Related notes

- [[MCP]]
- [[Environment]]
- [[00-Home]]
