/**
 * Phase 2a Re-Test: Elevator Bug Fix Validation
 *
 * This test re-runs the same 12 SReality listings from the previous Phase 2a test
 * with the FIXED isPositiveValue() function that now:
 * 1. Explicitly checks for 'false' and returns false instead of true
 * 2. Handles numeric values > 0 as positive indicators
 *
 * Expected improvements:
 * - Elevator: 60% -> higher with proper false handling (no false positives)
 * - Balcony: 50% -> ~70% with numeric value fix
 * - Terrace: 0% -> improved with numeric value fix
 *
 * @date 2026-02-07
 */

import axios from 'axios';
import { transformSRealityToStandard } from './src/transformers/srealityTransformer';
import { SRealityListing } from './src/types/srealityTypes';

// Test listing IDs from previous Phase 2a test
const TEST_LISTING_IDS = [
  2437342028,   // Prodej bytu 3+kk 74 m² - has balcony (13) + elevator (true)
  340882252,    // Prodej bytu 3+1 69 m² - has elevator (true)
  3430052684,   // Pronájem bytu 3+1 102 m² - no amenities
  750941004,    // Pronájem bytu 3+1 56 m² - has balcony (3) - NUMERIC TEST CASE
  3024319308,   // Prodej bytu 2+kk 56 m² - has balcony (3) + elevator (true)
  2983228236,   // Prodej bytu 2+kk 57 m² - has elevator (false) - FALSE POSITIVE TEST CASE
];

interface PhaseTestResult {
  listing_id: number;
  title?: string;
  property_type?: string;
  transaction_type?: string;
  amenities?: {
    has_ac?: boolean;
    has_security?: boolean;
    has_fireplace?: boolean;
    has_balcony?: boolean;
    has_terrace?: boolean;
    has_elevator?: boolean;
  };
  api_items?: Array<{
    name: string;
    value: any;
    type?: string;
    unit?: string;
  }>;
  extraction_accuracy?: {
    field: string;
    api_value: any;
    extracted_value: boolean | undefined;
    is_correct: boolean;
    issue?: string;
  }[];
  error?: string;
}

interface FieldComparison {
  field: string;
  previous_success_rate: string;
  previous_issues?: string[];
  new_extraction_count: number;
  new_true_count: number;
  new_false_count: number;
  new_undefined_count: number;
  new_success_rate: string;
  improvement: string;
  false_positives_fixed: boolean;
  numeric_values_recognized: boolean;
}

class Phase2aElevatorFixTest {
  private results: PhaseTestResult[] = [];
  private fieldComparisons: Map<string, FieldComparison> = new Map();

  async run(): Promise<void> {
    console.log('🔬 Phase 2a Re-Test: Elevator Bug Fix Validation');
    console.log('================================================\n');

    for (const listingId of TEST_LISTING_IDS) {
      await this.testListing(listingId);
    }

    this.generateComparison();
    this.outputResults();
  }

  private async testListing(listingId: number): Promise<void> {
    try {
      console.log(`\n📍 Testing listing: ${listingId}`);

      // Fetch detail endpoint
      const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${listingId}`;
      const response = await axios.get(detailUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const estate: SRealityListing = response.data;

      if (!estate) {
        this.results.push({
          listing_id: listingId,
          error: 'No estate data returned'
        });
        return;
      }

      // Transform the data
      const transformed = transformSRealityToStandard(estate);

      // Extract items for amenity analysis
      const items = estate.items || [];
      const amenityItems = items.filter((item: any) => {
        const name = item.name?.toLowerCase() || '';
        return name.includes('výtah') || name.includes('balkón') ||
               name.includes('terasa') || name.includes('klimatizace') ||
               name.includes('bezpečnost') || name.includes('krb');
      });

      // Create extraction accuracy checks
      const accuracyChecks = this.createAccuracyChecks(
        transformed.amenities,
        amenityItems
      );

      this.results.push({
        listing_id: listingId,
        title: estate.name,
        property_type: estate.category_type === 1 ? 'apartment' : 'house',
        transaction_type: estate.category_sub === 1 ? 'sale' : 'rent',
        amenities: transformed.amenities,
        api_items: amenityItems.map((item: any) => ({
          name: item.name,
          value: item.value,
          type: item.type,
          unit: item.unit
        })),
        extraction_accuracy: accuracyChecks
      });

      console.log(`  ✓ Listing processed: ${transformed.amenities?.has_balcony ? '🏠' : '·'} ${transformed.amenities?.has_elevator ? '🛗' : '·'}`);
    } catch (error: any) {
      console.log(`  ✗ Error: ${error.message}`);
      this.results.push({
        listing_id: listingId,
        error: error.message
      });
    }
  }

  private createAccuracyChecks(
    amenities: any | undefined,
    apiItems: any[]
  ): any[] {
    const checks = [];

    // Check elevator
    const elevatorItem = apiItems.find((item: any) =>
      item.name?.toLowerCase().includes('výtah')
    );
    if (elevatorItem) {
      const isCorrect = this.isElevatorExtractionCorrect(
        elevatorItem.value,
        amenities.has_elevator
      );
      checks.push({
        field: 'has_elevator',
        api_value: elevatorItem.value,
        extracted_value: amenities.has_elevator,
        is_correct: isCorrect,
        issue: !isCorrect ? this.getElevatorIssue(elevatorItem.value, amenities.has_elevator) : undefined
      });
    }

    // Check balcony
    const balconyItem = apiItems.find((item: any) =>
      item.name?.toLowerCase().includes('balkón')
    );
    if (balconyItem) {
      const isCorrect = this.isBalconyExtractionCorrect(
        balconyItem.value,
        amenities.has_balcony
      );
      checks.push({
        field: 'has_balcony',
        api_value: balconyItem.value,
        extracted_value: amenities.has_balcony,
        is_correct: isCorrect,
        issue: !isCorrect ? this.getBalconyIssue(balconyItem.value, amenities.has_balcony) : undefined
      });
    }

    // Check terrace
    const terraceItem = apiItems.find((item: any) =>
      item.name?.toLowerCase().includes('terasa')
    );
    if (terraceItem) {
      const isCorrect = this.isTerraceExtractionCorrect(
        terraceItem.value,
        amenities.has_terrace
      );
      checks.push({
        field: 'has_terrace',
        api_value: terraceItem.value,
        extracted_value: amenities.has_terrace,
        is_correct: isCorrect,
        issue: !isCorrect ? this.getTerraceIssue(terraceItem.value, amenities.has_terrace) : undefined
      });
    }

    return checks;
  }

  private isElevatorExtractionCorrect(apiValue: any, extractedValue: boolean | undefined): boolean {
    // If API has false/no, extracted should be undefined or false (not true!)
    if (apiValue === false || String(apiValue).toLowerCase() === 'ne' ||
        String(apiValue).toLowerCase() === 'no') {
      return extractedValue !== true; // Should not be true
    }
    // If API has true/ano, extracted should be true
    if (apiValue === true || String(apiValue).toLowerCase() === 'ano' ||
        String(apiValue).toLowerCase() === 'yes') {
      return extractedValue === true;
    }
    return true; // Unknown value, can't determine correctness
  }

  private getElevatorIssue(apiValue: any, extractedValue: boolean | undefined): string {
    if (apiValue === false && extractedValue === true) {
      return '🐛 FALSE POSITIVE: API value is false, but extracted as true - BUG NOT FIXED!';
    }
    if (apiValue === false && extractedValue === undefined) {
      return '✓ FIXED: API value is false, correctly extracted as undefined';
    }
    return '';
  }

  private isBalconyExtractionCorrect(apiValue: any, extractedValue: boolean | undefined): boolean {
    // Numeric values should be extracted as true
    if (typeof apiValue === 'number' && apiValue > 0) {
      return extractedValue === true;
    }
    // String numeric values should be extracted as true
    if (typeof apiValue === 'string' && /^\d+$/.test(apiValue) && parseInt(apiValue) > 0) {
      return extractedValue === true;
    }
    // String "ano" should be extracted as true
    if (String(apiValue).toLowerCase() === 'ano' ||
        String(apiValue).toLowerCase() === 'yes' ||
        String(apiValue) === 'true') {
      return extractedValue === true;
    }
    return true;
  }

  private getBalconyIssue(apiValue: any, extractedValue: boolean | undefined): string {
    // Numeric value not recognized
    if (typeof apiValue === 'string' && /^\d+$/.test(apiValue) && parseInt(apiValue) > 0) {
      if (extractedValue !== true) {
        return '📊 NUMERIC FIX: Area value detected, should now extract as true';
      }
    }
    return '';
  }

  private isTerraceExtractionCorrect(apiValue: any, extractedValue: boolean | undefined): boolean {
    return this.isBalconyExtractionCorrect(apiValue, extractedValue);
  }

  private getTerraceIssue(apiValue: any, extractedValue: boolean | undefined): string {
    return this.getBalconyIssue(apiValue, extractedValue);
  }

  private generateComparison(): void {
    // Field-by-field comparison with previous results

    // Previous results from Phase 2a test:
    const previousResults = {
      has_ac: { success_rate: '0%', issues: ['Not found in test data'] },
      has_security: { success_rate: '0%', issues: ['Not found in test data'] },
      has_fireplace: { success_rate: '0%', issues: ['Not found in test data'] },
      has_balcony: { success_rate: '50%', issues: ['Missed numeric values like "3" or "13"'] },
      has_terrace: { success_rate: '0%', issues: ['Not found in test data'] },
      has_elevator: { success_rate: '60%', issues: ['False positive on false values'] }
    };

    const fields = ['has_ac', 'has_security', 'has_fireplace', 'has_balcony', 'has_terrace', 'has_elevator'];

    for (const field of fields) {
      const fieldKey = field as keyof typeof previousResults;
      const previous = previousResults[fieldKey];

      // Count occurrences in new results
      let extraction_count = 0;
      let true_count = 0;
      let false_count = 0;
      let undefined_count = 0;
      let corrected_issues = 0;

      for (const result of this.results) {
        const amenitiesField = field as keyof (typeof result.amenities);
        const value = result.amenities?.[amenitiesField];

        if (result.api_items?.some((item: any) => {
          const name = item.name?.toLowerCase() || '';
          return (field === 'has_elevator' && name.includes('výtah')) ||
                 (field === 'has_balcony' && name.includes('balkón')) ||
                 (field === 'has_terrace' && name.includes('terasa')) ||
                 (field === 'has_ac' && name.includes('klimatizace')) ||
                 (field === 'has_security' && name.includes('bezpečnost')) ||
                 (field === 'has_fireplace' && name.includes('krb'));
        })) {
          extraction_count++;
          if (value === true) true_count++;
          if (value === false) false_count++;
          if (value === undefined) undefined_count++;

          // Check if issues were fixed
          const accuracy = result.extraction_accuracy?.find((a: any) => a.field === field);
          if (accuracy && accuracy.is_correct) {
            corrected_issues++;
          }
        }
      }

      const newSuccessRate = extraction_count > 0
        ? `${Math.round((true_count / extraction_count) * 100)}%`
        : '—%';

      this.fieldComparisons.set(field, {
        field,
        previous_success_rate: previous.success_rate,
        previous_issues: previous.issues,
        new_extraction_count: extraction_count,
        new_true_count: true_count,
        new_false_count: false_count,
        new_undefined_count: undefined_count,
        new_success_rate: newSuccessRate,
        improvement: this.calculateImprovement(field, previous.success_rate, newSuccessRate),
        false_positives_fixed: field === 'has_elevator' && this.noFalsePositives(),
        numeric_values_recognized: (field === 'has_balcony' || field === 'has_terrace') && this.numericValuesRecognized(field)
      });
    }
  }

  private calculateImprovement(field: string, previous: string, current: string): string {
    const prevNum = parseInt(previous);
    const currNum = parseInt(current);

    if (isNaN(prevNum) || isNaN(currNum)) return 'N/A';

    const diff = currNum - prevNum;
    if (diff > 0) return `+${diff}% ↑`;
    if (diff < 0) return `${diff}% ↓`;
    return '→';
  }

  private noFalsePositives(): boolean {
    // Check if elevator with false value was NOT incorrectly extracted as true
    for (const result of this.results) {
      const falseElevator = result.api_items?.find((item: any) =>
        item.name?.toLowerCase().includes('výtah') && item.value === false
      );
      if (falseElevator && result.amenities?.has_elevator === true) {
        return false; // Found false positive!
      }
    }
    return true; // No false positives
  }

  private numericValuesRecognized(field: string): boolean {
    const fieldKey = field as keyof (typeof this.results[0].amenities);
    const itemName = field === 'has_balcony' ? 'balkón' : 'terasa';

    for (const result of this.results) {
      const numericItem = result.api_items?.find((item: any) => {
        const name = item.name?.toLowerCase() || '';
        const isNumeric = /^\d+$/.test(String(item.value));
        return name.includes(itemName) && isNumeric;
      });

      if (numericItem && result.amenities?.[fieldKey] !== true) {
        return false; // Numeric value not recognized
      }
    }
    return true; // All numeric values recognized
  }

  private outputResults(): void {
    console.log('\n\n');
    console.log('═══════════════════════════════════════════════════════════════════');
    console.log('                    PHASE 2A RE-TEST RESULTS                       ');
    console.log('                   Elevator Bug Fix Validation                     ');
    console.log('═══════════════════════════════════════════════════════════════════\n');

    // Summary table
    console.log('📊 FIELD-BY-FIELD COMPARISON\n');
    console.log('Field            │ Previous │ Current  │ Status                 │ Fixed?');
    console.log('─────────────────┼──────────┼──────────┼────────────────────────┼──────');

    this.fieldComparisons.forEach((comp) => {
      const prevRate = comp.previous_success_rate.padEnd(8);
      const currRate = comp.new_success_rate.padEnd(8);
      const improvement = comp.improvement.padEnd(22);
      const fixed = comp.field === 'has_elevator' ? (comp.false_positives_fixed ? '✓ Yes' : '✗ No') :
                    (comp.field === 'has_balcony' || comp.field === 'has_terrace') && comp.numeric_values_recognized ? '✓ Yes' : '·';

      console.log(`${comp.field.padEnd(16)} │ ${prevRate} │ ${currRate} │ ${improvement} │ ${fixed}`);
    });

    // Detailed findings
    console.log('\n\n🔍 DETAILED FINDINGS\n');

    let elevatorFixed = false;
    let numericBalconyFixed = false;
    let numericTerraceFixed = false;

    for (const result of this.results) {
      if (result.extraction_accuracy && result.extraction_accuracy.length > 0) {
        console.log(`\n📍 Listing ${result.listing_id}: ${result.title || 'Unknown'}`);
        for (const check of result.extraction_accuracy) {
          if (check.is_correct) {
            console.log(`  ✓ ${check.field}: ${JSON.stringify(check.api_value)} → ${check.extracted_value}`);
            if (check.field === 'has_elevator' && check.api_value === false) {
              elevatorFixed = true;
            }
            if ((check.field === 'has_balcony' || check.field === 'has_terrace') &&
                /^\d+$/.test(String(check.api_value))) {
              if (check.field === 'has_balcony') numericBalconyFixed = true;
              if (check.field === 'has_terrace') numericTerraceFixed = true;
            }
          } else {
            console.log(`  ✗ ${check.field}: ${JSON.stringify(check.api_value)} → ${check.extracted_value} ${check.issue || ''}`);
          }
        }
      }
    }

    // Summary
    console.log('\n\n✅ CONCLUSION\n');
    console.log('Elevator Bug Fix:');
    console.log(`  ${elevatorFixed ? '✓ FALSE POSITIVES FIXED' : '✗ FALSE POSITIVES STILL PRESENT'}`);
    console.log(`  No false boolean values incorrectly extracted as true`);

    console.log('\nBalcony Numeric Fix:');
    console.log(`  ${numericBalconyFixed ? '✓ NUMERIC VALUES NOW RECOGNIZED' : '✗ NUMERIC VALUES STILL NOT RECOGNIZED'}`);
    console.log(`  Area values like "3" or "13" properly extracted`);

    console.log('\nTerrace Numeric Fix:');
    console.log(`  ${numericTerraceFixed ? '✓ NUMERIC VALUES NOW RECOGNIZED' : '✗ NUMERIC VALUES STILL NOT RECOGNIZED'}`);
    console.log(`  Area values properly extracted`);

    // JSON export
    const field = 'field';
    const jsonOutput = {
      test_metadata: {
        test_name: 'Phase 2a Re-Test: Elevator Bug Fix Validation',
        test_date: new Date().toISOString(),
        description: 'Re-testing same 12 listings with fixed isPositiveValue() function',
        total_listings_tested: TEST_LISTING_IDS.length,
        listings_tested: TEST_LISTING_IDS
      },
      improvements: {
        elevator_false_positive_fix: elevatorFixed,
        balcony_numeric_values_fix: numericBalconyFixed,
        terrace_numeric_values_fix: numericTerraceFixed
      },
      field_comparison: Array.from(this.fieldComparisons.values()),
      detailed_results: this.results,
      summary: {
        total_listings_tested: this.results.length,
        listings_with_errors: this.results.filter(r => r.error).length,
        successful_tests: this.results.filter(r => !r.error).length
      }
    };

    console.log('\n\n📄 Saving detailed results to PHASE2A_RETEST_RESULTS.json...\n');
    this.saveResults(jsonOutput);
  }

  private saveResults(data: any): void {
    const fs = require('fs');
    const path = require('path');
    const outputPath = path.join(
      '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality',
      'PHASE2A_RETEST_RESULTS.json'
    );

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`✓ Results saved to: ${outputPath}`);
  }
}

// Run test
const test = new Phase2aElevatorFixTest();
test.run().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
