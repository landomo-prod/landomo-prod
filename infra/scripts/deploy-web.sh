#!/bin/bash
# Deploy Landomo CZ Frontend to landomo-cz-web
# Usage: ./deploy-web.sh [build|deploy|restart|logs|status]

set -euo pipefail

HOST="landomo-cz-web"
REMOTE_BASE="/opt/landomo"
LOCAL_BASE="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE_FILE="infra/docker/countries/czech/web/docker-compose.web.yml"
ENV_FILE="infra/docker/countries/czech/web/.env"
PROJECT_NAME="landomo-cz-web"

ACTION="${1:-deploy}"

sync_source() {
    echo "--- Syncing source to $HOST ---"
    rsync -az --delete \
        --exclude='node_modules' \
        --exclude='.next' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='.env.local' \
        "$LOCAL_BASE/source/frontend/" \
        "$HOST:$REMOTE_BASE/source/frontend/"
}

sync_infra() {
    echo "--- Syncing infra to $HOST ---"
    rsync -az --delete \
        --exclude='.git' \
        "$LOCAL_BASE/infra/" \
        "$HOST:$REMOTE_BASE/infra/"
}

build() {
    echo "--- Building frontend on $HOST ---"
    ssh "$HOST" bash <<REMOTE
cd $REMOTE_BASE
docker compose -f $COMPOSE_FILE --project-name $PROJECT_NAME --env-file $ENV_FILE build --no-cache cz-frontend
REMOTE
}

deploy() {
    sync_source
    sync_infra
    echo "--- Deploying frontend on $HOST ---"
    ssh "$HOST" bash <<REMOTE
cd $REMOTE_BASE
docker compose -f $COMPOSE_FILE --project-name $PROJECT_NAME --env-file $ENV_FILE up -d --build --force-recreate
REMOTE
    echo "--- Waiting for health check ---"
    sleep 10
    status
}

restart() {
    echo "--- Restarting frontend on $HOST ---"
    ssh "$HOST" bash <<REMOTE
cd $REMOTE_BASE
docker compose -f $COMPOSE_FILE --project-name $PROJECT_NAME --env-file $ENV_FILE restart cz-frontend
REMOTE
}

logs() {
    ssh "$HOST" "cd $REMOTE_BASE && docker compose -f $COMPOSE_FILE --project-name $PROJECT_NAME logs -f --tail=100"
}

status() {
    echo "--- Service status ---"
    ssh "$HOST" "cd $REMOTE_BASE && docker compose -f $COMPOSE_FILE --project-name $PROJECT_NAME ps"
    echo ""
    echo "--- Health check ---"
    ssh "$HOST" "curl -sf http://localhost:80/ > /dev/null && echo 'HTTP OK' || echo 'HTTP FAILED'"
}

case "$ACTION" in
    build)    sync_source; sync_infra; build ;;
    deploy)   deploy ;;
    restart)  restart ;;
    logs)     logs ;;
    status)   status ;;
    sync)     sync_source; sync_infra ;;
    *)
        echo "Usage: $0 [build|deploy|restart|logs|status|sync]"
        exit 1
        ;;
esac
