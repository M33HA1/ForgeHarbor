#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT/deploy/compose/docker-compose.dev.yml"
HEALTH_ONLY=0
NO_MCP=0

for arg in "$@"; do
  case "$arg" in
    --health-only) HEALTH_ONLY=1 ;;
    --no-mcp) NO_MCP=1 ;;
    *)
      echo "usage: status.sh [--health-only] [--no-mcp]" >&2
      exit 2
      ;;
  esac
done

STATE=""
DETAIL=""

check_endpoint() {
  local url="$1" code
  code="$(curl -sS -o /dev/null -m 2 -w '%{http_code}' "$url" 2>/dev/null || true)"
  if [ -z "$code" ] || [ "$code" = "000" ]; then
    STATE="DOWN"
    DETAIL="unreachable"
    return 1
  fi
  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    STATE="UP"
    DETAIL="HTTP $code"
    return 0
  fi
  STATE="DOWN"
  DETAIL="HTTP $code"
  return 1
}

write_health() {
  echo ""
  echo "Health"
  local failures=0
  local names=(gateway auth phishing malware history reports notify web)
  local urls=(
    "http://localhost:8088/auth/health"
    "http://localhost:8080/auth/health"
    "http://localhost:8081/phishing/health"
    "http://localhost:8082/malware/health"
    "http://localhost:8083/history/health"
    "http://localhost:8084/reports/health"
    "http://localhost:8085/notify/health"
    "http://localhost:3000/"
  )
  local i
  for i in "${!names[@]}"; do
    if check_endpoint "${urls[$i]}"; then
      printf '  %-9s %-42s %-6s %s\n' "${names[$i]}" "${urls[$i]}" "$STATE" "$DETAIL"
    else
      printf '  %-9s %-42s %-6s %s\n' "${names[$i]}" "${urls[$i]}" "$STATE" "$DETAIL"
      failures=$((failures + 1))
    fi
  done
  HEALTH_FAILURES=$failures
}

if [ "$HEALTH_ONLY" -eq 1 ]; then
  write_health
  if [ "$HEALTH_FAILURES" -gt 0 ]; then
    exit 1
  fi
  exit 0
fi

echo "ForgeHarbor status"
echo ""
echo "  Branch:        $(git -C "$ROOT" branch --show-current 2>/dev/null || echo unknown)"
echo "  Commit:        $(git -C "$ROOT" log -1 --format='%h %s' 2>/dev/null || echo unknown)"
echo "  Working tree:  $(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ') changed path(s)"

echo ""
echo "Containers"
if command -v docker >/dev/null 2>&1; then
  if output="$(docker compose -f "$COMPOSE_FILE" ps 2>&1)"; then
    printf '%s\n' "$output" | sed 's/^/  /'
  else
    echo "  docker compose ps failed:"
    printf '%s\n' "$output" | sed 's/^/  /'
  fi
else
  echo "  docker not found on PATH"
fi

write_health

if [ "$NO_MCP" -eq 0 ]; then
  echo ""
  echo "MCP"
  if command -v opencode >/dev/null 2>&1; then
    if output="$(opencode mcp list 2>&1)"; then
      printf '%s\n' "$output" | sed 's/^/  /'
    else
      echo "  opencode mcp list failed:"
      printf '%s\n' "$output" | sed 's/^/  /'
    fi
  else
    echo "  opencode not found on PATH"
  fi
fi

echo ""
echo "Use ./scripts/dev.sh health for an exit code that fails on DOWN services."
exit 0
