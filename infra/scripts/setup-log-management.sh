#!/bin/bash
#
# Setup log management on VPS
# Installs logrotate config and Docker daemon log rotation
#
# Usage: ssh landomo-vps 'bash -s' < scripts/setup-log-management.sh
#   OR:  Run directly on VPS after copying files

set -euo pipefail

echo "=== Setting up log management ==="

# 1. Install logrotate config for Docker container logs
echo "[1/3] Installing logrotate config..."
cat > /etc/logrotate.d/docker-landomo <<'EOF'
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
    maxsize 100M
    dateext
    dateformat -%Y%m%d
}
EOF
echo "  Installed /etc/logrotate.d/docker-landomo"

# 2. Configure Docker daemon log defaults
echo "[2/3] Configuring Docker daemon log defaults..."
DAEMON_JSON="/etc/docker/daemon.json"
if [ -f "$DAEMON_JSON" ]; then
    # Merge with existing config
    if command -v jq &>/dev/null; then
        jq '. + {"log-driver":"json-file","log-opts":{"max-size":"50m","max-file":"5"}}' "$DAEMON_JSON" > "${DAEMON_JSON}.tmp"
        mv "${DAEMON_JSON}.tmp" "$DAEMON_JSON"
    else
        echo "  WARNING: jq not installed, cannot merge daemon.json. Manual edit needed."
        echo '  Add: "log-driver":"json-file","log-opts":{"max-size":"50m","max-file":"5"}'
    fi
else
    cat > "$DAEMON_JSON" <<'DJEOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5"
  }
}
DJEOF
fi
echo "  Configured $DAEMON_JSON"

# 3. Test logrotate config
echo "[3/3] Testing logrotate config..."
logrotate -d /etc/logrotate.d/docker-landomo 2>&1 | head -5
echo ""

echo "=== Log management setup complete ==="
echo ""
echo "NOTE: Docker daemon config changes require a Docker restart:"
echo "  systemctl restart docker"
echo ""
echo "Current Docker log disk usage:"
du -sh /var/lib/docker/containers/*/*.log 2>/dev/null | sort -rh | head -10 || echo "  No container logs found"
