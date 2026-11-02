# Changelog

All notable changes to ForgeHarbor are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project does not have a released version yet.

## [Unreleased]

### Added

- Root `AGENTS.md` with build commands, language boundaries, security rules, and definition of done.
- Repo-local Obsidian knowledge base under `docs/obsidian/`, including architecture, service, runbook, decision, security, testing, and reference notes.
- Mermaid architecture and data-flow diagrams plus Obsidian Canvas maps.
- Global `forgeharbor-*` skills for build, debug, architecture, change tracking, roadmap, security, Obsidian, service scaffolding, release, and MCP.
- Hybrid MCP configuration: Context7 and Playwright globally; GitHub, Obsidian, and MongoDB project-locally.
- PowerShell and POSIX build/status scripts.
- `.tool-versions` for reproducible local toolchains.
- `config/.env.example` with placeholders only.

### Changed

- `.gitignore` now excludes Obsidian workspace state, installed vault plugins, and Superpowers scratch files.
- The Obsidian vault is the project's living knowledge base; `00-Home.md` is the dashboard.

### Security

- Documented the current auth, ownership, routing, and secret-management findings in `docs/obsidian/07-Security/Security-Review.md`.
- No application security fixes are included in this documentation and tooling change.

### Known issues

- Auth does not build with the current `mongodb` dependency.
- Web uses Node 14 and cannot build Vite 7.
- MinIO image pull fails.
- Traefik cannot read the Docker provider.
- Compose passes blank `GEMINI_API_KEY` and `VIRUSTOTAL_API_KEY` values.
- History, Reports, and Notify have auth and ownership defects.
- The frontend misreads file-scan results and calls the wrong notification path.
- `config/.env` contains live-looking keys and must be rotated before publication.

### Documentation

- See `docs/obsidian/05-Changes/2026-11-02-initial-audit.md` for the audit record.
- See `docs/obsidian/05-Changes/2026-11-02-project-operating-system.md` for this tooling change.
- See `docs/obsidian/06-Roadmap/Roadmap.md` for the Phase 0–4 plan.
