---
date: 2026-11-03
type: change
area: [bootstrap, build, runtime, security]
status: complete
related: [[00-Home]], [[Auth]], [[Phishing]], [[Malware]], [[Build]], [[Run]], [[Security-Review]], [[Roadmap]], [[Backlog]]
tags: [change, release-readiness, verification]
---

# Add clean-clone key setup and verify the development stack

## What changed

- Added `scripts/setup-jwt-keys.mjs` to create a local 3072-bit RSA key pair when absent, validate existing Auth keys, and populate matching public-key copies for Phishing and Malware.
- The setup command uses exclusive file creation, refuses incomplete or mismatched key sets, and does not print or overwrite key material.
- Replaced manual OpenSSL and copy steps in the README and build runbook; marked FH-018 complete and resolved the corresponding clean-clone key setup finding.
- Rebuilt all seven application images and started the development Compose stack.

## Why

- A clean clone has no ignored key files. Without an explicit, safe setup step, Auth cannot start and the Rust scanner image builds lack their verifier key.

## Verification

| Check | Command | Result |
|---|---|---|
| Existing key pair and public copies | `node scripts/setup-jwt-keys.mjs` | Passed; Auth pair valid, verifier copies match, existing files unchanged |
| All application image builds | `docker compose -f deploy/compose/docker-compose.dev.yml build` | Passed for Auth, Phishing, Malware, History, Reports, Notify, and Web |
| Stack startup | `docker compose -f deploy/compose/docker-compose.dev.yml up -d` | Passed; all application and infrastructure containers started |
| Health probes | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 health` | Passed; gateway and seven services returned HTTP 200 |
| Repository verification | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/dev.ps1 test` | Passed; 20 gateway route/auth probes and tooling checks passed |
| Diff and credential patterns | `git diff --check`; credential-pattern scan of source/config/docs paths | Passed; no diff whitespace errors or matching credential literals |

## Follow-ups

- Live provider scan flows remain unverified because valid Gemini and VirusTotal credentials are not established here.
- Rotation of exposed-looking local credentials, edge auth, and production deployment controls remain open in [[Security-Review]] and [[Backlog]].
- The wider security and product regression suite still needs persistent valid-token ownership tests and end-to-end user-flow coverage.

## Related notes

- [[Change-Log]]
- [[00-Home]]
- [[Auth]]
- [[Build]]
- [[Security-Review]]
- [[Backlog]]
