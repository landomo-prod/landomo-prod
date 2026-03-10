#!/bin/sh
set -e

# Read passwords from Docker secrets if available, fall back to env vars
DB_PASS=$(cat /run/secrets/db_password 2>/dev/null || echo "${DB_PASSWORD:-landomo_dev_pass}")
DB_READ_PASS=$(cat /run/secrets/db_read_password 2>/dev/null || echo "${SEARCH_DB_READ_PASSWORD:-search_readonly_dev}")

# Pre-populate userlist with both users before the upstream entrypoint runs.
# The upstream entrypoint appends only if user is not already present, so this
# ensures both the admin (landomo) and read-only (search_readonly) users can connect.
mkdir -p /etc/pgbouncer
cat > /etc/pgbouncer/userlist.txt <<EOF
"${DB_USER:-landomo}" "${DB_PASS}"
"search_readonly" "${DB_READ_PASS}"
EOF

# Delegate to the upstream edoburu entrypoint which generates pgbouncer.ini
# and appends to userlist only for users not already present.
exec /entrypoint.sh "$@"
