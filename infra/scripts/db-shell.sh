#!/bin/bash

# Script to open PostgreSQL shell for a specific country database

COUNTRY=$1

if [ -z "$COUNTRY" ]; then
  echo "Usage: ./scripts/db-shell.sh <country>"
  echo ""
  echo "Available countries:"
  echo "  australia"
  echo "  uk"
  echo "  usa"
  echo "  czech"
  echo "  france"
  echo "  spain"
  echo "  italy"
  exit 1
fi

DB_NAME="landomo_${COUNTRY}"

echo "Opening PostgreSQL shell for ${DB_NAME}..."
docker exec -it landomo-postgres psql -U landomo -d "${DB_NAME}"
