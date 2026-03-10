#!/bin/bash
#
# Log Analysis Scripts for Landomo Platform
# Usage: ./scripts/log-analysis.sh <command> [options]
#

set -euo pipefail

LOKI_URL="${LOKI_URL:-http://localhost:3100}"

usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  errors [service] [hours]   Show recent errors (default: all services, 1h)
  scraper-failures [hours]   Show scraper failures and error rates
  ingestion-stats [hours]    Show ingestion success/failure counts
  slow-queries [hours]       Show slow database queries
  disk-usage                 Show Docker log disk usage
  top-errors [service] [n]   Show top N most frequent errors
  tail [service]             Live tail logs from a service

Examples:
  $0 errors ingest-czech 24
  $0 scraper-failures 6
  $0 top-errors worker-czech 20
  $0 tail scraper-sreality
  $0 disk-usage
EOF
    exit 1
}

# Query Loki via LogQL
loki_query() {
    local query="$1"
    local hours="${2:-1}"
    local limit="${3:-100}"
    local end=$(date +%s)000000000
    local start=$(( $(date +%s) - hours * 3600 ))000000000

    curl -sG "${LOKI_URL}/loki/api/v1/query_range" \
        --data-urlencode "query=${query}" \
        --data-urlencode "start=${start}" \
        --data-urlencode "end=${end}" \
        --data-urlencode "limit=${limit}" \
        2>/dev/null | jq -r '.data.result[].values[][1]' 2>/dev/null
}

cmd_errors() {
    local service="${1:-}"
    local hours="${2:-1}"

    if [ -n "$service" ]; then
        echo "=== Errors for ${service} (last ${hours}h) ==="
        loki_query '{level="error",service="'"${service}"'"}' "$hours"
    else
        echo "=== All errors (last ${hours}h) ==="
        loki_query '{level="error"}' "$hours"
    fi
}

cmd_scraper_failures() {
    local hours="${1:-1}"
    echo "=== Scraper failures (last ${hours}h) ==="
    loki_query '{service_type="scraper",level=~"error|fatal"} |~ "(?i)(fail|error|timeout|crash)"' "$hours"
}

cmd_ingestion_stats() {
    local hours="${1:-1}"
    echo "=== Ingestion errors (last ${hours}h) ==="
    loki_query '{service_type="ingest",level="error"}' "$hours"
    echo ""
    echo "=== Ingestion warnings (last ${hours}h) ==="
    loki_query '{service_type="ingest",level="warn"}' "$hours" 20
}

cmd_slow_queries() {
    local hours="${1:-1}"
    echo "=== Slow queries (last ${hours}h) ==="
    loki_query '{service="postgres"} |~ "duration.*ms"' "$hours" 50
}

cmd_disk_usage() {
    echo "=== Docker Log Disk Usage ==="
    if command -v docker &>/dev/null; then
        for container in $(docker ps --format '{{.Names}}' | grep landomo); do
            local log_file=$(docker inspect --format='{{.LogPath}}' "$container" 2>/dev/null)
            if [ -n "$log_file" ] && [ -f "$log_file" ]; then
                local size=$(du -sh "$log_file" 2>/dev/null | cut -f1)
                printf "  %-40s %s\n" "$container" "$size"
            fi
        done
    else
        echo "Docker not available locally. Run on VPS:"
        echo "  ssh landomo-vps 'for c in \$(docker ps --format \"{{.Names}}\" | grep landomo); do echo \"\$c: \$(du -sh \$(docker inspect --format=\"{{.LogPath}}\" \$c) 2>/dev/null | cut -f1)\"; done'"
    fi

    echo ""
    echo "=== Loki Storage ==="
    if docker volume inspect landomo-world_loki_data &>/dev/null 2>&1; then
        docker system df -v 2>/dev/null | grep loki || echo "  Run 'docker system df -v' on VPS"
    else
        echo "  Loki volume not found locally. Check VPS."
    fi
}

cmd_top_errors() {
    local service="${1:-}"
    local count="${2:-10}"
    local query

    if [ -n "$service" ]; then
        query='{level="error",service="'"${service}"'"}'
    else
        query='{level="error"}'
    fi

    echo "=== Top ${count} errors (last 24h) ==="
    loki_query "$query" 24 500 | sort | uniq -c | sort -rn | head -n "$count"
}

cmd_tail() {
    local service="${1:?Service name required}"

    if command -v docker &>/dev/null; then
        local container="landomo-${service}"
        docker logs -f --tail 50 "$container" 2>&1
    else
        echo "Docker not available. Use: ssh landomo-vps 'docker logs -f --tail 50 landomo-${service}'"
    fi
}

# Main
case "${1:-}" in
    errors)          shift; cmd_errors "$@" ;;
    scraper-failures) shift; cmd_scraper_failures "$@" ;;
    ingestion-stats) shift; cmd_ingestion_stats "$@" ;;
    slow-queries)    shift; cmd_slow_queries "$@" ;;
    disk-usage)      cmd_disk_usage ;;
    top-errors)      shift; cmd_top_errors "$@" ;;
    tail)            shift; cmd_tail "$@" ;;
    *)               usage ;;
esac
