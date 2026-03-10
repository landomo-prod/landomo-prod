#!/usr/bin/env bash
# build-all.sh - Build verification script for all Landomo services and scrapers
# Usage: ./scripts/build-all.sh [--scrapers-only] [--services-only]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
SKIP=0
RESULTS=()

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

log_pass() { RESULTS+=("PASS  $1"); ((PASS++)); echo -e "  ${GREEN}PASS${NC}  $1"; }
log_fail() { RESULTS+=("FAIL  $1: $2"); ((FAIL++)); echo -e "  ${RED}FAIL${NC}  $1: $2"; }
log_skip() { RESULTS+=("SKIP  $1: $2"); ((SKIP++)); echo -e "  ${YELLOW}SKIP${NC}  $1: $2"; }

build_service() {
  local name="$1"
  local dir="$2"

  if [ ! -d "$dir" ]; then
    log_skip "$name" "directory not found"
    return
  fi
  if [ ! -f "$dir/package.json" ]; then
    log_skip "$name" "no package.json"
    return
  fi

  cd "$dir"

  # Install if no node_modules
  if [ ! -d "node_modules" ]; then
    if ! npm install --prefer-offline --no-audit --no-fund > /dev/null 2>&1; then
      log_fail "$name" "npm install failed"
      return
    fi
  fi

  # Build
  if npm run build > /dev/null 2>&1; then
    log_pass "$name"
  else
    # Try npx tsc as fallback
    if npx tsc > /dev/null 2>&1; then
      log_pass "$name"
    else
      log_fail "$name" "build failed"
    fi
  fi
}

build_scraper() {
  local country="$1"
  local portal="$2"
  local dir="$3"

  local name="scraper/$country/$portal"

  if [ ! -f "$dir/package.json" ]; then
    log_skip "$name" "no package.json"
    return
  fi

  cd "$dir"

  # Install if no node_modules
  if [ ! -d "node_modules" ]; then
    if ! npm install --prefer-offline --no-audit --no-fund > /dev/null 2>&1; then
      log_fail "$name" "npm install failed"
      return
    fi
  fi

  # Build: try npm run build, then npx tsc
  if npm run build > /dev/null 2>&1; then
    log_pass "$name"
  elif npx tsc > /dev/null 2>&1; then
    log_pass "$name"
  elif npx tsc --noEmit > /dev/null 2>&1; then
    log_pass "$name (type-check only, no outDir)"
  else
    log_fail "$name" "build failed"
  fi
}

MODE="${1:-all}"

echo -e "${BOLD}Landomo Build Verification${NC}"
echo "=========================="
echo ""

# ---- Core services ----
if [ "$MODE" != "--scrapers-only" ]; then
  echo -e "${BOLD}[1/3] Core Services${NC}"

  echo "  Building shared-components first (dependency)..."
  build_service "shared-components" "$ROOT_DIR/shared-components"

  build_service "ingest-service" "$ROOT_DIR/ingest-service"
  build_service "search-service" "$ROOT_DIR/search-service"
  build_service "scheduler" "$ROOT_DIR/scheduler"
  echo ""
fi

# ---- Scrapers ----
if [ "$MODE" != "--services-only" ]; then
  echo -e "${BOLD}[2/3] Scrapers${NC}"

  # Find all scraper directories with package.json (exclude shared/, country-level package.json)
  while IFS= read -r pkg; do
    dir="$(dirname "$pkg")"
    portal="$(basename "$dir")"
    country_dir="$(dirname "$dir")"
    country="$(basename "$country_dir")"

    # Skip country-level package.json (e.g. "Czech Republic/package.json")
    # and shared directories
    if [ "$portal" = "shared" ] || [ "$dir" = "$country_dir" ]; then
      continue
    fi

    # Skip if parent dir is "scrapers" (means this is a country-level package.json)
    if [ "$(basename "$country_dir")" = "scrapers" ]; then
      continue
    fi

    # Only check if there's a src/ directory (real scraper, not a utility package)
    if [ ! -d "$dir/src" ]; then
      continue
    fi

    build_scraper "$country" "$portal" "$dir"
  done < <(find "$ROOT_DIR/scrapers" -maxdepth 3 -name "package.json" -not -path "*/node_modules/*" | sort)

  echo ""
fi

# ---- Summary ----
echo -e "${BOLD}[3/3] Summary${NC}"
echo "=========================="
echo -e "  ${GREEN}Passed:${NC}  $PASS"
echo -e "  ${RED}Failed:${NC}  $FAIL"
echo -e "  ${YELLOW}Skipped:${NC} $SKIP"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}Failed builds:${NC}"
  for r in "${RESULTS[@]}"; do
    if [[ "$r" == FAIL* ]]; then
      echo -e "  ${RED}$r${NC}"
    fi
  done
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}All builds passed.${NC}"
  exit 0
fi
