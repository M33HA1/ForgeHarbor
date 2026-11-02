---
type: change-index
status: active
updated: 2026-11-02
tags: [change, changelog]
---

# Change Log

This is the vault view of the root [`CHANGELOG.md`](../../../CHANGELOG.md). The root file is the release-level history; this page links the detailed change notes.

## Unreleased

### Added

- Project operating system: `AGENTS.md`, `CHANGELOG.md`, global `forgeharbor-*` skills, and repo-local Obsidian vault.
- Architecture, service, runbook, decision, security, testing, and reference notes.
- Hybrid MCP configuration: Context7 and Playwright global; GitHub, Obsidian, and MongoDB project-local.
- Build and status scripts for PowerShell and POSIX shells.
- Toolchain pinning and a safe environment example.

### Changed

- `.gitignore` now excludes Obsidian workspace state and Superpowers scratch files.
- The README's setup and port guidance is tracked as stale and will be corrected in Phase 0.

### Security

- Documented the current auth, ownership, routing, and secret-management findings.
- No application security fixes are included in this documentation/tooling change.

### Known issues

- Auth does not build.
- Web uses Node 14 and cannot build Vite 7.
- MinIO image pull fails.
- Traefik cannot read the Docker provider.
- Compose passes blank API keys.
- History, Reports, and Notify have auth and ownership defects.
- The frontend misreads file-scan results.

## Change notes

| Date | Note | Area |
|---|---|---|
| 2026-11-02 | [[2026-11-02-initial-audit]] | Audit, security, build |
| 2026-11-02 | [[2026-11-02-project-operating-system]] | Tooling, docs, MCP |

## Related notes

- [[00-Home]]
- [[Roadmap]]
- [[Backlog]]
