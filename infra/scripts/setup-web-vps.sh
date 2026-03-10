#!/bin/bash
# Setup script for landomo-cz-web VPS (Ampere/ARM64, Ubuntu)
# Run once to provision the server before first deploy

set -euo pipefail

HOST="landomo-cz-web"

echo "=== Setting up $HOST ==="

ssh "$HOST" bash <<'REMOTE'
set -euo pipefail

echo "--- Updating system ---"
apt-get update && apt-get upgrade -y

echo "--- Installing Docker ---"
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

echo "--- Installing Docker Compose plugin ---"
if ! docker compose version &>/dev/null; then
    apt-get install -y docker-compose-plugin
fi

echo "--- Configuring Docker daemon ---"
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "ipv6": true,
  "fixed-cidr-v6": "fd00:dead:cafe::/48"
}
EOF
systemctl restart docker

echo "--- Creating app directory ---"
mkdir -p /opt/landomo/source
mkdir -p /opt/landomo/infra

echo "--- Setting up firewall ---"
if command -v ufw &>/dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
fi

echo "--- Docker version ---"
docker --version
docker compose version

echo "=== VPS setup complete ==="
REMOTE
