#!/bin/bash

echo "=========================================="
echo "SCRAPER LISTING COUNTS CHECK"
echo "=========================================="
echo ""

# Test a sample from each country
declare -A scrapers=(
  ["8087"]="ingatlan-com (HU)"
  ["8088"]="oc-hu (HU)"
  ["8089"]="dh-hu (HU)"
  ["8090"]="zenga-hu (HU)"
  ["8091"]="ingatlannet-hu (HU)"
)

echo "=== Testing Hungarian Scrapers (Quick Sample) ==="
for port in 8087 8088 8089 8090 8091; do
  name="${scrapers[$port]}"
  echo ""
  echo "[$name - Port $port]"
  
  # Trigger quick scrape (1 page only)
  curl -s -X POST http://localhost:$port/scrape \
    -H "Content-Type: application/json" \
    -d '{"maxPages": 1}' | jq -r '.status // .message // "no response"' &
done

wait
sleep 20

echo ""
echo ""
echo "=== Recent Scrape Results ==="

for container in landomo-scraper-oc-hu landomo-scraper-dh-hu landomo-scraper-ingatlannet-hu landomo-scraper-zenga-hu landomo-scraper-ingatlan-com; do
  echo ""
  echo "[$container]"
  docker logs $container --tail 30 2>&1 | grep -E "Total listings|✅.*listings|Sent.*properties" | tail -2
done

