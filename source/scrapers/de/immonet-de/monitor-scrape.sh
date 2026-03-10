#!/bin/bash

# Monitor immonet-de scraper progress in real-time
# Usage: ./monitor-scrape.sh [duration_in_minutes]

DURATION_MIN=${1:-30}
DURATION_SEC=$((DURATION_MIN * 60))
CONTAINER="landomo-scraper-immonet-de"

echo "🔍 Monitoring immonet-de scraper for ${DURATION_MIN} minutes..."
echo "=================================================="
echo ""

START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION_SEC))

# Track metrics
CATEGORIES_SEEN=()
TOTAL_PAGES=0
TOTAL_LISTINGS=0

while [ $(date +%s) -lt $END_TIME ]; do
    CURRENT_TIME=$(date +%s)
    ELAPSED=$((CURRENT_TIME - START_TIME))
    ELAPSED_MIN=$((ELAPSED / 60))
    ELAPSED_SEC=$((ELAPSED % 60))

    # Get current category
    CURRENT_CATEGORY=$(docker logs $CONTAINER 2>&1 | grep "📄 Scraping category:" | tail -1)

    # Count pages scraped
    PAGE_COUNT=$(docker logs $CONTAINER 2>&1 | grep "✓ Page" | wc -l | xargs)

    # Count listings found
    LISTING_COUNT=$(docker logs $CONTAINER 2>&1 | grep "✓ Page" | grep -oE "Found [0-9]+" | grep -oE "[0-9]+" | awk '{s+=$1} END {print s}')

    # Count categories completed
    COMPLETED_CATEGORIES=$(docker logs $CONTAINER 2>&1 | grep "✅ Category complete:" | wc -l | xargs)

    # Get last page info
    LAST_PAGE=$(docker logs $CONTAINER 2>&1 | grep "✓ Page" | tail -1)

    # Check if scrape is complete
    SCRAPE_COMPLETE=$(docker logs $CONTAINER 2>&1 | grep "✅ Scrape completed" | tail -1)

    clear
    echo "🔍 Immonet-de Scraper Monitor"
    echo "=================================================="
    echo "⏱️  Elapsed: ${ELAPSED_MIN}m ${ELAPSED_SEC}s / ${DURATION_MIN}m"
    echo "📊 Progress:"
    echo "   Categories completed: ${COMPLETED_CATEGORIES}"
    echo "   Total pages scraped: ${PAGE_COUNT}"
    echo "   Total listings found: ${LISTING_COUNT:-0}"
    echo ""
    echo "📄 Current Activity:"
    if [ ! -z "$CURRENT_CATEGORY" ]; then
        echo "   $CURRENT_CATEGORY"
    fi
    if [ ! -z "$LAST_PAGE" ]; then
        echo "   $LAST_PAGE"
    fi
    echo ""

    if [ ! -z "$SCRAPE_COMPLETE" ]; then
        echo "✅ Scrape completed!"
        echo "$SCRAPE_COMPLETE"
        break
    fi

    # Check for errors
    RECENT_ERRORS=$(docker logs $CONTAINER --since "10s" 2>&1 | grep -E "(Error|❌)" | wc -l | xargs)
    if [ "$RECENT_ERRORS" -gt 0 ]; then
        echo "⚠️  Recent errors detected: $RECENT_ERRORS"
    fi

    echo "=================================================="
    echo "Press Ctrl+C to stop monitoring"

    sleep 10
done

echo ""
echo "📊 Final Statistics:"
echo "=================================================="
docker logs $CONTAINER 2>&1 | grep -E "(Total listings|Scrape completed|Categories: [0-9]+)"
echo ""
