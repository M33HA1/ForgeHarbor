---
name: forgeharbor-mcp
description: Configure, troubleshoot, or rotate ForgeHarbor MCP integrations. Use when a project MCP server is missing, disconnected, or needs safer scoping.
metadata:
  short-description: Maintain ForgeHarbor MCP
---

# ForgeHarbor MCP

Read `docs/obsidian/09-Reference/MCP.md` and `.codex/config.toml` before changing Codex integrations. During migration, inspect `.opencode/opencode.jsonc` when compatibility with the previous client matters; preserve it unless the user asks to remove it.

- Keep MCP servers scoped to the project when the project owns their purpose; use user scope for genuinely shared tools.
- Scope filesystem servers to the smallest useful project directories; do not expose `config/` or the entire repository when secrets may be present.
- Keep GitHub read-only unless a requested workflow needs more. Keep MongoDB `--readOnly` for routine work.
- Use environment-variable substitution for secrets, never literals. Verify the server's actual connection state after config changes; configured is not connected.
- Do not run OAuth flows through background shells or print credential values.
