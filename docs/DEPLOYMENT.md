# Deployment Guide

Production deployment guide for Landomo services.

## Overview

Landomo runs on a multi-VPS architecture:

- **Per-Country Ingest Services**: One VPS per country (e.g., ingest-czech, ingest-slovakia)
- **Central Search Service**: Single VPS querying all country databases
- **Polygon Service**: OSM boundary management
- **ML Pricing Service**: Price prediction models

## Prerequisites

- Ubuntu 22.04 LTS
- Docker & Docker Compose
- PostgreSQL 16+
- Redis 7+
- Node.js 20+
- 4GB RAM minimum (8GB recommended)

## Infrastructure Setup

### 1. VPS Provisioning

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-contrib-16

# Install Redis
sudo apt install -y redis-server
```

### 2. Database Setup

```bash
# Create landomo user
sudo -u postgres psql
CREATE USER landomo WITH PASSWORD 'your_secure_password';
CREATE DATABASE landomo_czech_republic OWNER landomo;
GRANT ALL PRIVILEGES ON DATABASE landomo_czech_republic TO landomo;
\q

# Apply schema
psql -U landomo -d landomo_czech_republic < docker/postgres/init-schema.sql

# Apply migrations
for migration in ingest-service/migrations/*.sql; do
  echo "Applying $migration..."
  psql -U landomo -d landomo_czech_republic -f "$migration"
done
```

### 3. Redis Configuration

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Set password
requirepass your_redis_password

# Bind to localhost (secure)
bind 127.0.0.1

# Restart Redis
sudo systemctl restart redis-server
```

## Service Deployment

### Ingest Service (Per-Country)

```bash
# Clone repository
git clone https://github.com/yourusername/landomo-world.git
cd landomo-world

# Build shared components
cd shared-components
npm install
npm run build

# Build ingest service
cd ../ingest-service
npm install
npm run build

# Create environment file
cat > .env << EOF
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=landomo
DB_PASSWORD=your_db_password
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
API_KEYS=your_production_api_key
NODE_ENV=production
EOF

# Start with PM2
npm install -g pm2
pm2 start dist/server.js --name ingest-czech
pm2 start dist/start-worker.js --name worker-czech

# Save PM2 configuration
pm2 save
pm2 startup
```

### Search Service

```bash
cd search-service
npm install
npm run build

# Configure environment
cat > .env << EOF
PORT=4000
# Add all country DB connections
DB_CZECH_HOST=localhost
DB_CZECH_PORT=5432
DB_CZECH_USER=landomo
DB_CZECH_PASSWORD=your_password
SEARCH_API_KEY=your_search_api_key
EOF

# Start service
pm2 start dist/server.js --name search-service
pm2 save
```

### Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Configure Nginx
sudo nano /etc/nginx/sites-available/landomo

# Paste configuration:
server {
    listen 80;
    server_name ingest-czech.landomo.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name search.landomo.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable sites
sudo ln -s /etc/nginx/sites-available/landomo /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Install SSL certificates
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ingest-czech.landomo.com -d search.landomo.com
```

## Docker Deployment

### Docker Compose Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: landomo
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: landomo_czech_republic
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init-schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    secrets:
      - db_password
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    restart: unless-stopped

  ingest-service:
    build:
      context: .
      dockerfile: ingest-service/Dockerfile
    environment:
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: landomo
      DB_PASSWORD_FILE: /run/secrets/db_password
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      API_KEYS_FILE: /run/secrets/api_keys
    secrets:
      - db_password
      - api_keys
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: ingest-service/Dockerfile
    command: node dist/start-worker.js
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: landomo
      DB_PASSWORD_FILE: /run/secrets/db_password
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    secrets:
      - db_password
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

secrets:
  db_password:
    file: ./secrets/db_password.txt
  api_keys:
    file: ./secrets/api_keys.txt

volumes:
  postgres-data:
  redis-data:
```

### Deploy with Docker

```bash
# Build images
docker compose -f docker-compose.prod.yml build

# Start services
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down
```

## Monitoring

### Health Checks

```bash
# Ingest service
curl http://localhost:3000/health

# Search service
curl http://localhost:4000/health

# Check all services
pm2 status
```

### Logs

```bash
# PM2 logs
pm2 logs ingest-czech
pm2 logs worker-czech
pm2 logs search-service

# Docker logs
docker compose logs -f ingest-service
docker compose logs -f worker

# System logs
sudo journalctl -u nginx -f
sudo tail -f /var/log/postgresql/postgresql-16-main.log
```

## Backup & Restore

### Database Backup

```bash
# Create backup
pg_dump -U landomo -d landomo_czech_republic -F c -f backup_$(date +%Y%m%d).dump

# Scheduled daily backup
crontab -e
0 2 * * * pg_dump -U landomo -d landomo_czech_republic -F c -f /backups/landomo_czech_$(date +\%Y\%m\%d).dump

# Restore from backup
pg_restore -U landomo -d landomo_czech_republic -c backup_20260216.dump
```

### Redis Backup

```bash
# Create snapshot
redis-cli SAVE

# Copy RDB file
cp /var/lib/redis/dump.rdb /backups/redis_$(date +%Y%m%d).rdb
```

## Scaling

### Horizontal Scaling

```bash
# Add more worker instances
pm2 start dist/start-worker.js --name worker-czech-2 -i 2

# Scale with Docker
docker compose up -d --scale worker=5
```

### Database Read Replicas

```sql
-- On primary
ALTER SYSTEM SET wal_level = replica;
CREATE USER replicator REPLICATION LOGIN ENCRYPTED PASSWORD 'replica_password';

-- On replica
pg_basebackup -h primary-server -D /var/lib/postgresql/16/main -U replicator -P -v
```

## Security

### Firewall

```bash
# Install UFW
sudo apt install -y ufw

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow PostgreSQL (from trusted IPs only)
sudo ufw allow from 10.0.0.0/8 to any port 5432

# Enable firewall
sudo ufw enable
```

### API Key Rotation

```bash
# Generate new API key
openssl rand -hex 32

# Update in .env
nano .env
# API_KEYS=old_key,new_key

# Restart services
pm2 restart all

# Remove old key after migration
nano .env
# API_KEYS=new_key
pm2 restart all
```

## Troubleshooting

See `/docs/TROUBLESHOOTING.md` for common issues.

---

**Last Updated**: 2026-02-16
