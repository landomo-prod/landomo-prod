# Grafana Dashboards

Production-ready monitoring dashboards for the Landomo platform.

## Dashboard Overview

### 1. Platform Overview (`01-platform-overview.json`)
**Purpose:** High-level platform metrics and activity monitoring
**Refresh Rate:** 30 seconds
**Key Metrics:**
- Total properties count with color-coded thresholds
- Active listings vs removed/sold/rented
- New properties added today
- Active portals in last 24 hours
- Real-time ingestion rate
- Stale listings detection

**Visualizations:**
- Ingestion rate time series (6-hour window)
- Properties by status/type pie charts
- Properties by portal bar gauge
- Recent scrape activity table
- Latest properties table with key fields
- Price distribution histogram

**Use Cases:**
- Daily operations monitoring
- Quick health check
- Understanding platform activity patterns

---

### 2. Scraper Performance (`02-scraper-performance.json`)
**Purpose:** Track scraper reliability and performance metrics
**Refresh Rate:** 1 minute
**Key Metrics:**
- Scraper success rate (24-hour rolling)
- Total scrape runs and failures
- Average scrape duration
- Per-portal success rates

**Visualizations:**
- Success rate by portal (horizontal bar gauge)
- Average listings found per portal
- Scrape run status over time (stacked area chart)
- Scrape duration trends by portal
- Listings found trend lines
- New vs updated listings comparison
- Portal performance table with detailed stats
- Currently running scrapers

**Use Cases:**
- Identifying failing scrapers
- Performance regression detection
- Capacity planning
- Troubleshooting scraper issues

---

### 3. Data Quality (`03-data-quality.json`)
**Purpose:** Monitor data completeness and detect quality issues
**Refresh Rate:** 5 minutes
**Key Metrics:**
- Overall data completeness score
- Missing critical fields (title, price, coordinates, images)
- Duplicate detection
- Stale listings
- Price and coordinate anomalies

**Visualizations:**
- Field completeness by portal (table with percentages)
- Critical fields missing (bar gauge)
- Data quality trend over 24 hours
- Property changes timeline
- Status distribution pie chart
- Recent price changes table
- Ingestion errors log

**Use Cases:**
- Data quality audits
- Portal-specific issues identification
- Transformer debugging
- Compliance monitoring

---

### 4. Infrastructure Health (`04-infrastructure-health.json`)
**Purpose:** Database and system infrastructure monitoring
**Refresh Rate:** 30 seconds
**Key Metrics:**
- Database connection pool status
- Database size and growth
- Cache hit ratios
- Query performance
- Index usage

**Visualizations:**
- Active/idle database connections time series
- Table sizes (top 10)
- Long-running queries table
- Transaction rate (commits vs rollbacks)
- Cache hit ratio gauge
- Deadlock counter
- Index usage and unused indexes
- Worker queue status
- Ingestion throughput
- Slow queries log (>5s)

**Use Cases:**
- Infrastructure capacity planning
- Performance bottleneck identification
- Index optimization
- Connection pool tuning
- Database maintenance planning

---

## Setup and Configuration

### Prerequisites
- Grafana running at `http://localhost:3100` (container: `landomo-grafana-simple`)
- PostgreSQL datasources configured:
  - `PostgreSQL-Czech` (landomo_czech)
  - `PostgreSQL-Germany` (landomo_germany)
  - Additional country databases as needed
- Redis datasource (optional, for queue monitoring)

### Installation
Dashboards are automatically provisioned from this directory via the configuration in `docker/grafana/dashboards.yml`.

To manually import:
1. Navigate to Grafana UI: http://localhost:3100
2. Login with default credentials (admin/admin)
3. Go to Dashboards → Import
4. Upload JSON file or paste JSON content
5. Select appropriate datasource

### Auto-Provisioning
The dashboards are auto-discovered by Grafana through the provisioning configuration:
```yaml
providers:
  - name: 'Landomo Dashboards'
    folder: ''
    type: file
    updateIntervalSeconds: 10
    options:
      path: /etc/grafana/provisioning/dashboards
```

Any changes to JSON files are picked up within 10 seconds.

---

## Dashboard Features

### Time Range Controls
All dashboards support flexible time ranges:
- Platform Overview: Last 6 hours (default)
- Scraper Performance: Last 7 days (default)
- Data Quality: Last 24 hours (default)
- Infrastructure Health: Last 1 hour (default)

Custom ranges can be selected via the time picker.

### Refresh Intervals
Configurable auto-refresh options:
- 5s, 10s, 30s (for real-time monitoring)
- 1m, 5m, 15m, 30m (for operational monitoring)
- Manual refresh available

### Variables and Filters
Currently static datasource selection. Future enhancements:
- Country selector variable
- Portal filter
- Date range presets

---

## Database Schema Requirements

### Required Tables
- `properties` - Core property listings
- `scrape_runs` - Scraper execution tracking
- `ingestion_log` - Ingestion audit trail
- `property_changes` - Change tracking
- `listing_status_history` - Status lifecycle

### Required Columns
**properties:**
- id, portal_id, portal, source_url, title, price, currency
- property_type, transaction_type, status
- city, latitude, longitude
- created_at, updated_at, last_seen_at
- images (JSONB)

**scrape_runs:**
- id, portal, started_at, finished_at
- listings_found, listings_new, listings_updated
- status (running/completed/failed)

**ingestion_log:**
- id, portal, portal_id, ingested_at
- error_message, raw_payload (JSONB)

**property_changes:**
- id, property_id, field_name, old_value, new_value
- changed_at

---

## Customization

### Adding New Panels
1. Edit the dashboard JSON file
2. Add new panel object to `panels` array
3. Set unique `id` and `gridPos` for layout
4. Configure `targets` with SQL query
5. Set `fieldConfig` for thresholds/units
6. Save and verify in Grafana

### Modifying Queries
SQL queries use standard PostgreSQL syntax:
- Use `$__timeFilter(column)` for time range filtering (auto-applied)
- Use `date_trunc('minute', column)` for time series grouping
- Format results as `time_series` or `table` based on visualization

### Color Thresholds
Threshold configuration in `fieldConfig.defaults.thresholds`:
```json
"steps": [
  {"value": null, "color": "red"},    // Default (0)
  {"value": 70, "color": "yellow"},   // Warning
  {"value": 90, "color": "green"}     // Healthy
]
```

---

## Troubleshooting

### Dashboard Not Loading
- Check Grafana logs: `docker logs landomo-grafana-simple`
- Verify JSON syntax: Use online JSON validator
- Check datasource connectivity in Grafana UI

### No Data Displayed
- Verify database has data: `SELECT COUNT(*) FROM properties;`
- Check datasource credentials in `docker/grafana/datasources.yml`
- Verify table and column names match schema

### Query Errors
- Test queries directly in PostgreSQL client
- Check for missing columns (e.g., `status`, `last_seen_at`)
- Verify date column types (should be `timestamp with time zone`)

### Performance Issues
- Add indexes on frequently queried columns
- Limit time ranges for large datasets
- Use `LIMIT` clauses in table panels
- Consider materialized views for complex aggregations

---

## Best Practices

### Monitoring Workflow
1. **Daily Check:** Platform Overview → verify overall health
2. **Scraper Issues:** Scraper Performance → identify failures
3. **Data Quality:** Data Quality → check completeness scores
4. **Performance:** Infrastructure Health → review slow queries

### Alert Configuration (Future)
Recommended alert rules:
- Scraper success rate < 80% (15min)
- Data completeness < 70% (1h)
- Database connections > 80 (5min)
- Stale listings > 500 (6h)

### Dashboard Maintenance
- Review and update queries monthly
- Archive unused panels
- Document custom modifications
- Test after schema changes

---

## Integration with Monitoring Stack

### Current Setup
- **Metrics Source:** PostgreSQL (direct queries)
- **Visualization:** Grafana
- **Provisioning:** Docker volume mount

### Future Enhancements
- Prometheus integration for system metrics
- Alertmanager for notifications
- Redis datasource for queue metrics
- Custom exporter for scraper metrics
- Loki for log aggregation

---

## Performance Considerations

### Query Optimization
- All queries use indexed columns where possible
- Time range filters applied via indexes on `created_at`, `started_at`, etc.
- Aggregations limited to reasonable time windows
- Heavy queries (>1s) run at slower refresh rates

### Resource Usage
- Each dashboard creates ~5-15 concurrent queries
- Queries run every 30s-5m depending on dashboard
- Total DB load: ~50-100 queries/minute across all dashboards
- Negligible impact on write operations

### Scaling Recommendations
- Add read replicas for dashboard queries
- Use connection pooler (PgBouncer) for dashboard connections
- Cache expensive aggregations in materialized views
- Archive old data to reduce query scan time

---

## Support and Documentation

### Related Files
- `docker/grafana/datasources.yml` - Datasource configuration
- `docker/grafana/dashboards.yml` - Provisioning config
- `docker/grafana/grafana.ini` - Grafana settings

### External Resources
- [Grafana Documentation](https://grafana.com/docs/)
- [PostgreSQL Data Source Plugin](https://grafana.com/grafana/plugins/grafana-postgresql-datasource/)
- [Dashboard JSON Schema](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/)

### Contributing
When adding new dashboards:
1. Follow the naming convention: `##-name.json`
2. Add UID for stable URLs
3. Set `"overwrite": true` for provisioning
4. Document in this README
5. Test with real data before committing
