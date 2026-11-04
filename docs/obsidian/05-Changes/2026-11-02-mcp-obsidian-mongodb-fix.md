---
date: 2026-11-02
type: change
area: [tooling, mcp]
status: complete
related: [[MCP]], [[Environment]]
tags: [change, mcp]
---

# MCP Obsidian and MongoDB fix

## What changed

- `.opencode/opencode.jsonc`: MongoDB server now runs the globally installed `mongodb-mcp-server` binary instead of the corrupted `npx -y mongodb-mcp-server@latest` extraction.
- `.opencode/opencode.jsonc`: Obsidian server now uses the local `@modelcontextprotocol/server-filesystem` server over `docs/obsidian` because the Obsidian desktop app and its Local REST API plugin are not installed.
- Set the user environment variable `MDB_MCP_CONNECTION_STRING=mongodb://localhost:27017/forgeharbor`.
- Updated `docs/obsidian/09-Reference/MCP.md` current-state table.

## Why

`opencode mcp list` reported both `obsidian` and `mongodb` as failed. Obsidian failed with `ECONNREFUSED` because nothing listened on `127.0.0.1:27123` and `OBSIDIAN_API_KEY` was unset. MongoDB failed because the `npx` cache extraction was missing `@mongosh/arg-parser`, and `MDB_MCP_CONNECTION_STRING` was unset.

## Verification

| Check | Command | Result |
|---|---|---|
| MCP status | `opencode mcp list` | context7, mongodb, obsidian, playwright connected; github awaiting OAuth |
| MongoDB port | `Test-NetConnection 127.0.0.1 -Port 27017` | True |
| Vault access | Obsidian MCP `list_allowed_directories` | `docs/obsidian` allowed |

## Follow-ups

- Install Obsidian and enable the Local REST API with MCP plugin to restore the intended remote Obsidian integration, then revert the filesystem fallback.
- Authenticate GitHub via `/mcps`.
- Keep MongoDB read-only.

## Related notes

- [[Change-Log]]
- [[MCP]]
- [[Environment]]