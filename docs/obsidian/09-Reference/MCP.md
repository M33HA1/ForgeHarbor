---
type: reference
status: active
updated: 2026-11-02
tags: [reference, mcp, tooling]
---

# MCP

ForgeHarbor uses a hybrid MCP layout: a small global set for tools that are useful in every project, and a project-local set for services that only make sense in this repository.

## Servers

| Server | Scope | Transport | Purpose | Credential |
|---|---|---|---|---|
| Context7 | Global | Remote | Current library and framework documentation | None; optional `CONTEXT7_API_KEY` |
| Playwright | Global | Local `npx` | Browser smoke tests, console/network capture, screenshots | None |
| GitHub | Project | Remote, read-only | Repository metadata, issues, pull requests, Actions logs | OAuth through `/mcps` |
| Obsidian | Project | Local REST API | Search, read, and update this vault | `OBSIDIAN_API_KEY` |
| MongoDB | Project | Local `npx`, read-only | Inspect local `forgeharbor` data | `MDB_MCP_CONNECTION_STRING` |

## Configuration files

| Scope | Path | Contents |
|---|---|---|
| Global | `C:\Users\Meehal\.config\opencode\opencode.json` | Context7, Playwright, and the `superpowers` plugin |
| Project | `.opencode/opencode.jsonc` | GitHub, Obsidian, MongoDB |

Both files use the V2 shape `mcp.servers`. A project server with the same name replaces the global object entirely, so keep server names unique.

Secrets are never written into either file. The config uses `{env:NAME}` substitution:

```jsonc
{
  "mcp": {
    "servers": {
      "obsidian": {
        "type": "remote",
        "url": "http://127.0.0.1:27123/mcp/",
        "oauth": false,
        "headers": {
          "Authorization": "Bearer {env:OBSIDIAN_API_KEY}"
        }
      }
    }
  }
}
```

## Setup

### Context7 and Playwright

Both are configured globally. Context7 works without a key; add `CONTEXT7_API_KEY` only if the public endpoint rate-limits you. Install the Playwright browser once:

```powershell
npx playwright install chromium
```

### GitHub

The project uses the read-only endpoint with a limited toolset:

```text
https://api.githubcopilot.com/mcp/readonly
X-MCP-Toolsets: repos,issues,pull_requests,actions
```

Authenticate from the OpenCode interface:

1. Run `/mcps`.
2. Select `github`.
3. Complete the browser sign-in.

Do not run `opencode mcp auth github` through an automated shell; the authorization link can be hidden in background output.

### Obsidian

Obsidian must be installed and running with a local REST/MCP plugin that exposes port `27123`.

1. Install Obsidian.
2. Open `docs/obsidian/` as a vault.
3. Install and enable the local REST API with MCP plugin.
4. Enable the HTTP server on `127.0.0.1:27123`.
5. Copy the plugin API key into the user environment:

   ```powershell
   [Environment]::SetEnvironmentVariable('OBSIDIAN_API_KEY', '<key>', 'User')
   ```

6. Reload OpenCode and check `/mcps`.

The vault is plain Markdown. If the MCP server is unavailable, edit files directly with the normal file tools; do not block documentation work on Obsidian.

### MongoDB

The local Compose database listens on `localhost:27017`. Set the connection string in the user environment:

```powershell
[Environment]::SetEnvironmentVariable('MDB_MCP_CONNECTION_STRING', 'mongodb://localhost:27017/forgeharbor', 'User')
```

The server runs with `--readOnly`, which disables create, update, and delete tools. Do not remove that flag for routine debugging.

## Health checks

```powershell
opencode mcp list
Test-NetConnection 127.0.0.1 -Port 27017
Test-NetConnection 127.0.0.1 -Port 27123
```

Expected states:

| Server | Expected when ready |
|---|---|
| context7 | connected |
| playwright | connected |
| github | connected after OAuth |
| obsidian | connected when Obsidian and the plugin are running |
| mongodb | connected when MongoDB and the connection string are available |

A configured server that is not connected is not a working tool. Report the actual state, not the intended state.

## Troubleshooting

| Symptom | Check |
|---|---|
| Obsidian connection refused | Obsidian running; plugin enabled; HTTP server on `127.0.0.1:27123` |
| Obsidian returns 401 | `OBSIDIAN_API_KEY` matches the plugin key and is visible to OpenCode |
| MongoDB cannot connect | `MDB_MCP_CONNECTION_STRING`; `fh-mongo` running; port 27017 |
| GitHub needs authentication | `/mcps` → `github` → sign in |
| Playwright cannot launch | `npx playwright install chromium`; Node 22 |
| Server configured but absent | Run `opencode mcp list` from the repository root |
| Project server does not override global | Names must match exactly; the whole server object is replaced |

## Secret rules

- Never put a token, key, or connection string with credentials in either config file.
- Use `{env:NAME}` and set the value in the user environment or a password manager.
- Keep MongoDB read-only unless a task explicitly requires a write.
- Keep GitHub on the read-only endpoint with a limited toolset.
- Rotate any credential that appears in a note, log, issue, or chat transcript.
- Do not paste `config/.env` contents into an MCP prompt.

## Current state

| Server | State as of 2026-11-02 |
|---|---|
| Context7 | Configured globally |
| Playwright | Configured globally; browser install may be needed |
| GitHub | Configured; awaiting OAuth |
| Obsidian | Configured; Obsidian is not installed yet |
| MongoDB | Configured; awaiting `MDB_MCP_CONNECTION_STRING` |

See [[Environment]] for application environment variables and [[Debug]] for the general evidence workflow.

## Related notes

- [[Environment]]
- [[00-Home]]
- [[Debug]]
- [[Glossary]]
