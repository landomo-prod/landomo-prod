#!/bin/bash
set -e

echo "=========================================="
echo "Landomo-World - Czech Republic Database Setup"
echo "=========================================="
echo ""

DB_NAME="landomo_cz"
echo "Creating database: ${DB_NAME}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE ${DB_NAME};
  GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO $POSTGRES_USER;
EOSQL

echo "${DB_NAME} created successfully"
echo ""

# Enable PostGIS and extensions on main database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DB_NAME}" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;
EOSQL

echo "Extensions enabled on ${DB_NAME}"
echo ""

# Create geocoding database for polygon-service
GEO_DB="landomo_geocoding"
echo "Creating database: ${GEO_DB}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE ${GEO_DB}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${GEO_DB}')\gexec
  GRANT ALL PRIVILEGES ON DATABASE ${GEO_DB} TO $POSTGRES_USER;
EOSQL

# Enable PostGIS on geocoding database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${GEO_DB}" <<-EOSQL
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  CREATE EXTENSION IF NOT EXISTS unaccent;
EOSQL

echo "${GEO_DB} created with PostGIS extensions"
echo ""

# Create read-only user for search-service (persisted so it survives container recreation)
READONLY_USER="search_readonly"
READONLY_PASS="${DB_READ_PASSWORD:-search_readonly_dev}"
echo "Creating read-only user: ${READONLY_USER}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${READONLY_USER}') THEN
      CREATE USER ${READONLY_USER} WITH PASSWORD '${READONLY_PASS}';
    ELSE
      ALTER USER ${READONLY_USER} WITH PASSWORD '${READONLY_PASS}';
    END IF;
  END
  \$\$;
  GRANT CONNECT ON DATABASE ${DB_NAME} TO ${READONLY_USER};
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${DB_NAME}" <<-EOSQL
  GRANT USAGE ON SCHEMA public TO ${READONLY_USER};
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${READONLY_USER};
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${READONLY_USER};
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ${READONLY_USER};
EOSQL

echo "${READONLY_USER} created with SELECT on ${DB_NAME}"
echo ""
