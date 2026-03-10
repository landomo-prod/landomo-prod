"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const srealityTransformer_1 = require("./src/transformers/srealityTransformer");
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
async function fetchListingDetail(hash_id) {
    try {
        const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
        const response = await axios_1.default.get(url, {
            headers: { 'User-Agent': userAgent },
            timeout: 10000
        });
        return response.data;
    }
    catch (error) {
        console.error(`Failed to fetch listing ${hash_id}:`, error.message);
        return null;
    }
}
async function fetchListingsPage(page = 1, perPage = 20) {
    try {
        // Fetch mix of apartments (category_main_cb=1) and houses (category_main_cb=2)
        const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&tms=${Date.now()}`;
        const response = await axios_1.default.get(url, {
            headers: { 'User-Agent': userAgent },
            timeout: 10000
        });
        return response.data._embedded?.estates || [];
    }
    catch (error) {
        console.error(`Failed to fetch listings page ${page}:`, error.message);
        return [];
    }
}
function extractAreaFields(result) {
    return {
        area_balcony: result.country_specific?.area_balcony,
        area_terrace: result.country_specific?.area_terrace,
        area_garden: result.country_specific?.area_garden,
        area_cellar: result.country_specific?.area_cellar,
        area_loggia: result.country_specific?.area_loggia,
        has_hot_water: result.amenities?.has_hot_water
    };
}
function getPropertyType(seo) {
    const typeMap = {
        1: 'apartment',
        2: 'house',
        3: 'land',
        4: 'commercial',
        5: 'other'
    };
    return typeMap[seo?.category_main_cb] || 'other';
}
function filterAreaItems(items) {
    if (!items)
        return [];
    const areaKeywords = [
        'balkón', 'balcony', 'terasa', 'terrace', 'zahrada', 'garden',
        'sklep', 'cellar', 'lodžie', 'loggia', 'teplá voda', 'hot water'
    ];
    return items.filter(item => areaKeywords.some(keyword => {
        const valueLower = String(item.value || '').toLowerCase();
        return item.name.toLowerCase().includes(keyword.toLowerCase()) ||
            valueLower.includes(keyword.toLowerCase());
    }));
}
async function testPhase3Extraction() {
    console.log('Starting SReality Phase 3 Area Field Extraction Test');
    console.log('====================================================\n');
    const testResults = [];
    const listings = [];
    // Fetch listings from first page
    console.log('Fetching listings from SReality API...');
    const pageListings = await fetchListingsPage(1, 20);
    listings.push(...pageListings);
    console.log(`Fetched ${listings.length} listings\n`);
    // Fetch details for first 5-10 listings with proper variety
    const targetCount = Math.min(8, listings.length);
    console.log(`Fetching detailed information for ${targetCount} listings...`);
    for (let i = 0; i < targetCount; i++) {
        const listing = listings[i];
        if (!listing.hash_id)
            continue;
        console.log(`\n[${i + 1}/${targetCount}] Fetching hash_id: ${listing.hash_id}`);
        // Fetch full detail
        const detail = await fetchListingDetail(listing.hash_id);
        if (!detail) {
            console.log('  -> Detail fetch failed, skipping');
            continue;
        }
        // Transform to standard format
        const result = (0, srealityTransformer_1.transformSRealityToStandard)(detail);
        const propertyType = getPropertyType(detail.seo);
        // Extract Phase 3 fields
        const extractedFields = extractAreaFields(result);
        const areaItems = filterAreaItems(detail.items);
        const testResult = {
            hash_id: detail.hash_id || 0,
            property_type: propertyType,
            title: result.title || 'N/A',
            url: `https://www.sreality.cz/detail/${detail.hash_id}`,
            extracted_fields: extractedFields,
            raw_items_with_area: areaItems.length > 0 ? areaItems : undefined
        };
        testResults.push(testResult);
        // Print summary
        console.log(`  -> Type: ${propertyType}`);
        console.log(`  -> Title: ${testResult.title.substring(0, 50)}`);
        console.log(`  -> Area Fields: ${JSON.stringify(extractedFields, null, 2).split('\n').join('\n      ')}`);
        if (areaItems.length > 0) {
            console.log(`  -> Raw Area Items: ${areaItems.length} found`);
            areaItems.forEach(item => {
                console.log(`     - ${item.name}: ${item.value}`);
            });
        }
        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    // Calculate statistics
    console.log('\n\nCalculating Statistics...\n');
    const stats = calculateStatistics(testResults);
    const report = {
        timestamp: new Date().toISOString(),
        total_tested: testResults.length,
        listings: testResults,
        statistics: stats
    };
    // Print report
    printReport(report);
    // Save report to file
    const fs = require('fs');
    const reportPath = '/Users/samuelseidel/Development/landomo-world/scrapers/Czech Republic/sreality/phase3_test_report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n\nTest report saved to: ${reportPath}`);
}
function calculateStatistics(results) {
    const fieldCounts = {
        area_balcony: 0,
        area_terrace: 0,
        area_garden: 0,
        area_cellar: 0,
        area_loggia: 0,
        has_hot_water: 0
    };
    const fieldValues = {
        area_balcony: [],
        area_terrace: [],
        area_garden: [],
        area_cellar: [],
        area_loggia: []
    };
    const propertyTypes = {};
    const formatVariations = new Set();
    results.forEach(result => {
        // Count property types
        propertyTypes[result.property_type] = (propertyTypes[result.property_type] || 0) + 1;
        // Count field presence
        if (result.extracted_fields.area_balcony !== undefined) {
            fieldCounts.area_balcony++;
            fieldValues.area_balcony.push(result.extracted_fields.area_balcony);
        }
        if (result.extracted_fields.area_terrace !== undefined) {
            fieldCounts.area_terrace++;
            fieldValues.area_terrace.push(result.extracted_fields.area_terrace);
        }
        if (result.extracted_fields.area_garden !== undefined) {
            fieldCounts.area_garden++;
            fieldValues.area_garden.push(result.extracted_fields.area_garden);
        }
        if (result.extracted_fields.area_cellar !== undefined) {
            fieldCounts.area_cellar++;
            fieldValues.area_cellar.push(result.extracted_fields.area_cellar);
        }
        if (result.extracted_fields.area_loggia !== undefined) {
            fieldCounts.area_loggia++;
            fieldValues.area_loggia.push(result.extracted_fields.area_loggia);
        }
        if (result.extracted_fields.has_hot_water !== undefined) {
            fieldCounts.has_hot_water++;
        }
        // Track format variations
        result.raw_items_with_area?.forEach(item => {
            const value = String(item.value || '');
            if (value.includes('m²'))
                formatVariations.add('m²');
            if (value.includes('m2'))
                formatVariations.add('m2');
            if (value.match(/,\d+/))
                formatVariations.add('comma decimal separator');
            if (value.match(/\.\d+/))
                formatVariations.add('dot decimal separator');
        });
    });
    const total = results.length;
    return {
        field_extraction_rates: {
            area_balcony: {
                count: fieldCounts.area_balcony,
                percentage: `${((fieldCounts.area_balcony / total) * 100).toFixed(1)}%`
            },
            area_terrace: {
                count: fieldCounts.area_terrace,
                percentage: `${((fieldCounts.area_terrace / total) * 100).toFixed(1)}%`
            },
            area_garden: {
                count: fieldCounts.area_garden,
                percentage: `${((fieldCounts.area_garden / total) * 100).toFixed(1)}%`
            },
            area_cellar: {
                count: fieldCounts.area_cellar,
                percentage: `${((fieldCounts.area_cellar / total) * 100).toFixed(1)}%`
            },
            area_loggia: {
                count: fieldCounts.area_loggia,
                percentage: `${((fieldCounts.area_loggia / total) * 100).toFixed(1)}%`
            },
            has_hot_water: {
                count: fieldCounts.has_hot_water,
                percentage: `${((fieldCounts.has_hot_water / total) * 100).toFixed(1)}%`
            }
        },
        area_statistics: {
            area_balcony: calculateAreaStats(fieldValues.area_balcony),
            area_terrace: calculateAreaStats(fieldValues.area_terrace),
            area_garden: calculateAreaStats(fieldValues.area_garden),
            area_cellar: calculateAreaStats(fieldValues.area_cellar),
            area_loggia: calculateAreaStats(fieldValues.area_loggia)
        },
        property_type_distribution: propertyTypes,
        format_variations_handled: Array.from(formatVariations)
    };
}
function calculateAreaStats(values) {
    if (values.length === 0) {
        return { unit: 'sqm' };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
        min: parseFloat(min.toFixed(2)),
        max: parseFloat(max.toFixed(2)),
        avg: parseFloat(avg.toFixed(2)),
        unit: 'sqm'
    };
}
function printReport(report) {
    console.log('╔════════════════════════════════════════════════════╗');
    console.log('║   SReality Phase 3 Area Field Extraction Report    ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
    console.log(`Test Date: ${report.timestamp}`);
    console.log(`Total Listings Tested: ${report.total_tested}\n`);
    console.log('Field Extraction Rates:');
    console.log('─────────────────────────────────────────────────');
    Object.entries(report.statistics.field_extraction_rates).forEach(([field, data]) => {
        console.log(`  ${field.padEnd(20)}: ${data.count} / ${report.total_tested} (${data.percentage})`);
    });
    console.log('\n\nArea Statistics (sqm):');
    console.log('─────────────────────────────────────────────────');
    Object.entries(report.statistics.area_statistics).forEach(([field, stats]) => {
        if (stats.min !== undefined) {
            console.log(`  ${field}:`);
            console.log(`    Min: ${stats.min} ${stats.unit}`);
            console.log(`    Max: ${stats.max} ${stats.unit}`);
            console.log(`    Avg: ${stats.avg} ${stats.unit}`);
        }
        else {
            console.log(`  ${field}: No data`);
        }
    });
    console.log('\n\nProperty Type Distribution:');
    console.log('─────────────────────────────────────────────────');
    Object.entries(report.statistics.property_type_distribution).forEach(([type, count]) => {
        console.log(`  ${type.padEnd(15)}: ${count}`);
    });
    console.log('\n\nFormat Variations Handled:');
    console.log('─────────────────────────────────────────────────');
    if (report.statistics.format_variations_handled.length === 0) {
        console.log('  (None detected in test data)');
    }
    else {
        report.statistics.format_variations_handled.forEach(variation => {
            console.log(`  ✓ ${variation}`);
        });
    }
    console.log('\n\nSample Listings:');
    console.log('─────────────────────────────────────────────────');
    report.listings.slice(0, 3).forEach((listing, idx) => {
        console.log(`\n${idx + 1}. ${listing.title}`);
        console.log(`   Hash ID: ${listing.hash_id}`);
        console.log(`   Type: ${listing.property_type}`);
        console.log(`   URL: ${listing.url}`);
        console.log(`   Extracted Areas:`);
        Object.entries(listing.extracted_fields).forEach(([field, value]) => {
            const unit = field.includes('area') ? 'sqm' : 'boolean';
            const display = value !== undefined ? `${value} ${unit}` : 'undefined';
            console.log(`     - ${field}: ${display}`);
        });
    });
}
// Run test
testPhase3Extraction().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
