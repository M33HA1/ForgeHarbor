---
date: 2026-11-06
type: change
area: [ci, reports]
status: in-progress
related: [[Reports]]
tags: [change, ci, go]
---

# Go CI build avoids absent VCS metadata

## What changed

- Pinned hosted Report-Go CI to Go 1.24 and added `-buildvcs=false` to the Go build command.
- Updated the Reports Docker builder to Go 1.24 so the image can compile against the upgraded AWS SDK.

## Why

- Hosted CI runs showed `go test ./...` passing, followed by `go build ./...` failing with `error obtaining VCS status` because the container checkout lacks complete Git metadata.

## Verification

| Check | Command | Result |
|---|---|---|
| Hosted Report-Go tests | `go test ./...` | Passed on the CI run that exposed the build failure |
| Hosted Report-Go build | `go build -buildvcs=false ./...` | Awaiting a fresh CI run after the Go 1.24 image update |

## Follow-ups

- Recheck the Report-Go job on the updated branch and confirm the full CI matrix.
- Resolve the remaining dependency and web peer-version conflicts.

## Related notes

- [[Reports]]
- [[Build]]
- [[Change-Log]]
- [[Roadmap]]
