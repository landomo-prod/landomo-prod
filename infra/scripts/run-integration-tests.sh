#!/bin/bash

# ==========================================================================
# Landomo Integration Test Runner
#
# Starts an isolated test environment via docker compose, runs the full
# integration test suite, captures results, and tears down the environment.
#
# Usage:
#   ./scripts/run-integration-tests.sh              # Run all tests
#   ./scripts/run-integration-tests.sh ingest        # Run only ingest tests
#   ./scripts/run-integration-tests.sh --no-teardown # Keep containers running
#
# Environment:
#   TEST_WORKER_SETTLE_MS  - ms to wait for worker (default: 5000)
#   TEST_HEALTH_TIMEOUT    - ms to wait for services (default: 120000)
# ==========================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$PROJECT_DIR/tests/integration"
COMPOSE_FILE="$TEST_DIR/docker-compose.test.yml"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TEARDOWN=true
TEST_FILTER=""
EXIT_CODE=0

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --no-teardown) TEARDOWN=false ;;
    ingest)        TEST_FILTER="ingest-pipeline" ;;
    scrape-runs)   TEST_FILTER="scrape-run-lifecycle" ;;
    staleness)     TEST_FILTER="staleness" ;;
    search)        TEST_FILTER="search" ;;
    *)             echo -e "${RED}Unknown argument: $arg${NC}"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Docker compose helper
# ---------------------------------------------------------------------------
dc() {
  docker compose -f "$COMPOSE_FILE" "$@"
}

# ---------------------------------------------------------------------------
# Cleanup handler
# ---------------------------------------------------------------------------
cleanup() {
  if [ "$TEARDOWN" = "true" ]; then
    echo ""
    echo -e "${BLUE}Tearing down test environment...${NC}"
    dc down --volumes --remove-orphans > /dev/null 2>&1 || true
    echo -e "${GREEN}Test environment removed.${NC}"
  else
    echo ""
    echo -e "${YELLOW}Skipping teardown (--no-teardown). Containers still running.${NC}"
    echo "  To tear down manually: docker compose -f $COMPOSE_FILE down --volumes"
  fi
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo "=========================================="
echo "  Landomo Integration Test Runner"
echo "=========================================="
echo ""

# ---------------------------------------------------------------------------
# Step 1: Install test dependencies
# ---------------------------------------------------------------------------
echo -e "${BLUE}[1/5] Installing test dependencies...${NC}"
cd "$TEST_DIR"
npm install --silent 2>&1 | tail -1
echo -e "${GREEN}  Dependencies installed.${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 2: Start test environment
# ---------------------------------------------------------------------------
echo -e "${BLUE}[2/5] Starting isolated test environment...${NC}"
dc down --volumes --remove-orphans > /dev/null 2>&1 || true
dc up -d --build 2>&1 | tail -5
echo -e "${GREEN}  Containers started.${NC}"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Wait for services
# ---------------------------------------------------------------------------
echo -e "${BLUE}[3/5] Waiting for services to become healthy...${NC}"

HEALTH_TIMEOUT=${TEST_HEALTH_TIMEOUT:-120}
elapsed=0

wait_health() {
  local url=$1
  local label=$2
  local e=0
  while [ $e -lt $HEALTH_TIMEOUT ]; do
    if curl -sf "$url" > /dev/null 2>&1; then
      echo -e "${GREEN}  $label is healthy${NC}"
      return 0
    fi
    sleep 2
    e=$((e + 2))
  done
  echo -e "${RED}  $label did not become healthy within ${HEALTH_TIMEOUT}s${NC}"
  return 1
}

wait_health "http://localhost:13000/api/v1/health" "Ingest service" || exit 1
wait_health "http://localhost:14000/api/v1/health" "Search service" || exit 1

# Also verify postgres is reachable
PG_READY=false
for i in $(seq 1 30); do
  if docker exec landomo-test-postgres pg_isready -U landomo_test > /dev/null 2>&1; then
    PG_READY=true
    break
  fi
  sleep 2
done
if [ "$PG_READY" = "true" ]; then
  echo -e "${GREEN}  PostgreSQL is ready${NC}"
else
  echo -e "${RED}  PostgreSQL did not become ready${NC}"
  exit 1
fi

echo ""

# ---------------------------------------------------------------------------
# Step 4: Run tests
# ---------------------------------------------------------------------------
echo -e "${BLUE}[4/5] Running integration tests...${NC}"
echo ""

cd "$TEST_DIR"

if [ -n "$TEST_FILTER" ]; then
  echo "  Filter: $TEST_FILTER"
  npx jest --config jest.config.ts --runInBand --forceExit "$TEST_FILTER" && EXIT_CODE=0 || EXIT_CODE=$?
else
  npx jest --config jest.config.ts --runInBand --forceExit && EXIT_CODE=0 || EXIT_CODE=$?
fi

echo ""

# ---------------------------------------------------------------------------
# Step 5: Summary
# ---------------------------------------------------------------------------
echo "=========================================="
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "  ${GREEN}All integration tests PASSED${NC}"
else
  echo -e "  ${RED}Some integration tests FAILED (exit code: $EXIT_CODE)${NC}"
fi
echo "=========================================="

exit $EXIT_CODE
