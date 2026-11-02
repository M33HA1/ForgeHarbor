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
- Architecture review note with eight findings, a target architecture, and three open decisions.
- Gateway route-contract test (`scripts/check-routes.mjs`).
- ADR-0004 for the gateway prefix contract.

### Changed

- `.gitignore` now excludes Obsidian workspace state, installed vault plugins, and Superpowers scratch files.
- The Obsidian vault is the project's living knowledge base; `00-Home.md` is the dashboard.
- Architecture and routing notes now document the History, Reports, and Notify prefix conflicts and the inconsistent gateway contract.
- Auth, Phishing, and Malware build on pinned stable Rust 1.90.0 instead of nightly.
- Every service registers its full public prefix; the gateway no longer strips it (D1=B).
- Health probes in the dev scripts use the prefixed paths.

### Security

- Documented the current auth, ownership, routing, and secret-management findings in `docs/obsidian/07-Security/Security-Review.md`.
- The Auth image no longer copies `config`; Phishing and Malware copy only `jwt-public.pem`.
- Added `.dockerignore` to the Rust apps so `.env`, the private key, and `target` stay out of build contexts.

### Fixed

- Auth, Phishing, and Malware images build; the `E0391` nightly async-drop cycle is gone.
- The Docker cache no longer ships a dummy binary when the real source is copied after the dependency build.
- History, Reports, and Notify data routes no longer 404 through the gateway because of a prefix mismatch.
- Notify now exposes `/notify`, which is the path the frontend already calls.

### Known issues

- Web uses Node 14 and cannot build Vite 7.
- MinIO image pull fails.
- Traefik cannot read the Docker provider, so the route contract cannot be verified end to end.
- Compose passes blank `GEMINI_API_KEY` and `VIRUSTOTAL_API_KEY` values.
- History, Reports, and Notify have auth and ownership defects.
- Reports publishes to `report_events` while Notify consumes `notifications`.
- The frontend misreads file-scan results.
- Notify still copies its build context, and the infrastructure ports remain open.
- `config/.env` contains live-looking keys and must be rotated before publication.

### Documentation

- See `docs/obsidian/05-Changes/2026-11-02-initial-audit.md` for the audit record.
- See `docs/obsidian/05-Changes/2026-11-02-architecture-review.md` for the review.
- See `docs/obsidian/05-Changes/2026-11-02-phase-0-auth-build-and-routes.md` for the build and routing change.
- See `docs/obsidian/01-Architecture/Architecture-Review.md` for the findings and target shape.
- See `docs/obsidian/05-Changes/2026-11-02-project-operating-system.md` for the tooling change.
- See `docs/obsidian/06-Roadmap/Roadmap.md` for the Phase 0–4 plan.
