#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
export FH_REQUIRE_RUNNING=1
PYTHON="${PYTHON:-python3}"
COMPOSE=(docker compose -f deploy/compose/docker-compose.dev.yml)
cleanup() { "${COMPOSE[@]}" stop fh-auth-test-proxy >/dev/null 2>&1 || true; }
trap cleanup EXIT
"${COMPOSE[@]}" --profile integration up -d fh-auth-test-proxy
export AUTH_RATE_TEST_URL="${AUTH_RATE_TEST_URL:-http://localhost:8086}"
bash scripts/dev.sh health
bash scripts/dev.sh test
node scripts/check-edge-auth.mjs
node scripts/check-scanner-auth.mjs
"$PYTHON" scripts/check-auth-inputs.py
"$PYTHON" scripts/check-auth-flow.py
(cd apps/history-ts && npm run test:integration)
"$PYTHON" scripts/check-report-list.py
"$PYTHON" scripts/check-report-integrity.py
(cd apps/notify-py && "$PYTHON" scripts/check-ownership.py && "$PYTHON" scripts/check-delivery.py)
