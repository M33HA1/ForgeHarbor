---
name: forgeharbor-build
description: Build, run, and verify ForgeHarbor services or the local Compose stack. Use for build failures, local startup, health checks, and the repo's baseline test command.
metadata:
  short-description: Build and run ForgeHarbor
---

# ForgeHarbor Build

Use the commands in `AGENTS.md` and `docs/obsidian/03-Runbooks/Build.md` and `Run.md`.

- Prefer `scripts/dev.ps1` on Windows and `scripts/dev.sh` on POSIX; the gateway is port 8088.
- Build or inspect only the affected service first. Use Docker for Go when Go is unavailable locally.
- Keep `config/.env` out of command output, build context, and diffs. Do not start, stop, or rebuild the whole stack unless the requested work needs it.
- Report exact commands and observed results. A successful config check is not evidence that services are healthy.
