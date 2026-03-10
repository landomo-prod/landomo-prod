#!/bin/bash
set -e

# Generate/renew production SSL certificates using Let's Encrypt (certbot)
# Usage: ./scripts/generate-ssl-prod.sh <domain> [email]
#
# Examples:
#   ./scripts/generate-ssl-prod.sh api.landomo.com
#   ./scripts/generate-ssl-prod.sh api.landomo.com admin@landomo.com
#
# Prerequisites:
#   - nginx must be running and reachable on port 80
#   - DNS for <domain> must point to this server
#   - Docker must be available (uses certbot container)
#
# The script uses the webroot challenge method:
#   certbot writes challenge files to nginx/certbot-webroot/.well-known/acme-challenge/
#   nginx serves them on http://<domain>/.well-known/acme-challenge/
#
# Produces:
#   nginx/ssl/live/<domain>/fullchain.pem
#   nginx/ssl/live/<domain>/privkey.pem
#
# Auto-renewal:
#   Installs a cron job that runs certbot renew twice daily and reloads nginx.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"
WEBROOT_DIR="$PROJECT_ROOT/nginx/certbot-webroot"

# --- Argument parsing ---

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: $0 <domain> [email]"
  echo ""
  echo "Examples:"
  echo "  $0 api.landomo.com"
  echo "  $0 api.landomo.com admin@landomo.com"
  exit 1
fi

echo "================================================"
echo "  Landomo - Production SSL Certificate (Let's Encrypt)"
echo "================================================"
echo ""
echo "  Domain:   $DOMAIN"
echo "  Email:    ${EMAIL:-<none, using --register-unsafely-without-email>}"
echo "  SSL dir:  $SSL_DIR"
echo "  Webroot:  $WEBROOT_DIR"
echo ""

# --- Prerequisite checks ---

if ! command -v docker &> /dev/null; then
  echo "Error: docker is not installed or not in PATH"
  exit 1
fi

if ! docker info > /dev/null 2>&1; then
  echo "Error: Docker daemon is not running"
  exit 1
fi

# Create directories
mkdir -p "$SSL_DIR"
mkdir -p "$WEBROOT_DIR"

# --- Build certbot command ---

EMAIL_FLAG="--register-unsafely-without-email"
if [ -n "$EMAIL" ]; then
  EMAIL_FLAG="--email $EMAIL --no-eff-email"
fi

echo "Requesting certificate from Let's Encrypt..."
echo ""

docker run --rm \
  -v "$SSL_DIR:/etc/letsencrypt" \
  -v "$WEBROOT_DIR:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --domain "$DOMAIN" \
    $EMAIL_FLAG \
    --agree-tos \
    --non-interactive \
    --keep-until-expiring

RESULT=$?

if [ $RESULT -ne 0 ]; then
  echo ""
  echo "Error: certbot failed (exit code $RESULT)"
  echo ""
  echo "Common issues:"
  echo "  - DNS for $DOMAIN does not point to this server"
  echo "  - Port 80 is not reachable from the internet"
  echo "  - nginx is not serving /.well-known/acme-challenge/ from the webroot"
  echo ""
  echo "To debug, check that this URL is reachable:"
  echo "  http://$DOMAIN/.well-known/acme-challenge/"
  exit 1
fi

echo ""
echo "Certificate obtained successfully."
echo ""
echo "  Certificate: $SSL_DIR/live/$DOMAIN/fullchain.pem"
echo "  Private key: $SSL_DIR/live/$DOMAIN/privkey.pem"
echo ""

# --- Create symlinks for nginx.conf compatibility ---
# nginx.conf expects landomo.crt and landomo.key at nginx/ssl/
echo "Creating symlinks for nginx.conf..."
ln -sf "live/$DOMAIN/fullchain.pem" "$SSL_DIR/landomo.crt"
ln -sf "live/$DOMAIN/privkey.pem" "$SSL_DIR/landomo.key"
echo "  $SSL_DIR/landomo.crt -> live/$DOMAIN/fullchain.pem"
echo "  $SSL_DIR/landomo.key -> live/$DOMAIN/privkey.pem"
echo ""

# --- Set up auto-renewal cron job ---

CRON_CMD="0 0,12 * * * docker run --rm -v $SSL_DIR:/etc/letsencrypt -v $WEBROOT_DIR:/var/www/certbot certbot/certbot renew --quiet && docker kill --signal=HUP \$(docker ps -qf name=landomo-nginx) 2>/dev/null || true"

echo "Setting up auto-renewal cron job..."

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -qF "certbot/certbot renew"; then
  echo "  Cron job for certbot renewal already exists. Skipping."
else
  # Add the cron job
  (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
  echo "  Cron job installed (runs at 00:00 and 12:00 daily)"
fi

echo ""
echo "================================================"
echo "  SSL setup complete for $DOMAIN"
echo "================================================"
echo ""
echo "Next steps:"
echo "  1. Update nginx.conf server_name to include: $DOMAIN"
echo "  2. Reload nginx: docker exec landomo-nginx nginx -s reload"
echo "  3. Verify HTTPS: curl -I https://$DOMAIN/health"
echo ""
echo "Renewal:"
echo "  Certificates auto-renew via cron. To manually renew:"
echo "  docker run --rm -v $SSL_DIR:/etc/letsencrypt -v $WEBROOT_DIR:/var/www/certbot certbot/certbot renew"
echo ""
