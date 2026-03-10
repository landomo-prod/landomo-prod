#!/bin/bash
set -e

# ============================================================
# Add a new country to the Landomo-World platform
# ============================================================
# Usage: ./scripts/add-country.sh
# Interactive script that generates all deployment files for a new country.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$PROJECT_ROOT/docker/templates"

# ============================================================
# Country registry - maps slug to display name, code, directory, ports
# ============================================================
# Port allocation scheme:
#   Ingest ports: 3001-3099 (one per country)
#   Scraper ports: 8000-8999 (allocated in blocks of 10 per country)
# Existing allocations:
#   australia=3001, uk=3002, usa=3003, czech=3004, france=3005
#   spain=3006, italy=3007, slovakia=3008, hungary=3009, germany=3010, austria=3011
# ============================================================

declare -A COUNTRY_DISPLAY=(
  [slovakia]="Slovakia" [poland]="Poland" [austria]="Austria" [germany]="Germany"
  [czech]="Czech Republic" [hungary]="Hungary" [australia]="Australia" [uk]="United Kingdom"
  [usa]="United States" [france]="France" [spain]="Spain" [italy]="Italy"
  [croatia]="Croatia" [romania]="Romania" [bulgaria]="Bulgaria" [serbia]="Serbia"
  [slovenia]="Slovenia" [portugal]="Portugal" [netherlands]="Netherlands" [belgium]="Belgium"
  [switzerland]="Switzerland" [ireland]="Ireland" [greece]="Greece" [sweden]="Sweden"
)

declare -A COUNTRY_CODE=(
  [slovakia]="sk" [poland]="pl" [austria]="at" [germany]="de"
  [czech]="cz" [hungary]="hu" [australia]="aus" [uk]="uk"
  [usa]="usa" [france]="fr" [spain]="es" [italy]="it"
  [croatia]="hr" [romania]="ro" [bulgaria]="bg" [serbia]="rs"
  [slovenia]="si" [portugal]="pt" [netherlands]="nl" [belgium]="be"
  [switzerland]="ch" [ireland]="ie" [greece]="gr" [sweden]="se"
)

declare -A COUNTRY_DIR=(
  [slovakia]="Slovakia" [poland]="Poland" [austria]="Austria" [germany]="Germany"
  [czech]="Czech Republic" [hungary]="Hungary" [australia]="Australia" [uk]="United Kingdom"
  [usa]="USA" [france]="France" [spain]="Spain" [italy]="Italy"
  [croatia]="Croatia" [romania]="Romania" [bulgaria]="Bulgaria" [serbia]="Serbia"
  [slovenia]="Slovenia" [portugal]="Portugal" [netherlands]="Netherlands" [belgium]="Belgium"
  [switzerland]="Switzerland" [ireland]="Ireland" [greece]="Greece" [sweden]="Sweden"
)

# Next available ingest port (scan existing compose)
get_next_ingest_port() {
  local max_port=3000
  if [ -f "$PROJECT_ROOT/docker/docker-compose.yml" ]; then
    local found
    found=$(grep -oP '"(\d+):3000"' "$PROJECT_ROOT/docker/docker-compose.yml" | grep -oP '\d+(?=:)' | sort -n | tail -1)
    if [ -n "$found" ]; then
      max_port=$found
    fi
  fi
  echo $((max_port + 1))
}

# Next available scraper port block (blocks of 10)
get_next_scraper_port_base() {
  local max_port=8080
  if [ -f "$PROJECT_ROOT/docker/docker-compose.yml" ]; then
    local found
    found=$(grep -oP '"(8\d{3}):\1"' "$PROJECT_ROOT/docker/docker-compose.yml" | grep -oP '^\d+' | sort -n | tail -1)
    if [ -n "$found" ]; then
      # Round up to next block of 10
      max_port=$(( (found / 10 + 1) * 10 ))
    fi
  fi
  echo $max_port
}

echo "=========================================="
echo "Landomo-World - Add New Country"
echo "=========================================="
echo ""

# Get country slug
read -p "Enter country slug (e.g., poland, croatia): " COUNTRY_SLUG
COUNTRY_SLUG=$(echo "$COUNTRY_SLUG" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')

if [ -z "$COUNTRY_SLUG" ]; then
  echo "Error: Country slug is required."
  exit 1
fi

# Look up or prompt for details
DISPLAY="${COUNTRY_DISPLAY[$COUNTRY_SLUG]}"
CODE="${COUNTRY_CODE[$COUNTRY_SLUG]}"
DIR="${COUNTRY_DIR[$COUNTRY_SLUG]}"

if [ -z "$DISPLAY" ]; then
  read -p "Country display name (e.g., Croatia): " DISPLAY
  read -p "Country code (2-3 letters, e.g., hr): " CODE
  read -p "Country directory name in scrapers/ (e.g., Croatia): " DIR
fi

COUNTRY_UPPER=$(echo "$COUNTRY_SLUG" | tr '[:lower:]' '[:upper:]')
INGEST_PORT=$(get_next_ingest_port)
SCRAPER_PORT_BASE=$(get_next_scraper_port_base)

echo ""
echo "Configuration:"
echo "  Slug:         $COUNTRY_SLUG"
echo "  Display:      $DISPLAY"
echo "  Code:         $CODE"
echo "  Directory:    scrapers/$DIR"
echo "  DB Name:      landomo_$COUNTRY_SLUG"
echo "  Ingest Port:  $INGEST_PORT"
echo "  Scraper Base: $SCRAPER_PORT_BASE"
echo ""
read -p "Proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ============================================================
# 1. Generate docker-compose override file
# ============================================================
COMPOSE_OUTPUT="$PROJECT_ROOT/docker/docker-compose.${COUNTRY_SLUG}.yml"
echo ""
echo "1. Generating $COMPOSE_OUTPUT"

sed \
  -e "s/{{COUNTRY_SLUG}}/$COUNTRY_SLUG/g" \
  -e "s/{{COUNTRY_DISPLAY}}/$DISPLAY/g" \
  -e "s/{{COUNTRY_UPPER}}/$COUNTRY_UPPER/g" \
  -e "s/{{COUNTRY_CODE}}/$CODE/g" \
  -e "s/{{COUNTRY_DIR}}/$DIR/g" \
  -e "s/{{INGEST_PORT}}/$INGEST_PORT/g" \
  -e "s/{{SCRAPER_PORT_BASE}}/$SCRAPER_PORT_BASE/g" \
  -e "s/{{PORTAL_EXAMPLE}}/example-portal/g" \
  "$TEMPLATES_DIR/docker-compose.country.yml.template" > "$COMPOSE_OUTPUT"

echo "   Created: $COMPOSE_OUTPUT"

# ============================================================
# 2. Generate environment file
# ============================================================
ENV_OUTPUT="$PROJECT_ROOT/.env.${COUNTRY_SLUG}"
echo ""
echo "2. Generating $ENV_OUTPUT"

sed \
  -e "s/{{COUNTRY_SLUG}}/$COUNTRY_SLUG/g" \
  -e "s/{{COUNTRY_DISPLAY}}/$DISPLAY/g" \
  -e "s/{{COUNTRY_UPPER}}/$COUNTRY_UPPER/g" \
  -e "s/{{COUNTRY_CODE}}/$CODE/g" \
  "$TEMPLATES_DIR/env.country.template" > "$ENV_OUTPUT"

echo "   Created: $ENV_OUTPUT"

# ============================================================
# 3. Create secrets file placeholder
# ============================================================
SECRETS_DIR="$PROJECT_ROOT/docker/secrets"
SECRET_FILE="$SECRETS_DIR/api_keys_${COUNTRY_SLUG}"
echo ""
echo "3. Creating API key secret"

if [ ! -f "$SECRET_FILE" ]; then
  # Generate a random API key
  API_KEY="prod_${CODE}_$(openssl rand -hex 16)"
  echo "$API_KEY" > "$SECRET_FILE"
  chmod 600 "$SECRET_FILE"
  echo "   Created: $SECRET_FILE"
  echo "   Key:     $API_KEY"
else
  echo "   Already exists: $SECRET_FILE"
fi

# ============================================================
# 4. Create scraper directory structure
# ============================================================
SCRAPER_DIR="$PROJECT_ROOT/scrapers/$DIR"
echo ""
echo "4. Setting up scraper directory"

if [ ! -d "$SCRAPER_DIR" ]; then
  mkdir -p "$SCRAPER_DIR/shared"
  echo "   Created: $SCRAPER_DIR/"
else
  echo "   Already exists: $SCRAPER_DIR/"
fi

# Create shared value mappings template if missing
if [ ! -f "$SCRAPER_DIR/shared/${COUNTRY_SLUG}-value-mappings.js" ]; then
  cat > "$SCRAPER_DIR/shared/${COUNTRY_SLUG}-value-mappings.js" << 'MAPPINGS_EOF'
// Value mappings for property field normalization
// Adapt these to the local language and portal conventions

const propertyTypeMap = {
  // Map local property type strings to: apartment, house, land, commercial
};

const conditionMap = {
  // Map local condition strings to: new, good, fair, poor, renovation_needed, after_renovation
};

const heatingTypeMap = {
  // Map local heating type strings to normalized values
};

const furnishedMap = {
  // Map local furnished strings to: furnished, partially_furnished, unfurnished
};

module.exports = {
  propertyTypeMap,
  conditionMap,
  heatingTypeMap,
  furnishedMap,
};
MAPPINGS_EOF
  echo "   Created: shared value mappings template"
fi

# ============================================================
# 5. Add to init-databases.sh if not present
# ============================================================
INIT_DB="$PROJECT_ROOT/docker/postgres/init-databases.sh"
echo ""
echo "5. Checking init-databases.sh"

if grep -q "\"$COUNTRY_SLUG\"" "$INIT_DB"; then
  echo "   Already registered in init-databases.sh"
else
  # Insert before the closing parenthesis of COUNTRIES array
  sed -i '' "/^)/i\\
  \"$COUNTRY_SLUG\"" "$INIT_DB"
  echo "   Added '$COUNTRY_SLUG' to init-databases.sh"
fi

# ============================================================
# 6. Add secret to docker-compose.yml if not present
# ============================================================
MAIN_COMPOSE="$PROJECT_ROOT/docker/docker-compose.yml"
echo ""
echo "6. Checking docker-compose.yml secrets"

if grep -q "api_keys_${COUNTRY_SLUG}" "$MAIN_COMPOSE"; then
  echo "   Secret already defined in docker-compose.yml"
else
  echo "   NOTE: Add the following to docker-compose.yml secrets section:"
  echo "     api_keys_${COUNTRY_SLUG}:"
  echo "       file: ./secrets/api_keys_${COUNTRY_SLUG}"
fi

# ============================================================
# Summary
# ============================================================
echo ""
echo "=========================================="
echo "Country '$DISPLAY' setup complete!"
echo "=========================================="
echo ""
echo "Files created/updated:"
echo "  - $COMPOSE_OUTPUT"
echo "  - $ENV_OUTPUT"
echo "  - $SECRET_FILE"
echo "  - $SCRAPER_DIR/"
echo ""
echo "Next steps:"
echo "  1. Initialize the database:"
echo "     ./scripts/init-country-db.sh $COUNTRY_SLUG"
echo ""
echo "  2. Start infrastructure + country services:"
echo "     docker compose -f docker/docker-compose.yml -f docker/docker-compose.${COUNTRY_SLUG}.yml \\"
echo "       --env-file .env.dev --env-file .env.${COUNTRY_SLUG} up -d"
echo ""
echo "  3. Add scrapers to scrapers/$DIR/<portal-name>/"
echo "     Each scraper needs: Dockerfile, src/index.ts, src/transformers/, src/adapters/"
echo ""
echo "  4. Add scraper services to docker/docker-compose.${COUNTRY_SLUG}.yml"
echo "     Use ports starting from $SCRAPER_PORT_BASE"
echo ""
echo "  5. Update .env.${COUNTRY_SLUG} with production API keys"
echo ""
