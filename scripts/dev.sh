#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/deploy/compose/docker-compose.dev.yml"
ENV_FILE="$ROOT/config/.env"

usage() {
  cat <<'EOF'
ForgeHarbor development helper

Usage:
  ./scripts/dev.sh <command> [args]

Commands:
  build    Build every service image
  up       Start the stack in the background (add --build on first run)
  down     Stop containers, keep volumes
  status   Show branch, commit, containers, health, and MCP state
  health   Probe the gateway and every service; exit 1 if any probe fails
  logs     Follow logs; pass a service name to narrow, e.g. logs fh-auth
  test     Validate Compose, vault, shell, Python, and gateway routes
  config   Validate the Compose file without starting anything
  mcp      Show MCP server connection state
  help     Show this message

The gateway is http://localhost:8088. The Traefik dashboard is http://localhost:8000.
EOF
}

require_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "error: docker was not found on PATH. Install Docker Desktop and reopen the terminal." >&2
    exit 1
  fi
}

warn_env() {
  if [ ! -f "$ENV_FILE" ]; then
    echo "warning: config/.env is missing. Copy config/.env.example to config/.env and fill in placeholders before starting." >&2
  fi
}

compose() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

validate_json() {
  local file="$1"
  if command -v python >/dev/null 2>&1; then
    if python -c 'import json,sys; json.load(sys.stdin)' < "$file"; then
      echo "  ok  $(basename "$file")"
    else
      echo "  bad $(basename "$file")"
      return 1
    fi
  elif command -v node >/dev/null 2>&1; then
    if node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>JSON.parse(d))' < "$file"; then
      echo "  ok  $(basename "$file")"
    else
      echo "  bad $(basename "$file")"
      return 1
    fi
  else
    echo "  skipped: python and node not found"
  fi
}

cmd="${1:-help}"
if [ "$#" -gt 0 ]; then shift; fi

case "$cmd" in
  build)
    require_docker
    warn_env
    compose build "$@"
    ;;
  up)
    require_docker
    warn_env
    compose up -d "$@"
    echo "Stack start requested. Run ./scripts/dev.sh status, then ./scripts/dev.sh health."
    ;;
  down)
    require_docker
    compose down "$@"
    ;;
  status)
    exec bash "$ROOT/scripts/status.sh" "$@"
    ;;
  health)
    exec bash "$ROOT/scripts/status.sh" --health-only "$@"
    ;;
  logs)
    require_docker
    compose logs -f "$@"
    ;;
  config)
    require_docker
    compose config --quiet
    echo "Compose configuration is valid."
    ;;
  mcp)
    if ! command -v codex >/dev/null 2>&1; then
      echo "error: codex was not found on PATH; open this trusted repository in Codex to inspect project MCP servers." >&2
      exit 1
    fi
    exec codex mcp list
    ;;
  test)
    failed=0
    require_docker

    echo "==> Compose configuration"
    if ! compose config --quiet; then
      failed=1
    fi

    echo "==> Vault JSON and Canvas files"
    shopt -s nullglob
    for file in "$ROOT"/docs/obsidian/.obsidian/*.json "$ROOT"/docs/obsidian/Canvas/*.canvas; do
      if ! validate_json "$file"; then
        failed=1
      fi
    done
    shopt -u nullglob

    echo "==> Vault wikilinks"
    if command -v node >/dev/null 2>&1; then
      if ! node "$ROOT/scripts/check-links.mjs"; then
        failed=1
      fi
    else
      echo "  skipped: node not found"
    fi

    echo "==> Shell script syntax"
    for script in "$ROOT/scripts/dev.sh" "$ROOT/scripts/status.sh" "$ROOT/scripts/ci/integration.sh"; do
      if [ -f "$script" ]; then
        if bash -n "$script"; then
          echo "  ok  $(basename "$script")"
        else
          echo "  bad $(basename "$script")"
          failed=1
        fi
      fi
    done

    echo "==> Python syntax"
    if command -v python >/dev/null 2>&1; then
      if (cd "$ROOT/apps/notify-py" && python -m compileall -q .); then
        echo "  ok  apps/notify-py"
      else
        failed=1
      fi
      if python -c 'import pathlib,sys; [compile(pathlib.Path(p).read_text(encoding="utf-8"),p,"exec") for p in sys.argv[1:]]' "$ROOT/scripts/check-auth-inputs.py" "$ROOT/scripts/ci/prepare.py" "$ROOT/scripts/ci/security-summary.py"; then
        echo "  ok  Auth and CI Python scripts"
      else
        failed=1
      fi
    else
      echo "  skipped: python not found"
    fi

    echo "==> Gateway route contract"
    if command -v node >/dev/null 2>&1; then
      if ! node "$ROOT/scripts/check-routes.mjs"; then
        failed=1
      fi
      if ! node "$ROOT/scripts/check-cors.mjs"; then
        failed=1
      fi
    else
      echo "  skipped: node not found"
    fi

    echo "==> Known application blockers (tracked, not fixed here)"
    echo "  security: production TLS/exposure, proxy trust, and provider configuration remain open"

    if [ "$failed" -ne 0 ]; then
      echo "error: tooling verification failed." >&2
      exit 1
    fi
    echo "Tooling verification passed."
    ;;
  help|-h|--help)
    usage
    ;;
  *)
    usage
    exit 2
    ;;
esac
