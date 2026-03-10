#!/bin/bash

# Run all tests for the immodirekt-at scraper fixes

echo "================================================================================"
echo "IMMODIREKT-AT SCRAPER - RUNNING ALL TESTS"
echo "================================================================================"
echo ""

# Test 1: Basic scraper fix test
echo "📋 Test 1: Basic Scraper Fix Test (200 listings from 4 categories)"
echo "--------------------------------------------------------------------------------"
npx ts-node test-scraper-fix.ts
TEST1_EXIT=$?

echo ""
echo ""

# Test 2: Complete pipeline test
echo "📋 Test 2: Complete Pipeline Test (full data validation)"
echo "--------------------------------------------------------------------------------"
npx ts-node test-complete-pipeline.ts
TEST2_EXIT=$?

echo ""
echo ""

# Summary
echo "================================================================================"
echo "TEST SUMMARY"
echo "================================================================================"
echo ""

if [ $TEST1_EXIT -eq 0 ] && [ $TEST2_EXIT -eq 0 ]; then
  echo "✅ ALL TESTS PASSED"
  echo ""
  echo "The scraper is working correctly:"
  echo "  ✓ Correct URLs (no more 404s)"
  echo "  ✓ JSON extraction from window.__INITIAL_STATE__"
  echo "  ✓ 100% field coverage"
  echo "  ✓ 100% success rate"
  echo ""
  echo "Ready for production deployment!"
  exit 0
else
  echo "❌ SOME TESTS FAILED"
  echo ""
  if [ $TEST1_EXIT -ne 0 ]; then
    echo "  ✗ Test 1 failed (Basic Scraper Fix Test)"
  fi
  if [ $TEST2_EXIT -ne 0 ]; then
    echo "  ✗ Test 2 failed (Complete Pipeline Test)"
  fi
  echo ""
  echo "Please review the errors above."
  exit 1
fi
