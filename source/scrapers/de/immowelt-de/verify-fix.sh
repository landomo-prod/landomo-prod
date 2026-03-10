#!/bin/bash

# Verification script for immowelt-de browser crash fix
# This script tests the fix in multiple ways

set -e

echo "🔍 Immowelt-de Browser Crash Fix Verification"
echo "=============================================="
echo ""

cd "$(dirname "$0")"

echo "1️⃣ Checking TypeScript compilation..."
npm run build
if [ $? -eq 0 ]; then
    echo "   ✅ Build successful"
else
    echo "   ❌ Build failed"
    exit 1
fi
echo ""

echo "2️⃣ Verifying key fixes are in place..."

# Check timeout increase
if grep -q "timeout = 60000" src/utils/browser.ts; then
    echo "   ✅ Timeout increased to 60s"
else
    echo "   ❌ Timeout not increased"
    exit 1
fi

# Check page.isClosed() checks
if grep -q "page.isClosed()" src/scrapers/listingsScraper-ufrn.ts; then
    echo "   ✅ Page closure checks added"
else
    echo "   ❌ Page closure checks missing"
    exit 1
fi

# Check proper cleanup order
if grep -q "if (page && !page.isClosed())" src/scrapers/listingsScraper-ufrn.ts; then
    echo "   ✅ Proper cleanup order implemented"
else
    echo "   ❌ Cleanup order not fixed"
    exit 1
fi

echo ""
echo "3️⃣ Checking test script exists..."
if [ -f "test-browser-crash.ts" ]; then
    echo "   ✅ Test script present"
else
    echo "   ❌ Test script missing"
    exit 1
fi

echo ""
echo "4️⃣ Checking documentation..."
if [ -f "BROWSER_CRASH_FIX.md" ]; then
    echo "   ✅ Fix documentation present"
else
    echo "   ❌ Documentation missing"
    exit 1
fi

echo ""
echo "✅ All verification checks passed!"
echo ""
echo "📋 Next steps:"
echo "   1. Run test: npx ts-node test-browser-crash.ts"
echo "   2. Build Docker: docker build -t landomo/scraper-immowelt-de:latest ."
echo "   3. Test Docker: docker run --rm landomo/scraper-immowelt-de:latest npm test"
echo ""
echo "📖 See BROWSER_CRASH_FIX.md for detailed documentation"
