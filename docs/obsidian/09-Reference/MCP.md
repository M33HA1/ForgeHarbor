---
type: reference
status: active
updated: 2026-11-02
tags: [reference, mcp, tooling]
---

# MCP

ForgeHarbor now targets Codex. Project MCP servers live in `.codex/config.toml`; project skills already live in `.agents/skills/` and Codex discovers them there. The previous OpenCode config remains during the transition.

## Servers

| Server | Scope | Transport | Purpose | Credential |
|---|---|---|---|---|
| Context7 | Codex project | Remote HTTP | Current library and framework documentation | Optional Context7 authentication |
| Playwright | Codex project | Local `npx` | Browser automation for frontend smoke checks | None |
| GitHub | Codex project | Remote HTTP, read-only endpoint | Repository metadata, issues, pull requests, Actions logs | Codex OAuth login |
| Obsidian | Codex project | Local filesystem | Search, read, and update this vault | None |
| MongoDB | Codex project | Local stdio, read-only | Inspect local `forgeharbor` data | `MDB_MCP_CONNECTION_STRING` |
| Source | Codex project | Local filesystem | Read and edit code under `apps/`, `deploy/`, `scripts/`, and `pkg/` | None |

## Configuration files

| Scope | Path | Contents |
|---|---|---|
| User | `C:\Users\Meehal\.codex\config.toml` | User-level Codex settings |
| Project | `.codex/config.toml` | Context7, Playwright, GitHub, Obsidian, source filesystem, MongoDB |
| Legacy | `.opencode/opencode.jsonc` | Previous OpenCode MCP config; retain during migration |

Codex reads project configuration only for trusted projects. It shares MCP configuration across Codex CLI, IDE extension, and desktop app. See the [official Codex MCP guide](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).

Secrets are never written into either file. Codex forwards the MongoDB URI from the local environment using `env_vars`:

```toml
[mcp_servers.mongodb]
command = "mongodb-mcp-server"
args = ["--readOnly"]
env_vars = ["MDB_MCP_CONNECTION_STRING"]
```

## Setup

### Context7 and Playwright

Both are configured in the project Codex config. Context7 uses its remote endpoint; browser setup may be needed the first time Playwright runs. Playwright MCP requires Node 20 or newer; the project pins Node 22.

```powershell
npx playwright install chromium
```

### GitHub

The project uses the read-only endpoint with a limited toolset:

```text
https://api.githubcopilot.com/mcp/readonly
X-MCP-Toolsets: repos,issues,pull_requests,actions
```

Authenticate with Codex after opening this repository as a trusted project:

1. Run `codex mcp login github` from a terminal, or open `/mcp` in the Codex TUI.
2. Complete the GitHub OAuth sign-in if prompted.

Keep the configured endpoint read-only and retain its limited toolset header.

### Obsidian

Both filesystem servers use the official `@modelcontextprotocol/server-filesystem` package pinned at `2.1.0` and a Node 24 runtime fetched through `npx`. On Windows, `cmd.exe /c` launches `npx` to avoid PowerShell script-policy issues. This keeps the MCP runtime compatible without changing the app toolchain pinned in `.tool-versions`.

The `obsidian` server is scoped to `docs/obsidian/`. The `source` server is scoped to `apps/`, `deploy/`, `scripts/`, and `pkg/`. Keep those allowlists narrow; never add `config/` or the repository root. The source server can write within its allowed directories, so review changes with the normal diff workflow.

The vault is plain Markdown. If either server is unavailable, use the normal project file tools; do not block documentation or code work on MCP.

### MongoDB

The local Compose database listens on `localhost:27017`. Set the connection string in the user environment:

```powershell
[Environment]::SetEnvironmentVariable('MDB_MCP_CONNECTION_STRING', 'mongodb://localhost:27017/forgeharbor', 'User')
```

The server runs with `--readOnly`, which disables create, update, and delete tools. Do not remove that flag for routine debugging.

### Source filesystem

The `source` server is scoped to `apps/`, `deploy/`, `scripts/`, and `pkg/` so coding tools can inspect and edit implementation files without exposing root `config/`. Keep its allowed directories narrow and do not add `config/` or the repository root. The existing `obsidian` server remains scoped to `docs/obsidian/`.

## Health checks

```powershell
codex mcp list
Test-NetConnection 127.0.0.1 -Port 27017
```

In the Codex TUI, `/mcp` shows active servers.

Expected states:

| Server | Expected when ready |
|---|---|
| context7 | connected when the project is trusted and outbound access is available |
| playwright | connected when `npx` can resolve its package |
| github | connected after OAuth |
| obsidian | connected when its local filesystem server can start |
| mongodb | connected when MongoDB and the connection string are available |
| source | connected when its local filesystem server can start |

A configured server that is not connected is not a working tool. Report the actual state, not the intended state.

### Last checked (2026-11-02)

`codex mcp list` loaded the project configuration. Context7 and GitHub were enabled but not logged in. Playwright, Obsidian, MongoDB, and source were enabled; the CLI displayed `Unsupported` in their Auth column, so verify their live transport state in `/mcp` in the trusted Codex project before relying on them.

## Troubleshooting

| Symptom | Check |
|---|---|
| Filesystem server exits on startup | Node 24 available through `npx`; package install/network access works |
| MongoDB cannot connect | `MDB_MCP_CONNECTION_STRING`; `fh-mongo` running; port 27017 |
| GitHub needs authentication | Run `codex mcp login github` or use `/mcp` in the Codex TUI |
| Playwright cannot launch | `npx playwright install chromium`; Node 22 |
| Server configured but absent | Trust the project, then run `codex mcp list` or `/mcp` |
| Local server fails to start | Check the configured command, required runtime, and package access |

## Secret rules

- Never put a token, key, or connection string with credentials in either config file.
- Use `env_vars` to forward names from the user environment; never copy the values into the Codex config or a password manager export.
- Keep MongoDB read-only unless a task explicitly requires a write.
- Keep GitHub on the read-only endpoint with a limited toolset.
- Rotate any credential that appears in a note, log, issue, or chat transcript.
- Do not paste `config/.env` contents into an MCP prompt.

## Current state

| Server | State as of 2026-11-02 |
|---|---|
| Codex project MCPs | Configured in `.codex/config.toml`; live connection check pending in a trusted Codex project |
| Legacy OpenCode | Previously verified: Context7, Playwright, Obsidian, source, and MongoDB connected; GitHub needed authentication |

See [[Environment]] for application environment variables and [[Debug]] for the general evidence workflow.

## Related notes

- [[Environment]]
- [[00-Home]]
- [[Debug]]
- [[Glossary]]
