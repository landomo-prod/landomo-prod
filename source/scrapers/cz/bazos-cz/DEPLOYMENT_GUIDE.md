# Bazos LLM Extraction - Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Testing](#testing)
6. [Production Deployment](#production-deployment)
7. [Monitoring](#monitoring)
8. [Cost Optimization](#cost-optimization)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js**: v18.0 or higher
- **npm**: v9.0 or higher (comes with Node.js)
- **TypeScript**: v5.0 or higher (installed via npm)
- **Docker**: v20.0+ (for containerized deployment)

### Azure Requirements

- **Azure Subscription**: Active subscription with billing enabled
- **Azure AI Foundry Access**: Cognitive Services API access
- **API Key**: Valid Azure OpenAI API key with GPT-4.1 deployment
- **Resource Group**: Existing resource group with deployed model

### Recommended Azure Models

1. **GPT-4.1** (Recommended for PoC)
   - Resource: `prg-operations-resource`
   - Location: Sweden Central
   - Rate Limits: 33 requests/min, 33K tokens/min
   - Best for: High-quality structured extraction

2. **Grok-3** (Alternative for High Throughput)
   - Resource: `opsass-grok-resource`
   - Location: Germany West Central
   - Rate Limits: 400 requests/min, 400K tokens/min
   - Best for: Production scale with high volume

### System Requirements

- **RAM**: 2GB minimum, 4GB recommended
- **CPU**: 2 cores minimum
- **Disk Space**: 500MB for dependencies + logs
- **Network**: Stable internet connection for Azure API calls

---

## Environment Setup

### 1. Clone Repository

```bash
cd /Users/samuelseidel/Development/landomo-world
cd "scrapers/Czech Republic/bazos"
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `openai` - Azure OpenAI SDK
- `@azure/openai` - Azure-specific types
- `axios` - HTTP client for scraping
- `express` - API server
- `dotenv` - Environment variable management
- `typescript` - Type safety

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Azure credentials:

```env
# ===========================
# AZURE AI CONFIGURATION
# ===========================

# GPT-4.1 (Recommended)
AZURE_OPENAI_ENDPOINT=https://prg-operations-resource.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your_api_key_here  # Replace with actual key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# ===========================
# LLM EXTRACTION SETTINGS
# ===========================

LLM_EXTRACTION_ENABLED=true  # Set to false to disable LLM extraction
LLM_TEMPERATURE=0           # Lower = more deterministic (0-1)
LLM_MAX_TOKENS=1000         # Max response length
LLM_TIMEOUT_MS=30000        # 30 second timeout

# ===========================
# INGEST SERVICE
# ===========================

INGEST_API_URL=http://ingest-czech:3003/api/v1/properties/bulk-ingest
INGEST_API_KEY=dev_key_cz_1

# ===========================
# SCRAPER CONFIGURATION
# ===========================

PORT=8082
NODE_ENV=development  # Change to production for deployment
MAX_PAGES=5
CONCURRENT_REQUESTS=3
REQUEST_DELAY_MS=1000
```

### 4. Get Azure API Key

#### Option A: Azure Portal (Web UI)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Resource Groups** → `semlegacy`
3. Select **prg-operations-resource**
4. Go to **Keys and Endpoint**
5. Copy **Key 1** or **Key 2**
6. Paste into `.env` as `AZURE_OPENAI_API_KEY`

#### Option B: Azure CLI

```bash
# Login to Azure
az login

# List API keys
az cognitiveservices account keys list \
  --name "prg-operations-resource" \
  --resource-group "semlegacy"

# Output will show key1 and key2 - copy either one
```

---

## Installation

### Development Installation

```bash
# Navigate to bazos scraper directory
cd "scrapers/Czech Republic/bazos"

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify installation
npm run type-check
```

### Docker Installation

```bash
# Build Docker image
docker build -t bazos-llm:latest .

# Verify build
docker images | grep bazos-llm
```

---

## Configuration

### Feature Flag: Enabling/Disabling LLM Extraction

The LLM extraction can be toggled without code changes:

**Enable LLM Extraction** (20+ fields, ~1200ms per listing):
```env
LLM_EXTRACTION_ENABLED=true
```

**Disable LLM Extraction** (baseline only, ~2ms per listing):
```env
LLM_EXTRACTION_ENABLED=false
```

### LLM Parameters

#### Temperature (0-1)

Controls randomness in extraction:

```env
LLM_TEMPERATURE=0    # Deterministic (recommended)
LLM_TEMPERATURE=0.1  # Slightly more creative
LLM_TEMPERATURE=0.5  # More variation (not recommended)
```

**Recommendation**: Keep at `0` for consistent structured extraction.

#### Max Tokens

Maximum length of LLM response:

```env
LLM_MAX_TOKENS=1000  # Default (sufficient for most listings)
LLM_MAX_TOKENS=1500  # For very detailed listings
LLM_MAX_TOKENS=500   # Cost optimization (may truncate data)
```

**Recommendation**: Start with `1000`, adjust based on monitoring.

#### Timeout

Maximum time to wait for LLM response:

```env
LLM_TIMEOUT_MS=30000  # 30 seconds (default)
LLM_TIMEOUT_MS=60000  # 60 seconds (slower network)
LLM_TIMEOUT_MS=15000  # 15 seconds (aggressive)
```

**Recommendation**: Use `30000` (30s) for production.

### Rate Limiting

Azure enforces rate limits per deployment:

**GPT-4.1 Limits:**
- 33 requests/minute
- 33,000 tokens/minute

**Grok-3 Limits:**
- 400 requests/minute
- 400,000 tokens/minute

**Built-in Retry Logic:**
- Automatic retry on rate limit (429 error)
- Exponential backoff: 1s, 2s, 4s delays
- Max 3 attempts per request

---

## Testing

### 1. Unit Test: Connection

Test Azure OpenAI connectivity:

```bash
npx ts-node -e "
import { getAzureOpenAIClient } from './src/services/azureClient';
(async () => {
  const client = getAzureOpenAIClient();
  const success = await client.testConnection();
  console.log('Connection:', success ? '✅ SUCCESS' : '❌ FAILED');
  process.exit(success ? 0 : 1);
})();
"
```

**Expected Output:**
```
[AzureOpenAI] Initialized client for endpoint: https://prg-operations-resource.cognitiveservices.azure.com/
[AzureOpenAI] Deployment: gpt-4.1
[AzureOpenAI] Testing connection...
[AzureOpenAI] Connection test successful
[AzureOpenAI] Response: OK
Connection: ✅ SUCCESS
```

### 2. Integration Test: End-to-End

Run the complete PoC test:

```bash
npx ts-node test-poc-end-to-end.ts
```

**Expected Output:**
```
========================================
BAZOS LLM EXTRACTION - POC TEST
========================================

📋 Test Listing: 214704842 (Italian Villa)
🌐 Description: 1,341 characters

----------------------------------------
BASELINE TRANSFORMATION (No LLM)
----------------------------------------
✅ Extracted fields: 3
⏱️  Processing time: 2ms

property_type: real_estate
transaction_type: sale
price: 2,200,000 CZK

----------------------------------------
LLM-ENHANCED EXTRACTION
----------------------------------------
🤖 Calling Azure OpenAI GPT-4.1...
✅ LLM extraction successful
✅ Extracted fields: 25
⏱️  Processing time: 1,247ms
💰 Cost: $0.00485
📊 Tokens: 486 input + 368 output = 854 total

Extracted Data:
{
  "property_type": "villa",
  "bedrooms": 3,
  "area_garden": 10000,
  "condition": "requires_renovation",
  "country": "IT",
  "region": "Apulia",
  ...
}

----------------------------------------
IMPROVEMENT ANALYSIS
----------------------------------------
✅ Fields improved: +22 (+733%)
✅ Accuracy: 95% (8/8 validations passed)
✅ Confidence: high

----------------------------------------
VALIDATION RESULTS
----------------------------------------
✅ property_type: villa ✓
✅ bedrooms: 3 ✓
✅ area_garden: 10,000 m² ✓
✅ condition: requires_renovation ✓
✅ country: IT ✓
✅ region: Apulia ✓
✅ distance_from_sea: 5 km ✓

========================================
RECOMMENDATION: ✅ PROCEED TO PRODUCTION
========================================
```

### 3. Performance Test

Test with multiple listings:

```bash
# Test 10 diverse listings
npx ts-node test-performance.ts
```

**Expected Metrics:**
- Average processing time: 1,000-1,500ms per listing
- Average cost: $0.004-$0.006 per listing
- Success rate: >95%
- Field improvement: +15-25 fields per listing

### 4. Health Check

Test the Express API server:

```bash
# Start server
npm run dev

# In another terminal:
curl http://localhost:8082/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "uptime": 42.5,
  "llm_enabled": true,
  "azure_connection": "connected"
}
```

---

## Production Deployment

### Strategy: Staged Rollout

1. **Stage 1**: Deploy with `LLM_EXTRACTION_ENABLED=false` (baseline only)
2. **Stage 2**: Enable for 10% of traffic (A/B test)
3. **Stage 3**: Monitor metrics for 24-48 hours
4. **Stage 4**: Roll out to 100% if metrics are good

### Option A: Docker Deployment

#### 1. Build Production Image

```bash
# Build with production optimizations
docker build -t bazos-llm:1.0.0 \
  --build-arg NODE_ENV=production \
  .

# Tag as latest
docker tag bazos-llm:1.0.0 bazos-llm:latest
```

#### 2. Run Container

```bash
docker run -d \
  --name bazos-scraper \
  --restart unless-stopped \
  -p 8082:8082 \
  -e NODE_ENV=production \
  -e AZURE_OPENAI_ENDPOINT="${AZURE_OPENAI_ENDPOINT}" \
  -e AZURE_OPENAI_API_KEY="${AZURE_OPENAI_API_KEY}" \
  -e AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4.1 \
  -e LLM_EXTRACTION_ENABLED=true \
  -e INGEST_API_URL="${INGEST_API_URL}" \
  -e INGEST_API_KEY="${INGEST_API_KEY}" \
  bazos-llm:latest
```

#### 3. Verify Deployment

```bash
# Check logs
docker logs -f bazos-scraper

# Test health endpoint
curl http://localhost:8082/health

# Trigger test scrape
curl -X POST http://localhost:8082/scrape/cz -H "Content-Type: application/json" -d '{"maxPages": 1}'
```

### Option B: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  bazos-scraper:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: bazos-llm-scraper
    restart: unless-stopped
    ports:
      - "8082:8082"
    environment:
      NODE_ENV: production
      PORT: 8082

      # Azure AI
      AZURE_OPENAI_ENDPOINT: ${AZURE_OPENAI_ENDPOINT}
      AZURE_OPENAI_API_KEY: ${AZURE_OPENAI_API_KEY}
      AZURE_OPENAI_DEPLOYMENT_NAME: gpt-4.1
      AZURE_OPENAI_API_VERSION: 2024-08-01-preview

      # LLM Settings
      LLM_EXTRACTION_ENABLED: "true"
      LLM_TEMPERATURE: "0"
      LLM_MAX_TOKENS: "1000"
      LLM_TIMEOUT_MS: "30000"

      # Ingest Service
      INGEST_API_URL: ${INGEST_API_URL}
      INGEST_API_KEY: ${INGEST_API_KEY}

      # Scraper Config
      MAX_PAGES: "5"
      CONCURRENT_REQUESTS: "3"
      REQUEST_DELAY_MS: "1000"

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8082/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Deploy:

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f bazos-scraper

# Stop services
docker-compose down
```

### Option C: Kubernetes Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bazos-llm-scraper
  labels:
    app: bazos-scraper
spec:
  replicas: 2
  selector:
    matchLabels:
      app: bazos-scraper
  template:
    metadata:
      labels:
        app: bazos-scraper
    spec:
      containers:
      - name: scraper
        image: bazos-llm:1.0.0
        ports:
        - containerPort: 8082
        env:
        - name: NODE_ENV
          value: "production"
        - name: AZURE_OPENAI_ENDPOINT
          valueFrom:
            secretKeyRef:
              name: azure-openai-secrets
              key: endpoint
        - name: AZURE_OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: azure-openai-secrets
              key: api-key
        - name: LLM_EXTRACTION_ENABLED
          value: "true"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8082
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8082
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: bazos-scraper-service
spec:
  selector:
    app: bazos-scraper
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8082
  type: LoadBalancer
```

Deploy:

```bash
# Create secrets
kubectl create secret generic azure-openai-secrets \
  --from-literal=endpoint="${AZURE_OPENAI_ENDPOINT}" \
  --from-literal=api-key="${AZURE_OPENAI_API_KEY}"

# Deploy
kubectl apply -f k8s-deployment.yaml

# Check status
kubectl get pods -l app=bazos-scraper
kubectl logs -l app=bazos-scraper -f
```

### Production Checklist

- [ ] Environment variables configured
- [ ] Azure API key valid and tested
- [ ] Feature flag set correctly
- [ ] Health checks passing
- [ ] Logging configured
- [ ] Monitoring alerts set up
- [ ] Cost limits configured in Azure
- [ ] Backup/fallback plan documented
- [ ] Rate limiting tested
- [ ] Error handling verified

---

## Monitoring

### Application Metrics

Monitor these key metrics in production:

#### 1. Performance Metrics

```bash
# Log format includes these metrics per extraction:
[LLM] Processing time: 1,247ms
[LLM] Tokens used: 854 (486 input + 368 output)
[LLM] Cost: $0.00485
[LLM] Confidence: high
[LLM] Fields extracted: 25
```

**Target SLAs:**
- Processing time: <2,000ms (p95)
- Success rate: >95%
- Confidence "high": >80% of extractions

#### 2. Cost Metrics

Track daily/monthly costs:

```bash
# Example monitoring query (pseudo-code)
SELECT
  DATE(timestamp) as date,
  COUNT(*) as total_extractions,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost_usd
FROM llm_extraction_logs
GROUP BY date
ORDER BY date DESC;
```

**Cost Alerts:**
- Daily cost exceeds $50
- Hourly cost spike >200% of average
- Token usage anomaly detection

#### 3. Quality Metrics

Monitor extraction quality:

```bash
# Fields extracted distribution
{
  "0-5 fields": 5%,    // Low quality
  "6-15 fields": 25%,  // Medium quality
  "16-25 fields": 70%  // High quality (target)
}

# Confidence distribution
{
  "high": 75%,    // Target: >70%
  "medium": 20%,  // Acceptable
  "low": 5%       // Investigate if >10%
}
```

### Azure Portal Monitoring

#### 1. View Usage in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **prg-operations-resource**
3. Go to **Metrics**
4. Add charts for:
   - Total Calls
   - Successful Calls
   - Server Errors
   - Rate Limit Errors (429)
   - Latency (p50, p95, p99)

#### 2. Set Up Alerts

Create alerts for:

**Rate Limit Alert:**
```
Metric: Rate Limit Errors (429)
Condition: > 10 in 5 minutes
Action: Email + Slack notification
```

**Cost Alert:**
```
Metric: Total Tokens Consumed
Condition: > 1M tokens per day
Action: Email to billing team
```

**Error Alert:**
```
Metric: Server Errors (5xx)
Condition: > 5% error rate in 10 minutes
Action: PagerDuty alert
```

### Logging Best Practices

#### Structured Logging

All logs include context:

```typescript
console.log('[LLM] Extraction started', {
  listingId: '214704842',
  timestamp: new Date().toISOString(),
  model: 'gpt-4.1',
  enabled: true
});

console.log('[LLM] Extraction completed', {
  listingId: '214704842',
  processingTimeMs: 1247,
  tokensUsed: 854,
  costUsd: 0.00485,
  confidence: 'high',
  fieldsExtracted: 25,
  success: true
});
```

#### Log Levels

- **INFO**: Normal operations (extraction start/complete)
- **WARN**: Degraded performance (slow responses, medium confidence)
- **ERROR**: Failures (API errors, timeouts, validation failures)

#### Log Aggregation

Recommended tools:
- **CloudWatch** (AWS)
- **Azure Monitor** (Azure)
- **Datadog** (Multi-cloud)
- **Elasticsearch + Kibana** (Self-hosted)

---

## Cost Optimization

### Current Cost Model (GPT-4.1)

**Pricing:**
- Input: $0.0025 per 1K tokens
- Output: $0.01 per 1K tokens

**Average per Listing:**
- Input: ~500 tokens = $0.00125
- Output: ~350 tokens = $0.00350
- **Total: ~$0.00475 per listing**

### Cost Projections

| Volume | Daily | Monthly | Annual |
|--------|-------|---------|--------|
| 100 listings | $0.48 | $14.25 | $173.38 |
| 1,000 listings | $4.75 | $142.50 | $1,733.75 |
| 10,000 listings | $47.50 | $1,425.00 | $17,337.50 |
| 100,000 listings | $475.00 | $14,250.00 | $173,375.00 |

### Optimization Strategies

#### 1. Prompt Optimization

**Before** (verbose examples):
```typescript
// 5 full examples with complete data
// Cost: ~500 tokens per example = 2,500 tokens
```

**After** (condensed examples):
```typescript
// 3 key examples with essential fields only
// Cost: ~300 tokens per example = 900 tokens
// Savings: 64% reduction in prompt tokens
```

#### 2. Selective Extraction

Only use LLM for listings that benefit most:

```typescript
// Skip LLM for listings with complete structured data
if (hasCompleteStructuredData(listing)) {
  return baselineTransform(listing);
}

// Use LLM only for rich descriptions
if (listing.description.length > 200) {
  return llmEnhancedTransform(listing);
}

// Estimated savings: 30-40% of API calls
```

#### 3. Caching Strategy

Cache LLM results to avoid re-extraction:

```typescript
// Cache key: hash(listing description)
const cacheKey = hashDescription(listing.description);
const cached = await cache.get(cacheKey);

if (cached && !isStale(cached, 30 * 24 * 60 * 60)) {
  return cached; // 30-day cache TTL
}

// Estimated savings: 20-30% on re-scraped listings
```

#### 4. Model Selection

Switch to Grok-3 for cost-effective scaling:

**Grok-3 Pricing** (example - verify actual pricing):
- Potentially 30-50% lower cost per token
- 12x higher throughput (400 vs 33 req/min)
- May require prompt tuning for accuracy

#### 5. Rate Limit Management

Batch requests to stay within free tier:

**GPT-4.1 Free Tier:**
- Check if your subscription includes free monthly tokens
- Target: <X tokens/month to stay within free tier

**Batching Strategy:**
```typescript
// Process 30 listings per minute (GPT-4.1 limit: 33/min)
// Ensures consistent throughput without rate limit overages
const BATCH_SIZE = 30;
const BATCH_INTERVAL_MS = 60000; // 1 minute
```

### Budget Alerts

Set up spending alerts in Azure:

```bash
# Azure CLI: Create budget alert
az consumption budget create \
  --amount 100 \
  --budget-name "bazos-llm-monthly-budget" \
  --category Cost \
  --time-grain Monthly \
  --start-date "2026-02-01" \
  --end-date "2026-12-31"
```

**Recommended Budgets:**
- Development: $50/month
- Staging: $200/month
- Production: $1,500/month (adjust based on volume)

---

## Troubleshooting

### Common Issues

#### 1. "Azure OpenAI API key is invalid"

**Symptoms:**
```
Error: Request failed with status code 401
[AzureOpenAI] Connection test failed: Unauthorized
```

**Solution:**
```bash
# Verify API key format (should be 100+ characters)
echo $AZURE_OPENAI_API_KEY | wc -c

# Test key manually
curl -X POST "https://prg-operations-resource.cognitiveservices.azure.com/openai/deployments/gpt-4.1/chat/completions?api-version=2024-08-01-preview" \
  -H "Content-Type: application/json" \
  -H "api-key: YOUR_KEY_HERE" \
  -d '{"messages":[{"role":"user","content":"test"}],"max_tokens":10}'

# If test fails, regenerate key in Azure Portal:
# Portal → prg-operations-resource → Keys and Endpoint → Regenerate Key 1
```

#### 2. "Rate limit exceeded" (429 Error)

**Symptoms:**
```
Error: Rate limit is exceeded. Try again in 32 seconds.
[AzureOpenAI] Non-retryable error, aborting
```

**Solution:**
```bash
# Check current rate limits
# GPT-4.1: 33 requests/min, 33K tokens/min

# Reduce concurrent requests in .env
CONCURRENT_REQUESTS=1  # Down from 3

# Add delays between batches
REQUEST_DELAY_MS=2000  # 2 seconds (up from 1 second)

# Or switch to Grok-3 (400 req/min)
AZURE_OPENAI_DEPLOYMENT_NAME=grok-3
```

#### 3. "Timeout after 30000ms"

**Symptoms:**
```
[AzureOpenAI] Operation timeout after 30000ms
Error: Request timeout
```

**Solution:**
```bash
# Increase timeout in .env
LLM_TIMEOUT_MS=60000  # 60 seconds

# Check Azure service status
# https://status.azure.com/

# Verify network connectivity
curl -I https://prg-operations-resource.cognitiveservices.azure.com/

# Test from different network (VPN/proxy issue?)
```

#### 4. "Invalid JSON response from LLM"

**Symptoms:**
```
[LLM] Extraction failed: Unexpected token in JSON at position 0
```

**Solution:**
```typescript
// Enable response logging in azureClient.ts
console.log('[DEBUG] Raw LLM response:', response.choices[0]?.message?.content);

// Common causes:
// 1. LLM outputting text before JSON
// 2. Incomplete JSON (truncated due to max_tokens)
// 3. LLM using code blocks (```json ... ```)

// Fix: Update extraction to strip code blocks
const content = response.choices[0]?.message?.content || '';
const jsonMatch = content.match(/```json\n(.*?)\n```/s) || [null, content];
const jsonString = jsonMatch[1];
const data = JSON.parse(jsonString);
```

#### 5. "Low confidence" or "Missing fields"

**Symptoms:**
```json
{
  "extraction_metadata": {
    "confidence": "low",
    "missing_fields": ["bedrooms", "area_sqm", "disposition"]
  }
}
```

**Solution:**
```typescript
// 1. Check input quality
console.log('Listing text length:', listingText.length);
// If <100 chars, description may be too sparse

// 2. Improve prompt with more examples
// Add similar listing examples to FEW_SHOT_EXAMPLES

// 3. Adjust temperature (try slight increase)
LLM_TEMPERATURE=0.1  // Up from 0

// 4. Increase max tokens if output is truncated
LLM_MAX_TOKENS=1500  // Up from 1000
```

#### 6. "Feature flag not working"

**Symptoms:**
```
LLM_EXTRACTION_ENABLED=false but still making API calls
```

**Solution:**
```bash
# Check environment variable loading
npx ts-node -e "
require('dotenv').config();
console.log('LLM_EXTRACTION_ENABLED:', process.env.LLM_EXTRACTION_ENABLED);
console.log('Type:', typeof process.env.LLM_EXTRACTION_ENABLED);
"

# Ensure boolean conversion in code
const isEnabled = process.env.LLM_EXTRACTION_ENABLED === 'true';

# Restart service after .env changes
docker restart bazos-scraper
```

#### 7. "High costs / Unexpected billing"

**Symptoms:**
```
Azure billing alert: $500 charged in one day
```

**Investigation:**
```bash
# Check Azure portal for usage breakdown
# Portal → Cost Management → Cost Analysis

# Review logs for token usage
grep "Tokens used" logs/*.log | awk '{sum+=$4} END {print "Total tokens:", sum}'

# Identify high-cost requests
grep "Cost:" logs/*.log | sort -t'$' -k2 -nr | head -20

# Common causes:
# 1. Accidentally scraping in loop
# 2. No caching (re-processing same listings)
# 3. Very long listing descriptions (10K+ chars)
```

**Mitigation:**
```bash
# Set hard Azure budget limits
az consumption budget create --amount 100 ...

# Add circuit breaker to code
if (dailyCost > MAX_DAILY_BUDGET) {
  throw new Error('Daily budget exceeded, stopping extraction');
}

# Enable request logging
LLM_LOG_ALL_REQUESTS=true
```

### Debug Mode

Enable verbose logging:

```env
# Add to .env
DEBUG=true
LLM_LOG_REQUESTS=true
LLM_LOG_RESPONSES=true
```

```typescript
// Logs will include:
[DEBUG] LLM Request:
{
  "model": "gpt-4.1",
  "messages": [...],
  "max_tokens": 1000,
  "temperature": 0
}

[DEBUG] LLM Response:
{
  "id": "chatcmpl-...",
  "choices": [{...}],
  "usage": {
    "prompt_tokens": 486,
    "completion_tokens": 368,
    "total_tokens": 854
  }
}
```

### Support Contacts

**Azure Support:**
- Azure Portal: [https://portal.azure.com](https://portal.azure.com) → Support
- Resource Owner (GPT-4.1): Robin.Sitar@cancom.com
- Resource Owner (Grok-3): Samuel.Seidel@cancom.com

**Internal Support:**
- Team Lead: [Contact via Slack/Email]
- Documentation: `docs/` directory in this repo

**Community Resources:**
- Azure OpenAI Docs: [https://learn.microsoft.com/azure/ai-services/openai/](https://learn.microsoft.com/azure/ai-services/openai/)
- OpenAI API Reference: [https://platform.openai.com/docs/api-reference](https://platform.openai.com/docs/api-reference)

---

## Next Steps After Deployment

1. **Monitor for 24-48 hours**
   - Check logs for errors
   - Verify cost metrics
   - Review extraction quality

2. **Tune parameters if needed**
   - Adjust temperature based on consistency
   - Modify max_tokens if truncation occurs
   - Update prompt with domain-specific examples

3. **Scale gradually**
   - Start with 10% of traffic
   - Increase to 50% if metrics are good
   - Roll out to 100% after validation

4. **Set up alerts**
   - Cost overruns
   - High error rates
   - Performance degradation

5. **Document lessons learned**
   - Update this guide with production insights
   - Share metrics with team
   - Plan for optimization iterations

---

**Last Updated:** 2026-02-09
**Version:** 1.0.0
**Status:** Production Ready
