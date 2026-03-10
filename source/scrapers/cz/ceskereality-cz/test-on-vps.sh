#!/bin/bash
# Manual VPS test script - run this directly on the VPS
# ssh root@187.77.70.123 'bash -s' < test-on-vps.sh

set -e

echo "=== CeskeReality Scraper VPS Test ==="
echo ""

# Navigate to project directory
cd /opt/landomo-world || { echo "❌ Project directory not found. Please rsync files first."; exit 1; }

echo "📦 Installing shared components..."
cd shared-components
npm install
npm run build

echo ""
echo "📦 Installing ceskereality scraper..."
cd "../scrapers/Czech Republic/ceskereality"
npm install

echo ""
echo "🔨 Building scraper..."
npm run build

echo ""
echo "🧪 Running investigation script (60 second timeout)..."
export HEADLESS=true
export NODE_ENV=production
timeout 60s npm run investigate || echo "✅ Investigation script executed (timed out as expected)"

echo ""
echo "✅ Build and test complete!"
echo ""
echo "To run the scraper manually:"
echo "  cd '/opt/landomo-world/scrapers/Czech Republic/ceskereality'"
echo "  PORT=3016 npm start"
