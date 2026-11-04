---
date: 2026-11-03
type: change
area: [tooling, documentation, context]
status: complete
related: [[00-Home]], [[History]], [[Reports]], [[Security-Review]], [[Test-Matrix]], [[API-Contracts]], [[Ports]], [[Backlog]]
tags: [change, skills, documentation]
---

# Add a project context skill and align current docs

## What changed

- Added `forgeharbor-context` to restore current roadmap, working-tree, service, and blocker context at the start of ForgeHarbor work.
- Updated `AGENTS.md` to route continuation work through the context skill.
- Corrected History pagination and cursor documentation, Report content validation wording, and stale security/test statuses using verification already recorded in the repository.
- Rewrote the README's setup and API guidance and marked FH-019 complete; aligned the runbook, port reference, and API contract note.
- Updated the dashboard and change records to include the new skill and current GitHub project MCP login state.

## Why

Continuation work was relying on chat history while the repository already held the durable state. Several service and test notes also described pre-fix behavior as current, making the next action harder to choose accurately.

## Verification

| Check | Command | Result |
|---|---|---|
| Skill instructions | Manual review against `skill-creator` guidance | Complete; focused project-specific entrypoint |
| Documentation claims | Compared edits with current service code, Compose config, dev scripts, route list, and recorded change-note evidence | Updated; no new runtime verification claimed |

## Follow-ups

- Use `forgeharbor-context` on future ForgeHarbor continuation requests and keep canonical notes current as verification changes.
- Project GitHub MCP OAuth remains pending; the current shell does not expose the `codex` CLI.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[History]]
- [[Security-Review]]
- [[Test-Matrix]]
- [[API-Contracts]]
- [[Ports]]
- [[Backlog]]
