---
date: 2026-11-06
type: change
area: [ci, security]
status: in-progress
related: [[Security-Review]]
tags: [change, ci, trivy, security]
---

# CI reports actionable Trivy finding details

## What changed

- The CI security summary now prints affected package names, installed versions, available fixed versions, and misconfiguration resources for HIGH/CRITICAL findings.
- Secret findings remain limited to rule IDs and counts; the summary does not print match text, source snippets, or secret paths.
- Refreshed vulnerable Rust and Go dependencies to patched releases.
- Set unprivileged runtime users for all scanned Dockerfiles and added --no-install-recommends to Notify's apt install.
- Updated hosted integration setup to grant the non-root Auth UID read-only group access to its ephemeral test signing key.

## Why

- The strict Trivy gate correctly exits nonzero when HIGH/CRITICAL findings are present, but the previous summary only showed finding IDs and counts, which was insufficient to identify safe dependency or configuration remediations.

## Verification

| Check | Command | Result |
|---|---|---|
| Rust dependency locks | Cargo update in isolated scratch manifests | Cargo lockfiles refreshed for Auth, Malware, and Phishing. |
| Go dependency updates | Reports CI runs go mod tidy and prints the module lock diffs | Pending CI run |
| Main workflow | ForgeHarbor CI | Pending |

## Follow-ups

- Capture the Go module checksum updates from CI, remove the temporary lock-diff output, then rerun the strict gate and full integration suite.
- Keep unfixed findings visible; do not suppress the gate with broad ignores.

## Related notes

- [[Security-Review]]
- [[Change-Log]]
- [[Roadmap]]
