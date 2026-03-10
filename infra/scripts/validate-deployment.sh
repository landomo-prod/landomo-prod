#!/usr/bin/env bash
# ==============================================================================
# Landomo Deployment Validation Script
# Checks prerequisites, configuration, builds, and infrastructure readiness
# Compatible with bash 3.2+ (macOS default)
# ==============================================================================

set -uo pipefail

# --- Color codes ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Counters ---
PASS=0
FAIL=0
WARN=0

# --- Project root (resolve relative to script location) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Target countries and their scraper portals ---
COUNTRIES="Czech Republic|Slovakia|Germany|Austria|Hungary"

get_portals() {
  local country="$1"
  case "$country" in
    "Czech Republic") echo "bazos bezrealitky idnes-reality realingo reality sreality ulovdomov" ;;
    "Slovakia")       echo "byty-sk nehnutelnosti-sk reality-sk topreality-sk" ;;
    "Germany")        echo "immobilienscout24-de immonet-de immowelt-de kleinanzeigen-de wg-gesucht-de" ;;
    "Austria")        echo "immobilienscout24-at immodirekt-at immowelt-at willhaben-at wohnnet-at" ;;
    "Hungary")        echo "dh-hu ingatlan-com ingatlannet-hu oc-hu zenga-hu" ;;
  esac
}

# --- Required .env.dev variables ---
REQUIRED_ENV_VARS="DB_USER DB_PASSWORD DB_PORT REDIS_PORT API_KEYS_CZECH API_KEYS_SLOVAKIA API_KEYS_GERMANY API_KEYS_AUSTRIA API_KEYS_HUNGARY BATCH_SIZE BATCH_TIMEOUT BATCH_WORKERS"

# --- Required ports (port:service pairs) ---
REQUIRED_PORTS="3001:ingest-czech 3002:ingest-slovakia 3003:ingest-germany 3004:ingest-austria 3005:ingest-hungary 3006:worker-czech 3007:worker-slovakia 3008:worker-germany 3009:worker-austria 3010:worker-hungary 3011:scheduler 4000:search-service 5432:postgresql 6379:redis"

# --- Helper functions ---
pass() {
  echo -e "  ${GREEN}[PASS]${NC} $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}[FAIL]${NC} $1"
  FAIL=$((FAIL + 1))
}

warn() {
  echo -e "  ${YELLOW}[WARN]${NC} $1"
  WARN=$((WARN + 1))
}

header() {
  echo ""
  echo -e "${CYAN}${BOLD}=== $1 ===${NC}"
}

check_json_script() {
  local pkg_file="$1"
  local script_name="$2"
  python3 -c "import json; d=json.load(open('$pkg_file')); print('yes' if '$script_name' in d.get('scripts',{}) else 'no')" 2>/dev/null || echo "error"
}

# ==============================================================================
echo -e "${BOLD}Landomo Deployment Validation${NC}"
echo -e "Project root: ${CYAN}$PROJECT_ROOT${NC}"
echo -e "Date: $(date '+%Y-%m-%d %H:%M:%S')"

# ==============================================================================
# CHECK 1: Docker and docker-compose availability
# ==============================================================================
header "1. Docker & Docker Compose"

if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker --version 2>/dev/null || echo "unknown")
  pass "Docker available: $DOCKER_VERSION"
else
  fail "Docker not found in PATH"
fi

if docker compose version &>/dev/null 2>&1; then
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
  pass "Docker Compose (plugin) available: v$COMPOSE_VERSION"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_VERSION=$(docker-compose --version 2>/dev/null || echo "unknown")
  pass "docker-compose (standalone) available: $COMPOSE_VERSION"
else
  fail "Docker Compose not found (neither plugin nor standalone)"
fi

# ==============================================================================
# CHECK 2: .env.dev file and required variables
# ==============================================================================
header "2. Environment Configuration (.env.dev)"

ENV_FILE="$PROJECT_ROOT/.env.dev"
if [[ -f "$ENV_FILE" ]]; then
  pass ".env.dev file exists"

  for var in $REQUIRED_ENV_VARS; do
    if grep -q "^${var}=" "$ENV_FILE" 2>/dev/null; then
      VALUE=$(grep "^${var}=" "$ENV_FILE" | head -1 | cut -d'=' -f2-)
      if [[ -z "$VALUE" ]]; then
        warn "$var is set but empty"
      else
        pass "$var is configured"
      fi
    else
      fail "$var is missing from .env.dev"
    fi
  done
else
  fail ".env.dev file not found at $ENV_FILE"
fi

# ==============================================================================
# CHECK 3: Required Dockerfiles for 5 target countries' scrapers
# ==============================================================================
header "3. Scraper Dockerfiles (5 Target Countries)"

IFS='|' read -ra COUNTRY_LIST <<< "$COUNTRIES"
for country in "${COUNTRY_LIST[@]}"; do
  portals=$(get_portals "$country")
  country_pass=0
  country_total=0

  for portal in $portals; do
    country_total=$((country_total + 1))
    DOCKERFILE="$PROJECT_ROOT/scrapers/$country/$portal/Dockerfile"
    if [[ -f "$DOCKERFILE" ]]; then
      country_pass=$((country_pass + 1))
    else
      fail "$country/$portal: Dockerfile missing"
    fi
  done

  if [[ $country_pass -eq $country_total ]]; then
    pass "$country: All $country_total scraper Dockerfiles present"
  fi
done

# Also check core service Dockerfiles
for service in ingest-service search-service scheduler; do
  DOCKERFILE="$PROJECT_ROOT/$service/Dockerfile"
  if [[ -f "$DOCKERFILE" ]]; then
    pass "$service/Dockerfile exists"
  else
    fail "$service/Dockerfile missing"
  fi
done

# ==============================================================================
# CHECK 4: package.json files have "build" and "start" scripts
# ==============================================================================
header "4. Package.json Build & Start Scripts"

for service in shared-components ingest-service search-service scheduler; do
  PKG="$PROJECT_ROOT/$service/package.json"
  if [[ -f "$PKG" ]]; then
    HAS_BUILD=$(check_json_script "$PKG" "build")
    HAS_START=$(check_json_script "$PKG" "start")

    if [[ "$HAS_BUILD" == "yes" ]]; then
      pass "$service: 'build' script present"
    else
      fail "$service: 'build' script missing in package.json"
    fi

    # shared-components doesn't need a start script
    if [[ "$service" == "shared-components" ]]; then
      continue
    fi

    if [[ "$HAS_START" == "yes" ]]; then
      pass "$service: 'start' script present"
    else
      fail "$service: 'start' script missing in package.json"
    fi
  else
    fail "$service: package.json not found"
  fi
done

# Check scraper package.json files
for country in "${COUNTRY_LIST[@]}"; do
  portals=$(get_portals "$country")
  for portal in $portals; do
    PKG="$PROJECT_ROOT/scrapers/$country/$portal/package.json"
    if [[ -f "$PKG" ]]; then
      HAS_BUILD=$(check_json_script "$PKG" "build")
      HAS_START=$(check_json_script "$PKG" "start")

      if [[ "$HAS_BUILD" != "yes" ]]; then
        fail "$country/$portal: 'build' script missing"
      fi
      if [[ "$HAS_START" != "yes" ]]; then
        fail "$country/$portal: 'start' script missing"
      fi
      if [[ "$HAS_BUILD" == "yes" && "$HAS_START" == "yes" ]]; then
        pass "$country/$portal: build & start scripts present"
      fi
    else
      fail "$country/$portal: package.json not found"
    fi
  done
done

# ==============================================================================
# CHECK 5: shared-components build
# ==============================================================================
header "5. Shared Components Build"

SHARED_DIR="$PROJECT_ROOT/shared-components"
if [[ -f "$SHARED_DIR/package.json" ]]; then
  if [[ -d "$SHARED_DIR/node_modules" ]]; then
    pass "shared-components: node_modules present"
  else
    warn "shared-components: node_modules missing (run npm install)"
  fi

  # Try building
  echo -e "  ${CYAN}Building shared-components...${NC}"
  if (cd "$SHARED_DIR" && npm run build 2>&1) >/dev/null 2>&1; then
    pass "shared-components: npm run build succeeded"
  else
    fail "shared-components: npm run build failed"
    echo -e "    ${YELLOW}Hint: cd shared-components && npm install && npm run build${NC}"
  fi

  if [[ -d "$SHARED_DIR/dist" ]]; then
    pass "shared-components: dist/ directory exists"
  else
    fail "shared-components: dist/ directory missing after build"
  fi
else
  fail "shared-components: package.json not found"
fi

# ==============================================================================
# CHECK 6: TypeScript compilation (ingest-service, search-service)
# ==============================================================================
header "6. TypeScript Compilation"

for service in ingest-service search-service; do
  SVC_DIR="$PROJECT_ROOT/$service"
  if [[ -f "$SVC_DIR/package.json" ]] && [[ -f "$SVC_DIR/tsconfig.json" ]]; then
    if [[ ! -d "$SVC_DIR/node_modules" ]]; then
      warn "$service: node_modules missing, skipping type-check (run npm install)"
      continue
    fi

    echo -e "  ${CYAN}Type-checking $service...${NC}"
    TS_OUTPUT=$( (cd "$SVC_DIR" && npx tsc --noEmit 2>&1) || true )

    if echo "$TS_OUTPUT" | grep -q "error TS"; then
      ERROR_COUNT=$(echo "$TS_OUTPUT" | grep -c "error TS" || true)
      fail "$service: TypeScript has $ERROR_COUNT error(s)"
      # Show first 5 errors
      echo "$TS_OUTPUT" | grep "error TS" | head -5 | while IFS= read -r line; do
        echo -e "    ${RED}$line${NC}"
      done
    else
      pass "$service: TypeScript compilation clean (no errors)"
    fi
  else
    fail "$service: package.json or tsconfig.json missing"
  fi
done

# ==============================================================================
# CHECK 7: Required ports
# ==============================================================================
header "7. Required Ports"

echo -e "  ${CYAN}Ports required for full platform deployment:${NC}"
for entry in $REQUIRED_PORTS; do
  port="${entry%%:*}"
  svc="${entry#*:}"
  # Check if port is currently in use
  if lsof -i ":$port" &>/dev/null 2>&1; then
    warn "Port $port ($svc) - currently IN USE"
  else
    pass "Port $port ($svc) - available"
  fi
done

# ==============================================================================
# CHECK 8: docker-compose.yml validation
# ==============================================================================
header "8. Docker Compose Configuration"

COMPOSE_FILE="$PROJECT_ROOT/docker/docker-compose.yml"
if [[ -f "$COMPOSE_FILE" ]]; then
  pass "docker/docker-compose.yml exists"

  echo -e "  ${CYAN}Validating docker-compose.yml syntax...${NC}"
  if docker compose -f "$COMPOSE_FILE" config --quiet 2>/dev/null; then
    pass "docker-compose.yml is valid (docker compose config)"
  elif docker compose -f "$COMPOSE_FILE" --env-file "$PROJECT_ROOT/.env.dev" config --quiet 2>/dev/null; then
    pass "docker-compose.yml is valid (with .env.dev)"
  else
    fail "docker-compose.yml has syntax/configuration errors"
    echo -e "    ${YELLOW}Hint: docker compose -f docker/docker-compose.yml --env-file .env.dev config${NC}"
  fi
else
  fail "docker/docker-compose.yml not found"
fi

# Also check dev and search compose files
for compose in docker/docker-compose.dev.yml docker/docker-compose.search.yml; do
  CFILE="$PROJECT_ROOT/$compose"
  if [[ -f "$CFILE" ]]; then
    pass "$compose exists"
  else
    warn "$compose not found"
  fi
done

# ==============================================================================
# CHECK 9: Additional infrastructure files
# ==============================================================================
header "9. Additional Infrastructure"

# Postgres init scripts
for script in init-databases.sh init-schema.sql enable-postgis.sql create-readonly-user.sql; do
  PGFILE="$PROJECT_ROOT/docker/postgres/$script"
  if [[ -f "$PGFILE" ]]; then
    pass "docker/postgres/$script exists"
  else
    warn "docker/postgres/$script not found"
  fi
done

# Nginx config
if [[ -f "$PROJECT_ROOT/nginx/nginx.conf" ]]; then
  pass "nginx/nginx.conf exists"
else
  warn "nginx/nginx.conf not found"
fi

# Migrations
MIGRATION_COUNT=$(find "$PROJECT_ROOT/ingest-service/migrations" -name "*.sql" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$MIGRATION_COUNT" -gt 0 ]]; then
  pass "SQL migrations found: $MIGRATION_COUNT files"
else
  warn "No SQL migration files found in ingest-service/migrations/"
fi

# ==============================================================================
# SUMMARY
# ==============================================================================
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD} DEPLOYMENT VALIDATION SUMMARY${NC}"
echo -e "${BOLD}============================================================${NC}"
echo -e "  ${GREEN}Passed:  $PASS${NC}"
echo -e "  ${RED}Failed:  $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}RESULT: ALL CHECKS PASSED${NC}"
  echo -e "  ${GREEN}The platform is ready for deployment.${NC}"
  exit 0
else
  echo -e "  ${RED}${BOLD}RESULT: $FAIL CHECK(S) FAILED${NC}"
  echo -e "  ${RED}Fix the above failures before deploying.${NC}"
  exit 1
fi
