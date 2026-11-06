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
- Updated the Auth MongoDB driver to 3.9.1, Rust OpenSSL lock entries to 0.10.79, and vulnerable Go transitive dependencies to scanner-listed fixed versions.
- Set unprivileged runtime users for all scanned Dockerfiles and added --no-install-recommends to Notify's apt install.

## Why

- The strict Trivy gate correctly exits nonzero when HIGH/CRITICAL findings are present, but the previous summary only showed finding IDs and counts, which was insufficient to identify safe dependency or configuration remediations.

## Verification

| Check | Command | Result |
|---|---|---|
| Rust dependency locks | Cargo update in isolated scratch manifests | Completed; Auth MongoDB 3.9.1, Malware/Phishing OpenSSL 0.10.79 |
| Go dependency updates | Reports CI runs go mod tidy and prints only dependency lock diffs | Pending CI run |
| Main workflow | ForgeHarbor CI | Pending |

## Follow-ups

- Capture the Go module checksum updates from CI, remove the temporary lock-diff output, then rerun the strict gate and full integration suite.
- Keep unfixed findings visible; do not suppress the gate with broad ignores.

## Related notes

- [[Security-Review]]
- [[Change-Log]]
- [[Roadmap]]
