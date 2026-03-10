#!/usr/bin/env bash
# Deploy Czech-only stack to landomo-app (DB on landomo-db)
set -euo pipefail

APP_HOST="landomo-app"
REMOTE_DIR="/opt/landomo"
COMPOSE_FILE="infra/docker/countries/czech/docker-compose.app.yml"
LOCAL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

echo "==> Syncing source to $APP_HOST:$REMOTE_DIR ..."
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='infra/scripts/node_modules' \
  --exclude='*.log' \
  "$LOCAL_ROOT/" "$APP_HOST:$REMOTE_DIR/"

echo "==> Cleaning all containers, images, volumes on $APP_HOST ..."
ssh "$APP_HOST" bash <<'REMOTE'
set -euo pipefail

# Stop and remove all running containers
if [ -n "$(docker ps -aq)" ]; then
  docker stop $(docker ps -aq) 2>/dev/null || true
  docker rm -f $(docker ps -aq) 2>/dev/null || true
fi

# Remove all images
if [ -n "$(docker images -aq)" ]; then
  docker rmi -f $(docker images -aq) 2>/dev/null || true
fi

# Remove all volumes except cz_redis_data (preserve queue state) and cz_ml_models
KEEP_VOLUMES="cz_redis_data cz_ml_models"
for vol in $(docker volume ls -q); do
  skip=false
  for keep in $KEEP_VOLUMES; do
    if echo "$vol" | grep -q "$keep"; then
      skip=true
      break
    fi
  done
  if [ "$skip" = "false" ]; then
    docker volume rm "$vol" 2>/dev/null || true
  fi
done

# Remove unused networks
docker network prune -f 2>/dev/null || true

# Prune build cache
docker builder prune -af 2>/dev/null || true

echo "Server cleaned."
REMOTE

echo "==> Enabling IPv6 in Docker daemon on $APP_HOST ..."
ssh "$APP_HOST" bash <<'REMOTE'
set -euo pipefail
DAEMON_JSON="/etc/docker/daemon.json"
CURRENT=$(cat "$DAEMON_JSON" 2>/dev/null || echo '{}')

# Add ipv6 support if not already set
if ! echo "$CURRENT" | grep -q '"ipv6"'; then
  python3 -c "
import json, sys
d = json.loads(sys.argv[1])
d['ipv6'] = True
d['fixed-cidr-v6'] = 'fd00::/80'
print(json.dumps(d, indent=2))
" "$CURRENT" > /tmp/daemon.json.new
  mv /tmp/daemon.json.new "$DAEMON_JSON"
  systemctl reload docker || systemctl restart docker
  echo "Docker daemon updated with IPv6 support."
else
  echo "IPv6 already configured."
fi
REMOTE

echo "==> Starting Czech stack on $APP_HOST ..."
ssh "$APP_HOST" bash <<REMOTE
set -euo pipefail

COMPOSE_DIR="$REMOTE_DIR/infra/docker/countries/czech"
SECRETS_SRC="/opt/landomo/scrapers/Czech/docker/secrets"
ENV_SRC="/opt/landomo/scrapers/Czech/docker/.env"

# Link existing secrets into compose dir
mkdir -p "\$COMPOSE_DIR"
ln -sfn "\$SECRETS_SRC" "\$COMPOSE_DIR/secrets"

# Compose up using existing .env
docker compose \
  -f "$REMOTE_DIR/$COMPOSE_FILE" \
  --project-name landomo-cz \
  --env-file "\$ENV_SRC" \
  up -d --build

echo "==> Container status:"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
REMOTE

echo ""
echo "Done. Czech stack is up on $APP_HOST."
echo "DB is at 2a01:4f8:1c19:6b5b::1 (landomo-db)"
