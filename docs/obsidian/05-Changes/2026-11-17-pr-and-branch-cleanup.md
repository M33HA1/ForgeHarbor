---
date: 2026-11-17
type: change
area: [dependencies, ci, repository]
status: locally-verified
updated: 2026-11-17
related: [Auth, Reports, Web]
tags: [change, dependencies, git]
---

# PR and branch cleanup

## What changed

- Reviewed all 18 open Dependabot PRs (#76–93). Sixteen had successful hosted CI; #81 (SHA-1) and #83 (Argon2) failed at legacy Rust Auth compilation. Consolidate their exact dependency targets into one maintenance revision rather than merging independently stale lockfiles.
- Adopt Argon2 0.6's OS-random-salt hashing API and format SHA-1 bytes as uppercase hex for HIBP. Remove the unused direct rand_core dependency. Preserve Argon2id v19, m=19456/t=2/p=1, bounded hashing work, and old stored hashes.
- Update Actix in all Rust services, Malware Reqwest, Reports AWS SDK modules together, Web tooling/icons/tooltip, legacy History dotenv and legacy Notify FastAPI. Regenerate and verify lockfiles.
- Group future minor/patch AWS SDK family updates and Web build-tool updates. Existing schedules, major-update review and required CI gates remain active; no update ignores or scanner suppressions added.
- Remove 22 remote branches verified merged or closed and superseded, with head leases. Delete merged local branch references, detach clean historical worktrees without deleting their files and fast-forward local main. The root workflow modification was a status artifact: working/index/HEAD normalized hashes matched; refreshing that file's index cleared it without discarding content.

## Preserved work

- `codex/aws-deployment-plan` has an unmerged commit and nine edited files. Its older production-budget assumptions are superseded by [[AWS-Deployment]], but its working files were not rewritten or removed.
- `codex/language-revamp` has four unique historical commits; retain the local branch.
- `devsecops-baseline` contains unmerged historical commits; retain its local and remote references.
- Do not remove the open dependency branches until the validated consolidated revision is merged. PR metadata records final closure/deletion counts.

## Verification

| Check | Evidence | Result |
|---|---|---|
| Legacy Auth | Pinned Rust 1.90 `cargo test --locked`; `cargo build --locked` | 26 tests and build pass; old Rust 0.5 and active Go synthetic PHC vectors verify, wrong passwords fail, fresh salts differ and cost parameters stay fixed |
| HIBP contract | Existing prefix/suffix and request-header tests | Pass; uppercase 40-character SHA-1 representation retained |
| Rust scanners | Pinned Rust 1.90 locked tests for Malware/Phishing | Pass |
| Reports | Pinned Go 1.27.3 race tests and build | Pass; credential-chain, temporary token, refresh and storage tests retained |
| Web/legacy History | Production TypeScript/Vite and TypeScript builds | Pass; npm audits reported no vulnerabilities |
| Security | Trivy 0.76.1 vuln/secret/misconfiguration scan | No HIGH/CRITICAL findings |
| Documentation/config | 100 vault notes, diff checks and Dependabot YAML parse | Pass |
| Legacy Notify | Python 3.11 worker unit tests after dependency installation | Six tests pass |

The combined Auth check caught an overly broad manifest replacement affecting tracing-actix-web; it was restored before successful builds. The Docker Rust image lacked rustfmt, so formatting used the installed host toolchain and compilation remained in pinned Rust 1.90.

Implementation references checked 2026-11-17: [password-hash 0.6 random-salt API](https://docs.rs/password-hash/0.6.1/password_hash/trait.PasswordHasher.html), [Dependabot grouping options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference).

## Follow-ups

- Require all 11 hosted CI checks and the security workflow on the final revision before merge; resolve or supersede the original dependency PRs only afterward.
- Keep provider rotation, live scans and AWS deployment verification as separate gates. No cloud resources changed.

## Related notes

- [[Auth]]
- [[Reports]]
- [[Web]]
- [[Test]]
- [[AWS-Deployment]]
- [[Change-Log]]
