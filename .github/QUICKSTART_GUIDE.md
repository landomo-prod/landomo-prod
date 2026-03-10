# Quickstart Guide — From GitHub to Production

This guide walks you through activating the deployment infrastructure step-by-step.

## Phase 1: GitHub Setup (15 min)

### 1.1 Enable GitHub Features

Go to **https://github.com/landomo-prod/landomo-prod/settings**

**General**
- [ ] Change default branch to `main`
- [ ] Enable "Discussions" (Settings → Features → Discussions checkbox)

**Branches**
- [ ] Click "Add rule" next to "Branch protection rules"
- [ ] Pattern: `main`
  - [x] Require pull request reviews before merging: **1**
  - [x] Require status checks to pass before merging
    - Search for and select: `ci-shared`, `ci-ingest`, `ci-search`, `ci-frontend`
  - [x] Require branches to be up to date before merging
  - [x] Dismiss stale pull request approvals
- [ ] Click "Create"

**Actions → General**
- [x] Allow all actions and reusable workflows

**Secrets and Variables → Actions**
- Will set up in Phase 2

### 1.2 Create GitHub Labels

Go to **Issues → Labels**

Create these labels (copy from `.github/LABELS.md`):

```
Type Labels:
  - bug (red)
  - feature (green)
  - enhancement (blue)
  - refactor (purple)
  - docs (orange)

Priority Labels:
  - critical (dark red)
  - high (orange)
  - medium (yellow)
  - low (green)

Component Labels:
  - frontend
  - api
  - ingest
  - ml
  - scrapers
  - infra
  - shared

Status Labels:
  - help-wanted
  - good-first-issue
  - in-progress
  - blocked
```

## Phase 2: DNS Setup (5-15 min)

**Your domain registrar or Cloudflare**

Add these **A records**:

```
Type  Name                   Value              TTL
────────────────────────────────────────────────────
A     landomo.cz             91.99.110.217      Auto
A     www.landomo.cz         91.99.110.217      Auto
A     staging.landomo.cz     91.99.110.217      Auto
A     api.landomo.cz         178.104.40.105     Auto
A     staging-api.landomo.cz 178.104.40.105     Auto
```

**Wait 5-15 minutes** for DNS propagation, then verify:
```bash
nslookup staging.landomo.cz
# Should return: 91.99.110.217

nslookup staging-api.landomo.cz
# Should return: 178.104.40.105
```

## Phase 3: SSL Certificates (20 min)

### 3.1 On Web Server (91.99.110.217)

```bash
# SSH into web server
ssh ubuntu@91.99.110.217

# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificates (wait for DNS propagation first!)
sudo certbot certonly --standalone \
  -d landomo.cz \
  -d www.landomo.cz \
  -d staging.landomo.cz \
  --agree-tos \
  --register-unsafely-without-email

# Verify certificates created
sudo certbot certificates
# Should show: landomo.cz, www.landomo.cz, staging.landomo.cz

# Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

### 3.2 On App Server (178.104.40.105)

```bash
# SSH into app server
ssh ubuntu@178.104.40.105

# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Get certificates for API subdomains
sudo certbot certonly --standalone \
  -d api.landomo.cz \
  -d staging-api.landomo.cz \
  --agree-tos \
  --register-unsafely-without-email

# Verify certificates
sudo certbot certificates
# Should show: api.landomo.cz, staging-api.landomo.cz

# Enable auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Phase 4: Nginx Configuration (10 min)

### 4.1 On Web Server (91.99.110.217)

```bash
# Copy nginx configs from repo
cd /opt/landomo
git pull origin main

# Setup frontend configs
sudo cp infra/nginx/frontend-prod.conf /etc/nginx/sites-available/
sudo cp infra/nginx/frontend-staging.conf /etc/nginx/sites-available/

# Enable them
sudo ln -s /etc/nginx/sites-available/frontend-prod.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/frontend-staging.conf /etc/nginx/sites-enabled/

# Test nginx
sudo nginx -t
# Should output: "configuration file test is successful"

# Reload nginx
sudo systemctl reload nginx

# Verify it's listening
sudo netstat -tlnp | grep nginx
# Should show port 80 and 443 listening
```

### 4.2 On App Server (178.104.40.105)

```bash
# Copy nginx configs
sudo cp infra/nginx/api-prod.conf /etc/nginx/sites-available/
sudo cp infra/nginx/api-staging.conf /etc/nginx/sites-available/

# Enable them
sudo ln -s /etc/nginx/sites-available/api-prod.conf /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api-staging.conf /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## Phase 5: Basic Auth for Staging (5 min)

### 5.1 On Web Server

```bash
# Install apache utilities
sudo apt install apache2-utils

# Create staging password file
sudo htpasswd -c /etc/nginx/.htpasswd-staging team
# Enter password twice: (choose a secure password)

# Verify it worked
sudo cat /etc/nginx/.htpasswd-staging
# Should show: team:$apr1$...

# Reload nginx
sudo systemctl reload nginx
```

### 5.2 On App Server

```bash
# Same as web server
sudo apt install apache2-utils

sudo htpasswd -c /etc/nginx/.htpasswd-staging api
# Enter password twice

# Reload nginx
sudo systemctl reload nginx
```

### Test It

```bash
# Without auth (should fail)
curl https://staging.landomo.cz/
# Returns 401 Unauthorized ✓

# With auth (should succeed)
curl -u team:password https://staging.landomo.cz/
# Returns HTML content ✓
```

## Phase 6: GitHub Secrets (10 min)

**On your local machine:**

### 6.1 Generate SSH Keys for Deployment

```bash
# Generate key for web server
ssh-keygen -t ed25519 -f ~/.ssh/landomo-web-deploy -N "" -C "landomo-web-deploy"

# Generate key for app server
ssh-keygen -t ed25519 -f ~/.ssh/landomo-app-deploy -N "" -C "landomo-app-deploy"

# Copy to servers
ssh-copy-id -i ~/.ssh/landomo-web-deploy.pub ubuntu@91.99.110.217
ssh-copy-id -i ~/.ssh/landomo-app-deploy.pub ubuntu@178.104.40.105

# Get private key content (for GitHub Secrets)
cat ~/.ssh/landomo-web-deploy
cat ~/.ssh/landomo-app-deploy
```

### 6.2 Add to GitHub

Go to **https://github.com/landomo-prod/landomo-prod/settings/secrets/actions**

Click "New repository secret" for each:

```
Name: STAGING_WEB_HOST
Value: 91.99.110.217

Name: STAGING_WEB_SSH_KEY
Value: (paste entire content of ~/.ssh/landomo-web-deploy)

Name: STAGING_APP_HOST
Value: 178.104.40.105

Name: STAGING_APP_SSH_KEY
Value: (paste entire content of ~/.ssh/landomo-app-deploy)

Name: PROD_WEB_HOST
Value: 91.99.110.217

Name: PROD_WEB_SSH_KEY
Value: (paste entire content of ~/.ssh/landomo-web-deploy)

Name: PROD_APP_HOST
Value: 178.104.40.105

Name: PROD_APP_SSH_KEY
Value: (paste entire content of ~/.ssh/landomo-app-deploy)
```

## Phase 7: Test Deployments (10 min)

### 7.1 Verify DNS & HTTPS

```bash
# Test all domains resolve and have valid SSL
curl -I https://landomo.cz/
# Should return: HTTP/2 200

curl -I https://staging.landomo.cz/
# Should return: HTTP/2 401 (basic auth required)

curl -I https://api.landomo.cz/health
# Should return: HTTP/2 (once frontend is deployed)

curl -I https://staging-api.landomo.cz/health
# Should return: HTTP/2 401 (basic auth required)
```

### 7.2 Test CI/CD Pipeline

```bash
# Create a test branch
git checkout -b test/ci-pipeline
echo "test" > TEST.txt
git add TEST.txt
git commit -m "test: verify CI pipeline"
git push origin test/ci-pipeline
```

Go to **https://github.com/landomo-prod/landomo-prod/actions**

- [ ] Watch workflows run (should be fast, only ci-shared triggers)
- [ ] All checks should pass ✓

### 7.3 Test Frontend Deployment (if not yet deployed)

Make sure you have running frontends locally or in Docker:

```bash
# On web server, verify Next.js is running
ssh ubuntu@91.99.110.217

# Check if frontend container is running
docker ps | grep frontend
# Should show: cz-frontend (port 3000)

# If not, start it:
docker compose -f /opt/landomo/infra/docker/countries/czech/web/docker-compose.web.yml up -d cz-frontend
```

Then test:
```bash
curl -u team:password https://staging.landomo.cz/ | head -20
# Should show Next.js HTML
```

## Phase 8: Team Onboarding (5 min)

Share these links with your team:

1. **Main repo**: https://github.com/landomo-prod/landomo-prod
2. **Getting started**: Read `DEVELOPMENT.md` for local setup
3. **Contributing**: Read `CONTRIBUTING.md` for guidelines
4. **CI/CD overview**: Read `.github/CI_CD_SETUP.md`

## Deployment Flow

Now your team can:

### For Testing on Staging

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# ... edit code ...

# 3. Push to develop for staging test
git push origin develop

# 4. GitHub Actions auto-deploys to staging.landomo.cz
# Watch: https://github.com/landomo-prod/landomo-prod/actions

# 5. Team tests at: https://team:password@staging.landomo.cz

# 6. Looks good? Merge to main for production
git merge feature/my-feature  # into main
git push origin main

# 7. Manual approval required
# Go to Actions tab, click "Review" on production workflow
# Production deployed to landomo.cz
```

## Troubleshooting

### DNS not resolving

```bash
nslookup staging.landomo.cz
# If empty, DNS not propagated yet (wait 5-15 min)

# Or check your registrar's DNS settings
```

### SSL certificate errors

```bash
# Check certificates exist
sudo certbot certificates

# Renew if needed
sudo certbot renew --dry-run

# Check nginx is using correct certificate path
sudo cat /etc/nginx/sites-available/frontend-prod.conf | grep ssl_certificate
```

### Basic auth not working

```bash
# Check .htpasswd file exists
sudo ls -la /etc/nginx/.htpasswd-staging

# Verify nginx is using it
sudo cat /etc/nginx/sites-available/frontend-staging.conf | grep auth_basic
```

### Deployment not triggering

```bash
# Check GitHub Actions logs
https://github.com/landomo-prod/landomo-prod/actions

# Check SSH keys are working
ssh -i ~/.ssh/landomo-web-deploy ubuntu@91.99.110.217 "echo 'Connection works'"
```

## What's Next

Once all phases are complete:

✅ **Staging environment is live** — team can test changes before production

✅ **Production environment is ready** — manual approval prevents accidents

✅ **CI/CD is automated** — tests run on every push

✅ **Monitoring is visible** — GitHub Actions shows deployment status

Your platform is ready for team collaboration! 🚀

---

**Questions?** See:
- `DEPLOYMENT_SETUP.md` — Detailed deployment guide
- `BASIC_AUTH_SETUP.md` — Advanced basic auth config
- `CI_CD_SETUP.md` — How workflows work
- `CONTRIBUTING.md` — Team contribution guidelines
