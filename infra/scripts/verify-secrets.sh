#!/usr/bin/env bash
#
# verify-secrets.sh - Verify secret configuration for production readiness
#
# Usage:
#   ./scripts/verify-secrets.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SECRETS_DIR="$PROJECT_ROOT/docker/secrets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

print_header() {
  echo -e "${BLUE}================================================${NC}"
  echo -e "${BLUE}  Landomo Security Configuration Verification${NC}"
  echo -e "${BLUE}================================================${NC}"
  echo ""
}

print_section() {
  echo ""
  echo -e "${BLUE}--- $1 ---${NC}"
}

check_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASS++))
}

check_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAIL++))
}

check_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
  ((WARN++))
}

# Check if secret file exists and has correct permissions
check_secret_file() {
  local name="$1"
  local expected_size="$2"
  local file="$SECRETS_DIR/$name"

  if [[ ! -f "$file" ]]; then
    check_fail "Secret file missing: $name"
    return 1
  fi

  # Check permissions (should be 600)
  local perms
  perms=$(stat -f "%Lp" "$file" 2>/dev/null || stat -c "%a" "$file" 2>/dev/null)
  if [[ "$perms" != "600" ]]; then
    check_fail "Incorrect permissions on $name: $perms (should be 600)"
  else
    check_pass "Permissions correct on $name: 600"
  fi

  # Check size
  local size
  size=$(wc -c < "$file" | tr -d ' ')
  if [[ "$size" -lt "$expected_size" ]]; then
    check_fail "Secret too short: $name (${size} chars, expected >=${expected_size})"
  else
    check_pass "Secret length OK: $name (${size} chars)"
  fi

  # Check for common weak patterns
  local content
  content=$(cat "$file")
  if [[ "$content" =~ (password|secret|test|dev|demo|admin|root|1234) ]]; then
    check_warn "Secret may be weak: $name contains common pattern"
  fi

  return 0
}

# Check if secret is not in git history
check_not_in_git() {
  local pattern="$1"
  local description="$2"

  if git log --all --full-history --source -- "$pattern" 2>/dev/null | grep -q "commit"; then
    check_fail "SECURITY: $description found in git history!"
    return 1
  else
    check_pass "$description not in git history"
    return 0
  fi
}

# Check Docker Compose secrets configuration
check_docker_compose_secrets() {
  local compose_file="$PROJECT_ROOT/docker/docker-compose.yml"

  if [[ ! -f "$compose_file" ]]; then
    check_fail "docker-compose.yml not found"
    return 1
  fi

  if grep -q "secrets:" "$compose_file"; then
    check_pass "Docker Compose secrets section defined"
  else
    check_fail "Docker Compose missing secrets section"
  fi

  # Check all expected secrets are defined
  local expected_secrets=(db_password db_read_password redis_password api_keys_czech)
  for secret in "${expected_secrets[@]}"; do
    if grep -q "file: ./docker/secrets/$secret" "$compose_file"; then
      check_pass "Secret '$secret' configured in docker-compose.yml"
    else
      check_fail "Secret '$secret' NOT configured in docker-compose.yml"
    fi
  done
}

# Check .gitignore
check_gitignore() {
  local gitignore="$PROJECT_ROOT/.gitignore"

  if [[ ! -f "$gitignore" ]]; then
    check_fail ".gitignore not found"
    return 1
  fi

  if grep -q "docker/secrets/\*" "$gitignore"; then
    check_pass ".gitignore excludes docker/secrets/*"
  else
    check_fail ".gitignore does NOT exclude docker/secrets/*"
  fi

  if grep -q "\\.env\\.production" "$gitignore"; then
    check_pass ".gitignore excludes .env.production"
  else
    check_warn ".gitignore should exclude .env.production"
  fi
}

# Check for secrets in environment variables
check_env_files() {
  local env_files=(".env" ".env.dev" ".env.local" ".env.production")

  for env_file in "${env_files[@]}"; do
    local path="$PROJECT_ROOT/$env_file"
    if [[ -f "$path" ]]; then
      # Check if env file contains actual secrets (not just paths)
      if grep -E "^(DB_PASSWORD|REDIS_PASSWORD|API_KEYS)=[^$]+" "$path" >/dev/null 2>&1; then
        check_warn "Environment file '$env_file' may contain hardcoded secrets (use Docker secrets instead)"
      else
        check_pass "Environment file '$env_file' clean (no hardcoded secrets)"
      fi
    fi
  done
}

# Check Redis authentication
check_redis_auth() {
  if docker ps --format '{{.Names}}' | grep -q 'landomo-redis'; then
    local redis_pass
    redis_pass=$(cat "$SECRETS_DIR/redis_password" 2>/dev/null || echo "")

    if [[ -z "$redis_pass" ]]; then
      check_fail "Redis password file empty or unreadable"
      return 1
    fi

    # Test without password (should fail)
    if docker exec landomo-redis redis-cli PING 2>&1 | grep -q "NOAUTH"; then
      check_pass "Redis authentication enabled (NOAUTH error)"
    else
      check_fail "Redis authentication NOT enabled (accepted connection without password)"
    fi

    # Test with password (should succeed)
    if docker exec landomo-redis redis-cli -a "$redis_pass" PING 2>&1 | grep -q "PONG"; then
      check_pass "Redis authentication works with correct password"
    else
      check_warn "Redis authentication test with password failed (container may not be running)"
    fi
  else
    check_warn "Redis container not running (skipping authentication test)"
  fi
}

# Check PostgreSQL authentication
check_postgres_auth() {
  if docker ps --format '{{.Names}}' | grep -q 'landomo-postgres'; then
    local db_pass
    db_pass=$(cat "$SECRETS_DIR/db_password" 2>/dev/null || echo "")

    if [[ -z "$db_pass" ]]; then
      check_fail "Database password file empty or unreadable"
      return 1
    fi

    # Test with wrong password (should fail)
    if docker exec landomo-postgres psql -U landomo -d postgres --password=wrongpass -c "SELECT 1;" 2>&1 | grep -q "password authentication failed"; then
      check_pass "PostgreSQL rejects incorrect password"
    else
      check_warn "PostgreSQL authentication test failed (container may not be running)"
    fi
  else
    check_warn "PostgreSQL container not running (skipping authentication test)"
  fi
}

# Check API key format
check_api_key_format() {
  local countries=(czech slovakia hungary germany austria)

  for country in "${countries[@]}"; do
    local file="$SECRETS_DIR/api_keys_${country}"
    if [[ -f "$file" ]]; then
      local keys
      keys=$(cat "$file")

      # Check format: prefix_alphanumeric
      if [[ "$keys" =~ ^[a-z_]+_[A-Za-z0-9]{20,} ]]; then
        check_pass "API key format valid: api_keys_${country}"
      else
        check_fail "API key format invalid: api_keys_${country}"
      fi

      # Check for multiple keys (comma-separated)
      if [[ "$keys" =~ , ]]; then
        local count
        count=$(echo "$keys" | tr ',' '\n' | wc -l)
        check_pass "Multiple API keys configured: api_keys_${country} (${count} keys)"
      else
        check_warn "Single API key configured: api_keys_${country} (consider adding backup key)"
      fi
    fi
  done
}

# Check for weak secrets
check_weak_secrets() {
  local weak_patterns=(
    "password"
    "secret"
    "test"
    "dev"
    "demo"
    "admin"
    "root"
    "1234"
    "qwerty"
    "changeme"
    "default"
  )

  for file in "$SECRETS_DIR"/*; do
    if [[ -f "$file" ]] && [[ ! "$(basename "$file")" =~ ^(README|\.gitignore) ]]; then
      local content
      content=$(cat "$file")

      for pattern in "${weak_patterns[@]}"; do
        if echo "$content" | grep -qi "$pattern"; then
          check_warn "Weak secret detected in $(basename "$file"): contains '$pattern'"
          break
        fi
      done
    fi
  done
}

# Check secret age (recommend rotation if >90 days old)
check_secret_age() {
  local max_age_days=90

  for file in "$SECRETS_DIR"/*; do
    if [[ -f "$file" ]] && [[ ! "$(basename "$file")" =~ ^(README|\.gitignore) ]]; then
      local age_seconds
      age_seconds=$(( $(date +%s) - $(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null) ))
      local age_days=$(( age_seconds / 86400 ))

      if [[ $age_days -gt $max_age_days ]]; then
        check_warn "Secret older than ${max_age_days} days: $(basename "$file") (${age_days} days old, consider rotation)"
      fi
    fi
  done
}

# Main verification
print_header

print_section "1. Secret Files"
check_secret_file "db_password" 32
check_secret_file "db_read_password" 32
check_secret_file "redis_password" 32
check_secret_file "api_keys_czech" 50

print_section "2. Git History"
check_not_in_git "docker/secrets/*" "Secret files"
check_not_in_git "*password*" "Password files"
check_not_in_git "*.pem" "Certificate files"

print_section "3. Configuration Files"
check_docker_compose_secrets
check_gitignore

print_section "4. Environment Files"
check_env_files

print_section "5. Service Authentication"
check_redis_auth
check_postgres_auth

print_section "6. API Key Configuration"
check_api_key_format

print_section "7. Security Best Practices"
check_weak_secrets
check_secret_age

# Summary
echo ""
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""
echo -e "${GREEN}Passed:${NC}  $PASS"
echo -e "${YELLOW}Warnings:${NC} $WARN"
echo -e "${RED}Failed:${NC}  $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}❌ Security verification FAILED${NC}"
  echo ""
  echo "Please fix the failed checks before deploying to production."
  echo "See docs/SECURITY_SETUP.md for detailed guidance."
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "${YELLOW}⚠️  Security verification PASSED with warnings${NC}"
  echo ""
  echo "Consider addressing the warnings for better security posture."
  echo "See docs/SECURITY_SETUP.md for recommendations."
  exit 0
else
  echo -e "${GREEN}✅ Security verification PASSED${NC}"
  echo ""
  echo "All security checks passed. System is ready for production."
  exit 0
fi
