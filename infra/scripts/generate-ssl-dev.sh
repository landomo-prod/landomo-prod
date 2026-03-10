#!/bin/bash
set -e

# Generate self-signed SSL certificates for local development
# Usage: ./scripts/generate-ssl-dev.sh
#
# Produces:
#   nginx/ssl/landomo.key  (RSA 2048-bit private key)
#   nginx/ssl/landomo.crt  (Self-signed certificate, valid 365 days)
#
# The certificate covers: api.landomo.local, localhost, 127.0.0.1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_ROOT/nginx/ssl"

echo "================================================"
echo "  Landomo - Development SSL Certificate Generator"
echo "================================================"
echo ""

# Check for openssl
if ! command -v openssl &> /dev/null; then
  echo "Error: openssl is not installed or not in PATH"
  exit 1
fi

# Create output directory
mkdir -p "$SSL_DIR"

# Check if certs already exist
if [ -f "$SSL_DIR/landomo.key" ] && [ -f "$SSL_DIR/landomo.crt" ]; then
  echo "Existing certificates found in $SSL_DIR"
  echo ""

  # Show expiry of existing cert
  EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_DIR/landomo.crt" 2>/dev/null || echo "unknown")
  echo "  Current cert expiry: $EXPIRY"
  echo ""

  read -p "Overwrite existing certificates? [y/N] " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted. Existing certificates unchanged."
    exit 0
  fi
  echo ""
fi

echo "Generating self-signed certificate..."
echo ""

# Generate private key and self-signed certificate in one step
# Uses Subject Alternative Names (SANs) for modern browser compatibility
openssl req -x509 -nodes -newkey rsa:2048 \
  -days 365 \
  -keyout "$SSL_DIR/landomo.key" \
  -out "$SSL_DIR/landomo.crt" \
  -subj "/C=US/ST=Development/L=Local/O=Landomo/OU=Dev/CN=api.landomo.local" \
  -addext "subjectAltName=DNS:api.landomo.local,DNS:localhost,IP:127.0.0.1" \
  2>/dev/null

# Restrict permissions on the private key
chmod 600 "$SSL_DIR/landomo.key"
chmod 644 "$SSL_DIR/landomo.crt"

echo "Certificates generated successfully:"
echo ""
echo "  Private key:  $SSL_DIR/landomo.key"
echo "  Certificate:  $SSL_DIR/landomo.crt"
echo ""

# Show certificate details
echo "Certificate details:"
openssl x509 -in "$SSL_DIR/landomo.crt" -noout \
  -subject -issuer -dates -ext subjectAltName 2>/dev/null | sed 's/^/  /'

echo ""
echo "To trust this certificate on macOS (optional):"
echo "  sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $SSL_DIR/landomo.crt"
echo ""
echo "To use with Docker, mount nginx/ssl/ into the nginx container."
echo "Done."
