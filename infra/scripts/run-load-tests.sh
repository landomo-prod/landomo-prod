#!/usr/bin/env bash
#
# Run Landomo k6 Load Tests
#
# Usage:
#   ./scripts/run-load-tests.sh                          # Run all tests
#   ./scripts/run-load-tests.sh ingest                   # Run ingest test only
#   ./scripts/run-load-tests.sh search                   # Run search test only
#   ./scripts/run-load-tests.sh combined                 # Run combined test only
#   ./scripts/run-load-tests.sh --influxdb               # Output to InfluxDB
#   INGEST_URL=http://host:3008 ./scripts/run-load-tests.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOAD_DIR="${PROJECT_ROOT}/tests/load"
RESULTS_DIR="${LOAD_DIR}/results"

# Defaults
INGEST_URL="${INGEST_URL:-http://localhost:3000}"
SEARCH_URL="${SEARCH_URL:-http://localhost:4000}"
API_KEY="${API_KEY:-dev_key_1}"
USE_INFLUXDB=false
TEST_FILTER="${1:-all}"

# Parse flags
for arg in "$@"; do
  case $arg in
    --influxdb) USE_INFLUXDB=true ;;
    ingest|search|combined) TEST_FILTER="$arg" ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[load-test]${NC} $*"; }
ok()   { echo -e "${GREEN}[load-test]${NC} $*"; }
warn() { echo -e "${YELLOW}[load-test]${NC} $*"; }
err()  { echo -e "${RED}[load-test]${NC} $*"; }

# Determine k6 binary
K6_CMD=""
if command -v k6 &>/dev/null; then
  K6_CMD="k6"
  log "Using local k6: $(k6 version)"
elif command -v docker &>/dev/null; then
  K6_CMD="docker run --rm -i --network host -v ${LOAD_DIR}:/tests -w /tests grafana/k6:latest"
  log "Using Docker k6 (grafana/k6)"
else
  err "k6 not found. Install k6 or Docker."
  echo ""
  echo "  Install k6:   brew install k6"
  echo "  Or use Docker: docker pull grafana/k6"
  exit 1
fi

# Build k6 output flags
K6_OUTPUT=""
if [ "$USE_INFLUXDB" = true ]; then
  K6_OUTPUT="--out influxdb=http://localhost:8086/k6"
  log "Output will be sent to InfluxDB (view at http://localhost:3030)"
fi

# Ensure results directory exists
mkdir -p "${RESULTS_DIR}"

# Run timestamp for this session
RUN_ID=$(date +%Y%m%d-%H%M%S)

echo ""
echo "============================================================"
echo "  Landomo k6 Load Tests"
echo "============================================================"
echo "  Run ID:      ${RUN_ID}"
echo "  Ingest URL:  ${INGEST_URL}"
echo "  Search URL:  ${SEARCH_URL}"
echo "  Tests:       ${TEST_FILTER}"
echo "  InfluxDB:    ${USE_INFLUXDB}"
echo "============================================================"
echo ""

PASSED=0
FAILED=0
RESULTS=()

run_test() {
  local name="$1"
  local script="$2"
  local extra_env="$3"

  log "Running ${name}..."
  echo ""

  local result_file="${RESULTS_DIR}/${name}-${RUN_ID}.json"

  set +e
  if [ "$K6_CMD" = "k6" ]; then
    K6_OUT_JSON="${result_file}" \
    INGEST_URL="${INGEST_URL}" \
    SEARCH_URL="${SEARCH_URL}" \
    API_KEY="${API_KEY}" \
    ${extra_env} \
    k6 run ${K6_OUTPUT} \
      --summary-export="${result_file}" \
      "${LOAD_DIR}/${script}"
    local exit_code=$?
  else
    ${K6_CMD} run ${K6_OUTPUT} \
      -e INGEST_URL="${INGEST_URL}" \
      -e SEARCH_URL="${SEARCH_URL}" \
      -e API_KEY="${API_KEY}" \
      --summary-export="/tests/results/${name}-${RUN_ID}.json" \
      "/tests/${script}"
    local exit_code=$?
  fi
  set -e

  if [ $exit_code -eq 0 ]; then
    ok "${name}: PASSED"
    PASSED=$((PASSED + 1))
    RESULTS+=("${GREEN}PASS${NC} ${name}")
  else
    err "${name}: FAILED (exit code ${exit_code})"
    FAILED=$((FAILED + 1))
    RESULTS+=("${RED}FAIL${NC} ${name}")
  fi
  echo ""
}

# Run tests based on filter
if [ "$TEST_FILTER" = "all" ] || [ "$TEST_FILTER" = "ingest" ]; then
  run_test "ingest-load" "ingest-load.js" ""
fi

if [ "$TEST_FILTER" = "all" ] || [ "$TEST_FILTER" = "search" ]; then
  run_test "search-load" "search-load.js" ""
fi

if [ "$TEST_FILTER" = "all" ] || [ "$TEST_FILTER" = "combined" ]; then
  run_test "combined-load" "combined-load.js" ""
fi

# Summary
echo ""
echo "============================================================"
echo "  LOAD TEST SUMMARY (${RUN_ID})"
echo "============================================================"
for r in "${RESULTS[@]}"; do
  echo -e "  ${r}"
done
echo ""
echo -e "  Passed: ${GREEN}${PASSED}${NC}"
echo -e "  Failed: ${RED}${FAILED}${NC}"
echo "  Results: ${RESULTS_DIR}/"
echo "============================================================"

if [ "$USE_INFLUXDB" = true ]; then
  echo ""
  echo "  View Grafana dashboard: http://localhost:3030"
fi

exit ${FAILED}
