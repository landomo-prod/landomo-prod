#!/bin/bash
set -e

# ============================================================
# Initialize a new country database with schema and migrations
# ============================================================
# Usage: ./scripts/init-country-db.sh <country_slug> [db_host] [db_user]
# Example: ./scripts/init-country-db.sh slovakia localhost landomo
# ============================================================

COUNTRY_SLUG="${1:?Usage: $0 <country_slug> [db_host] [db_user]}"
DB_HOST="${2:-localhost}"
DB_USER="${3:-landomo}"
DB_NAME="landomo_${COUNTRY_SLUG}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SCHEMA_FILE="$PROJECT_ROOT/docker/postgres/init-schema.sql"
MIGRATIONS_DIR="$PROJECT_ROOT/ingest-service/migrations"

echo "=========================================="
echo "Landomo - Initialize Country Database"
echo "=========================================="
echo "Country:  $COUNTRY_SLUG"
echo "Database: $DB_NAME"
echo "Host:     $DB_HOST"
echo "User:     $DB_USER"
echo ""

# Check if database exists
if psql -h "$DB_HOST" -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "Database $DB_NAME already exists."
  read -p "Apply migrations only? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
else
  echo "Creating database: $DB_NAME"
  psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"
  psql -h "$DB_HOST" -U "$DB_USER" -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
  echo "Database created."

  echo ""
  echo "Applying base schema..."
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"
  echo "Base schema applied."
fi

echo ""
echo "Applying migrations..."
if [ -d "$MIGRATIONS_DIR" ]; then
  for migration in "$MIGRATIONS_DIR"/*.sql; do
    if [ -f "$migration" ]; then
      MIGRATION_NAME="$(basename "$migration")"
      echo "  Applying: $MIGRATION_NAME"
      psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -f "$migration" 2>&1 | grep -v "already exists\|NOTICE" || true
    fi
  done
  echo "Migrations applied."
else
  echo "No migrations directory found at $MIGRATIONS_DIR"
fi

echo ""
echo "=========================================="
echo "Database $DB_NAME is ready."
echo "=========================================="
