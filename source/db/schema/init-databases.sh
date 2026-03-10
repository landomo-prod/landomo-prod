#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Landomo-World Multi-Database Setup"
echo "=========================================="
echo ""

# List of countries to create databases for
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

echo "Creating country databases..."
echo ""

for country in "${COUNTRIES[@]}"; do
  DB_NAME="landomo_${country}"
  echo "📦 Creating database: ${DB_NAME}"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE ${DB_NAME};
    GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO $POSTGRES_USER;
EOSQL

  echo "✅ ${DB_NAME} created successfully"
done

echo ""
echo "=========================================="
echo "✅ All country databases created!"
echo "=========================================="
echo ""
echo "Databases created:"
for country in "${COUNTRIES[@]}"; do
  echo "  - landomo_${country}"
done
echo ""
