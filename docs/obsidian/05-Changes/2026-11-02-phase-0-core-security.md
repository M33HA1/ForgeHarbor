---
date: 2026-11-02
type: change
area: [security, frontend, build, messaging, tooling]
status: complete
related: [[History]], [[Reports]], [[Notify]], [[Web]], [[Security-Review]], [[Roadmap]]
tags: [change, phase-0, security]
---

# Stabilize the web client and secure data routes

## What changed

- Moved both Web image stages to Node 22.12 and added `.dockerignore` files for Web, History, Reports, and Notify.
- Mapped the nested VirusTotal file result to the UI, removed the fabricated confidence fallback, and linked the vendor report.
- Removed Compose overrides that replaced provider keys loaded from `env_file` with blank values.
- Added fail-closed RS256 JWT verification to History, Reports, and Notify, using the Auth public key mounted read-only.
- Scoped History, Reports, and Notify reads to the verified user subject; Reports stores ownership, uses a unique report-ID object key, and publishes notification messages to the configured queue.
- Expanded the route check to require 401 for missing and forged tokens, removed Notify's unused PyYAML dependency, and repaired `dev.ps1 health` argument forwarding.
- Bound all published development application and infrastructure ports to loopback and made the PowerShell health probe work with those bindings.
- Updated the developer MCP commands to query Codex rather than the legacy OpenCode CLI.

## Why

The application image could not build under Node 14, file detections could render as clean, and three data APIs permitted anonymous access. Reports and Notify also used different queues, preventing report notifications from reaching the consumer.

## Verification

| Check | Command | Result |
|---|---|---|
| Web bundle | `npm.cmd run build` in `apps/web` | Passed on local Node 22.20 |
| History TypeScript | `npm.cmd run build` in `apps/history-ts` | Passed |
| Service images | Docker Compose build for History, Reports, Notify, Web | Passed after adding the JWT dependency checksum |
| Runtime health | `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 health` | All eight probes returned HTTP 200 |
| Route/auth contract | `node scripts/check-routes.mjs` | 20 probes passed; missing/forged tokens rejected |
| Repository checks | `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 test` | Passed |
| PowerShell health wrapper | `powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 health` | Passed; all eight service probes returned HTTP 200 |

## Follow-ups

- Verify report artifact creation and download against RustFS with a disposable authenticated user.
- Add valid-token and cross-user regression fixtures; existing legacy reports/notifications need a controlled ownership migration.
- Centralize token validation at the edge and keep production services internal-only.
- Confirm provider credentials locally without exposing their values; rotate the existing local credentials before publishing.
- Review the History risk filter when the canonical scan result schema is defined.
- `codex mcp list` loaded project configuration; Context7 and GitHub are not logged in, and local servers still need live transport verification in `/mcp`.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[ADR-0004-gateway-prefix-contract]]
