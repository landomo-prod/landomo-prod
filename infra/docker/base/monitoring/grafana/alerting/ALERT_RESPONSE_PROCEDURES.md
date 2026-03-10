# Alert Response Procedures

## Overview

This document outlines the response procedures for monitoring alerts in the Landomo platform.

## Alert Severity Levels

### Critical
- **Response Time:** Immediate (< 5 minutes)
- **Notification:** PagerDuty + Slack + Email
- **Escalation:** On-call engineer paged
- **Impact:** Production system down or severely degraded

### Warning
- **Response Time:** Within 30 minutes
- **Notification:** Slack + Email
- **Escalation:** Team lead after 1 hour
- **Impact:** Degraded performance or potential issues

### Info
- **Response Time:** Within business hours
- **Notification:** Email only
- **Escalation:** Not escalated
- **Impact:** Informational, no immediate action required

## Infrastructure Alerts

### 1. Database Connection Failure (CRITICAL)

**Alert Trigger:** No active database connections for 5 minutes

**Immediate Actions:**
1. Check database container status:
   ```bash
   docker ps --filter name=postgres
   docker logs landomo-postgres --tail 100
   ```
2. Check PostgreSQL process:
   ```bash
   docker exec landomo-postgres pg_isready
   ```
3. Verify network connectivity:
   ```bash
   docker exec landomo-postgres psql -U landomo -c "SELECT 1"
   ```

**Resolution Steps:**
- If container is down: `docker restart landomo-postgres`
- If connection limit reached: Investigate active connections and kill long-running queries
- If disk full: Clear space or expand volume
- Check `/var/log/postgresql/` for errors

**Post-Incident:**
- Document root cause
- Update runbook if new issue discovered
- Consider connection pool tuning

---

### 2. No Property Ingestion for 1 Hour (WARNING)

**Alert Trigger:** Zero properties ingested in last 60 minutes

**Immediate Actions:**
1. Check worker status:
   ```bash
   docker ps --filter name=worker
   docker logs landomo-worker-czech --tail 100
   ```
2. Check Redis queue:
   ```bash
   docker exec landomo-redis redis-cli LLEN ingest-property-czech
   ```
3. Check scraper status:
   ```bash
   curl -s -u admin:admin 'http://localhost:3100/d/landomo-scraper-performance'
   ```

**Resolution Steps:**
- If workers down: Restart workers
- If queue empty: Check scrapers are running
- If queue full: Scale up workers or investigate processing bottleneck
- Check ingest service logs for errors

**Post-Incident:**
- Review scraper schedules
- Check for rate limiting or blocking
- Monitor ingestion rate trends

---

### 3. Scraper Down for 15+ Minutes (WARNING)

**Alert Trigger:** Scraper has not completed a run in 15 minutes

**Immediate Actions:**
1. Check scraper container:
   ```bash
   docker ps --filter name=scraper
   docker logs <scraper-container> --tail 100
   ```
2. Check recent scrape runs:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT * FROM scrape_runs WHERE portal = 'sreality' ORDER BY started_at DESC LIMIT 5;"
   ```
3. Check for running/stuck scrapes:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT * FROM scrape_runs WHERE status = 'running' AND started_at < NOW() - INTERVAL '1 hour';"
   ```

**Resolution Steps:**
- If container crashed: Check logs, restart container
- If scraper stuck: Mark as failed, restart container
- If portal blocking: Review anti-detection measures, adjust delays
- If network issues: Check connectivity, DNS resolution

**Post-Incident:**
- Update scraper anti-detection if needed
- Adjust timeouts if legitimate long runs
- Consider circuit breaker tuning

---

### 4. High Scraper Failure Rate (WARNING)

**Alert Trigger:** >30% of scraper runs failing in last hour

**Immediate Actions:**
1. Check error patterns:
   ```bash
   docker logs <scraper-container> | grep -i error | tail -20
   ```
2. Check portal availability:
   ```bash
   curl -I <portal-url>
   ```
3. Review recent failures:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT portal, COUNT(*), string_agg(DISTINCT error_message, ', ') FROM scrape_runs WHERE status = 'failed' AND started_at > NOW() - INTERVAL '1 hour' GROUP BY portal;"
   ```

**Resolution Steps:**
- If portal changed: Update selectors/transformers
- If rate limited: Adjust delays, rotate IPs
- If authentication issues: Refresh credentials
- If temporary: Monitor, may self-resolve

**Post-Incident:**
- Update scraper code if needed
- Document portal changes
- Adjust monitoring thresholds

---

### 5. Data Quality Below Threshold (WARNING)

**Alert Trigger:** Data completeness < 85% for 30 minutes

**Immediate Actions:**
1. Check which fields are missing:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT portal, COUNT(*) FILTER (WHERE title IS NULL) as missing_title, COUNT(*) FILTER (WHERE price IS NULL) as missing_price FROM properties WHERE created_at > NOW() - INTERVAL '1 hour' GROUP BY portal;"
   ```
2. Review recent ingestion:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT * FROM ingestion_log WHERE error_message IS NOT NULL ORDER BY ingested_at DESC LIMIT 10;"
   ```
3. Check transformer logs:
   ```bash
   docker logs <scraper-container> | grep -i "transform" | tail -20
   ```

**Resolution Steps:**
- If portal changed: Update transformer mappings
- If scraper regression: Revert recent changes
- If data quality always low: Adjust threshold or document expected quality
- Review sample raw payloads

**Post-Incident:**
- Update transformer tests
- Document expected quality per portal
- Consider field-level completeness alerts

---

### 6. Excessive Stale Listings (WARNING)

**Alert Trigger:** >15% of active listings stale (>72h) for 15 minutes

**Immediate Actions:**
1. Check staleness checker:
   ```bash
   docker logs landomo-worker-czech | grep -i "staleness" | tail -20
   ```
2. Review last seen timestamps:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT portal, COUNT(*), MIN(last_seen_at), MAX(last_seen_at) FROM properties WHERE status = 'active' GROUP BY portal;"
   ```
3. Check scraper coverage:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT portal, MAX(started_at) as last_run FROM scrape_runs GROUP BY portal ORDER BY last_run DESC;"
   ```

**Resolution Steps:**
- If scrapers not running: Restart scrapers
- If circuit breaker triggered: Review and reset
- If legitimate stale listings: Mark as removed manually
- Check staleness thresholds per portal

**Post-Incident:**
- Review staleness_thresholds table
- Adjust per-portal thresholds if needed
- Consider automated cleanup

---

### 7. Database Storage Critical (CRITICAL)

**Alert Trigger:** Database >85% full for 5 minutes

**Immediate Actions:**
1. Check current usage:
   ```bash
   docker exec landomo-postgres psql -U landomo \
     -c "SELECT pg_database.datname, pg_size_pretty(pg_database_size(pg_database.datname)) FROM pg_database ORDER BY pg_database_size(pg_database.datname) DESC;"
   ```
2. Check table sizes:
   ```bash
   docker exec landomo-postgres psql -U landomo -d landomo_czech \
     -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC LIMIT 10;"
   ```
3. Check available disk:
   ```bash
   docker exec landomo-postgres df -h /var/lib/postgresql/data
   ```

**Resolution Steps:**
- **Immediate:** Archive old data, vacuum tables
- **Short-term:** Expand volume, add disk
- **Long-term:** Implement data retention policy, partitioning

**Commands:**
```sql
-- Archive old properties
BEGIN;
DELETE FROM properties WHERE created_at < NOW() - INTERVAL '1 year';
VACUUM FULL properties;
COMMIT;

-- Archive old logs
DELETE FROM ingestion_log WHERE ingested_at < NOW() - INTERVAL '90 days';
VACUUM ingestion_log;
```

**Post-Incident:**
- Implement automated archival
- Set up data retention policy
- Consider table partitioning
- Monitor growth trends

---

### 8. High Database Connection Usage (WARNING)

**Alert Trigger:** >80% connection pool usage for 10 minutes

**Immediate Actions:**
1. Check active connections:
   ```bash
   docker exec landomo-postgres psql -U landomo \
     -c "SELECT pid, usename, application_name, state, query_start, state_change FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"
   ```
2. Identify connection hogs:
   ```bash
   docker exec landomo-postgres psql -U landomo \
     -c "SELECT application_name, COUNT(*) FROM pg_stat_activity GROUP BY application_name ORDER BY COUNT(*) DESC;"
   ```
3. Check for idle connections:
   ```bash
   docker exec landomo-postgres psql -U landomo \
     -c "SELECT COUNT(*), state FROM pg_stat_activity GROUP BY state;"
   ```

**Resolution Steps:**
- Kill long-running queries: `SELECT pg_terminate_backend(pid);`
- Restart misbehaving service
- Tune connection pool settings
- Consider PgBouncer for connection pooling

**Post-Incident:**
- Review application connection management
- Tune pool sizes (max_connections, pool size per service)
- Consider connection lifecycle auditing

---

### 9. Slow Queries Detected (WARNING)

**Alert Trigger:** >5 queries running >30 seconds for 5 minutes

**Immediate Actions:**
1. Identify slow queries:
   ```bash
   docker exec landomo-postgres psql -U landomo \
     -c "SELECT pid, usename, query_start, state, LEFT(query, 100) FROM pg_stat_activity WHERE state != 'idle' AND query_start < NOW() - INTERVAL '30 seconds' ORDER BY query_start;"
   ```
2. Check query plan:
   ```sql
   EXPLAIN ANALYZE <slow-query>;
   ```
3. Review table statistics:
   ```sql
   ANALYZE properties;
   ```

**Resolution Steps:**
- Add missing indexes
- Optimize query (rewrite, add indexes)
- Kill query if blocking others: `SELECT pg_terminate_backend(pid);`
- Update table statistics: `ANALYZE`

**Post-Incident:**
- Review slow query log
- Add indexes where needed
- Consider query timeout configuration
- Update application code

---

## Security Alerts

### (To be defined by security-engineer)

Placeholder for security alert response procedures:
1. Failed authentication attempts
2. Rate limit violations
3. Unauthorized access attempts

---

## Escalation Matrix

### Level 1: On-Call Engineer
- **Scope:** All critical and warning alerts
- **Response Time:** < 5 minutes (critical), < 30 minutes (warning)
- **Contact:** Slack #landomo-oncall, PagerDuty

### Level 2: Team Lead
- **Scope:** Unresolved alerts after 1 hour
- **Response Time:** < 15 minutes
- **Contact:** Slack DM, Phone

### Level 3: Engineering Manager
- **Scope:** Major incidents affecting multiple systems
- **Response Time:** < 30 minutes
- **Contact:** Phone, Slack

---

## Alert Lifecycle

### 1. Alert Fires
- Notification sent via configured channels
- Alert appears in Grafana Alerting dashboard
- Incident tracking begins

### 2. Acknowledgment
- On-call engineer acknowledges via PagerDuty/Slack
- Investigation begins
- Status updates posted to #landomo-incidents

### 3. Investigation
- Follow runbook procedures
- Document findings in incident doc
- Apply temporary mitigations if needed

### 4. Resolution
- Fix root cause
- Verify alert clears
- Document resolution steps

### 5. Post-Incident Review
- Within 24 hours for critical
- Within 1 week for warnings
- Update runbooks
- Implement preventive measures

---

## Runbook Locations

- Database Issues: https://docs.landomo.com/runbooks/database
- Scraper Issues: https://docs.landomo.com/runbooks/scrapers
- Data Quality: https://docs.landomo.com/runbooks/data-quality
- Infrastructure: https://docs.landomo.com/runbooks/infrastructure
- Security: https://docs.landomo.com/runbooks/security

---

## Useful Commands

### Docker
```bash
# List all containers
docker ps -a

# View logs
docker logs -f <container-name>

# Restart container
docker restart <container-name>

# Execute command in container
docker exec -it <container-name> bash
```

### PostgreSQL
```bash
# Connect to database
docker exec -it landomo-postgres psql -U landomo -d landomo_czech

# Check connections
SELECT * FROM pg_stat_activity;

# Kill connection
SELECT pg_terminate_backend(pid);

# Database size
SELECT pg_size_pretty(pg_database_size(current_database()));

# Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Redis
```bash
# Check queue length
docker exec landomo-redis redis-cli LLEN ingest-property-czech

# View queue contents
docker exec landomo-redis redis-cli LRANGE ingest-property-czech 0 10

# Clear queue (emergency only)
docker exec landomo-redis redis-cli DEL ingest-property-czech
```

### Grafana
```bash
# Access Grafana
http://localhost:3100

# View alerts
http://localhost:3100/alerting/list

# View dashboards
http://localhost:3100/dashboards
```

---

## Contact Information

### On-Call Rotation
- **Primary:** Check PagerDuty schedule
- **Backup:** Check PagerDuty schedule
- **Escalation:** Team lead

### Slack Channels
- **#landomo-alerts:** All operational alerts
- **#landomo-security:** Security alerts
- **#landomo-incidents:** Active incident tracking
- **#landomo-oncall:** On-call coordination

### Email
- **ops@landomo.com:** Operations team
- **security@landomo.com:** Security team
- **oncall@landomo.com:** On-call engineer

---

**Last Updated:** 2026-02-08
**Version:** 1.0
**Owner:** Monitoring Specialist
