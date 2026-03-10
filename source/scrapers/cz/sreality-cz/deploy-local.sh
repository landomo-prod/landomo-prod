#!/bin/bash

# SReality Scraper - Local Docker Deployment Script
# Deploys scraper to local Docker pointing to VPS ingest service

set -e

echo "🚀 SReality Scraper - Local Docker Deployment"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
VPS_ENDPOINT="http://187.77.70.123:3006/api/v1/properties"
CONTAINER_NAME="sreality-scraper"
IMAGE_NAME="landomo/sreality-scraper"

echo "📋 Configuration:"
echo "  - VPS Endpoint: $VPS_ENDPOINT"
echo "  - Container: $CONTAINER_NAME"
echo "  - Port: 8102"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker is not running. Please start Docker Desktop.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Step 1: Stop and remove existing container
echo "🛑 Stopping existing container (if any)..."
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  docker stop "$CONTAINER_NAME" 2>/dev/null || true
  docker rm "$CONTAINER_NAME" 2>/dev/null || true
  echo -e "${GREEN}✅ Removed existing container${NC}"
else
  echo "  No existing container found"
fi
echo ""

# Step 2: Build Docker image
echo "🔨 Building Docker image..."
echo "  This may take 2-3 minutes on first build..."
cd ../../..
docker build \
  -f "scrapers/Czech Republic/sreality/Dockerfile" \
  -t "$IMAGE_NAME:latest" \
  --progress=plain \
  .

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
  echo -e "${RED}❌ Docker build failed${NC}"
  exit 1
fi
echo ""

# Step 3: Start services with docker compose
echo "🚀 Starting services..."
cd "scrapers/Czech Republic/sreality"
docker compose up -d

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Services started successfully${NC}"
else
  echo -e "${RED}❌ Failed to start services${NC}"
  exit 1
fi
echo ""

# Step 4: Wait for health check
echo "⏳ Waiting for scraper to be healthy..."
sleep 5

HEALTH_CHECK_COUNT=0
MAX_HEALTH_CHECKS=12

while [ $HEALTH_CHECK_COUNT -lt $MAX_HEALTH_CHECKS ]; do
  if docker exec "$CONTAINER_NAME" wget --no-verbose --tries=1 --spider http://localhost:8102/health 2>/dev/null; then
    echo -e "${GREEN}✅ Scraper is healthy!${NC}"
    break
  fi
  HEALTH_CHECK_COUNT=$((HEALTH_CHECK_COUNT + 1))
  echo "  Waiting... ($HEALTH_CHECK_COUNT/$MAX_HEALTH_CHECKS)"
  sleep 5
done

if [ $HEALTH_CHECK_COUNT -eq $MAX_HEALTH_CHECKS ]; then
  echo -e "${YELLOW}⚠️  Health check timeout - scraper may still be starting${NC}"
fi
echo ""

# Step 5: Display status
echo "=============================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "=============================================="
echo ""
echo "📊 Service Status:"
docker compose ps
echo ""
echo "🔗 Endpoints:"
echo "  - Scraper Health: http://localhost:8102/health"
echo "  - Scraper API: http://localhost:8102"
echo "  - VPS Ingest: $VPS_ENDPOINT"
echo ""
echo "📝 Useful Commands:"
echo "  - View logs:        docker compose logs -f sreality-scraper"
echo "  - Stop services:    docker compose down"
echo "  - Restart scraper:  docker compose restart sreality-scraper"
echo "  - View status:      docker compose ps"
echo "  - Execute command:  docker exec -it $CONTAINER_NAME sh"
echo ""
echo "🎯 Trigger a scrape:"
echo "  curl -X POST http://localhost:8102/scrape"
echo ""
