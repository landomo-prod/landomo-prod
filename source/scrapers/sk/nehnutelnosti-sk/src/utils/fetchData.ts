import axios, { AxiosError } from 'axios';

/**
 * Fetch data from API with retry logic and exponential backoff
 */
export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3
): Promise<any> => {
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: 30000 // 30 second timeout
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      // Don't retry on 4xx errors (client errors)
      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }

      // On last attempt, throw the error
      if (attempt === retries - 1) {
        throw error;
      }

      // Exponential backoff with jitter
      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(`Retrying request (${attempt + 1}/${retries}) in ${delayMs}ms: ${url}`);
      await delay(delayMs);
    }
  }
};

/**
 * Fetch property detail from Nehnutelnosti.sk
 */
export const fetchPropertyDetail = async (propertyId: string | number, userAgent: string): Promise<any> => {
  // This URL structure may need to be adjusted based on actual Nehnutelnosti.sk API
  const url = `https://www.nehnutelnosti.sk/api/v1/properties/${propertyId}`;
  const headers = { 'User-Agent': userAgent };
  return fetchDataWithRetry(url, headers, 3);
};

/**
 * Fetch listings from Nehnutelnosti.sk API with pagination
 * Processes each page through the provided callback
 */
export const fetchListingsData = async (
  category: string,
  transactionType: string,
  userAgent: string,
  perPage: number,
  processPage: (listings: any[], pageNumber: number) => Promise<void>
): Promise<number> => {
  let page = 1;
  let totalProcessed = 0;
  const maxPages = 1000; // Handle up to 1000 pages

  while (page <= maxPages) {
    try {
      // Build URL based on Nehnutelnosti.sk API structure
      // This URL structure may need to be adjusted based on actual API
      const url = `https://www.nehnutelnosti.sk/api/v1/listings?page=${page}&per_page=${perPage}&category=${category}&type=${transactionType}`;
      const data = await fetchDataWithRetry(url, { 'User-Agent': userAgent }, 3);

      // Extract listings from response
      const listings = data._embedded?.offers ||
                      data._embedded?.estates ||
                      data.items ||
                      [];

      if (listings.length === 0) {
        break; // No more results
      }

      await processPage(listings, page);

      totalProcessed += listings.length;

      // If we got less than requested, we're at the end
      if (listings.length < perPage) {
        break;
      }

      // Add delay between page requests to avoid throttling
      await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200)); // 300-500ms delay

      page++;
    } catch (error: any) {
      console.error(`Error fetching category ${category}, page ${page}:`, error.message);
      break; // Stop processing this category on error
    }
  }

  return totalProcessed;
};
