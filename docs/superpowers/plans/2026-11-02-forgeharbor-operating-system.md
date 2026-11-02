# ForgeHarbor Project Operating System

**Goal:** Add a repo-local Obsidian knowledge base, global ForgeHarbor skills, hybrid MCP configuration, change tracking, roadmap, and easy-build scripts without changing application code.

**Scope:** Documentation, agent guidance, developer tooling, and OpenCode configuration only.

**Non-goals:** Fixing the application startup, security, routing, or data-access defects. Those are tracked in the vault and remain Phase 0 work.

## Global Constraints

- Do not modify application source code in this change.
- Do not commit secrets. Use environment variables for MCP credentials.
- Keep the Obsidian vault inside the repository at `docs/obsidian/`.
- Keep skills global at `C:\Users\Meehal\.config\opencode\skills`.
- Preserve the existing global `superpowers` plugin configuration.
- Every note linked from `00-Home.md`.
- Every behavior change updates `CHANGELOG.md` and a change note.

## Task 1: Vault foundation and architecture

Create the vault skeleton, home dashboard, architecture notes, Mermaid diagrams, templates, graph groups, and Canvas files.

**Verification:** `00-Home.md` exists; every architecture note is linked; `.obsidian/graph.json` and both `.canvas` files parse as JSON.

## Task 2: Service notes, runbooks, and reference

Create service notes for Auth, Phishing, Malware, History, Reports, Notify, and Web; runbooks for Build, Run, Debug, Test, and Deploy; reference pages for ports, environment, API contracts, and glossary.

**Verification:** every service note links to at least one runbook, ADR, or change note; all seven services are represented.

## Task 3: Decisions, changes, roadmap, security, and testing

Create ADRs for polyglot boundaries, Go control plane, and PostgreSQL for history; the initial audit change note; roadmap, backlog, milestones; security review; threat model; and test matrix.

**Verification:** all ADRs and change notes are linked from `00-Home.md`; roadmap contains Phase 0 through Phase 4.

## Task 4: Persistent rules and changelog

Create root `AGENTS.md`, `CHANGELOG.md`, `config/.env.example`, and update `.gitignore` for Obsidian workspace state and Superpowers scratch.

**Verification:** `AGENTS.md` contains build commands, language boundaries, definition of done, and security rules; no secret values are present.

## Task 5: Global ForgeHarbor skills

Create ten global skills: build, debug, architecture, change-tracker, roadmap, security, obsidian, service-scaffold, release, and mcp.

**Verification:** every `SKILL.md` has valid frontmatter with `name` and a `description` starting with `Use when`; all ten directories exist.

## Task 6: MCP configuration

Merge Context7 and Playwright into the global OpenCode config; create project-local GitHub, Obsidian, and MongoDB configuration; document setup, health checks, and secret handling.

**Verification:** both config files parse; no secret values are embedded; `opencode mcp list` runs.

## Task 7: Build and status scripts

Create `scripts/dev.ps1`, `scripts/dev.sh`, `scripts/status.ps1`, and `scripts/status.sh`; pin tool versions; document usage.

**Verification:** PowerShell scripts parse; shell scripts pass `bash -n`; status output includes branch, commit, containers, health, and MCP state.

## Task 8: Final verification and commit

Check every vault link, validate JSON and Canvas files, run scripts in read-only modes, confirm no application code changed, and commit the documentation/tooling change.

**Verification:** link checker reports zero broken local wikilinks; `git diff --stat` shows only docs, scripts, config examples, and OpenCode config; `git status` is clean after commit.
