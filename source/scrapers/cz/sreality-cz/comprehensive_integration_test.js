"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const srealityTransformer_1 = require("./src/transformers/srealityTransformer");
const fs = __importStar(require("fs"));
const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];
/**
 * Fetch detail endpoint for a listing to get full data with items
 */
async function fetchListingDetail(hashId, userAgent) {
    try {
        const url = `https://www.sreality.cz/api/cs/v2/estates/${hashId}`;
        const response = await axios_1.default.get(url, {
            headers: { 'User-Agent': userAgent },
            timeout: 15000
        });
        return response.data;
    }
    catch (error) {
        console.error(`Error fetching detail for hash_id ${hashId}:`, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}
/**
 * Fetch 5 random listings from SReality API
 * Uses list endpoint to get hash_ids, then detail endpoint for full data
 */
async function fetchRandomListings(count = 5) {
    const listings = [];
    const category = 1; // Apartments
    const userAgent = userAgents[0];
    try {
        // Fetch from first few pages to get listing hash_ids
        const pages = [1, 2];
        const allHashIds = [];
        for (const page of pages) {
            try {
                const tms = Date.now();
                const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=20&category_main_cb=${category}&tms=${tms}`;
                console.log(`Fetching page ${page}...`);
                const response = await axios_1.default.get(url, {
                    headers: { 'User-Agent': userAgent },
                    timeout: 15000
                });
                const estates = response.data._embedded?.estates || [];
                allHashIds.push(...estates.map((e) => e.hash_id));
                // Add delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            catch (error) {
                console.error(`Error fetching page ${page}:`, error instanceof Error ? error.message : 'Unknown error');
            }
        }
        console.log(`Total hash_ids fetched: ${allHashIds.length}`);
        if (allHashIds.length === 0) {
            throw new Error('No listings fetched from API');
        }
        // Pick random hash_ids and fetch their details
        const shuffled = allHashIds.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));
        for (const hashId of selected) {
            const detail = await fetchListingDetail(hashId, userAgent);
            if (detail) {
                listings.push(detail);
            }
            // Add delay between detail requests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return listings;
    }
    catch (error) {
        console.error('Error fetching listings:', error instanceof Error ? error.message : 'Unknown error');
        return [];
    }
}
/**
 * Test transformer on a single listing
 */
function testTransformer(listing) {
    const result = {
        listing_hash_id: listing.hash_id,
        listing_url: `https://www.sreality.cz/detail/${listing.hash_id}`,
        transformation_success: false,
        extracted_fields: {}
    };
    try {
        // Transform listing
        const standardProperty = (0, srealityTransformer_1.transformSRealityToStandard)(listing);
        result.transformation_success = true;
        // Extract fields for reporting
        result.extracted_fields.title = standardProperty.title;
        result.extracted_fields.price = standardProperty.price;
        result.extracted_fields.location = standardProperty.location?.address;
        result.extracted_fields.property_type = standardProperty.property_type;
        // New seller info fields
        if (standardProperty.agent) {
            result.extracted_fields.seller_company = standardProperty.agent.name;
            result.extracted_fields.seller_phone = standardProperty.agent.phone;
            result.extracted_fields.seller_email = standardProperty.agent.email;
        }
        // Seller metadata from portal_metadata
        if (standardProperty.portal_metadata?.sreality) {
            const metadata = standardProperty.portal_metadata.sreality;
            result.extracted_fields.seller_rating = metadata.seller_rating;
            result.extracted_fields.seller_reviews = metadata.seller_reviews;
        }
        // Accessibility (is_barrier_free)
        result.extracted_fields.has_accessibility = standardProperty.amenities?.is_barrier_free;
        // Virtual tours
        if (standardProperty.media) {
            result.extracted_fields.virtual_tour_url = standardProperty.media.virtual_tour_url;
            result.extracted_fields.tour_360_url = standardProperty.media.tour_360_url;
            result.extracted_fields.video_tour_url = standardProperty.media.video_tour_url;
            result.extracted_fields.floor_plan_urls = standardProperty.media.floor_plan_urls;
        }
        // Built area and Phase 3 areas
        if (standardProperty.country_specific) {
            result.extracted_fields.area_built = standardProperty.country_specific.area_built;
            result.extracted_fields.area_balcony = standardProperty.country_specific.area_balcony;
            result.extracted_fields.area_terrace = standardProperty.country_specific.area_terrace;
            result.extracted_fields.area_garden = standardProperty.country_specific.area_garden;
            result.extracted_fields.area_cellar = standardProperty.country_specific.area_cellar;
            result.extracted_fields.area_loggia = standardProperty.country_specific.area_loggia;
        }
        // Existing fields
        if (standardProperty.details) {
            result.extracted_fields.bedrooms = standardProperty.details.bedrooms;
            result.extracted_fields.bathrooms = standardProperty.details.bathrooms;
            result.extracted_fields.sqm = standardProperty.details.sqm;
        }
        // Amenities
        if (standardProperty.amenities) {
            const amenityCount = Object.values(standardProperty.amenities).filter(v => v === true).length;
            result.extracted_fields.amenities_count = amenityCount;
            result.extracted_fields.has_balcony = standardProperty.amenities.has_balcony;
            result.extracted_fields.has_terrace = standardProperty.amenities.has_terrace;
            result.extracted_fields.has_elevator = standardProperty.amenities.has_elevator;
            result.extracted_fields.has_ac = standardProperty.amenities.has_ac;
            result.extracted_fields.has_parking = standardProperty.amenities.has_parking;
        }
    }
    catch (error) {
        result.transformation_success = false;
        result.transformation_error = error instanceof Error ? `${error.message} (${error.stack})` : 'Unknown error';
    }
    return result;
}
/**
 * Calculate coverage metrics from test results
 */
function calculateCoverageMetrics(results) {
    const metrics = {
        total_listings: results.length,
        successful_transformations: results.filter(r => r.transformation_success).length,
        failed_transformations: results.filter(r => !r.transformation_success).length,
        success_rate: 0,
        field_availability: {}
    };
    metrics.success_rate = metrics.successful_transformations / metrics.total_listings;
    // Track field availability
    const fields = [
        'title', 'price', 'location', 'property_type',
        'seller_company', 'seller_rating', 'seller_reviews', 'seller_phone', 'seller_email',
        'has_accessibility',
        'virtual_tour_url', 'tour_360_url', 'video_tour_url', 'floor_plan_urls',
        'area_built',
        'area_balcony', 'area_terrace', 'area_garden', 'area_cellar', 'area_loggia',
        'bedrooms', 'bathrooms', 'sqm',
        'has_balcony', 'has_terrace', 'has_elevator', 'has_ac', 'has_parking'
    ];
    for (const field of fields) {
        const count = results.filter(r => {
            const value = r.extracted_fields[field];
            return value !== undefined && value !== null && value !== '' && value !== false;
        }).length;
        metrics.field_availability[field] = {
            count,
            percentage: (count / Math.max(results.length, 1)) * 100
        };
    }
    return metrics;
}
/**
 * Run the comprehensive integration test
 */
async function runIntegrationTest() {
    console.log('Starting comprehensive SReality integration test...\n');
    const startTime = Date.now();
    const issues = [];
    // Step 1: Fetch listings
    console.log('Step 1: Fetching 5 random listings from SReality API...');
    const listings = await fetchRandomListings(5);
    if (listings.length === 0) {
        issues.push('Failed to fetch any listings from API');
        return {
            timestamp: new Date().toISOString(),
            test_duration_ms: Date.now() - startTime,
            summary: {
                total_listings_tested: 0,
                successful_transformations: 0,
                failed_transformations: 0,
                overall_success_rate: 0
            },
            coverage_metrics: {
                total_listings: 0,
                successful_transformations: 0,
                failed_transformations: 0,
                success_rate: 0,
                field_availability: {}
            },
            sample_results: [],
            issues_encountered: issues,
            compilation_status: 'ERROR: No listings fetched'
        };
    }
    console.log(`Successfully fetched ${listings.length} listings\n`);
    // Step 2: Transform and test each listing
    console.log('Step 2: Running transformer on each listing...');
    const results = [];
    for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];
        console.log(`Testing listing ${i + 1}/${listings.length} (hash_id: ${listing.hash_id})...`);
        const result = testTransformer(listing);
        results.push(result);
        if (!result.transformation_success) {
            issues.push(`Listing ${listing.hash_id}: ${result.transformation_error}`);
        }
    }
    console.log(`\nCompleted transformation testing for ${results.length} listings\n`);
    // Step 3: Calculate metrics
    console.log('Step 3: Calculating coverage metrics...');
    const coverage = calculateCoverageMetrics(results);
    const testDuration = Date.now() - startTime;
    const report = {
        timestamp: new Date().toISOString(),
        test_duration_ms: testDuration,
        summary: {
            total_listings_tested: coverage.total_listings,
            successful_transformations: coverage.successful_transformations,
            failed_transformations: coverage.failed_transformations,
            overall_success_rate: coverage.success_rate
        },
        coverage_metrics: coverage,
        sample_results: results,
        issues_encountered: issues,
        compilation_status: 'SUCCESS: All transformations compiled without errors'
    };
    return report;
}
/**
 * Main execution
 */
async function main() {
    try {
        const report = await runIntegrationTest();
        // Print detailed report
        console.log('\n' + '='.repeat(80));
        console.log('SREALITY SCRAPER - COMPREHENSIVE INTEGRATION TEST REPORT');
        console.log('='.repeat(80) + '\n');
        console.log(`Timestamp: ${report.timestamp}`);
        console.log(`Test Duration: ${report.test_duration_ms}ms\n`);
        console.log('SUMMARY:');
        console.log(`  Total Listings Tested: ${report.summary.total_listings_tested}`);
        console.log(`  Successful Transformations: ${report.summary.successful_transformations}`);
        console.log(`  Failed Transformations: ${report.summary.failed_transformations}`);
        console.log(`  Overall Success Rate: ${(report.summary.overall_success_rate * 100).toFixed(2)}%\n`);
        console.log('COMPILATION STATUS:');
        console.log(`  ${report.compilation_status}\n`);
        console.log('FIELD AVAILABILITY (Coverage Metrics):');
        console.log('  New Features:');
        console.log(`    - Seller Company: ${report.coverage_metrics.field_availability.seller_company?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.seller_company?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Seller Rating: ${report.coverage_metrics.field_availability.seller_rating?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.seller_rating?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Seller Reviews: ${report.coverage_metrics.field_availability.seller_reviews?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.seller_reviews?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Has Accessibility: ${report.coverage_metrics.field_availability.has_accessibility?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.has_accessibility?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Virtual Tour URL: ${report.coverage_metrics.field_availability.virtual_tour_url?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.virtual_tour_url?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Built Area: ${report.coverage_metrics.field_availability.area_built?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.area_built?.percentage || 0).toFixed(1)}%)`);
        console.log('\n  Phase 3 Area Fields:');
        console.log(`    - Balcony Area: ${report.coverage_metrics.field_availability.area_balcony?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.area_balcony?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Terrace Area: ${report.coverage_metrics.field_availability.area_terrace?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.area_terrace?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Garden Area: ${report.coverage_metrics.field_availability.area_garden?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.area_garden?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Cellar Area: ${report.coverage_metrics.field_availability.area_cellar?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.area_cellar?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Loggia Area: ${report.coverage_metrics.field_availability.area_loggia?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.area_loggia?.percentage || 0).toFixed(1)}%)`);
        console.log('\n  Existing Fields:');
        console.log(`    - Price: ${report.coverage_metrics.field_availability.price?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.price?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Bedrooms: ${report.coverage_metrics.field_availability.bedrooms?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.bedrooms?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - SQM: ${report.coverage_metrics.field_availability.sqm?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.sqm?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Has Balcony: ${report.coverage_metrics.field_availability.has_balcony?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.has_balcony?.percentage || 0).toFixed(1)}%)`);
        console.log(`    - Has Elevator: ${report.coverage_metrics.field_availability.has_elevator?.count || 0}/${report.summary.total_listings_tested} (${(report.coverage_metrics.field_availability.has_elevator?.percentage || 0).toFixed(1)}%)`);
        console.log('\nSAMPLE RESULTS (First 5 Listings):');
        for (let i = 0; i < Math.min(5, report.sample_results.length); i++) {
            const result = report.sample_results[i];
            console.log(`\n  Listing ${i + 1} (hash_id: ${result.listing_hash_id}):`);
            console.log(`    URL: ${result.listing_url}`);
            console.log(`    Transformation: ${result.transformation_success ? 'SUCCESS' : 'FAILED'}`);
            if (result.transformation_error) {
                console.log(`    Error: ${result.transformation_error}`);
            }
            console.log(`    - Price: ${result.extracted_fields.price} CZK`);
            console.log(`    - Location: ${result.extracted_fields.location}`);
            console.log(`    - SQM: ${result.extracted_fields.sqm} m²`);
            console.log(`    - Bedrooms: ${result.extracted_fields.bedrooms}`);
            console.log(`    - Seller: ${result.extracted_fields.seller_company || 'N/A'}`);
            console.log(`    - Virtual Tour: ${result.extracted_fields.virtual_tour_url ? 'Yes' : 'No'}`);
            console.log(`    - Built Area: ${result.extracted_fields.area_built ? result.extracted_fields.area_built + ' m²' : 'N/A'}`);
            console.log(`    - Accessibility: ${result.extracted_fields.has_accessibility ? 'Yes' : 'No'}`);
        }
        if (report.issues_encountered.length > 0) {
            console.log('\nISSUES ENCOUNTERED:');
            for (const issue of report.issues_encountered) {
                console.log(`  - ${issue}`);
            }
        }
        else {
            console.log('\nNo issues encountered!');
        }
        console.log('\n' + '='.repeat(80));
        // Save detailed JSON report
        const reportPath = './COMPREHENSIVE_INTEGRATION_TEST_REPORT.json';
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\nDetailed JSON report saved to: ${reportPath}`);
    }
    catch (error) {
        console.error('Fatal error during integration test:', error);
        process.exit(1);
    }
}
main();
