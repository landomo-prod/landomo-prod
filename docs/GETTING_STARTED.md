# Getting Started with Landomo-World

Quick start guide to get the platform running locally.

## Prerequisites

### Required
- **Docker** 20.10+ and Docker Compose
- **Node.js** 18+ and npm
- **Git**
- **8GB RAM** minimum (16GB recommended)
- **20GB disk space** for Docker images and databases

### Optional
- **PostgreSQL** 14+ (for local development without Docker)
- **Redis** 6+ (for local queue development)
- **Python** 3.11+ (for ML service development)

## Quick Start (5 minutes)

### 1. Clone Repository

```bash
git clone https://github.com/landomo/landomo-world.git
cd landomo-world
```

### 2. Start Core Infrastructure

```bash
# Start PostgreSQL and Redis
docker compose -f docker/docker-compose.yml --env-file .env.dev up -d postgres redis

# Wait for services to be ready (30 seconds)
sleep 30
```

### 3. Initialize Database

```bash
# Create Czech Republic database
docker exec -i landomo-postgres psql -U landomo -c "CREATE DATABASE landomo_czech_republic;"

# Apply schema
docker exec -i landomo-postgres psql -U landomo -d landomo_czech_republic < docker/postgres/init-schema.sql

# Apply migrations
for file in ingest-service/migrations/*.sql; do
  docker exec -i landomo-postgres psql -U landomo -d landomo_czech_republic < "$file"
done
```

### 4. Start Services

```bash
# Start Czech Republic ingest + worker
docker compose -f docker/docker-compose.yml up -d ingest-czech worker-czech

# Start a scraper
docker compose -f docker/docker-compose.yml up -d sreality
```

### 5. Verify Everything Works

```bash
# Check ingest service health
curl http://localhost:3004/health

# Trigger scraper
curl -X POST http://localhost:8084/scrape

# Check logs
docker logs landomo-worker-czech
```

You should see properties being ingested!

## Local Development Setup

For active development, you'll want to run services locally outside Docker.

### 1. Install Dependencies

```bash
# Shared components (must be built first)
cd shared-components
npm install
npm run build
cd ..

# Ingest service
cd ingest-service
npm install
cd ..
```

### 2. Configure Environment

```bash
# Copy example env file
cp .env.example .env.dev

# Edit with your local settings
nano .env.dev
```

Key settings for local development:
```env
# Database (local or Docker)
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=your_password

# Redis (local or Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# API Keys (get from team)
INGEST_API_KEY_CZECH=dev_key_czech_sreality
```

### 3. Run Services Locally

```bash
# Terminal 1: Ingest Service
cd ingest-service
npm run dev  # Port 3004

# Terminal 2: Worker
cd ingest-service
npm run worker  # Processes queue jobs

# Terminal 3: Scraper
cd "scrapers/Czech Republic/sreality"
npm install
npm run dev  # Port 8084
```

### 4. Trigger a Scrape

```bash
# Trigger the scraper
curl -X POST http://localhost:8084/scrape

# Watch ingest logs
# You should see properties being processed
```

## Development Workflow

### Building Shared Components

Whenever you change shared types or utilities:

```bash
cd shared-components
npm run build

# Then rebuild dependent services
cd ../ingest-service
npm run type-check
```

### Running a Single Scraper

```bash
cd "scrapers/Czech Republic/sreality"

# Install dependencies
npm install

# Start in dev mode
npm run dev

# In another terminal, trigger it
curl -X POST http://localhost:8084/scrape
```

### Testing Changes

```bash
# Type check
cd ingest-service
npm run type-check

# Run a scraper test
cd "scrapers/Czech Republic/sreality"
npm test
```

## Common Setup Issues

### Port Already in Use

```bash
# Check what's using the port
lsof -ti:3004

# Kill the process
kill -9 $(lsof -ti:3004)
```

### Docker Out of Memory

```bash
# Increase Docker memory limit to 8GB
# Docker Desktop → Settings → Resources → Memory: 8GB

# Restart Docker
```

### PostgreSQL Connection Failed

```bash
# Check if postgres is running
docker ps | grep postgres

# Check logs
docker logs landomo-postgres

# Restart if needed
docker restart landomo-postgres
```

### Redis Connection Timeout

```bash
# Check redis is running
docker ps | grep redis

# Test connection
redis-cli -h localhost ping
# Should return: PONG

# Restart if needed
docker restart landomo-redis
```

### Migrations Failed

```bash
# Check which migrations ran
docker exec -i landomo-postgres psql -U landomo -d landomo_czech_republic -c "SELECT * FROM schema_migrations;"

# Manually run a specific migration
docker exec -i landomo-postgres psql -U landomo -d landomo_czech_republic < ingest-service/migrations/013_category_partitioning.sql
```

## Next Steps

- **Add a scraper**: See [scrapers/SCRAPER_GUIDE.md](scrapers/SCRAPER_GUIDE.md)
- **Understand architecture**: Read [ARCHITECTURE.md](ARCHITECTURE.md)
- **Learn data model**: Check [DATA_MODEL.md](DATA_MODEL.md)
- **Deploy to production**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)

## Useful Commands

```bash
# View all running services
docker ps

# View logs for a service
docker logs -f landomo-ingest-czech

# Restart a service
docker restart landomo-worker-czech

# Stop all services
docker compose -f docker/docker-compose.yml down

# Clean up everything (WARNING: deletes data)
docker compose -f docker/docker-compose.yml down -v

# Shell into postgres
docker exec -it landomo-postgres psql -U landomo -d landomo_czech_republic

# Shell into redis
docker exec -it landomo-redis redis-cli

# Check disk usage
docker system df

# Clean up unused images
docker system prune -a
```

## Development Tips

1. **Always build shared-components first** when changing types
2. **Use local services** for active development (faster iteration)
3. **Use Docker** for testing full integration
4. **Check logs** when something doesn't work - they're your friend
5. **Type check** before committing - saves time debugging later

## Getting Help

- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Common patterns**: [scrapers/SCRAPER_PATTERNS.md](scrapers/SCRAPER_PATTERNS.md)
- **API docs**: [API_REFERENCE.md](API_REFERENCE.md)
