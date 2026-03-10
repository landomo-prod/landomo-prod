#!/bin/bash

echo "=========================================="
echo "LANDOMO PLATFORM - OVERALL PROGRESS"
echo "=========================================="
echo ""

# Check all scraper containers
echo "=== SCRAPER CONTAINERS STATUS ==="
docker ps --filter "name=landomo-scraper" --format "table {{.Names}}\t{{.Status}}" | head -30

echo ""
echo "=== SCRAPERS BY COUNTRY ==="

for country in hungary slovakia czech austria germany; do
  count=$(docker ps --filter "name=landomo-scraper" --filter "name=$country\|${country:0:2}-" | wc -l | tr -d ' ')
  echo "$country: $count containers"
done

echo ""
echo "=== RECENT SCRAPER ACTIVITY (Last 5 min) ==="
for container in $(docker ps --filter "name=landomo-scraper" --format "{{.Names}}" | head -10); do
  recent=$(docker logs $container --since 5m 2>&1 | grep -c "Scrape completed\|Sent.*properties" || echo "0")
  if [ "$recent" -gt 0 ]; then
    echo "✅ $container: $recent activities"
  fi
done

echo ""
echo "=== INGEST SERVICES STATUS ==="
docker ps --filter "name=landomo-ingest" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== WORKER STATUS ==="
docker ps --filter "name=landomo-worker" --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== REDIS & POSTGRES ==="
docker ps --filter "name=landomo-redis\|landomo-postgres" --format "table {{.Names}}\t{{.Status}}"

