#!/bin/bash
set -e

echo "=========================================="
echo "Applying schema and migrations to all country databases"
echo "=========================================="
echo ""

COUNTRIES=(
  "australia"
  "uk"
  "usa"
  "czech"
  "france"
  "spain"
  "italy"
  "slovakia"
  "germany"
  "hungary"
  "austria"
)

SCHEMA_FILE="/docker-entrypoint-initdb.d/02-init-schema.sql"
MIGRATIONS_DIR="/docker-entrypoint-initdb.d/migrations"

for country in "${COUNTRIES[@]}"; do
  DB_NAME="landomo_${country}"
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
done

echo ""
echo "=========================================="
echo "All country databases migrated successfully!"
echo "=========================================="
