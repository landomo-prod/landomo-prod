"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchAllListingPages = exports.fetchCategoryData = exports.fetchEstateDetail = exports.fetchDataWithRetry = void 0;
const axios_1 = __importDefault(require("axios"));
const headers_1 = require("./headers");
/**
 * Fetch data from API with retry logic and exponential backoff
 */
const fetchDataWithRetry = async (url, headers, retries = 3) => {
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await axios_1.default.get(url, {
                headers,
                timeout: 30000 // 30 second timeout
            });
            return response.data;
        }
        catch (error) {
            const axiosError = error;
            // Don't retry on 4xx errors (client errors) — except 429 (rate limit)
            if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500 && axiosError.response.status !== 429) {
                throw error;
            }
            // On last attempt, throw the error
            if (attempt === retries - 1) {
                throw error;
            }
            // Exponential backoff with jitter
            const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
            console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Retrying request', attempt: attempt + 1, retries, delayMs, url }));
            await delay(delayMs);
        }
    }
};
exports.fetchDataWithRetry = fetchDataWithRetry;
/**
 * Fetch estate detail from SReality API
 * Returns object indicating if property is inactive
 */
const fetchEstateDetail = async (hash_id, headers) => {
    const url = `https://www.sreality.cz/api/cs/v2/estates/${hash_id}`;
    try {
        const data = await (0, exports.fetchDataWithRetry)(url, headers, 3);
        // Check for inactive/removed estate
        // Sreality returns {"logged_in": false} for removed listings.
        // Axios auto-parses JSON, so `data` is an object, not a string.
        if (data && typeof data === 'object' && data.logged_in === false && Object.keys(data).length === 1) {
            return {
                isInactive: true,
                inactiveReason: 'logged_in_false'
            };
        }
        return {
            data,
            isInactive: false
        };
    }
    catch (error) {
        const axiosError = error;
        // HTTP 410 (Gone) - Standard HTTP status for permanently removed resources
        if (axiosError.response?.status === 410) {
            return {
                isInactive: true,
                inactiveReason: 'http_410'
            };
        }
        // Re-throw other errors
        throw error;
    }
};
exports.fetchEstateDetail = fetchEstateDetail;
/**
 * Fetch category data from SReality API with pagination
 * Processes each page through the provided callback
 *
 * @deprecated Use fetchAllListingPages for better performance
 */
const fetchCategoryData = async (category, perPage, tms, processPage) => {
    let page = 1;
    let totalProcessed = 0;
    const maxPages = 10000; // Handle ~100k estates
    while (page <= maxPages) {
        try {
            const url = `https://www.sreality.cz/api/cs/v2/estates?page=${page}&per_page=${perPage}&category_main_cb=${category}&tms=${tms}`;
            const headers = (0, headers_1.getRealisticHeaders)();
            const data = await (0, exports.fetchDataWithRetry)(url, headers, 3);
            const estates = data._embedded?.estates || [];
            if (estates.length === 0) {
                break; // No more results
            }
            await processPage(estates, page);
            totalProcessed += estates.length;
            // If we got less than requested, we're at the end
            if (estates.length < perPage) {
                break;
            }
            // Add delay between page requests to avoid throttling
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200)); // 300-500ms delay
            page++;
        }
        catch (error) {
            console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Error fetching category page', category, page, err: error.message }));
            break; // Stop processing this category on error
        }
    }
    return totalProcessed;
};
exports.fetchCategoryData = fetchCategoryData;
/**
 * Fetch a single page of listings
 */
async function fetchPage(pageNum, category, categoryType, perPage = 100, sort) {
    const sortParam = sort !== undefined ? `&sort=${sort}` : '';
    const url = `https://www.sreality.cz/api/cs/v2/estates?page=${pageNum}&per_page=${perPage}&category_main_cb=${category}&category_type_cb=${categoryType}${sortParam}&tms=${Date.now()}`;
    // Generate realistic headers for this page request
    const headers = (0, headers_1.getRealisticHeaders)();
    const data = await (0, exports.fetchDataWithRetry)(url, headers, 3);
    return {
        estates: data._embedded?.estates || [],
        totalResults: data.result_size || 0
    };
}
/**
 * Fetch all listing pages for a category with parallel execution
 * Headers (including User-Agent) are rotated per page request to avoid bot detection
 *
 * @param category - Category ID (1=Byty, 2=Domy, 3=Pozemky, 4=Komerční, 5=Ostatní)
 * @param categoryType - Transaction type (1=Sale, 2=Rent)
 * @param maxPages - Maximum pages to fetch (undefined = fetch all)
 * @returns Array of all listings
 */
const fetchAllListingPages = async (category, categoryType, maxPages, onBatchFetched, sort) => {
    const CONCURRENT_PAGES = parseInt(process.env.CONCURRENT_PAGES || '3');
    const allListings = [];
    let currentPage = 1;
    let hasMore = true;
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Fetching listings for category', category, categoryType, concurrentPages: CONCURRENT_PAGES }));
    while (hasMore && (!maxPages || currentPage <= maxPages)) {
        // Calculate page range for this batch
        const batchEndPage = maxPages
            ? Math.min(currentPage + CONCURRENT_PAGES - 1, maxPages)
            : currentPage + CONCURRENT_PAGES - 1;
        const pageNumbers = Array.from({ length: batchEndPage - currentPage + 1 }, (_, i) => currentPage + i);
        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Fetching pages in parallel', fromPage: currentPage, toPage: batchEndPage }));
        // Fetch all pages in this batch simultaneously (each with fresh headers)
        const pageResults = await Promise.allSettled(pageNumbers.map(pageNum => fetchPage(pageNum, category, categoryType, 100, sort)));
        // Process results
        let pagesWithData = 0;
        const batchListings = [];
        for (let i = 0; i < pageResults.length; i++) {
            const result = pageResults[i];
            const pageNum = pageNumbers[i];
            if (result.status === 'fulfilled') {
                const { estates } = result.value;
                if (estates.length > 0) {
                    pagesWithData++;
                    allListings.push(...estates);
                    batchListings.push(...estates);
                    // If we got less than 100, we're at the end
                    if (estates.length < 100) {
                        hasMore = false;
                        console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Last page reached', pageNum }));
                        break;
                    }
                }
                else {
                    // Empty page means we've reached the end
                    hasMore = false;
                    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Empty page, stopping', pageNum }));
                    break;
                }
            }
            else {
                console.error(JSON.stringify({ level: 'error', service: 'sreality-scraper', msg: 'Failed to fetch page', pageNum, err: result.reason?.message || String(result.reason) }));
            }
        }
        // If no pages had data, we're done
        if (pagesWithData === 0) {
            hasMore = false;
        }
        // Stream this batch immediately — caller can compare checksums + queue jobs
        // while we continue fetching the next batch of pages
        if (onBatchFetched && batchListings.length > 0) {
            await onBatchFetched(batchListings);
        }
        // Move to next batch
        currentPage = batchEndPage + 1;
        // Brief pause between batches to avoid overwhelming the API
        if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    console.log(JSON.stringify({ level: 'info', service: 'sreality-scraper', msg: 'Fetched total listings', totalListings: allListings.length, category, categoryType }));
    return allListings;
};
exports.fetchAllListingPages = fetchAllListingPages;
