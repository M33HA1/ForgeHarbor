---
date: 2026-11-05
updated: 2026-11-05
type: change
area: [ci, security, testing]
status: pending-hosted-verification
related: [[2026-11-03-ci-matrix-and-strict-integration]]
tags: [change, ci, github-actions]
---

# Fix CI runner context validation

## What changed

- Removed `runner.temp` from the integration job's job-level environment. The browser test step now builds `PLAYWRIGHT_MODULE` from the runner-provided `RUNNER_TEMP` shell environment.

## Why

- GitHub rejected the workflow before any jobs could run because the `runner` context is unavailable in that job-level `env` expression. This blocked CI on all open pull requests.

## Verification

| Check | Command | Result |
|---|---|---|
| CI workflow syntax and context validation | Pending fresh hosted run after push | Not yet run |
| Notify dependency regression tests | Isolated updated dependency environment; `python -m unittest test_worker.py` | Passed (6 tests) |

## Follow-ups

- Confirm the fresh hosted CI and Trivy runs pass on `main` and open pull requests.
- Merge only pull requests whose current checks and mergeability are verified.
- [[2026-11-03-ci-matrix-and-strict-integration]]
- [[00-Home]]
- [[Backlog]]
- [[Test-Matrix]]

## Related notes

- [[Change-Log]]
- [[Roadmap]]
