#!/bin/bash

# ML Pricing Service - Deployment Verification Script
# Run this script after deploying the service to verify everything works

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ML_SERVICE_URL="${ML_SERVICE_URL:-http://localhost:3500}"
API_KEY="${API_KEY:-dev_ml_key_1}"
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-landomo}"
DB_NAME="${DB_NAME:-landomo_czech}"

echo "================================================"
echo "ML Pricing Service - Deployment Verification"
echo "================================================"
echo ""

# Function to print test result
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    exit 1
  fi
}

# Function to check HTTP status
check_http() {
  local url=$1
  local expected_status=$2
  local description=$3

  echo -e "${YELLOW}Testing:${NC} $description"

  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer $API_KEY" \
    "$url")

  if [ "$status" -eq "$expected_status" ]; then
    print_result 0 "$description (HTTP $status)"
  else
    echo -e "${RED}Expected HTTP $expected_status, got $status${NC}"
    print_result 1 "$description"
  fi
}

echo "1. Database Migrations"
echo "---------------------"

# Check if materialized views exist
echo -e "${YELLOW}Checking:${NC} Materialized views exist"
for view in apartment house land commercial; do
  result=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tAc \
    "SELECT EXISTS(SELECT 1 FROM pg_matviews WHERE matviewname = 'ml_training_features_$view');" 2>/dev/null || echo "f")

  if [ "$result" = "t" ]; then
    print_result 0 "ml_training_features_$view exists"
  else
    print_result 1 "ml_training_features_$view missing - run migration 023"
  fi
done

# Check if model registry table exists
echo -e "${YELLOW}Checking:${NC} ml_model_registry table exists"
result=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tAc \
  "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'ml_model_registry');" 2>/dev/null || echo "f")

if [ "$result" = "t" ]; then
  print_result 0 "ml_model_registry table exists"
else
  print_result 1 "ml_model_registry table missing - run migration 024"
fi

# Check if read-only user exists
echo -e "${YELLOW}Checking:${NC} ml_pricing_readonly user exists"
result=$(psql -h $DB_HOST -U $DB_USER -d postgres -tAc \
  "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = 'ml_pricing_readonly');" 2>/dev/null || echo "f")

if [ "$result" = "t" ]; then
  print_result 0 "ml_pricing_readonly user exists"
else
  print_result 1 "ml_pricing_readonly user missing - run migration 025"
fi

echo ""
echo "2. Training Data Availability"
echo "----------------------------"

# Check if materialized views have data
for view in apartment house land commercial; do
  count=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME -tAc \
    "SELECT COUNT(*) FROM ml_training_features_$view WHERE status IN ('active', 'sold', 'rented') AND price > 0;" 2>/dev/null || echo "0")

  if [ "$count" -ge 100 ]; then
    print_result 0 "ml_training_features_$view has $count samples (sufficient)"
  elif [ "$count" -gt 0 ]; then
    echo -e "${YELLOW}⚠ WARNING${NC}: ml_training_features_$view has only $count samples (min 100 recommended)"
  else
    echo -e "${RED}✗ FAIL${NC}: ml_training_features_$view has no data - refresh materialized view"
  fi
done

echo ""
echo "3. Service Health"
echo "----------------"

# Health check endpoint
check_http "$ML_SERVICE_URL/api/v1/health" 200 "Health endpoint"

# Parse health check response
health_response=$(curl -s "$ML_SERVICE_URL/api/v1/health")
database_check=$(echo "$health_response" | jq -r '.checks.database' 2>/dev/null || echo "null")
redis_check=$(echo "$health_response" | jq -r '.checks.redis' 2>/dev/null || echo "null")
model_check=$(echo "$health_response" | jq -r '.checks.model' 2>/dev/null || echo "null")

if [ "$database_check" = "true" ]; then
  print_result 0 "Database connectivity"
else
  print_result 1 "Database connectivity failed"
fi

if [ "$redis_check" = "true" ]; then
  print_result 0 "Redis connectivity"
else
  print_result 1 "Redis connectivity failed"
fi

if [ "$model_check" = "true" ]; then
  print_result 0 "Model availability"
else
  echo -e "${YELLOW}⚠ WARNING${NC}: No trained models found - run 'python ml/train_model.py --country czech_republic --category apartment'"
fi

echo ""
echo "4. API Endpoints"
echo "---------------"

# Model info endpoint (may 404 if no model trained yet)
echo -e "${YELLOW}Testing:${NC} Model info endpoint"
model_info_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $API_KEY" \
  "$ML_SERVICE_URL/api/v1/models/czech_republic/apartment/info")

if [ "$model_info_status" -eq 200 ]; then
  print_result 0 "Model info endpoint (model exists)"
elif [ "$model_info_status" -eq 404 ]; then
  echo -e "${YELLOW}⚠ WARNING${NC}: Model not found (404) - train a model first"
else
  print_result 1 "Model info endpoint (unexpected status $model_info_status)"
fi

# Prediction endpoint (requires trained model)
if [ "$model_info_status" -eq 200 ]; then
  echo -e "${YELLOW}Testing:${NC} Prediction endpoint"

  prediction_response=$(curl -s -X POST "$ML_SERVICE_URL/api/v1/predictions" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "country": "czech_republic",
      "property_category": "apartment",
      "features": {
        "bedrooms": 2,
        "sqm": 65,
        "floor": 3,
        "has_elevator": true,
        "has_balcony": true,
        "has_parking": false,
        "has_basement": false,
        "city": "Prague",
        "latitude": 50.0755,
        "longitude": 14.4378,
        "year_built": 2015
      },
      "options": {
        "include_confidence": true
      }
    }')

  predicted_price=$(echo "$prediction_response" | jq -r '.predicted_price' 2>/dev/null || echo "null")

  if [ "$predicted_price" != "null" ] && [ "$predicted_price" -gt 0 ]; then
    print_result 0 "Prediction endpoint (predicted price: $predicted_price CZK)"

    # Check prediction time
    prediction_time=$(echo "$prediction_response" | jq -r '.prediction_metadata.prediction_time_ms' 2>/dev/null || echo "0")
    cache_hit=$(echo "$prediction_response" | jq -r '.prediction_metadata.cache_hit' 2>/dev/null || echo "false")

    if [ "$cache_hit" = "true" ]; then
      echo -e "  ${GREEN}→${NC} Cached prediction: ${prediction_time}ms"
    else
      echo -e "  ${GREEN}→${NC} Uncached prediction: ${prediction_time}ms"

      if [ "$prediction_time" -lt 500 ]; then
        echo -e "  ${GREEN}→${NC} Performance: Excellent (<500ms target)"
      elif [ "$prediction_time" -lt 1000 ]; then
        echo -e "  ${YELLOW}→${NC} Performance: Acceptable but could be optimized"
      else
        echo -e "  ${RED}→${NC} Performance: Slow (>1s) - investigate"
      fi
    fi
  else
    print_result 1 "Prediction endpoint (invalid response)"
  fi
else
  echo -e "${YELLOW}⚠ SKIP${NC}: Prediction endpoint (no model trained)"
fi

echo ""
echo "5. Authentication"
echo "----------------"

# Test without API key (should fail with 401)
echo -e "${YELLOW}Testing:${NC} Unauthorized access blocked"
unauth_status=$(curl -s -o /dev/null -w "%{http_code}" \
  "$ML_SERVICE_URL/api/v1/models/czech_republic/apartment/info")

if [ "$unauth_status" -eq 401 ]; then
  print_result 0 "Unauthorized access correctly blocked (401)"
else
  print_result 1 "Unauthorized access not blocked (got $unauth_status, expected 401)"
fi

# Test with invalid API key (should fail with 401)
echo -e "${YELLOW}Testing:${NC} Invalid API key rejected"
invalid_key_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer invalid_key_xyz" \
  "$ML_SERVICE_URL/api/v1/models/czech_republic/apartment/info")

if [ "$invalid_key_status" -eq 401 ]; then
  print_result 0 "Invalid API key correctly rejected (401)"
else
  print_result 1 "Invalid API key not rejected (got $invalid_key_status, expected 401)"
fi

echo ""
echo "6. Performance & Monitoring"
echo "--------------------------"

# Check if Prometheus metrics endpoint is available
echo -e "${YELLOW}Testing:${NC} Prometheus metrics endpoint"
metrics_status=$(curl -s -o /dev/null -w "%{http_code}" "$ML_SERVICE_URL/metrics")

if [ "$metrics_status" -eq 200 ]; then
  print_result 0 "Prometheus metrics endpoint"

  # Check for key metrics
  metrics=$(curl -s "$ML_SERVICE_URL/metrics")

  if echo "$metrics" | grep -q "ml_prediction_requests_total"; then
    echo -e "  ${GREEN}→${NC} ml_prediction_requests_total metric present"
  fi

  if echo "$metrics" | grep -q "ml_prediction_duration_seconds"; then
    echo -e "  ${GREEN}→${NC} ml_prediction_duration_seconds metric present"
  fi

  if echo "$metrics" | grep -q "ml_cache_hit_rate"; then
    echo -e "  ${GREEN}→${NC} ml_cache_hit_rate metric present"
  fi
else
  print_result 1 "Prometheus metrics endpoint (HTTP $metrics_status)"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✓ Deployment verification complete!${NC}"
echo "================================================"
echo ""

if [ "$model_check" != "true" ]; then
  echo -e "${YELLOW}NEXT STEPS:${NC}"
  echo "1. Train initial model:"
  echo "   python ml-pricing-service/ml/train_model.py --country czech_republic --category apartment"
  echo ""
  echo "2. Verify model was created:"
  echo "   ls -lh models/czech_republic/apartment/"
  echo ""
  echo "3. Re-run this verification script"
  echo ""
fi

echo "For detailed documentation, see: ml-pricing-service/README.md"
