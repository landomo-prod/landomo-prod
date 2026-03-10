# Bazos - Configuration

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8102` | Express server port |
| `INGEST_API_URL` | `http://localhost:3000` | Ingest service URL |
| `INGEST_API_KEY` | _(empty)_ | API key for ingest service |
| `REDIS_HOST` | `redis` | Redis host for BullMQ + caching |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(none)_ | Redis password |
| `LLM_EXTRACTION_ENABLED` | `false` | Enable LLM-based field extraction |
| `ENABLE_CHECKSUM_MODE` | `false` | Enable checksum-based change detection |
| `AZURE_OPENAI_ENDPOINT` | _(required)_ | Azure OpenAI API endpoint |
| `AZURE_OPENAI_API_KEY` | _(required)_ | Azure OpenAI API key |
| `AZURE_OPENAI_DEPLOYMENT` | `deepseek-v3-2` | Model deployment name |

## BullMQ Queue Configuration

**Queue name:** `bazos-llm-extraction`

| Setting | Value |
|---------|-------|
| Max attempts | 3 |
| Backoff type | Exponential |
| Backoff delay | 5,000ms |
| Rate limit | 60 jobs per minute |
| Concurrency | 5 workers |

## Cache Configuration

| Layer | TTL | Key Format |
|-------|-----|-----------|
| Redis | 7 days | `bazos:llm:{hash(url+title+price)}` |
| PostgreSQL | 90 days | Same hash, persistent storage |

## Docker Configuration

```yaml
bazos:
  build:
    context: ./scrapers/Czech Republic/bazos
  ports:
    - "8102:8102"
  environment:
    - PORT=8102
    - INGEST_API_URL=http://ingest:3000
    - INGEST_API_KEY=${API_KEY}
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - LLM_EXTRACTION_ENABLED=true
    - ENABLE_CHECKSUM_MODE=true
    - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
    - AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}
    - AZURE_OPENAI_DEPLOYMENT=deepseek-v3-2
  networks:
    - cz-network
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scrape/:country` | Trigger scrape for specific country (cz/sk/pl/at) |
| `GET` | `/health` | Health check |

## LLM Cost Estimates

| Model | Input Cost | Output Cost |
|-------|-----------|-------------|
| DeepSeek-V3.2 | $0.14 / 1M tokens | $0.28 / 1M tokens |

Estimated cost per listing: ~$0.001 (with caching, amortized over 7-day cache TTL)

## Feature Flags

| Flag | Effect |
|------|--------|
| `LLM_EXTRACTION_ENABLED=true` | Enables Azure OpenAI LLM extraction; without it, only basic fields are extracted |
| `ENABLE_CHECKSUM_MODE=true` | Enables checksum comparison to skip unchanged listings; reduces LLM calls significantly |
