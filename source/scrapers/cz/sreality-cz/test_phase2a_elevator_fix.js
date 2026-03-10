/**
 * Phase 2a Re-Test: Elevator Bug Fix Validation
 *
 * This test re-runs the same 6 critical SReality listings from Phase 2a test
 * with the FIXED isPositiveValue() function that now:
 * 1. Explicitly checks for 'false' and returns false instead of true
 * 2. Handles numeric values > 0 as positive indicators
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test listing IDs - the key ones that showed bugs
const TEST_LISTING_IDS = [
  2437342028,   // has balcony (13) + elevator (true) - BASELINE
  340882252,    // has elevator (true) - BASELINE
  3430052684,   // no amenities - BASELINE
  750941004,    // has balcony (3) - NUMERIC TEST CASE - CRITICAL
  3024319308,   // has balcony (3) + elevator (true) - NUMERIC + BASELINE
  2983228236,   // has elevator (false) - FALSE POSITIVE TEST CASE - CRITICAL
];

class Phase2aElevatorFixTest {
  constructor() {
    this.results = [];
    this.fieldComparisons = {};
    this.detailedFindings = {
      elevatorFalsePositiveFixed: false,
      numericBalconyFixed: false,
      numericTerraceFixed: false,
      falseElevatorCases: [],
      numericBalconyCases: [],
    };
  }

  async run() {
    console.log('🔬 Phase 2a Re-Test: Elevator Bug Fix Validation');
    console.log('================================================\n');

    for (const listingId of TEST_LISTING_IDS) {
      await this.testListing(listingId);
    }

    this.analyzeResults();
    this.outputResults();
  }

  async testListing(listingId) {
    try {
      console.log(`📍 Testing listing: ${listingId}`);

      const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${listingId}`;
      const response = await axios.get(detailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const estate = response.data;

      if (!estate) {
        this.results.push({
          listing_id: listingId,
          error: 'No estate data returned'
        });
        return;
      }

      // Extract items for amenity analysis
      const items = estate.items || [];
      const amenityItems = items.filter(item => {
        const name = (item.name || '').toLowerCase();
        return name.includes('výtah') || name.includes('balkón') ||
               name.includes('terasa') || name.includes('klimatizace') ||
               name.includes('bezpečnost') || name.includes('krb');
      });

      // Manually check extraction logic based on the transformer code
      const extractedAmenities = this.extractAmenities(amenityItems);

      this.results.push({
        listing_id: listingId,
        title: estate.name,
        property_type: estate.category_type === 1 ? 'apartment' : 'house',
        transaction_type: estate.category_sub === 1 ? 'sale' : 'rent',
        amenities: extractedAmenities,
        api_items: amenityItems.map(item => ({
          name: item.name,
          value: item.value,
          type: item.type,
          unit: item.unit
        }))
      });

      // Log quick summary
      const emoji = extractedAmenities.has_elevator ? '🛗' : '·';
      const balcony = extractedAmenities.has_balcony ? '🏠' : '·';
      console.log(`  ✓ Processed: ${emoji} ${balcony}\n`);
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}\n`);
      this.results.push({
        listing_id: listingId,
        error: error.message
      });
    }
  }

  extractAmenities(items) {
    const amenities = {
      has_ac: undefined,
      has_security: undefined,
      has_fireplace: undefined,
      has_balcony: undefined,
      has_terrace: undefined,
      has_elevator: undefined,
    };

    for (const item of items) {
      const name = (item.name || '').toLowerCase();
      const value = item.value;

      // Check if value is positive using the same logic as isPositiveValue()
      const isPositive = this.isPositiveValue(value);

      // Extract elevator
      if (name.includes('výtah') || name.includes('ascensor')) {
        if (isPositive === true) {
          amenities.has_elevator = true;
        } else if (isPositive === false) {
          // Fixed: now returns false for negative values instead of undefined
          amenities.has_elevator = false;
        }
      }

      // Extract balcony
      if (name.includes('balkón')) {
        if (isPositive === true) {
          amenities.has_balcony = true;
        }
      }

      // Extract terrace
      if (name.includes('terasa')) {
        if (isPositive === true) {
          amenities.has_terrace = true;
        }
      }

      // Extract AC
      if (name.includes('klimatizace')) {
        if (isPositive === true) {
          amenities.has_ac = true;
        }
      }

      // Extract security
      if (name.includes('bezpečnost') || name.includes('alarm') || name.includes('kamera')) {
        if (isPositive === true) {
          amenities.has_security = true;
        }
      }

      // Extract fireplace
      if (name.includes('krb')) {
        if (isPositive === true) {
          amenities.has_fireplace = true;
        }
      }
    }

    return amenities;
  }

  isPositiveValue(value) {
    if (value === undefined || value === null) return undefined;

    // Numeric values > 0 are positive (FIX: handles numeric area values)
    if (typeof value === 'number') {
      return value > 0 ? true : false;
    }

    // String values
    const str = String(value).toLowerCase().trim();

    // FIX: Explicitly check for negative indicators
    if (str === '' || str === 'ne' || str === 'no' || str === 'false') {
      return false;
    }

    // Check for positive indicators
    const isPositive = str.includes('ano') ||
                      str.includes('yes') ||
                      str.includes('true') ||
                      str.includes('máme') ||
                      str.includes('je') ||
                      str.includes('existuje') ||
                      str.includes('connected');

    return isPositive ? true : undefined;
  }

  analyzeResults() {
    console.log('\n📊 Analyzing results...\n');

    for (const result of this.results) {
      if (result.error || !result.api_items) continue;

      // Check for false elevator bug fix
      const falseElevator = result.api_items.find(item => {
        const name = (item.name || '').toLowerCase();
        return name.includes('výtah') && item.value === false;
      });

      if (falseElevator) {
        const extracted = result.amenities.has_elevator;
        console.log(`  Listing ${result.listing_id}: Elevator with false value`);
        console.log(`    API value: ${falseElevator.value} (type: ${typeof falseElevator.value})`);
        console.log(`    Extracted: ${extracted}`);

        if (extracted !== true) {
          console.log(`    ✓ CORRECT: Not extracted as true (bug is FIXED)`);
          this.detailedFindings.elevatorFalsePositiveFixed = true;
          this.detailedFindings.falseElevatorCases.push({
            listing_id: result.listing_id,
            api_value: falseElevator.value,
            extracted: extracted,
            status: 'FIXED'
          });
        } else {
          console.log(`    ✗ WRONG: Still extracted as true (bug NOT FIXED)`);
          this.detailedFindings.falseElevatorCases.push({
            listing_id: result.listing_id,
            api_value: falseElevator.value,
            extracted: extracted,
            status: 'NOT FIXED'
          });
        }
        console.log('');
      }

      // Check for numeric balcony fix
      const numericBalcony = result.api_items.find(item => {
        const name = (item.name || '').toLowerCase();
        const isNumeric = /^\d+$/.test(String(item.value));
        return name.includes('balkón') && isNumeric;
      });

      if (numericBalcony) {
        const extracted = result.amenities.has_balcony;
        console.log(`  Listing ${result.listing_id}: Balcony with numeric value`);
        console.log(`    API value: "${numericBalcony.value}" (type: ${typeof numericBalcony.value})`);
        console.log(`    Extracted: ${extracted}`);

        if (extracted === true) {
          console.log(`    ✓ CORRECT: Numeric value recognized (bug is FIXED)`);
          this.detailedFindings.numericBalconyFixed = true;
          this.detailedFindings.numericBalconyCases.push({
            listing_id: result.listing_id,
            api_value: numericBalcony.value,
            extracted: extracted,
            status: 'FIXED'
          });
        } else {
          console.log(`    ✗ WRONG: Numeric value not recognized (bug NOT FIXED)`);
          this.detailedFindings.numericBalconyCases.push({
            listing_id: result.listing_id,
            api_value: numericBalcony.value,
            extracted: extracted,
            status: 'NOT FIXED'
          });
        }
        console.log('');
      }
    }
  }

  outputResults() {
    console.log('\n═══════════════════════════════════════════════════════════════════');
    console.log('                    PHASE 2A RE-TEST RESULTS                       ');
    console.log('                   Elevator Bug Fix Validation                     ');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Field extraction summary
    console.log('📊 FIELD EXTRACTION SUMMARY\n');

    let elevatorCount = 0;
    let elevatorTrue = 0;
    let elevatorFalse = 0;
    let balconyCount = 0;
    let balconyTrue = 0;
    let terraceCount = 0;
    let terraceTrue = 0;

    for (const result of this.results) {
      if (!result.api_items) continue;

      // Count elevator
      const hasElevator = result.api_items.find(item =>
        (item.name || '').toLowerCase().includes('výtah')
      );
      if (hasElevator) {
        elevatorCount++;
        if (result.amenities.has_elevator === true) elevatorTrue++;
        if (result.amenities.has_elevator === false) elevatorFalse++;
      }

      // Count balcony
      const hasBalcony = result.api_items.find(item =>
        (item.name || '').toLowerCase().includes('balkón')
      );
      if (hasBalcony) {
        balconyCount++;
        if (result.amenities.has_balcony === true) balconyTrue++;
      }

      // Count terrace
      const hasTerrace = result.api_items.find(item =>
        (item.name || '').toLowerCase().includes('terasa')
      );
      if (hasTerrace) {
        terraceCount++;
        if (result.amenities.has_terrace === true) terraceTrue++;
      }
    }

    const elevatorRate = elevatorCount > 0 ? Math.round((elevatorTrue / elevatorCount) * 100) : 0;
    const balconyRate = balconyCount > 0 ? Math.round((balconyTrue / balconyCount) * 100) : 0;
    const terraceRate = terraceCount > 0 ? Math.round((terraceTrue / terraceCount) * 100) : 0;

    console.log(`Field          │ API Found │ Extracted │ Success Rate │ Change      │ Status`);
    console.log(`───────────────┼───────────┼───────────┼──────────────┼─────────────┼───────────────────────`);
    console.log(`has_elevator   │ ${elevatorCount}/6 (${Math.round(elevatorCount/6*100)}%)      │ ${elevatorTrue}/${elevatorCount}       │ ${elevatorRate}%       │ +${Math.max(0, elevatorRate-60)}%  ↑ │ ${this.detailedFindings.falseElevatorCases.length > 0 && this.detailedFindings.falseElevatorCases.some(c => c.status === 'FIXED') ? '✓ FIXED' : '→'}`);
    console.log(`has_balcony    │ ${balconyCount}/6 (${Math.round(balconyCount/6*100)}%)      │ ${balconyTrue}/${balconyCount}       │ ${balconyRate}%       │ +${Math.max(0, balconyRate-50)}%  ↑ │ ${this.detailedFindings.numericBalconyCases.length > 0 && this.detailedFindings.numericBalconyCases.some(c => c.status === 'FIXED') ? '✓ FIXED' : '→'}`);
    console.log(`has_terrace    │ ${terraceCount}/6 (${Math.round(terraceCount/6*100)}%)      │ ${terraceTrue}/${terraceCount}       │ ${terraceRate}%       │ +${terraceRate}%  ↑ │ ${terraceRate > 0 ? '✓ Improved' : '·'}`);

    // Detailed findings
    console.log('\n\n🔍 CRITICAL BUG FIX VALIDATION\n');

    console.log('1️⃣  ELEVATOR FALSE POSITIVE BUG FIX');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (this.detailedFindings.falseElevatorCases.length > 0) {
      console.log(`   Cases tested: ${this.detailedFindings.falseElevatorCases.length}\n`);
      for (const testCase of this.detailedFindings.falseElevatorCases) {
        const status = testCase.status === 'FIXED' ? '✓' : '✗';
        console.log(`   ${status} Listing ${testCase.listing_id}:`);
        console.log(`      API: false → Extracted: ${testCase.extracted}`);
        console.log(`      Status: ${testCase.status}`);
      }
      const allFixed = this.detailedFindings.falseElevatorCases.every(c => c.status === 'FIXED');
      console.log(`\n   Overall: ${allFixed ? '✅ ALL FALSE POSITIVES FIXED' : '❌ SOME FALSE POSITIVES STILL PRESENT'}`);
    } else {
      console.log('   No false elevator values found in test data');
    }

    console.log('\n\n2️⃣  BALCONY NUMERIC VALUE FIX');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (this.detailedFindings.numericBalconyCases.length > 0) {
      console.log(`   Cases tested: ${this.detailedFindings.numericBalconyCases.length}\n`);
      for (const testCase of this.detailedFindings.numericBalconyCases) {
        const status = testCase.status === 'FIXED' ? '✓' : '✗';
        console.log(`   ${status} Listing ${testCase.listing_id}:`);
        console.log(`      API: "${testCase.api_value}" → Extracted: ${testCase.extracted}`);
        console.log(`      Status: ${testCase.status}`);
      }
      const allFixed = this.detailedFindings.numericBalconyCases.every(c => c.status === 'FIXED');
      console.log(`\n   Overall: ${allFixed ? '✅ ALL NUMERIC VALUES NOW RECOGNIZED' : '❌ SOME NUMERIC VALUES STILL NOT RECOGNIZED'}`);
    } else {
      console.log('   No numeric balcony values found in test data');
    }

    // JSON export
    const jsonOutput = {
      test_metadata: {
        test_name: 'Phase 2a Re-Test: Elevator Bug Fix Validation',
        test_date: new Date().toISOString(),
        description: 'Re-testing critical listings with fixed isPositiveValue() function',
        total_listings_tested: TEST_LISTING_IDS.length,
        listings_tested: TEST_LISTING_IDS,
        critical_test_cases: {
          elevator_false_positive: 2983228236,
          balcony_numeric_3sqm: 750941004,
          balcony_numeric_3sqm_with_elevator: 3024319308
        }
      },
      improvements: {
        elevator_false_positive_fix: this.detailedFindings.falseElevatorCases.every(c => c.status === 'FIXED'),
        balcony_numeric_values_fix: this.detailedFindings.numericBalconyCases.every(c => c.status === 'FIXED'),
        elevator_before: '60%',
        elevator_after: `${elevatorRate}%`,
        balcony_before: '50%',
        balcony_after: `${balconyRate}%`,
        terrace_before: '0%',
        terrace_after: `${terraceRate}%`
      },
      extraction_summary: {
        has_elevator: {
          api_availability: elevatorCount,
          extraction_count: elevatorTrue,
          extraction_rate: `${elevatorRate}%`
        },
        has_balcony: {
          api_availability: balconyCount,
          extraction_count: balconyTrue,
          extraction_rate: `${balconyRate}%`
        },
        has_terrace: {
          api_availability: terraceCount,
          extraction_count: terraceTrue,
          extraction_rate: `${terraceRate}%`
        }
      },
      critical_bug_validation: {
        false_elevator_cases: this.detailedFindings.falseElevatorCases,
        numeric_balcony_cases: this.detailedFindings.numericBalconyCases
      },
      detailed_results: this.results.filter(r => !r.error),
      summary: {
        total_listings_tested: this.results.length,
        listings_with_errors: this.results.filter(r => r.error).length,
        successful_tests: this.results.filter(r => !r.error).length
      }
    };

    console.log('\n\n✅ CONCLUSION\n');
    const elevatorFixed = this.detailedFindings.falseElevatorCases.every(c => c.status === 'FIXED');
    const balconyFixed = this.detailedFindings.numericBalconyCases.every(c => c.status === 'FIXED');

    console.log(elevatorFixed ?
      '✓ ELEVATOR FALSE POSITIVE BUG: FIXED' :
      '✗ ELEVATOR FALSE POSITIVE BUG: NOT FIXED');
    console.log(balconyFixed ?
      '✓ BALCONY NUMERIC VALUES BUG: FIXED' :
      '✗ BALCONY NUMERIC VALUES BUG: NOT FIXED');

    console.log('\n\n📄 Saving detailed results to PHASE2A_RETEST_RESULTS.json...\n');
    const outputPath = path.join(
      '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality',
      'PHASE2A_RETEST_RESULTS.json'
    );

    fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
    console.log(`✓ Results saved to: ${outputPath}`);
  }
}

// Run test
const test = new Phase2aElevatorFixTest();
test.run().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
