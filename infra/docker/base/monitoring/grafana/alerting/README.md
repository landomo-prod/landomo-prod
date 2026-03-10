# Grafana Alerting System

Production-ready alerting infrastructure for the Landomo platform.

## Overview

The Landomo alerting system provides comprehensive monitoring across infrastructure, data quality, and security domains with intelligent routing and escalation.

## Architecture

```
Alert Rules (YML) → Grafana Alertmanager → Contact Points → Notification Channels
                                          ↓
                                   Notification Policies
                                          ↓
                              Slack / Email / PagerDuty
```

## Files

### Alert Rules
- **`infrastructure-rules.yml`** - Operations/infrastructure alerts (9 rules)
- **`security-rules.yml`** - Security alerts (placeholder for security-engineer)

### Configuration
- **`contact-points.yml`** - Notification channel configuration
- **`notification-policies.yml`** - Alert routing and escalation logic
- **`ALERT_RESPONSE_PROCEDURES.md`** - Incident response runbooks

## Alert Rules Summary

### Infrastructure Alerts (9 rules)

| Rule | Severity | Threshold | For | Description |
|------|----------|-----------|-----|-------------|
| Database Connection Failure | Critical | <1 connections | 5m | No active DB connections |
| No Property Ingestion | Warning | 0 properties | 1h | Ingestion stopped |
| Scraper Down | Warning | No run in 15m | 5m | Scraper not executing |
| High Scraper Failures | Warning | >30% failure rate | 10m | Excessive scraper errors |
| Data Quality Low | Warning | <85% completeness | 30m | Missing critical fields |
| Excessive Stale Listings | Warning | >15% stale | 15m | Too many outdated listings |
| Database Storage Critical | Critical | >85% full | 5m | Running out of disk space |
| High DB Connections | Warning | >80% pool | 10m | Connection pool saturation |
| Slow Queries Detected | Warning | >5 queries >30s | 5m | Performance degradation |

### Security Alerts (To be implemented)

- Failed auth attempts >10/min
- Rate limit triggers
- Unauthorized access attempts

## Notification Channels

### Contact Points

1. **landomo-ops-email**
   - Email to ops@landomo.com
   - All alerts (fallback)

2. **landomo-ops-slack**
   - Slack #landomo-alerts
   - Critical and warning alerts
   - Rich formatting with runbook links

3. **landomo-security-slack**
   - Slack #landomo-security
   - Security team alerts only
   - Dedicated security monitoring

4. **landomo-critical-pagerduty**
   - PagerDuty integration
   - Critical infrastructure alerts only
   - 24/7 on-call rotation

### Notification Policies

**Critical Infrastructure Alerts:**
- → PagerDuty (immediate page)
- → Slack #landomo-alerts (10s delay)
- → Email ops@landomo.com (10s delay)
- Repeat: Every 30 minutes

**Critical Application Alerts:**
- → Slack #landomo-alerts (10s delay)
- → Email ops@landomo.com (10s delay)
- Repeat: Every 1 hour

**Warning Alerts:**
- → Slack #landomo-alerts (30s delay)
- Repeat: Every 4 hours

**Security Alerts:**
- → Slack #landomo-security (10s delay)
- Repeat: Every 30 minutes

## Setup Instructions

### Prerequisites
- Grafana 10.0+ with unified alerting enabled
- PostgreSQL datasources configured
- Notification channel credentials (Slack webhooks, PagerDuty key)

### 1. Configure Environment Variables

Add to `.env.dev` or docker-compose environment:
```bash
# Slack webhooks
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_SECURITY_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SECURITY/WEBHOOK/URL

# PagerDuty integration key
PAGERDUTY_INTEGRATION_KEY=your-pagerduty-integration-key

# Email settings (already in Grafana config)
GF_SMTP_ENABLED=true
GF_SMTP_HOST=smtp.gmail.com:587
GF_SMTP_USER=alerts@landomo.com
GF_SMTP_PASSWORD=your-smtp-password
GF_SMTP_FROM_ADDRESS=alerts@landomo.com
GF_SMTP_FROM_NAME=Landomo Alerts
```

### 2. Provision Alert Rules

Copy alert rule files to Grafana provisioning directory:
```bash
# Mount alerting directory in docker-compose.yml
volumes:
  - ./docker/grafana/alerting:/etc/grafana/provisioning/alerting:ro
```

### 3. Restart Grafana

```bash
docker restart landomo-grafana-simple
```

### 4. Verify Provisioning

```bash
# Check alert rules loaded
curl -s -u admin:admin 'http://localhost:3100/api/v1/provisioning/alert-rules' | jq '.[] | {uid, title}'

# Check contact points
curl -s -u admin:admin 'http://localhost:3100/api/v1/provisioning/contact-points' | jq '.[] | .name'

# Check notification policies
curl -s -u admin:admin 'http://localhost:3100/api/v1/provisioning/policies'
```

### 5. Test Notifications

```bash
# Test Slack notification
curl -X POST http://localhost:3100/api/alertmanager/grafana/api/v2/alerts \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {"alertname": "Test Alert", "severity": "warning"},
    "annotations": {"summary": "This is a test"}
  }]'
```

## Alert Management

### View Active Alerts
http://localhost:3100/alerting/list

### Silence Alerts
```bash
# Via UI
http://localhost:3100/alerting/silences

# Via API
curl -X POST http://localhost:3100/api/alertmanager/grafana/api/v2/silences \
  -u admin:admin \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [{"name": "alertname", "value": "Database Connection Failure", "isRegex": false}],
    "startsAt": "2026-02-08T20:00:00Z",
    "endsAt": "2026-02-08T22:00:00Z",
    "comment": "Planned maintenance",
    "createdBy": "admin"
  }'
```

### Acknowledge Alerts
- **PagerDuty:** Click "Acknowledge" in mobile app or web dashboard
- **Slack:** React with `:eyes:` emoji or reply in thread
- **Email:** Reply with "ACK" (if configured)

### Modify Alert Rules

1. Edit YAML files in `docker/grafana/alerting/`
2. Changes auto-reload within 10 seconds
3. Verify in Grafana UI

## Alert Tuning

### Adjust Thresholds

Edit rule conditions in `infrastructure-rules.yml`:
```yaml
conditions:
  - evaluator:
      params: [85]  # Change threshold here
      type: gt
```

### Change Evaluation Frequency

Edit `interval` in rule group:
```yaml
groups:
  - name: Infrastructure Alerts
    interval: 1m  # Evaluate every minute
```

### Modify "For" Duration

Change how long condition must be true before firing:
```yaml
for: 10m  # Alert only if condition persists for 10 minutes
```

## Troubleshooting

### Alerts Not Firing

**Check evaluation:**
```bash
docker logs landomo-grafana-simple | grep -i alert
```

**Verify query returns data:**
```sql
-- Test alert query directly in PostgreSQL
SELECT COUNT(*) as connections FROM pg_stat_activity WHERE state = 'active';
```

**Check alert state:**
```bash
curl -s -u admin:admin 'http://localhost:3100/api/v1/provisioning/alert-rules' \
  | jq '.[] | select(.title=="Database Connection Failure") | {title, state}'
```

### Notifications Not Sending

**Check contact points:**
```bash
curl -s -u admin:admin 'http://localhost:3100/api/v1/provisioning/contact-points'
```

**Test Slack webhook:**
```bash
curl -X POST ${SLACK_WEBHOOK_URL} \
  -H "Content-Type: application/json" \
  -d '{"text": "Test notification"}'
```

**Check Alertmanager logs:**
```bash
docker logs landomo-grafana-simple | grep -i alertmanager
```

### False Positives

**Increase "For" duration:**
```yaml
for: 15m  # Require longer duration before firing
```

**Add additional conditions:**
```yaml
conditions:
  - evaluator:
      params: [85]
      type: gt
  - evaluator:
      params: [1000]  # Also require >1000 absolute value
      type: gt
```

**Adjust thresholds based on baseline:**
- Monitor metrics over 7 days
- Set threshold at 95th percentile + 20%

## Best Practices

### Alert Design
1. **Be specific:** Clear, actionable alert names
2. **Include context:** Add runbook links, affected components
3. **Avoid alert fatigue:** Tune thresholds to reduce noise
4. **Group related alerts:** Use notification policies effectively

### Response
1. **Acknowledge immediately:** Let team know you're investigating
2. **Follow runbooks:** Documented procedures save time
3. **Document findings:** Update incident log
4. **Post-mortem:** Learn and improve after incidents

### Maintenance
1. **Review weekly:** Check for noisy or unused alerts
2. **Tune thresholds:** Adjust based on actual behavior
3. **Update runbooks:** Keep procedures current
4. **Test regularly:** Ensure notifications work

## Integration with Monitoring

### Dashboard Integration
Alerts are based on queries from these dashboards:
- Platform Overview → Ingestion alerts
- Scraper Performance → Scraper alerts
- Data Quality → Quality alerts
- Infrastructure Health → Database alerts

### Query Reuse
Alert queries should match dashboard queries for consistency.

## Security Considerations

### Webhook Security
- Use HTTPS webhooks only
- Rotate webhook URLs periodically
- Store in environment variables, not code

### Access Control
- Limit who can modify alert rules
- Require approval for critical alert changes
- Audit alert rule changes

### Sensitive Data
- Don't include passwords/keys in alert messages
- Sanitize error messages before alerting
- Use secure channels for sensitive alerts

## Metrics and SLOs

### Alert Performance Targets
- **MTTD (Mean Time To Detect):** < 5 minutes
- **MTTR (Mean Time To Resolve):** < 30 minutes (critical), < 4 hours (warning)
- **False Positive Rate:** < 5%
- **Alert Coverage:** 100% of critical system components

### Monitor Alert Health
- Alert firing frequency
- Time to acknowledgment
- Time to resolution
- False positive rate
- Escalation rate

## Future Enhancements

### Phase 2
- [ ] Anomaly detection alerts
- [ ] Predictive alerting (forecast-based)
- [ ] Auto-remediation for common issues
- [ ] Alert analytics dashboard

### Phase 3
- [ ] Machine learning-based threshold tuning
- [ ] Incident correlation and grouping
- [ ] Multi-channel consensus (reduce false positives)
- [ ] Self-healing automation

## Support

### Documentation
- Alert Response Procedures: `ALERT_RESPONSE_PROCEDURES.md`
- Grafana Alerting Docs: https://grafana.com/docs/grafana/latest/alerting/
- PagerDuty Integration: https://www.pagerduty.com/docs/

### Team Contacts
- **Monitoring Specialist:** Alerting infrastructure
- **Security Engineer:** Security alerts
- **On-Call Engineer:** Incident response

---

**Last Updated:** 2026-02-08
**Version:** 1.0
**Owner:** Monitoring Specialist
**Status:** Production Ready ✅
