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

## Why

- The strict Trivy gate correctly exits nonzero when HIGH/CRITICAL findings are present, but the previous summary only showed finding IDs and counts, which was insufficient to identify safe dependency or configuration remediations.

## Verification

| Check | Command | Result |
|---|---|---|
| Report parsing | python3 scripts/ci/security-summary.py with a Trivy report | Pending CI run |
| Main workflow | ForgeHarbor CI | Pending |

## Follow-ups

- Use the new component and fix-version output to remediate actionable findings, then rerun the strict gate.
- Keep unfixed findings visible; do not suppress the gate with broad ignores.

## Related notes

- [[Security-Review]]
- [[Change-Log]]
- [[Roadmap]]
