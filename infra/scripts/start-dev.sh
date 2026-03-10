#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Starting Landomo-World Platform"
echo "=========================================="
echo ""

# Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Error: Docker is not running"
  echo "Please start Docker Desktop and try again"
  exit 1
fi

echo "✅ Docker is running"
echo ""

# Load development environment
if [ -f .env.dev ]; then
  echo "📝 Loading development environment (.env.dev)"
  export $(cat .env.dev | grep -v '^#' | grep -v '^$' | xargs)
else
  echo "⚠️  Warning: .env.dev not found, using defaults"
fi

echo ""
echo "📦 Building Docker images..."
docker compose build

echo ""
echo "🏃 Starting services..."
docker compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 15

# Check PostgreSQL
if docker exec landomo-postgres pg_isready -U landomo > /dev/null 2>&1; then
  echo "✅ PostgreSQL is healthy"
else
  echo "❌ PostgreSQL is not responding"
fi

# Check Redis
if docker exec landomo-redis redis-cli ping > /dev/null 2>&1; then
  echo "✅ Redis is healthy"
else
  echo "❌ Redis is not responding"
fi

# Check ingest services
echo ""
echo "🏥 Checking ingest service health endpoints..."

SERVICES=(
  "3001:Australia"
  "3002:UK"
  "3003:USA"
  "3004:Czech"
  "3005:France"
  "3006:Spain"
  "3007:Italy"
)

for service in "${SERVICES[@]}"; do
  PORT="${service%%:*}"
  NAME="${service##*:}"

  if curl -s -f "http://localhost:${PORT}/api/v1/health" > /dev/null 2>&1; then
    echo "✅ ${NAME} ingest service (port ${PORT}) is healthy"
  else
    echo "❌ ${NAME} ingest service (port ${PORT}) is not responding"
  fi
done

echo ""
echo "=========================================="
echo "✅ Landomo-World Platform is Running!"
echo "=========================================="
echo ""
echo "📊 Services:"
echo "  PostgreSQL:  localhost:5432"
echo "  Redis:       localhost:6379"
echo ""
echo "🌍 Ingest APIs:"
echo "  Australia:   http://localhost:3001"
echo "  UK:          http://localhost:3002"
echo "  USA:         http://localhost:3003"
echo "  Czech:       http://localhost:3004"
echo "  France:      http://localhost:3005"
echo "  Spain:       http://localhost:3006"
echo "  Italy:       http://localhost:3007"
echo ""
echo "📖 Useful commands:"
echo "  View logs:          docker compose logs -f"
echo "  View specific:      docker compose logs -f ingest-australia"
echo "  Stop services:      docker compose down"
echo "  Restart service:    docker compose restart ingest-australia"
echo "  Check databases:    docker exec -it landomo-postgres psql -U landomo -l"
echo ""
echo "🔍 Monitor:"
echo "  Prometheus:  http://localhost:9090 (if monitoring enabled)"
echo "  Grafana:     http://localhost:3000 (if monitoring enabled)"
echo ""
