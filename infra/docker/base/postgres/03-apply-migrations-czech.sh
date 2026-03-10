#!/bin/bash
set -e

echo "=========================================="
echo "Applying schema and migrations to landomo_czech"
echo "=========================================="
echo ""

DB_NAME="landomo_czech"
SCHEMA_FILE="/docker-entrypoint-initdb.d/02-init-schema.sql"
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"

echo "Applying schema to ${DB_NAME}..."

# Apply base schema
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DB_NAME}" -f "${SCHEMA_FILE}"
echo "  Base schema applied."

# Apply migrations in order
if [ -d "${MIGRATIONS_DIR}" ]; then
  for migration in $(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | sort); do
    echo "  Applying migration: $(basename ${migration})"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DB_NAME}" -f "${migration}"
  done
fi

echo "  ${DB_NAME} fully migrated."
echo ""

# Apply boundaries schema to geocoding database (for polygon-service)
# Note: Uses ON_ERROR_STOP=0 because property_boundary_cache references
# the properties table which doesn't exist in the geocoding DB.
# The polygon-service only needs the boundaries table itself.
GEO_DB="landomo_geocoding"
BOUNDARIES_MIGRATION="${MIGRATIONS_DIR}/010_boundaries_schema.sql"
if [ -f "${BOUNDARIES_MIGRATION}" ]; then
  echo "Applying boundaries schema to ${GEO_DB}..."
  psql -v ON_ERROR_STOP=0 --username "$POSTGRES_USER" --dbname "${GEO_DB}" -f "${BOUNDARIES_MIGRATION}" 2>&1 | grep -v "ERROR" || true
  echo "  ${GEO_DB} boundaries schema applied (property_boundary_cache skipped)."
fi

echo ""
echo "=========================================="
echo "Czech database migrated successfully!"
echo "=========================================="
