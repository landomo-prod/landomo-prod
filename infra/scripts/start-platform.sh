#!/usr/bin/env bash
# ==============================================================================
# Landomo-World Platform Startup Script
# ==============================================================================
# Brings up services in correct dependency order with health checks.
#
# Usage:
#   ./scripts/start-platform.sh --all                    # All 5 target countries
#   ./scripts/start-platform.sh --country=germany        # Single country
#   ./scripts/start-platform.sh --country=czech --country=slovakia  # Multiple
#   ./scripts/start-platform.sh --all --no-scrapers      # Infrastructure only
#   ./scripts/start-platform.sh --all --monitoring       # With Prometheus/Grafana
#   ./scripts/start-platform.sh --all --no-search        # Skip search+nginx
#   ./scripts/start-platform.sh --all --dev              # Include dev overrides
# ==============================================================================

set -eo pipefail

# --- Configuration -----------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.yml"
COMPOSE_SEARCH_FILE="${PROJECT_ROOT}/docker/docker-compose.search.yml"
COMPOSE_DEV_FILE="${PROJECT_ROOT}/docker/docker-compose.dev.yml"
ENV_FILE="${PROJECT_ROOT}/.env.dev"

VALID_COUNTRIES="germany austria czech slovakia hungary"

# --- Lookup functions (compatible with bash 3.2 on macOS) ---------------------

get_ingest_port() {
  case "$1" in
    germany)  echo "3010" ;;
    austria)  echo "3011" ;;
    czech)    echo "3004" ;;
    slovakia) echo "3008" ;;
    hungary)  echo "3009" ;;
    *)        echo "" ;;
  esac
}

get_scrapers() {
  case "$1" in
    germany)  echo "scraper-immobilienscout24-de scraper-immonet-de scraper-immowelt-de scraper-kleinanzeigen-de scraper-wg-gesucht-de" ;;
    austria)  echo "scraper-willhaben-at scraper-immobilienscout24-at scraper-wohnnet-at scraper-immowelt-at scraper-immodirekt-at" ;;
    czech)    echo "scraper-sreality scraper-bezrealitky scraper-reality scraper-idnes-reality scraper-realingo scraper-ulovdomov" ;;
    slovakia) echo "scraper-nehnutelnosti-sk scraper-reality-sk scraper-topreality-sk scraper-byty-sk" ;;
    hungary)  echo "scraper-ingatlan-com scraper-ingatlannet-hu scraper-zenga-hu scraper-oc-hu scraper-dh-hu" ;;
    *)        echo "" ;;
  esac
}

# --- Parsed flags -------------------------------------------------------------

COUNTRIES=""
NO_SCRAPERS=false
MONITORING=false
NO_SEARCH=false
DEV_MODE=false
ALL_COUNTRIES=false
HEALTH_TIMEOUT=120
QUIET=false

# --- Helper functions ---------------------------------------------------------

log()    { echo "[$(date '+%H:%M:%S')] $*"; }
info()   { log "INFO  $*"; }
ok()     { log "OK    $*"; }
warn()   { log "WARN  $*"; }
err()    { log "ERROR $*"; }

usage() {
  cat <<'EOF'
Usage: start-platform.sh [OPTIONS]

Options:
  --all                Start all 5 target countries (DE, AT, CZ, SK, HU)
  --country=<name>     Start a specific country (repeatable)
                       Valid: germany, austria, czech, slovakia, hungary
  --no-scrapers        Skip starting scraper containers
  --no-search          Skip starting search-service and nginx
  --monitoring         Start Prometheus and Grafana
  --dev                Include development overrides (hot-reload volumes)
  --timeout=<secs>     Health check timeout per phase (default: 120)
  --quiet              Suppress per-service health poll output
  -h, --help           Show this help message

Examples:
  start-platform.sh --all
  start-platform.sh --country=czech --country=slovakia --no-scrapers
  start-platform.sh --all --monitoring --dev
EOF
  exit 0
}

# Build the docker compose command with the right file flags
compose_cmd() {
  local cmd="docker compose --project-directory ${PROJECT_ROOT} -f ${COMPOSE_FILE}"
  if [ "${NO_SEARCH}" = "false" ]; then
    cmd="${cmd} -f ${COMPOSE_SEARCH_FILE}"
  fi
  if [ "${DEV_MODE}" = "true" ] && [ -f "${COMPOSE_DEV_FILE}" ]; then
    cmd="${cmd} -f ${COMPOSE_DEV_FILE}"
  fi
  if [ -f "${ENV_FILE}" ]; then
    cmd="${cmd} --env-file ${ENV_FILE}"
  fi
  echo "${cmd}"
}

# Start one or more services
start_services() {
  local cmd
  cmd="$(compose_cmd)"
  info "Starting: $*"
  ${cmd} up -d "$@"
}

# Start monitoring services (uses profile)
start_monitoring() {
  local cmd
  cmd="$(compose_cmd)"
  info "Starting monitoring stack (Prometheus + Grafana)..."
  ${cmd} --profile monitoring up -d prometheus grafana
}

# Wait for a Docker healthcheck to report healthy
wait_docker_healthy() {
  local container="$1"
  local label="$2"
  local deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  while true; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "${container}" 2>/dev/null || echo "missing")

    case "${status}" in
      healthy)
        ok "${label} is healthy"
        return 0
        ;;
      unhealthy)
        err "${label} reported unhealthy"
        return 1
        ;;
      *)
        if [ "$(date +%s)" -ge "${deadline}" ]; then
          err "${label} did not become healthy within ${HEALTH_TIMEOUT}s (status: ${status})"
          return 1
        fi
        if [ "${QUIET}" = "false" ]; then
          info "Waiting for ${label}... (${status})"
        fi
        sleep 3
        ;;
    esac
  done
}

# Wait for an HTTP endpoint to return 200
wait_http_healthy() {
  local url="$1"
  local label="$2"
  local deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))

  while true; do
    if curl -sf --max-time 5 "${url}" > /dev/null 2>&1; then
      ok "${label} is healthy (${url})"
      return 0
    fi

    if [ "$(date +%s)" -ge "${deadline}" ]; then
      err "${label} health check failed after ${HEALTH_TIMEOUT}s (${url})"
      return 1
    fi

    if [ "${QUIET}" = "false" ]; then
      info "Waiting for ${label}..."
    fi
    sleep 3
  done
}

# Validate a country name
validate_country() {
  local country="$1"
  for valid in ${VALID_COUNTRIES}; do
    if [ "${country}" = "${valid}" ]; then
      return 0
    fi
  done
  err "Invalid country: ${country}"
  err "Valid countries: ${VALID_COUNTRIES}"
  exit 1
}

# Check if a country is already in the COUNTRIES list
country_in_list() {
  local needle="$1"
  for c in ${COUNTRIES}; do
    if [ "${c}" = "${needle}" ]; then
      return 0
    fi
  done
  return 1
}

# --- Parse arguments ----------------------------------------------------------

if [ $# -eq 0 ]; then
  usage
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --all)
      ALL_COUNTRIES=true
      shift
      ;;
    --country=*)
      c="${1#--country=}"
      c="$(echo "${c}" | tr '[:upper:]' '[:lower:]')"
      validate_country "${c}"
      if ! country_in_list "${c}"; then
        COUNTRIES="${COUNTRIES} ${c}"
      fi
      shift
      ;;
    --no-scrapers)
      NO_SCRAPERS=true
      shift
      ;;
    --no-search)
      NO_SEARCH=true
      shift
      ;;
    --monitoring)
      MONITORING=true
      shift
      ;;
    --dev)
      DEV_MODE=true
      shift
      ;;
    --timeout=*)
      HEALTH_TIMEOUT="${1#--timeout=}"
      shift
      ;;
    --quiet)
      QUIET=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      err "Unknown option: $1"
      usage
      ;;
  esac
done

if [ "${ALL_COUNTRIES}" = "true" ]; then
  COUNTRIES="${VALID_COUNTRIES}"
fi

# Trim leading whitespace
COUNTRIES="$(echo "${COUNTRIES}" | xargs)"

if [ -z "${COUNTRIES}" ]; then
  err "No countries specified. Use --all or --country=<name>."
  exit 1
fi

# --- Pre-flight checks --------------------------------------------------------

echo ""
echo "============================================================"
echo "  Landomo-World Platform Startup"
echo "============================================================"
echo ""
info "Countries:    ${COUNTRIES}"
info "Scrapers:     $(if [ "${NO_SCRAPERS}" = "true" ]; then echo "disabled"; else echo "enabled"; fi)"
info "Search/Nginx: $(if [ "${NO_SEARCH}" = "true" ]; then echo "disabled"; else echo "enabled"; fi)"
info "Monitoring:   $(if [ "${MONITORING}" = "true" ]; then echo "enabled"; else echo "disabled"; fi)"
info "Dev mode:     $(if [ "${DEV_MODE}" = "true" ]; then echo "enabled"; else echo "disabled"; fi)"
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  err "Docker is not running. Please start Docker Desktop and try again."
  exit 1
fi
ok "Docker daemon is running"

# Check compose files exist
if [ ! -f "${COMPOSE_FILE}" ]; then
  err "Main compose file not found: ${COMPOSE_FILE}"
  exit 1
fi
if [ "${NO_SEARCH}" = "false" ] && [ ! -f "${COMPOSE_SEARCH_FILE}" ]; then
  warn "Search compose file not found: ${COMPOSE_SEARCH_FILE}"
  warn "Disabling search/nginx services."
  NO_SEARCH=true
fi

# ==============================================================================
# PHASE 1: Infrastructure (PostgreSQL + Redis)
# ==============================================================================

echo ""
echo "------------------------------------------------------------"
info "PHASE 1: Starting infrastructure (PostgreSQL + Redis)"
echo "------------------------------------------------------------"

start_services postgres redis

wait_docker_healthy "landomo-postgres" "PostgreSQL"
wait_docker_healthy "landomo-redis" "Redis"

# ==============================================================================
# PHASE 2: Ingest services for selected countries
# ==============================================================================

echo ""
echo "------------------------------------------------------------"
info "PHASE 2: Starting ingest services"
echo "------------------------------------------------------------"

INGEST_SERVICES=""
for country in ${COUNTRIES}; do
  INGEST_SERVICES="${INGEST_SERVICES} ingest-${country}"
done

start_services ${INGEST_SERVICES}

# Wait for each ingest service to respond on its health endpoint
INGEST_FAILED=0
for country in ${COUNTRIES}; do
  port="$(get_ingest_port "${country}")"
  if ! wait_http_healthy "http://localhost:${port}/api/v1/health" "ingest-${country} (:${port})"; then
    INGEST_FAILED=1
  fi
done

if [ ${INGEST_FAILED} -eq 1 ]; then
  warn "Some ingest services failed health checks. Continuing with workers..."
fi

# ==============================================================================
# PHASE 3: Workers for selected countries
# ==============================================================================

echo ""
echo "------------------------------------------------------------"
info "PHASE 3: Starting batch workers"
echo "------------------------------------------------------------"

WORKER_SERVICES=""
for country in ${COUNTRIES}; do
  WORKER_SERVICES="${WORKER_SERVICES} worker-${country}"
done

start_services ${WORKER_SERVICES}

# Workers don't expose HTTP health endpoints; verify containers are running
sleep 5
for country in ${COUNTRIES}; do
  container="landomo-worker-${country}"
  status=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")
  if [ "${status}" = "running" ]; then
    ok "worker-${country} is running"
  else
    warn "worker-${country} status: ${status}"
  fi
done

# ==============================================================================
# PHASE 4: Search service + Nginx (optional)
# ==============================================================================

if [ "${NO_SEARCH}" = "false" ]; then
  echo ""
  echo "------------------------------------------------------------"
  info "PHASE 4: Starting search service"
  echo "------------------------------------------------------------"

  start_services search-service
  wait_http_healthy "http://localhost:4000/api/v1/health" "search-service (:4000)" || true

  echo ""
  info "Starting nginx gateway..."
  start_services nginx
  # Give nginx a moment to bind
  sleep 3
  container_status=$(docker inspect --format='{{.State.Status}}' "landomo-nginx" 2>/dev/null || echo "missing")
  if [ "${container_status}" = "running" ]; then
    ok "nginx is running"
  else
    warn "nginx status: ${container_status}"
  fi
else
  info "PHASE 4: Skipped (search/nginx disabled)"
fi

# ==============================================================================
# PHASE 5: Scrapers (optional)
# ==============================================================================

if [ "${NO_SCRAPERS}" = "false" ]; then
  echo ""
  echo "------------------------------------------------------------"
  info "PHASE 5: Starting scrapers"
  echo "------------------------------------------------------------"

  SCRAPER_SERVICES=""
  for country in ${COUNTRIES}; do
    scrapers="$(get_scrapers "${country}")"
    SCRAPER_SERVICES="${SCRAPER_SERVICES} ${scrapers}"
  done

  # Trim
  SCRAPER_SERVICES="$(echo "${SCRAPER_SERVICES}" | xargs)"

  if [ -n "${SCRAPER_SERVICES}" ]; then
    start_services ${SCRAPER_SERVICES}

    # Brief wait then check container status
    sleep 5
    scraper_ok=0
    scraper_fail=0
    for s in ${SCRAPER_SERVICES}; do
      container="landomo-${s}"
      status=$(docker inspect --format='{{.State.Status}}' "${container}" 2>/dev/null || echo "missing")
      if [ "${status}" = "running" ]; then
        scraper_ok=$((scraper_ok + 1))
      else
        warn "${s} status: ${status}"
        scraper_fail=$((scraper_fail + 1))
      fi
    done
    ok "${scraper_ok} scrapers running, ${scraper_fail} not ready"
  fi
else
  info "PHASE 5: Skipped (scrapers disabled)"
fi

# ==============================================================================
# PHASE 6: Monitoring (optional)
# ==============================================================================

if [ "${MONITORING}" = "true" ]; then
  echo ""
  echo "------------------------------------------------------------"
  info "PHASE 6: Starting monitoring stack"
  echo "------------------------------------------------------------"

  start_monitoring

  sleep 5
  for svc in landomo-prometheus landomo-grafana; do
    status=$(docker inspect --format='{{.State.Status}}' "${svc}" 2>/dev/null || echo "missing")
    if [ "${status}" = "running" ]; then
      ok "${svc} is running"
    else
      warn "${svc} status: ${status}"
    fi
  done
else
  info "PHASE 6: Skipped (monitoring disabled)"
fi

# ==============================================================================
# Final status report
# ==============================================================================

echo ""
echo "============================================================"
info "Platform Status"
echo "============================================================"
echo ""

cmd="$(compose_cmd)"
${cmd} ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || ${cmd} ps

echo ""
echo "------------------------------------------------------------"
echo "  Service Endpoints"
echo "------------------------------------------------------------"
echo ""
echo "  Infrastructure:"
echo "    PostgreSQL:     localhost:5432"
echo "    Redis:          localhost:6379"
echo ""
echo "  Ingest APIs:"
for country in ${COUNTRIES}; do
  port="$(get_ingest_port "${country}")"
  printf "    %-16s http://localhost:%s/api/v1/health\n" "${country}:" "${port}"
done

if [ "${NO_SEARCH}" = "false" ]; then
  echo ""
  echo "  Search & Gateway:"
  echo "    Search API:     http://localhost:4000/api/v1/health"
  echo "    Nginx Gateway:  http://localhost:80"
fi

if [ "${MONITORING}" = "true" ]; then
  echo ""
  echo "  Monitoring:"
  echo "    Prometheus:     http://localhost:9090"
  echo "    Grafana:        http://localhost:3000  (admin/admin)"
fi

echo ""
echo "  Commands:"
echo "    View logs:      docker compose --project-directory ${PROJECT_ROOT} -f ${COMPOSE_FILE} logs -f"
echo "    Stop all:       docker compose --project-directory ${PROJECT_ROOT} -f ${COMPOSE_FILE} down"
echo "    Service status: docker compose --project-directory ${PROJECT_ROOT} -f ${COMPOSE_FILE} ps"
echo ""
echo "============================================================"
echo "  Startup complete."
echo "============================================================"
echo ""
