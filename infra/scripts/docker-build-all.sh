#!/usr/bin/env bash
# docker-build-all.sh - Build all Docker images for Landomo services and scrapers
# Usage: ./scripts/docker-build-all.sh [--dry-run] [--no-cache]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
SKIP=0
RESULTS=()
DRY_RUN=false
NO_CACHE=""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

# Parse args
for arg in "$@"; do
  case $arg in
    --dry-run) DRY_RUN=true ;;
    --no-cache) NO_CACHE="--no-cache" ;;
  esac
done

log_pass() { RESULTS+=("PASS  $1"); ((PASS++)); echo -e "  ${GREEN}PASS${NC}  $1"; }
log_fail() { RESULTS+=("FAIL  $1: $2"); ((FAIL++)); echo -e "  ${RED}FAIL${NC}  $1: $2"; }
log_skip() { RESULTS+=("SKIP  $1: $2"); ((SKIP++)); echo -e "  ${YELLOW}SKIP${NC}  $1: $2"; }

docker_build() {
  local name="$1"
  local dir="$2"
  local tag="$3"

  if [ ! -f "$dir/Dockerfile" ]; then
    log_skip "$name" "no Dockerfile"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo -e "  ${YELLOW}DRY${NC}   docker build -t $tag $dir"
    ((PASS++))
    RESULTS+=("DRY   $name -> $tag")
    return
  fi

  if docker build $NO_CACHE -t "$tag" "$dir" > /dev/null 2>&1; then
    log_pass "$name -> $tag"
  else
    log_fail "$name" "docker build failed"
  fi
}

echo -e "${BOLD}Landomo Docker Build${NC}"
echo "====================="
if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN - no images will be built${NC}"
fi
echo ""

# ---- Core services ----
echo -e "${BOLD}[1/2] Core Services${NC}"

docker_build "ingest-service" "$ROOT_DIR/ingest-service" "landomo/ingest-service:latest"
docker_build "search-service" "$ROOT_DIR/search-service" "landomo/search-service:latest"
docker_build "scheduler" "$ROOT_DIR/scheduler" "landomo/scheduler:latest"
echo ""

# ---- Scrapers ----
echo -e "${BOLD}[2/2] Scrapers${NC}"

while IFS= read -r dockerfile; do
  dir="$(dirname "$dockerfile")"
  portal="$(basename "$dir")"
  country_dir="$(dirname "$dir")"
  country="$(basename "$country_dir")"

  # Normalize country name for docker tag (lowercase, replace spaces with hyphens)
  country_tag=$(echo "$country" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  tag="landomo/scraper-${country_tag}-${portal}:latest"

  docker_build "scraper/$country/$portal" "$dir" "$tag"
done < <(find "$ROOT_DIR/scrapers" -maxdepth 3 -name "Dockerfile" -not -path "*/node_modules/*" | sort)

echo ""

# ---- Summary ----
echo -e "${BOLD}Summary${NC}"
echo "====================="
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
  echo -e "${GREEN}${BOLD}All Docker builds passed.${NC}"
  exit 0
fi
