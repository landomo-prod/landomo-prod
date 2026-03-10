#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Landomo-World - Search Service Deployment Script
# ============================================================
# Rebuilds and restarts the cz-search container so code changes
# persist across restarts (replaces manual docker cp pattern).
#
# Usage:
#   ./scripts/deploy-search.sh              # Rebuild + restart cz-search
#   ./scripts/deploy-search.sh build        # Build only (no restart)
#   ./scripts/deploy-search.sh restart      # Restart only (no rebuild)
#   ./scripts/deploy-search.sh logs         # Tail cz-search logs
#   ./scripts/deploy-search.sh status       # Show cz-search status
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILE="${PROJECT_ROOT}/docker/docker-compose.cz.yml"
COMPOSE_CMD="docker compose --project-directory ${PROJECT_ROOT}/docker -f ${COMPOSE_FILE}"

check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo "ERROR: Docker is not running."
        exit 1
    fi
}

do_deploy() {
    check_docker
    echo "=== Deploying cz-search ==="
    echo ""

    echo "[1/3] Building cz-search image..."
    ${COMPOSE_CMD} build cz-search

    echo "[2/3] Restarting cz-search (no-deps)..."
    ${COMPOSE_CMD} up -d --no-deps cz-search

    echo "[3/3] Waiting for health check..."
    sleep 10

    do_status
    echo ""
    echo "cz-search deployed. Changes will persist across restarts."
}

do_build() {
    check_docker
    echo "Building cz-search image (no restart)..."
    ${COMPOSE_CMD} build cz-search
    echo "Build complete. Run './scripts/deploy-search.sh restart' to apply."
}

do_restart() {
    check_docker
    echo "Restarting cz-search from existing image..."
    ${COMPOSE_CMD} up -d --no-deps cz-search
    echo "Restarted. Run './scripts/deploy-search.sh status' to check."
}

do_logs() {
    check_docker
    echo "Tailing cz-search logs (Ctrl+C to exit)..."
    ${COMPOSE_CMD} logs -f cz-search
}

do_status() {
    check_docker
    ${COMPOSE_CMD} ps cz-search

    # Check health endpoint
    if curl -sf "http://localhost:4000/api/v1/health" > /dev/null 2>&1; then
        echo "  Health: OK"
    else
        echo "  Health: WAITING (may still be starting)"
    fi
}

case "${1:-deploy}" in
    deploy)   do_deploy ;;
    build)    do_build ;;
    restart)  do_restart ;;
    logs)     do_logs ;;
    status)   do_status ;;
    *)
        echo "Usage: $0 {deploy|build|restart|logs|status}"
        echo ""
        echo "  deploy   - Build image + restart container (default)"
        echo "  build    - Build image only"
        echo "  restart  - Restart from existing image"
        echo "  logs     - Tail container logs"
        echo "  status   - Show container status + health"
        exit 1
        ;;
esac
