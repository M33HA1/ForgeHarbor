---
date: 2026-11-02
type: change
area: [tooling, documentation, mcp, developer-experience]
status: complete
related: ["[[00-Home]]", "[[Change-Log]]", "[[Environment]]", "[[MCP]]", "[[Build]]", "[[Roadmap]]"]
tags: [change, tooling, docs, mcp]
---

# Project operating system

## What changed

No application code was changed. This change adds the layer that makes the repository easier to build, operate, track, and explain.

- Root `AGENTS.md` with build commands, language boundaries, security rules, and definition of done.
- Repo-local Obsidian vault at `docs/obsidian/` with a dashboard, architecture, services, runbooks, ADRs, changes, roadmap, security, testing, and reference notes.
- Mermaid diagrams in notes and two Obsidian Canvas maps.
- Ten global `forgeharbor-*` skills for build, debug, architecture, change tracking, roadmap, security, Obsidian, service scaffolding, release, and MCP.
- Hybrid MCP configuration: Context7 and Playwright globally; GitHub, Obsidian, and MongoDB project-locally.
- PowerShell and POSIX build/status scripts with health probes and honest exit codes.
- `.tool-versions` and `config/.env.example` for reproducible setup.
- `.gitignore` rules for Obsidian workspace state, installed plugins, and Superpowers scratch files.

## Why

The repository had working parts but no operating system around them:

- Setup knowledge lived in scattered commands and README drift.
- Failures were rediscovered instead of recorded.
- Security findings had no tracked remediation order.
- Changes had no release-level or detailed history.
- The polyglot language choices had no written rationale.
- MCP tools had no consistent scope or secret-handling rules.

The result was a project that was hard to resume, hard to demo, and easy to describe inaccurately.

## Verification

| Check | Command | Result |
|---|---|---|
| PowerShell scripts parse | `Parser::ParseFile` on `dev.ps1` and `status.ps1` | Pass |
| Shell scripts parse | `bash -n scripts/dev.sh scripts/status.sh` | Pass |
| Tooling checks | `.\scripts\dev.ps1 test` | Pass |
| Tooling checks, POSIX | `./scripts/dev.sh test` | Pass |
| Status output | `.\scripts\status.ps1 -NoMcp` | Branch, commit, containers, and health reported |
| Health exit code | `.\scripts\dev.ps1 health` | Exit 1 while services are down |
| MCP inventory | `opencode mcp list` | 5 servers configured; 2 connected, 3 awaiting local setup |
| Vault JSON | `.obsidian/*.json` and `Canvas/*.canvas` | All parse |
| Link check | Vault wikilink resolver | Zero broken local links |
| Scope check | `git status --porcelain` | No `apps/` changes |

MCP state at verification time:

| Server | State |
|---|---|
| Context7 | Connected |
| Playwright | Connected |
| GitHub | Needs OAuth |
| Obsidian | Failed; Obsidian and the local REST/MCP plugin are not installed |
| MongoDB | Failed; `MDB_MCP_CONNECTION_STRING` is not set |

These are environment prerequisites, not code defects. See [[MCP]].

## Follow-ups

1. Install Obsidian, open `docs/obsidian/` as a vault, enable the local REST/MCP plugin on port 27123, and set `OBSIDIAN_API_KEY`.
2. Set `MDB_MCP_CONNECTION_STRING` and confirm the read-only MongoDB server connects.
3. Authenticate GitHub through `/mcps`.
4. Fix the Phase 0 blockers in [[Backlog]] before adding new services.
5. Correct the README ports, paths, and clean-clone setup.
6. Add CI for the four language toolchains and the vault link check.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Environment]]
- [[MCP]]
- [[Build]]
- [[Roadmap]]
- [[Security-Review]]
