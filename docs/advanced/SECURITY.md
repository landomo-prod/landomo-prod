# Security Guide

Security best practices for Landomo deployment.

## Authentication

### API Key Management

```bash
# Generate key
openssl rand -hex 32

# Store in .env
API_KEYS=key1,key2,key3

# Rotate every 90 days
```

## Network Security

### Firewall

```bash
# UFW setup
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from 10.0.0.0/8 to any port 5432
sudo ufw enable
```

### Nginx Configuration

```nginx
# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

server {
    listen 443 ssl http2;
    server_name api.landomo.com;
    
    ssl_certificate /etc/letsencrypt/live/api.landomo.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.landomo.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        limit_req zone=api burst=20;
        proxy_pass http://localhost:3000;
    }
}
```

## SQL Injection Prevention

```typescript
// ✅ Good: Parameterized
await pool.query('SELECT * FROM properties_new WHERE city = $1', [city]);

// ❌ Bad: String concat
await pool.query(`SELECT * FROM properties_new WHERE city = '${city}'`);
```

## Secrets Management

```bash
# Use Docker secrets
secrets:
  db_password:
    file: ./secrets/db_password.txt
```

---

**Last Updated**: 2026-02-16
