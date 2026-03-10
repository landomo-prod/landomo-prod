#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Landomo-World - Staging Deployment Script
# ============================================================
# Deploys the staging environment (Czech + Austria subset)
# with resource limits, restart policies, and debug logging.
#
# Usage:
#   ./scripts/deploy-staging.sh          # Full deploy (pull + build + up)
#   ./scripts/deploy-staging.sh up       # Start services (no rebuild)
#   ./scripts/deploy-staging.sh down     # Stop all staging services
#   ./scripts/deploy-staging.sh logs     # Tail staging logs
#   ./scripts/deploy-staging.sh status   # Show service status
#   ./scripts/deploy-staging.sh health   # Check health endpoints
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILES="-f ${PROJECT_ROOT}/docker/docker-compose.yml -f ${PROJECT_ROOT}/docker/docker-compose.staging.yml"
ENV_FILE="--env-file ${PROJECT_ROOT}/.env.staging"
COMPOSE_CMD="docker compose --project-directory ${PROJECT_ROOT} ${COMPOSE_FILES} ${ENV_FILE}"

# Staging services to monitor
STAGING_SERVICES=(
    "ingest-czech"
    "ingest-austria"
    "worker-czech"
    "worker-austria"
    "scraper-sreality"
    "scraper-bezrealitky"
    "scraper-willhaben-at"
    "scraper-immobilienscout24-at"
)

HEALTH_ENDPOINTS=(
    "13004:Czech Ingest"
    "13011:Austria Ingest"
    "18102:Sreality Scraper"
    "18103:Bezrealitky Scraper"
    "18097:Willhaben Scraper"
    "18098:ImmobilienScout24.at Scraper"
)

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "ERROR: Docker is not running."
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
}

check_env_file() {
    if [ ! -f "${PROJECT_ROOT}/.env.staging" ]; then
        echo "ERROR: .env.staging not found at ${PROJECT_ROOT}/.env.staging"
        echo "Copy .env.staging.example or create one before deploying."
        exit 1
    fi

    # Warn about placeholder passwords
    if grep -q "CHANGE_ME" "${PROJECT_ROOT}/.env.staging"; then
        echo "WARNING: .env.staging contains CHANGE_ME placeholder values."
        echo "Update these before deploying to a real staging server."
        echo ""
    fi
}

do_deploy() {
    echo "============================================"
    echo "  Landomo-World Staging Deployment"
    echo "============================================"
    echo ""
    echo "Environment: staging"
    echo "Countries:   Czech Republic, Austria"
    echo "Services:    ${#STAGING_SERVICES[@]} containers"
    echo ""

    check_docker
    check_env_file

    echo "[1/4] Pulling latest base images..."
    ${COMPOSE_CMD} pull postgres redis 2>/dev/null || true

    echo "[2/4] Building service images..."
    ${COMPOSE_CMD} build ingest-czech ingest-austria \
        worker-czech worker-austria \
        scraper-sreality scraper-bezrealitky \
        scraper-willhaben-at scraper-immobilienscout24-at

    echo "[3/4] Starting staging services..."
    ${COMPOSE_CMD} up -d \
        postgres redis \
        ingest-czech ingest-austria \
        worker-czech worker-austria \
        scraper-sreality scraper-bezrealitky \
        scraper-willhaben-at scraper-immobilienscout24-at

    echo "[4/4] Waiting for services to become healthy..."
    sleep 20

    do_health
    echo ""
    echo "Staging deployment complete."
    echo ""
    echo "Ingest APIs:"
    echo "  Czech:   http://localhost:13004/api/v1/health"
    echo "  Austria: http://localhost:13011/api/v1/health"
    echo ""
    echo "Infrastructure:"
    echo "  PostgreSQL: localhost:15432"
    echo "  Redis:      localhost:16379"
    echo ""
    echo "Commands:"
    echo "  Logs:    ./scripts/deploy-staging.sh logs"
    echo "  Status:  ./scripts/deploy-staging.sh status"
    echo "  Health:  ./scripts/deploy-staging.sh health"
    echo "  Stop:    ./scripts/deploy-staging.sh down"
}

do_up() {
    check_docker
    check_env_file
    echo "Starting staging services (no rebuild)..."
    ${COMPOSE_CMD} up -d \
        postgres redis \
        ingest-czech ingest-austria \
        worker-czech worker-austria \
        scraper-sreality scraper-bezrealitky \
        scraper-willhaben-at scraper-immobilienscout24-at
    echo "Services started. Run './scripts/deploy-staging.sh health' to check."
}

do_down() {
    check_docker
    echo "Stopping all staging services..."
    ${COMPOSE_CMD} down
    echo "All staging services stopped."
}

do_logs() {
    check_docker
    echo "Tailing staging service logs (Ctrl+C to exit)..."
    ${COMPOSE_CMD} logs -f \
        postgres redis \
        ingest-czech ingest-austria \
        worker-czech worker-austria \
        scraper-sreality scraper-bezrealitky \
        scraper-willhaben-at scraper-immobilienscout24-at
}

do_status() {
    check_docker
    echo "Staging service status:"
    echo ""
    ${COMPOSE_CMD} ps
}

do_health() {
    echo "Health check results:"
    echo ""

    # Check PostgreSQL
    if docker exec landomo-staging-postgres pg_isready -U landomo > /dev/null 2>&1; then
        echo "  [OK]   PostgreSQL"
    else
        echo "  [FAIL] PostgreSQL"
    fi

    # Check Redis
    if docker exec landomo-staging-redis redis-cli ping > /dev/null 2>&1; then
        echo "  [OK]   Redis"
    else
        echo "  [FAIL] Redis"
    fi

    # Check HTTP health endpoints
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        PORT="${endpoint%%:*}"
        NAME="${endpoint##*:}"
        if curl -sf "http://localhost:${PORT}/api/v1/health" > /dev/null 2>&1 || \
           curl -sf "http://localhost:${PORT}/health" > /dev/null 2>&1; then
            echo "  [OK]   ${NAME} (port ${PORT})"
        else
            echo "  [FAIL] ${NAME} (port ${PORT})"
        fi
    done
}

# ============================================================
# Main
# ============================================================
case "${1:-deploy}" in
    deploy)  do_deploy ;;
    up)      do_up ;;
    down)    do_down ;;
    logs)    do_logs ;;
    status)  do_status ;;
    health)  do_health ;;
    *)
        echo "Usage: $0 {deploy|up|down|logs|status|health}"
        echo ""
        echo "  deploy  - Full deploy: pull + build + start (default)"
        echo "  up      - Start services without rebuilding"
        echo "  down    - Stop all staging services"
        echo "  logs    - Tail logs from staging services"
        echo "  status  - Show container status"
        echo "  health  - Check health endpoints"
        exit 1
        ;;
esac
