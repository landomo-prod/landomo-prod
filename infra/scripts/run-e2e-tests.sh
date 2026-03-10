#!/usr/bin/env bash
set -euo pipefail

# Run Playwright E2E tests for the frontend-mobile application.
#
# Usage:
#   ./scripts/run-e2e-tests.sh              # Run all E2E tests
#   ./scripts/run-e2e-tests.sh --ui         # Open Playwright UI mode
#   ./scripts/run-e2e-tests.sh --headed     # Run tests in headed browser
#   ./scripts/run-e2e-tests.sh search       # Run only search tests
#   ./scripts/run-e2e-tests.sh --project "Mobile Chrome"  # Run on specific device

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend-mobile"

echo "=== Landomo E2E Test Runner ==="
echo ""

# Check that frontend-mobile directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
  echo "ERROR: frontend-mobile directory not found at $FRONTEND_DIR"
  exit 1
fi

cd "$FRONTEND_DIR"

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Install Playwright browsers if needed
if ! npx playwright --version > /dev/null 2>&1; then
  echo "Installing Playwright..."
  npx playwright install
fi

# Check if Playwright browsers are installed
if [ ! -d "$HOME/Library/Caches/ms-playwright" ] && [ ! -d "$HOME/.cache/ms-playwright" ]; then
  echo "Installing Playwright browsers..."
  npx playwright install --with-deps
fi

# Build shared-components if needed
SHARED_DIR="$PROJECT_ROOT/shared-components"
if [ -d "$SHARED_DIR" ] && [ ! -d "$SHARED_DIR/dist" ]; then
  echo "Building shared-components..."
  (cd "$SHARED_DIR" && npm run build)
fi

echo ""
echo "Running Playwright E2E tests..."
echo "Arguments: ${*:-<none>}"
echo ""

# Pass all arguments through to playwright
npx playwright test "$@"

EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "All E2E tests passed."
else
  echo "Some E2E tests failed (exit code: $EXIT_CODE)."
  echo ""
  echo "To view the HTML report:"
  echo "  cd frontend-mobile && npx playwright show-report"
  echo ""
  echo "To debug failing tests:"
  echo "  cd frontend-mobile && npx playwright test --ui"
fi

exit $EXIT_CODE
