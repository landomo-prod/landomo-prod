#!/bin/bash

# Verification Script for Performance Fixes
# Checks that all optimizations were applied correctly

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║              Performance Fixes Verification                                   ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check function
check() {
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} $1"
  else
    echo -e "${RED}✗${NC} $1"
  fi
}

# 1. Check .env file exists
echo "Checking configuration files..."
if [ -f .env ]; then
  echo -e "${GREEN}✓${NC} .env file exists"
else
  echo -e "${RED}✗${NC} .env file missing"
  exit 1
fi

# 2. Check BATCH_WORKERS setting
WORKERS=$(grep "BATCH_WORKERS=" .env | cut -d'=' -f2)
if [ "$WORKERS" = "20" ]; then
  echo -e "${GREEN}✓${NC} BATCH_WORKERS = 20 (optimized)"
else
  echo -e "${YELLOW}⚠${NC} BATCH_WORKERS = $WORKERS (expected 20)"
fi

# 3. Check DB_MAX_CONNECTIONS setting
CONNECTIONS=$(grep "DB_MAX_CONNECTIONS=" .env | cut -d'=' -f2)
if [ "$CONNECTIONS" = "50" ]; then
  echo -e "${GREEN}✓${NC} DB_MAX_CONNECTIONS = 50 (optimized)"
else
  echo -e "${YELLOW}⚠${NC} DB_MAX_CONNECTIONS = $CONNECTIONS (expected 50)"
fi

# 4. Check INSTANCE_COUNTRY setting
COUNTRY=$(grep "INSTANCE_COUNTRY=" .env | cut -d'=' -f2)
if [ "$COUNTRY" = "czech_republic" ]; then
  echo -e "${GREEN}✓${NC} INSTANCE_COUNTRY = czech_republic"
else
  echo -e "${YELLOW}⚠${NC} INSTANCE_COUNTRY = $COUNTRY (expected czech_republic)"
fi

# 5. Check API_KEYS includes czech key
if grep -q "dev_key_czech_1" .env; then
  echo -e "${GREEN}✓${NC} API_KEYS includes dev_key_czech_1"
else
  echo -e "${YELLOW}⚠${NC} API_KEYS missing dev_key_czech_1"
fi

# 6. Check rate limiter in worker file
echo ""
echo "Checking worker configuration..."
if grep -q "max: 500" src/workers/batch-ingestion.ts; then
  echo -e "${GREEN}✓${NC} Rate limiter set to 500 (optimized)"
else
  echo -e "${RED}✗${NC} Rate limiter not updated"
fi

# 7. Check Node.js version
echo ""
echo "Checking environment..."
NODE_VERSION=$(node --version)
echo "Node.js version: $NODE_VERSION"

# 8. Check if dependencies are installed
if [ -d "node_modules" ]; then
  echo -e "${GREEN}✓${NC} Dependencies installed"
else
  echo -e "${YELLOW}⚠${NC} Dependencies not installed (run: npm install)"
fi

# 9. Check Redis connection
echo ""
echo "Checking services..."
if redis-cli ping > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} Redis is running"
else
  echo -e "${RED}✗${NC} Redis is not running"
fi

# 10. Check PostgreSQL connection
if psql -U landomo -d landomo_czech_republic -c "SELECT 1" > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} PostgreSQL is accessible"
else
  echo -e "${YELLOW}⚠${NC} PostgreSQL connection failed (database may not exist yet)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                          Verification Complete                                ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Start the worker: npm run dev:worker"
echo "  2. Start the API: npm run dev"
echo "  3. Trigger Czech scrapers"
echo "  4. Monitor queue depth: redis-cli LLEN bull:ingest-property:wait"
echo ""
