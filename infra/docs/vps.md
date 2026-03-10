# VPS Infrastructure

Landomo runs on two Hetzner VPS nodes.

## Servers

| Alias | Role | IP | Notes |
|-------|------|----|-------|
| `landomo-app` | Application server | 46.225.167.44 | Scrapers, ingest API, workers, search, Redis |
| `landomo-db` | Database server | 2a01:4f8:1c19:6b5b::1 (IPv6) | PostgreSQL per-country DBs |

## SSH Access

```bash
ssh landomo-app   # application server
ssh landomo-db    # DB server (proxied through landomo-app)
```

`landomo-db` is only reachable via `ProxyJump landomo-app` (not directly exposed).

> **TODO (hardening):** Set up a Hetzner private network (VLAN) between the two nodes, update DB connection strings to use the private IP, and add a firewall rule on `landomo-db` to drop all traffic except from the private network interface. This will give true network-level isolation rather than SSH-only.

## Key Paths on landomo-app

- Deployments: `/opt/landomo/scrapers/Czech/`
- Docker root: `/mnt/volume-nbg1-1/docker/`
- Env files: `/opt/landomo/scrapers/Czech/docker/`
- Secrets: `/opt/landomo/scrapers/Czech/docker/secrets/`

## Deployment

```bash
# Deploy Czech stack
ssh landomo-app
cd /opt/landomo/scrapers/Czech/docker
docker compose -f docker-compose-cz.yml --env-file .env.cz up -d

# Trigger a scrape manually
curl -X POST http://localhost:8102/scrape   # sreality
curl -X POST http://localhost:8103/scrape   # bezrealitky
curl -X POST http://localhost:8104/scrape   # reality.cz
curl -X POST http://localhost:8107/scrape   # ulovdomov
```

## Scraper Ports (Czech)

| Port | Scraper |
|------|---------|
| 8102 | sreality |
| 8103 | bezrealitky |
| 8104 | reality.cz |
| 8107 | ulovdomov |

## Database Access

```bash
ssh landomo-db
psql -U landomo -d landomo_cz
```

DB name convention: `landomo_{country_code}` (e.g. `landomo_cz`, `landomo_hu`, `landomo_pl`)
