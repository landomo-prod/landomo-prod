# Grafana Dashboard Deployment Summary

**Date:** 2026-02-08
**Status:** ✅ Completed
**Grafana Version:** 12.3.2

## Deployed Dashboards

All four production dashboards have been successfully deployed and are accessible via Grafana at http://localhost:3100.

### 1. Landomo Platform Overview
- **UID:** `landomo-platform-overview`
- **URL:** http://localhost:3100/d/landomo-platform-overview/landomo-platform-overview
- **Refresh Rate:** 30 seconds
- **Panels:** 14 visualizations
- **Purpose:** High-level platform health and activity monitoring

**Key Metrics:**
- Total properties count
- Active listings vs stale
- New properties today
- Ingestion rate (properties/minute)
- Properties by status, type, portal, country
- Recent scrape activity
- Latest properties table

### 2. Scraper Performance
- **UID:** `landomo-scraper-performance`
- **URL:** http://localhost:3100/d/landomo-scraper-performance/scraper-performance
- **Refresh Rate:** 1 minute
- **Panels:** 12 visualizations
- **Purpose:** Track scraper reliability and performance

**Key Metrics:**
- Scraper success rate (24h rolling)
- Total runs and failures
- Average scrape duration
- Success rate by portal
- Listings found per portal
- Scrape status over time
- Duration and listings trends
- New vs updated listings
- Portal performance details
- Currently running scrapers

### 3. Data Quality
- **UID:** `landomo-data-quality`
- **URL:** http://localhost:3100/d/landomo-data-quality/data-quality
- **Refresh Rate:** 5 minutes
- **Panels:** 15 visualizations
- **Purpose:** Monitor data completeness and detect quality issues

**Key Metrics:**
- Overall data completeness score
- Missing critical fields (title, price, coordinates)
- Field completeness by portal
- Duplicate detection
- Stale listings (>72h)
- Price and coordinate anomalies
- Data quality trends
- Property changes timeline
- Status distribution
- Recent price changes
- Ingestion errors log

### 4. Infrastructure Health
- **UID:** `landomo-infrastructure-health`
- **URL:** http://localhost:3100/d/landomo-infrastructure-health/infrastructure-health
- **Refresh Rate:** 30 seconds
- **Panels:** 15 visualizations
- **Purpose:** Database and system infrastructure monitoring

**Key Metrics:**
- Database connection pool (active/idle)
- Database size and total rows
- Table sizes (top 10)
- Long running queries
- Transaction rate (commits/rollbacks)
- Cache hit ratio
- Deadlock counter
- Index usage and unused indexes
- Worker queue status
- Ingestion throughput
- Slow queries (>5s)

## Technical Configuration

### Datasources
Successfully provisioned:
- **PostgreSQL-Czech** (landomo_czech) - UID: P97BDFA724AF7CD80
- **PostgreSQL-Germany** (landomo_germany) - UID: PF74DBDC7D7111C44
- **Redis** - UID: PA7F6415749A3297A

### Container Setup
```bash
Container: landomo-grafana-simple
Image: grafana/grafana:latest
Port: 3100 (host) → 3000 (container)
Network: landomo-world_landomo-net
```

### Volume Mounts
```
/Users/samuelseidel/Development/landomo-world/docker/grafana/dashboards
  → /var/lib/grafana/dashboards (ro)

/Users/samuelseidel/Development/landomo-world/docker/grafana/dashboards.yml
  → /etc/grafana/provisioning/dashboards/dashboards.yml (ro)

/Users/samuelseidel/Development/landomo-world/docker/grafana/datasources.yml
  → /etc/grafana/provisioning/datasources/datasources.yml (ro)
```

### Provisioning Configuration
File: `docker/grafana/dashboards.yml`
```yaml
providers:
  - name: 'Landomo Dashboards'
    folder: ''
    type: file
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: false
```

## Dashboard Files

Located in: `/Users/samuelseidel/Development/landomo-world/docker/grafana/dashboards/`

```
01-platform-overview.json         15K
02-scraper-performance.json       16K
03-data-quality.json              18K
04-infrastructure-health.json     17K
README.md                         9.5K
```

## Verification Steps

### 1. Check Grafana Health
```bash
curl -s http://localhost:3100/api/health | python3 -m json.tool
```
Expected output:
```json
{
    "database": "ok",
    "version": "12.3.2",
    "commit": "df2547decd50d14defa20ec9ce1c2e2bc9462d72"
}
```

### 2. List Dashboards
```bash
curl -s -u admin:admin 'http://localhost:3100/api/search?type=dash-db' | python3 -m json.tool
```

### 3. Check Datasources
```bash
curl -s -u admin:admin http://localhost:3100/api/datasources | python3 -m json.tool
```

### 4. Test Database Connectivity
```bash
docker exec landomo-postgres psql -U landomo -d landomo_czech -c "SELECT COUNT(*) FROM properties;"
```

## Dashboard Query Patterns

All dashboards follow these best practices:

### Time Series Queries
```sql
SELECT
  date_trunc('minute', column_name) as time,
  COUNT(*) as metric_name
FROM table_name
WHERE column_name > NOW() - INTERVAL '6 hours'
GROUP BY time
ORDER BY time
```

### Stat Queries
```sql
SELECT COUNT(*) as "Display Name"
FROM table_name
WHERE condition
```

### Table Queries
```sql
SELECT
  column1 as "Column 1",
  column2 as "Column 2"
FROM table_name
ORDER BY column1 DESC
LIMIT 20
```

## Color Thresholds

Standard threshold configurations:

**Success Rates:**
- Red: < 70%
- Yellow: 70-90%
- Green: > 90%

**Data Completeness:**
- Red: < 70%
- Yellow: 70-90%
- Green: > 90%

**Error Counts:**
- Green: 0
- Yellow: 1-10
- Red: > 10

## Dashboard Maintenance

### Updating Dashboards
1. Edit JSON files in `docker/grafana/dashboards/`
2. Changes are auto-detected within 10 seconds
3. Refresh Grafana browser to see updates

### Adding New Panels
1. Open dashboard JSON file
2. Add new panel object to `panels` array
3. Assign unique `id` and position via `gridPos`
4. Configure `targets` with SQL query
5. Set `fieldConfig` for formatting
6. Save file (auto-reload in Grafana)

### Restart Grafana
```bash
docker restart landomo-grafana-simple
```

## Known Limitations

### Current State
- Database tables are empty (0 properties, 0 scrape runs)
- Some panels will show "No Data" until ingestion starts
- Queries assume standard schema (as defined in init-schema.sql)

### Schema Dependencies
Dashboards require these tables:
- `properties` (core listings table)
- `scrape_runs` (scraper execution tracking)
- `ingestion_log` (ingestion audit trail)
- `property_changes` (change tracking)
- `listing_status_history` (status lifecycle)

### Missing Features
- Multi-country aggregation (currently Czech/Germany only)
- Alerting rules (not configured)
- Alert notifications (not configured)
- Redis queue metrics (datasource configured but not used)
- User authentication (default admin/admin)

## Next Steps

### Phase 1: Immediate
- [ ] Populate databases with test data
- [ ] Verify all queries return data
- [ ] Test dashboard performance under load
- [ ] Configure Grafana authentication

### Phase 2: Enhancements
- [ ] Add dashboard variables (country selector, time range presets)
- [ ] Configure alerting rules
- [ ] Set up alert notifications (Slack, email, PagerDuty)
- [ ] Add Redis queue monitoring panels
- [ ] Create aggregated multi-country views

### Phase 3: Production
- [ ] Enable HTTPS
- [ ] Set up persistent storage for Grafana data
- [ ] Configure backup/restore for dashboards
- [ ] Add user roles and permissions
- [ ] Integrate with external authentication (OAuth, LDAP)

## Troubleshooting

### Dashboard Not Loading
**Issue:** "Dashboard title cannot be empty"
**Solution:** Ensure JSON format is correct (dashboard object at root level, not wrapped)

### No Data in Panels
**Issue:** All panels show "No Data"
**Solution:**
1. Check database has data: `docker exec landomo-postgres psql -U landomo -d landomo_czech -c "SELECT COUNT(*) FROM properties;"`
2. Verify datasource connectivity in Grafana UI
3. Check PostgreSQL logs: `docker logs landomo-postgres`

### Query Errors
**Issue:** Panel shows query error
**Solution:**
1. Test query directly in PostgreSQL
2. Check column names match schema
3. Verify table exists: `\dt` in psql

### Connection Refused
**Issue:** Cannot connect to Grafana
**Solution:**
1. Check container status: `docker ps --filter name=grafana`
2. Check port mapping: Should be `0.0.0.0:3100->3000/tcp`
3. Restart container: `docker restart landomo-grafana-simple`

## Production Readiness Checklist

- [x] Dashboards deployed
- [x] Datasources configured
- [x] JSON files provisioned
- [x] All panels defined with queries
- [ ] Dashboards tested with real data
- [ ] Performance validated under load
- [ ] Documentation complete
- [ ] Alert rules configured
- [ ] Alert notifications configured
- [ ] Authentication configured
- [ ] HTTPS enabled
- [ ] Backup strategy defined

## Support

For issues or questions:
1. Check dashboard README: `docker/grafana/dashboards/README.md`
2. Review Grafana logs: `docker logs landomo-grafana-simple`
3. Check database connectivity
4. Verify schema migrations applied

---

**Deployed by:** Monitoring Specialist (monitoring-specialist agent)
**Completion Date:** 2026-02-08
**Documentation:** See `docker/grafana/dashboards/README.md` for detailed dashboard documentation
