# Deployment Guide: Immodirekt.at Scraper

## Quick Start

### Local Development

```bash
# 1. Navigate to scraper directory
cd /Users/samuelseidel/Development/landomo-world/scrapers/Austria/immodirekt-at

# 2. Install dependencies
npm install

# 3. Install Playwright browsers
npm run install:browsers

# 4. Copy environment file
cp .env.example .env

# 5. Run in development mode
npm run dev
```

### Production Deployment

```bash
# 1. Build TypeScript
npm run build

# 2. Set production environment variables
export NODE_ENV=production
export INGEST_API_URL=https://api.landomo.world
export INGEST_API_KEY_IMMODIREKT_AT=<your-production-key>

# 3. Start server
npm start
```

## Docker Deployment

### Build Image

```bash
docker build -t landomo/scraper-immodirekt-at:latest .
```

### Run Container

```bash
docker run -d \
  --name immodirekt-at-scraper \
  -p 8088:8088 \
  -e HEADLESS=true \
  -e BYPASS_CLOUDFLARE=true \
  -e INGEST_API_URL=https://api.landomo.world \
  -e INGEST_API_KEY_IMMODIREKT_AT=<key> \
  --restart unless-stopped \
  landomo/scraper-immodirekt-at:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  immodirekt-at-scraper:
    build: .
    container_name: immodirekt-at-scraper
    ports:
      - "8088:8088"
    environment:
      - HEADLESS=true
      - BYPASS_CLOUDFLARE=true
      - STEALTH_MODE=true
      - RATE_LIMIT_DELAY=2000
      - INGEST_API_URL=https://api.landomo.world
      - INGEST_API_KEY_IMMODIREKT_AT=${INGEST_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8088/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## Kubernetes Deployment

### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: immodirekt-at-scraper
  namespace: landomo-scrapers
spec:
  replicas: 1
  selector:
    matchLabels:
      app: immodirekt-at-scraper
  template:
    metadata:
      labels:
        app: immodirekt-at-scraper
    spec:
      containers:
      - name: scraper
        image: landomo/scraper-immodirekt-at:latest
        ports:
        - containerPort: 8088
        env:
        - name: HEADLESS
          value: "true"
        - name: BYPASS_CLOUDFLARE
          value: "true"
        - name: INGEST_API_URL
          valueFrom:
            configMapKeyRef:
              name: landomo-config
              key: ingest-api-url
        - name: INGEST_API_KEY_IMMODIREKT_AT
          valueFrom:
            secretKeyRef:
              name: scraper-secrets
              key: immodirekt-at-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8088
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8088
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: immodirekt-at-scraper
  namespace: landomo-scrapers
spec:
  selector:
    app: immodirekt-at-scraper
  ports:
  - port: 8088
    targetPort: 8088
  type: ClusterIP
```

## Scheduling

### Cron Job (Linux)

```bash
# Edit crontab
crontab -e

# Add daily scrape at 2 AM
0 2 * * * curl -X POST http://localhost:8088/scrape
```

### Kubernetes CronJob

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: immodirekt-at-scrape-job
  namespace: landomo-scrapers
spec:
  # Run daily at 2 AM
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: curl
            image: curlimages/curl:latest
            args:
            - /bin/sh
            - -c
            - curl -X POST http://immodirekt-at-scraper:8088/scrape
          restartPolicy: OnFailure
```

## Monitoring

### Health Check

```bash
# Check scraper health
curl http://localhost:8088/health
```

### Logs

```bash
# Docker logs
docker logs -f immodirekt-at-scraper

# Kubernetes logs
kubectl logs -f deployment/immodirekt-at-scraper -n landomo-scrapers
```

### Metrics to Monitor

- **Response Time**: Should complete within 30-60 minutes
- **Success Rate**: Track successful vs failed scrapes
- **Listings Count**: Monitor for sudden drops
- **Cloudflare Blocks**: Track bypass success rate
- **Memory Usage**: Should stay under 1GB
- **CPU Usage**: Should stay under 1 core

## Troubleshooting

### Cloudflare Blocks

**Symptom**: Scraper gets stuck on Cloudflare challenges

**Solutions**:
1. Increase rate limiting delay:
   ```bash
   export RATE_LIMIT_DELAY=3000
   ```

2. Run with visible browser to debug:
   ```bash
   export HEADLESS=false
   npm run dev
   ```

3. Consider using residential proxies (requires proxy service)

4. Use ImmoScout24 API instead (recommended)

### Out of Memory

**Symptom**: Process crashes with OOM error

**Solutions**:
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=2048"
npm start

# Or in Docker
docker run -e NODE_OPTIONS="--max-old-space-size=2048" ...
```

### Browser Launch Failures

**Symptom**: Playwright fails to launch browser

**Solutions**:
```bash
# Reinstall browsers
npm run install:browsers

# Check system dependencies (Ubuntu/Debian)
npx playwright install-deps
```

### Rate Limiting

**Symptom**: Getting 429 or blocked by site

**Solutions**:
```bash
# Increase delays
export RATE_LIMIT_DELAY=5000

# Reduce pages per category
export MAX_PAGES_PER_CATEGORY=5
```

## Performance Optimization

### Disable Detail Fetching

For faster scraping without detail pages:
```bash
export FETCH_DETAILS=false
```

### Limit Categories

Modify `src/scrapers/listingsScraper.ts` to scrape only specific categories:
```typescript
const categories = [
  {
    name: 'Apartments for Sale',
    url: 'https://www.immodirekt.at/kaufen/wohnung',
    type: 'sale',
    propertyType: 'apartment'
  }
  // Comment out other categories
];
```

### Parallel Scraping

Not recommended due to Cloudflare detection, but possible:
```bash
# Run multiple instances on different ports
PORT=8088 npm start &
PORT=8089 npm start &
```

## Alternative: ImmoScout24 API

**Recommended approach** - Since immodirekt.at is owned by Scout24 Group and has Cloudflare protection, consider using the ImmoScout24 API instead:

```bash
# ImmoScout24 API has no Cloudflare protection
# See: /Users/samuelseidel/Development/landomo-world/GERMAN_AUSTRIAN_PORTALS_SCRAPING_GUIDE.md

# Endpoints discovered:
# GET /api/psa/is24/properties/search
# GET /api/psa/is24/property/{exposeId}

# Likely includes immodirekt.at listings (same parent company)
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Rotate API keys** regularly
4. **Limit network access** to required domains
5. **Run with least privilege** user

## Backup Strategy

```bash
# Backup raw data before processing
export BACKUP_DIR=/backup/immodirekt-at
mkdir -p $BACKUP_DIR

# Save raw HTML for debugging
# (Implement in scraper if needed)
```

## Maintenance

### Weekly Tasks
- Review logs for errors
- Check success rate metrics
- Monitor Cloudflare bypass effectiveness

### Monthly Tasks
- Update Playwright browsers: `npm run install:browsers`
- Update dependencies: `npm update`
- Review and update selectors if site changes

### Quarterly Tasks
- Review scraping strategy
- Evaluate alternative approaches (API vs scraping)
- Update documentation

## Support

For technical issues:
1. Check logs first
2. Review this deployment guide
3. Consult main research guide
4. Consider ImmoScout24 API alternative
