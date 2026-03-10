# Grafana Dashboards - Quick Start Guide

## Access Grafana

**URL:** http://localhost:3100
**Username:** admin
**Password:** admin

## Available Dashboards

### 1. Platform Overview
**URL:** http://localhost:3100/d/landomo-platform-overview/landomo-platform-overview

Quick health check - see total properties, active listings, ingestion rate, and recent activity.

**Best for:** Daily ops monitoring, quick status check

### 2. Scraper Performance
**URL:** http://localhost:3100/d/landomo-scraper-performance/scraper-performance

Track scraper success rates, duration, and listings found per portal.

**Best for:** Identifying failing scrapers, performance regression detection

### 3. Data Quality
**URL:** http://localhost:3100/d/landomo-data-quality/data-quality

Monitor data completeness, missing fields, duplicates, and anomalies.

**Best for:** Data quality audits, transformer debugging

### 4. Infrastructure Health
**URL:** http://localhost:3100/d/landomo-infrastructure-health/infrastructure-health

Database connections, cache hit ratio, slow queries, and system metrics.

**Best for:** Performance tuning, capacity planning

## Quick Commands

### Restart Grafana
```bash
docker restart landomo-grafana-simple
```

### Check Grafana Status
```bash
docker ps --filter name=grafana
curl -s http://localhost:3100/api/health
```

### View Grafana Logs
```bash
docker logs -f landomo-grafana-simple
```

### Test Database Connectivity
```bash
# Czech database
docker exec landomo-postgres psql -U landomo -d landomo_czech -c "SELECT COUNT(*) FROM properties;"

# Germany database
docker exec landomo-postgres psql -U landomo -d landomo_germany -c "SELECT COUNT(*) FROM properties;"
```

## Troubleshooting

### No Data in Dashboards
Databases are currently empty. Run ingestion to populate:
```bash
# Example: Trigger a scraper run
curl -X POST http://localhost:3008/api/v1/scrape-runs/start \
  -H "X-API-Key: dev_key_czech_1" \
  -H "Content-Type: application/json" \
  -d '{"portal": "sreality"}'
```

### Dashboard Not Loading
1. Check Grafana container is running
2. Verify port 3100 is accessible
3. Check logs for errors

### Query Errors
1. Verify database schema is up to date
2. Check table exists: `docker exec landomo-postgres psql -U landomo -d landomo_czech -c "\dt"`
3. Confirm columns match queries

## Dashboard Features

### Time Range Picker
- Top-right corner of each dashboard
- Quick ranges: Last 5m, 15m, 1h, 6h, 24h, 7d
- Custom range selector available

### Auto-Refresh
- Configurable in top-right dropdown
- Options: 5s, 10s, 30s, 1m, 5m, 15m
- Default varies by dashboard (30s to 5m)

### Panel Actions
- Hover over panel title for menu
- View → Full screen mode
- Explore → Query in Explore view
- Inspect → See raw data and query

### Variables (Future)
Currently not configured, but planned:
- Country selector
- Portal filter
- Time range presets

## Key Metrics to Watch

### Platform Health
- **Total Properties** - Should grow steadily
- **Active Listings** - Should be > 80% of total
- **New Today** - Should match scraper schedule
- **Ingestion Rate** - Should be stable during scrape runs

### Scraper Health
- **Success Rate** - Should be > 90%
- **Failed Runs** - Should be 0 or minimal
- **Average Duration** - Should be consistent per portal
- **Listings Found** - Should match portal averages

### Data Quality
- **Completeness Score** - Should be > 90%
- **Missing Fields** - Should be minimal (< 10%)
- **Duplicates** - Should be 0
- **Stale Listings** - Should be < 5% of active

### Infrastructure
- **DB Connections** - Should be < 80% of max
- **Cache Hit Ratio** - Should be > 95%
- **Slow Queries** - Should be 0 or minimal
- **Deadlocks** - Should be 0

## Alerting (Future)

Recommended alert rules to configure:

**Critical:**
- Scraper success rate < 80% for 15 minutes
- Database connections > 80% of max for 5 minutes
- Ingestion rate = 0 for 1 hour during business hours

**Warning:**
- Data completeness < 85% for 1 hour
- Stale listings > 10% of active for 6 hours
- Cache hit ratio < 90% for 30 minutes
- Slow queries > 5 for 15 minutes

**Notifications:**
- Slack: #landomo-alerts
- Email: ops@landomo.com
- PagerDuty: Critical only

## Dashboard Maintenance

### Updating Dashboards
Edit JSON files in `docker/grafana/dashboards/` directory.
Changes auto-reload within 10 seconds.

### Adding New Panels
1. Copy existing panel structure
2. Assign unique `id` (increment from last panel)
3. Set `gridPos` for layout
4. Update SQL query in `targets`
5. Configure thresholds in `fieldConfig`

### Dashboard JSON Structure
```json
{
  "title": "Dashboard Title",
  "uid": "unique-dashboard-id",
  "refresh": "30s",
  "panels": [
    {
      "id": 1,
      "title": "Panel Title",
      "type": "stat|timeseries|table|bargauge|piechart",
      "gridPos": {"h": 6, "w": 6, "x": 0, "y": 0},
      "targets": [{
        "datasource": {"type": "postgres", "uid": "PostgreSQL-Czech"},
        "rawSql": "SELECT ...",
        "format": "table|time_series"
      }]
    }
  ]
}
```

## Documentation

**Full Documentation:** `docker/grafana/dashboards/README.md`
**Deployment Details:** `docker/grafana/DASHBOARD_DEPLOYMENT.md`
**Dashboard JSONs:** `docker/grafana/dashboards/*.json`

## Support

**Team Lead:** Direct questions to production-deployment team
**Monitoring Specialist:** Created these dashboards
**Documentation:** See README.md for detailed info

---

**Last Updated:** 2026-02-08
**Version:** 1.0
**Status:** Production Ready ✅
