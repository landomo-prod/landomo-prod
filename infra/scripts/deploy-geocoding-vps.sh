#!/bin/bash
set -euo pipefail

# Deploy Pelias geocoding stack + run backfill on VPS
# Usage: ./scripts/deploy-geocoding-vps.sh

VPS="landomo-vps"
REMOTE_DIR="/opt/landomo/geocoding"

echo "=== Deploying Geocoding to VPS ==="

# 1. Sync geocoding directory to VPS
echo "[1/4] Syncing geocoding files..."
ssh "$VPS" "mkdir -p $REMOTE_DIR"
rsync -avz --exclude 'data/' --exclude 'node_modules/' \
  geocoding/ "$VPS:$REMOTE_DIR/"

# 2. Sync backfill script
echo "[2/4] Syncing backfill script..."
rsync -avz scripts/geocode-backfill.ts "$VPS:/opt/landomo/scripts/"

# 3. Run Pelias setup on VPS (downloads data + starts services)
echo "[3/4] Setting up Pelias on VPS (this takes 15-30 min)..."
ssh "$VPS" "cd $REMOTE_DIR && ./setup.sh"

# 4. Test Pelias
echo "[4/4] Testing Pelias API..."
ssh "$VPS" "curl -sf 'http://localhost:4100/v1/search?text=Praha' | head -c 200"
echo ""

echo ""
echo "=== Pelias deployed! ==="
echo ""
echo "To run the backfill on VPS:"
echo "  ssh $VPS"
echo "  cd /opt/landomo"
echo "  DB_HOST=localhost DB_PASSWORD=\$DB_PASS npx tsx scripts/geocode-backfill.ts --country czech_republic"
echo ""
echo "For all countries (uses Nominatim for non-CZ, slower):"
echo "  DB_HOST=localhost DB_PASSWORD=\$DB_PASS npx tsx scripts/geocode-backfill.ts"
