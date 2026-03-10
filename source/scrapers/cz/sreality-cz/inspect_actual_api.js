"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
async function inspectAPI() {
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
    try {
        // Fetch from list endpoint first
        const tms = Date.now();
        const listUrl = `https://www.sreality.cz/api/cs/v2/estates?page=1&per_page=1&category_main_cb=1&tms=${tms}`;
        console.log('Fetching from list endpoint...');
        const listResponse = await axios_1.default.get(listUrl, {
            headers: { 'User-Agent': userAgent },
            timeout: 15000
        });
        const firstListing = listResponse.data._embedded?.estates?.[0];
        if (firstListing) {
            console.log('\n=== LISTING FROM LIST ENDPOINT ===');
            console.log(JSON.stringify(firstListing, null, 2).substring(0, 2000));
            // Now fetch the detail endpoint
            const detailUrl = `https://www.sreality.cz/api/cs/v2/estates/${firstListing.hash_id}`;
            console.log(`\n\nFetching detail endpoint for hash_id ${firstListing.hash_id}...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            const detailResponse = await axios_1.default.get(detailUrl, {
                headers: { 'User-Agent': userAgent },
                timeout: 15000
            });
            console.log('\n=== LISTING FROM DETAIL ENDPOINT ===');
            console.log(JSON.stringify(detailResponse.data, null, 2).substring(0, 3000));
            // Show structure
            console.log('\n\n=== STRUCTURE ANALYSIS ===');
            console.log('List endpoint keys:', Object.keys(firstListing).join(', '));
            console.log('List endpoint has items:', !!firstListing.items);
            console.log('List endpoint has _embedded:', !!firstListing._embedded);
            console.log('List endpoint has locality:', !!firstListing.locality);
            console.log('\nDetail endpoint keys:', Object.keys(detailResponse.data).join(', '));
            console.log('Detail endpoint has items:', !!detailResponse.data.items);
            console.log('Detail endpoint has _embedded:', !!detailResponse.data._embedded);
            console.log('Detail endpoint has locality:', !!detailResponse.data.locality);
            if (detailResponse.data.items) {
                console.log('\nSample items from detail endpoint:');
                detailResponse.data.items.slice(0, 3).forEach((item) => {
                    console.log(`  - ${item.name}: ${item.value}`);
                });
            }
        }
    }
    catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
    }
}
inspectAPI();
