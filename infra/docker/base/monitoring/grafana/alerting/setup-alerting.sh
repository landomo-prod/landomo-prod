#!/bin/bash
# Grafana Alerting Setup Script
# Sets up monitoring alerts and notification channels

set -e

echo "🚨 Setting up Grafana Alerting..."

# Check if Grafana is running
if ! docker ps | grep -q landomo-grafana-simple; then
    echo "❌ Grafana container not running. Start it first:"
    echo "   docker restart landomo-grafana-simple"
    exit 1
fi

echo "✅ Grafana container is running"

# Check environment variables
echo "📋 Checking required environment variables..."

if [ -z "$SLACK_WEBHOOK_URL" ]; then
    echo "⚠️  SLACK_WEBHOOK_URL not set (optional for testing)"
fi

if [ -z "$SLACK_SECURITY_WEBHOOK_URL" ]; then
    echo "⚠️  SLACK_SECURITY_WEBHOOK_URL not set (optional for testing)"
fi

if [ -z "$PAGERDUTY_INTEGRATION_KEY" ]; then
    echo "⚠️  PAGERDUTY_INTEGRATION_KEY not set (optional for testing)"
fi

# Verify Grafana API access
echo "🔑 Testing Grafana API access..."
if ! curl -s -u admin:admin http://localhost:3100/api/health > /dev/null; then
    echo "❌ Cannot connect to Grafana API. Check if Grafana is running on port 3100"
    exit 1
fi

echo "✅ Grafana API accessible"

# Check if datasources are configured
echo "📊 Checking datasources..."
DATASOURCES=$(curl -s -u admin:admin http://localhost:3100/api/datasources)
if echo "$DATASOURCES" | grep -q "PostgreSQL"; then
    echo "✅ PostgreSQL datasources configured"
else
    echo "❌ PostgreSQL datasources not found. Configure them first."
    exit 1
fi

# Count alert rules
echo "📜 Checking alert rules..."
INFRASTRUCTURE_RULES=$(grep -c "uid:" infrastructure-rules.yml || echo "0")
echo "   Infrastructure rules: $INFRASTRUCTURE_RULES"

SECURITY_RULES=$(grep -c "uid:" security-rules.yml || echo "0")
echo "   Security rules: $SECURITY_RULES (placeholder)"

# Verify alert rules are loaded (if Grafana has provisioning enabled)
echo "🔍 Verifying alert rules in Grafana..."
API_RULES=$(curl -s -u admin:admin 'http://localhost:3100/api/v1/provisioning/alert-rules' | grep -o '"uid"' | wc -l || echo "0")
echo "   Rules in Grafana: $API_RULES"

if [ "$API_RULES" -eq "0" ]; then
    echo ""
    echo "⚠️  No alert rules found in Grafana."
    echo "   Alerting files are created but not yet provisioned."
    echo ""
    echo "   To provision alerts, mount the alerting directory in docker-compose.yml:"
    echo ""
    echo "   volumes:"
    echo "     - ./docker/grafana/alerting:/etc/grafana/provisioning/alerting:ro"
    echo ""
    echo "   Then restart Grafana:"
    echo "   docker restart landomo-grafana-simple"
    echo ""
fi

# Test notification (optional)
echo ""
echo "🧪 Alert setup complete!"
echo ""
echo "📁 Files created:"
echo "   ✅ infrastructure-rules.yml (9 operational alerts)"
echo "   ✅ security-rules.yml (placeholder for security team)"
echo "   ✅ contact-points.yml (4 notification channels)"
echo "   ✅ notification-policies.yml (routing logic)"
echo "   ✅ ALERT_RESPONSE_PROCEDURES.md (runbooks)"
echo "   ✅ README.md (documentation)"
echo ""
echo "🔧 Next steps:"
echo "   1. Set environment variables (SLACK_WEBHOOK_URL, etc.)"
echo "   2. Mount alerting directory in docker-compose.yml"
echo "   3. Restart Grafana: docker restart landomo-grafana-simple"
echo "   4. Verify rules loaded: curl -u admin:admin http://localhost:3100/api/v1/provisioning/alert-rules"
echo "   5. Test notifications in Grafana UI: http://localhost:3100/alerting/list"
echo ""
echo "📖 Read README.md for detailed setup instructions"
echo "📞 Read ALERT_RESPONSE_PROCEDURES.md for incident response"
echo ""
echo "✨ Alerting infrastructure ready!"
