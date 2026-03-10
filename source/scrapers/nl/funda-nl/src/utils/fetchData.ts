import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { getRealisticHeaders } from './headers';
import { FundaSearchResult, FundaDetailData } from '../types/rawTypes';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchDataWithRetry = async (
  url: string,
  headers: Record<string, string>,
  retries: number = 3
): Promise<any> => {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status && axiosError.response.status >= 400 && axiosError.response.status < 500) {
        throw error;
      }

      if (attempt === retries - 1) {
        throw error;
      }

      const delayMs = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
      console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Retrying request', attempt: attempt + 1, retries, delayMs, url }));
      await delay(delayMs);
    }
  }
};

/**
 * Determine property type from Funda type string.
 * Maps Dutch property type names to TierI category names.
 */
function mapFundaType(type?: string): string {
  if (!type) return 'apartment';
  const t = type.toLowerCase();
  if (t.includes('appartement') || t.includes('flat') || t.includes('bovenwoning') || t.includes('benedenwoning') || t.includes('maisonnette') || t.includes('penthouse') || t.includes('portiek')) return 'apartment';
  if (t.includes('woonhuis') || t.includes('villa') || t.includes('herenhuis') || t.includes('grachtenpand') || t.includes('landhuis') || t.includes('bungalow') || t.includes('twee-onder-een-kap') || t.includes('hoekwoning') || t.includes('tussenwoning') || t.includes('geschakelde') || t.includes('vrijstaand')) return 'house';
  if (t.includes('bouwgrond') || t.includes('perceel') || t.includes('grond')) return 'land';
  if (t.includes('bedrijf') || t.includes('kantoor') || t.includes('winkel') || t.includes('horeca') || t.includes('praktijk')) return 'commercial';
  return 'apartment';
}

/**
 * Fetch search results from Funda
 * Uses the web search page and parses JSON data from script tags
 */
export async function fetchSearchPage(
  transactionType: 'koop' | 'huur',
  page: number,
  pageSize: number = 25
): Promise<{ results: FundaSearchResult[], totalPages: number }> {
  const url = `https://www.funda.nl/zoeken/${transactionType}/?selected_area=%5B%22nl%22%5D&search_result=${page}`;
  const headers = getRealisticHeaders();

  try {
    const html = await fetchDataWithRetry(url, headers, 3);
    const $ = cheerio.load(html);

    const results: FundaSearchResult[] = [];
    let totalPages = 1;

    // Look for JSON data in script tags (Next.js __NEXT_DATA__)
    $('script#__NEXT_DATA__').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).text());
        const searchResults = jsonData?.props?.pageProps?.searchResult?.resultList || [];
        totalPages = jsonData?.props?.pageProps?.searchResult?.paging?.aantalPaginas || 1;

        for (const item of searchResults) {
          results.push({
            Id: item.id?.toString() || item.globalId?.toString() || '',
            GlobalId: item.globalId || 0,
            PublicatieDatum: item.publicatieDatum || '',
            Adres: item.adres || item.address || '',
            Postcode: item.postcode || '',
            Woonplaats: item.woonplaats || item.plaats || '',
            Provincie: item.provincie || '',
            KoopPrijs: item.koopprijs || item.prijs?.koopprijs || undefined,
            HuurPrijs: item.huurprijs || item.prijs?.huurprijs || undefined,
            WoonOppervlakte: item.woonoppervlakte || item.woonOppervlakte || undefined,
            PercOppervlakte: item.perceeloppervlakte || item.percOppervlakte || undefined,
            AantalKamers: item.aantalKamers || undefined,
            AantalSlaapkamers: item.aantalSlaapkamers || undefined,
            AantalBadkamers: item.aantalBadkamers || undefined,
            URL: item.url || '',
            SoortAanbod: transactionType,
            Type: item.soortObject || item.type || undefined,
            Tuin: item.tuin || undefined,
            Garage: item.garage || undefined,
            Balkon: item.balkon || undefined,
            Lift: item.lift || undefined,
            Parkeren: item.parkeren || undefined,
            Energielabel: item.energielabel || undefined,
            BouwJaar: item.bouwjaar || undefined,
            Omschrijving: item.omschrijving || undefined,
            MakelaarNaam: item.makelaarNaam || undefined,
            MakelaarId: item.makelaarId || undefined,
            WGS84_X: item.wgs84X || item.longitude || undefined,
            WGS84_Y: item.wgs84Y || item.latitude || undefined,
          });
        }
      } catch (parseErr) {
        // JSON parse failed, try alternative extraction
      }
    });

    // Fallback: parse HTML listing cards if no JSON data found
    if (results.length === 0) {
      $('[data-test-id="search-result-item"], .search-result__header-title-col').each((_, el) => {
        const $el = $(el);
        const link = $el.find('a[href*="/koop/"], a[href*="/huur/"]').first();
        const href = link.attr('href') || '';
        const address = $el.find('[data-test-id="street-name-house-number"]').text().trim() || link.text().trim();
        const priceText = $el.find('[data-test-id="price-sale"], [data-test-id="price-rent"]').text().trim();
        const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;
        const areaText = $el.find('[title*="m\u00B2"], [title*="Woonoppervlakte"]').text().trim();
        const area = parseInt(areaText.replace(/[^0-9]/g, '')) || undefined;

        if (href) {
          const id = href.match(/\/(\d+)/)?.[1] || href.replace(/\//g, '-');
          results.push({
            Id: id,
            GlobalId: parseInt(id) || 0,
            PublicatieDatum: '',
            Adres: address,
            Postcode: '',
            Woonplaats: '',
            Provincie: '',
            KoopPrijs: transactionType === 'koop' ? price : undefined,
            HuurPrijs: transactionType === 'huur' ? price : undefined,
            WoonOppervlakte: area,
            URL: href.startsWith('http') ? href : `https://www.funda.nl${href}`,
            SoortAanbod: transactionType,
          });
        }
      });

      // Try to find total pages from pagination
      const lastPageLink = $('a[rel="last"], .pagination a').last().text().trim();
      totalPages = parseInt(lastPageLink) || totalPages;
    }

    return { results, totalPages };
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Failed to fetch search page', page, transactionType, err: error.message }));
    return { results: [], totalPages: 0 };
  }
}

/**
 * Fetch all listing pages for a given transaction type
 */
export async function fetchAllListingPages(
  transactionType: 'koop' | 'huur'
): Promise<FundaSearchResult[]> {
  const CONCURRENT_PAGES = parseInt(process.env.CONCURRENT_PAGES || '5');
  const allListings: FundaSearchResult[] = [];
  const seenIds = new Set<string>();

  // Fetch first page to get total pages
  const firstPage = await fetchSearchPage(transactionType, 1);
  for (const r of firstPage.results) {
    if (r.Id && !seenIds.has(r.Id)) {
      seenIds.add(r.Id);
      allListings.push(r);
    }
  }
  const totalPages = Math.min(firstPage.totalPages, parseInt(process.env.MAX_PAGES || '500'));

  console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Total pages', transactionType, totalPages }));

  let currentPage = 2;
  while (currentPage <= totalPages) {
    const batchEnd = Math.min(currentPage + CONCURRENT_PAGES - 1, totalPages);
    const pageNumbers = Array.from({ length: batchEnd - currentPage + 1 }, (_, i) => currentPage + i);

    const pageResults = await Promise.allSettled(
      pageNumbers.map(p => fetchSearchPage(transactionType, p))
    );

    let pagesWithData = 0;
    for (const result of pageResults) {
      if (result.status === 'fulfilled' && result.value.results.length > 0) {
        pagesWithData++;
        for (const r of result.value.results) {
          if (r.Id && !seenIds.has(r.Id)) {
            seenIds.add(r.Id);
            allListings.push(r);
          }
        }
      }
    }

    if (pagesWithData === 0) break;

    currentPage = batchEnd + 1;
    await delay(500 + Math.random() * 500);
  }

  console.log(JSON.stringify({ level: 'info', service: 'funda-scraper', msg: 'Fetched total listings', transactionType, total: allListings.length }));
  return allListings;
}

/**
 * Fetch detail page for a single property
 */
export async function fetchPropertyDetail(url: string): Promise<FundaDetailData | null> {
  const fullUrl = url.startsWith('http') ? url : `https://www.funda.nl${url}`;
  const headers = getRealisticHeaders(fullUrl);

  try {
    const html = await fetchDataWithRetry(fullUrl, headers, 3);
    const $ = cheerio.load(html);

    // Try to extract from __NEXT_DATA__
    let detailData: any = null;
    $('script#__NEXT_DATA__').each((_, el) => {
      try {
        const jsonData = JSON.parse($(el).text());
        detailData = jsonData?.props?.pageProps?.listing || jsonData?.props?.pageProps;
      } catch {}
    });

    // Also try JSON-LD
    if (!detailData) {
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const ld = JSON.parse($(el).text());
          if (ld['@type'] === 'Product' || ld['@type'] === 'RealEstateListing') {
            detailData = ld;
          }
        } catch {}
      });
    }

    const isRent = fullUrl.includes('/huur/');
    const priceText = $('[data-test-id="object-header-price"]').text().trim() || '';
    const price = parseInt(priceText.replace(/[^0-9]/g, '')) || detailData?.prijs?.koopprijs || detailData?.prijs?.huurprijs || 0;

    const address = $('h1').first().text().trim() || detailData?.adres || '';
    const postcode = detailData?.postcode || $('[data-test-id="object-header-postal-code"]').text().trim() || '';
    const city = detailData?.woonplaats || detailData?.plaats || '';

    const livingArea = detailData?.woonoppervlakte || parseInt($('[title*="Woonoppervlakte"]').next().text().replace(/[^0-9]/g, '')) || undefined;
    const plotArea = detailData?.perceeloppervlakte || parseInt($('[title*="Perceeloppervlakte"]').next().text().replace(/[^0-9]/g, '')) || undefined;
    const rooms = detailData?.aantalKamers || parseInt($('[title*="Aantal kamers"]').next().text().replace(/[^0-9]/g, '')) || undefined;
    const bedrooms = detailData?.aantalSlaapkamers || parseInt($('[title*="Aantal slaapkamers"]').next().text().replace(/[^0-9]/g, '')) || undefined;
    const bathrooms = detailData?.aantalBadkamers || parseInt($('[title*="Aantal badkamers"]').next().text().replace(/[^0-9]/g, '')) || undefined;

    const propertyType = detailData?.soortObject || detailData?.type || '';
    const fundaType = mapFundaType(propertyType);

    const images: string[] = [];
    $('img[src*="cloud.funda.nl"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src) images.push(src);
    });

    const features: string[] = [];
    $('[data-test-id="kenmerken-table"] dt, .object-kenmerken-list dt').each((_, el) => {
      features.push($(el).text().trim());
    });

    const description = $('[data-test-id="object-description-body"]').text().trim() || detailData?.omschrijving || '';

    const hasGarden = features.some(f => f.toLowerCase().includes('tuin')) || !!detailData?.tuin;
    const hasGarage = features.some(f => f.toLowerCase().includes('garage')) || !!detailData?.garage;
    const hasBasement = features.some(f => f.toLowerCase().includes('kelder') || f.toLowerCase().includes('berging'));
    const hasBalcony = features.some(f => f.toLowerCase().includes('balkon')) || !!detailData?.balkon;
    const hasElevator = features.some(f => f.toLowerCase().includes('lift')) || !!detailData?.lift;
    const hasParking = features.some(f => f.toLowerCase().includes('parkeer') || f.toLowerCase().includes('parking')) || !!detailData?.parkeren;

    const id = fullUrl.match(/\/(\d+)/)?.[1] || detailData?.id?.toString() || '';

    return {
      id,
      globalId: parseInt(id) || 0,
      address,
      postcode,
      city,
      province: detailData?.provincie || '',
      price,
      currency: 'EUR',
      transactionType: isRent ? 'rent' : 'sale',
      propertyType: fundaType,
      livingArea,
      plotArea,
      rooms,
      bedrooms,
      bathrooms,
      hasGarden,
      hasGarage,
      hasBasement,
      hasBalcony,
      hasElevator,
      hasParking,
      energyLabel: detailData?.energielabel || undefined,
      yearBuilt: detailData?.bouwjaar || undefined,
      description,
      images,
      agentName: detailData?.makelaarNaam || undefined,
      agentId: detailData?.makelaarId || undefined,
      latitude: detailData?.wgs84Y || detailData?.latitude || undefined,
      longitude: detailData?.wgs84X || detailData?.longitude || undefined,
      url: fullUrl,
      features,
    };
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'funda-scraper', msg: 'Failed to fetch detail', url: fullUrl, err: error.message }));
    return null;
  }
}
