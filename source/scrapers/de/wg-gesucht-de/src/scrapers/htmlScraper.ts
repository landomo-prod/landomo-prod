import axios from 'axios';
import * as cheerio from 'cheerio';
import { getRandomUserAgent, getRandomAcceptLanguage } from '../utils/userAgents';
import { WGGesuchtOffer, CITY_IDS } from '../types/wgGesuchtTypes';

/**
 * City name mapping for URL construction
 * URL pattern: /{type}-in-{CityName}.{cityId}.{category}.1.{page}.html
 */
const CITY_URL_NAMES: Record<number, string> = {
  [CITY_IDS.BERLIN]: 'Berlin',
  [CITY_IDS.MUNICH]: 'Muenchen',
  [CITY_IDS.HAMBURG]: 'Hamburg',
  [CITY_IDS.COLOGNE]: 'Koeln',
  [CITY_IDS.FRANKFURT]: 'Frankfurt-am-Main',
  [CITY_IDS.STUTTGART]: 'Stuttgart',
  [CITY_IDS.DUSSELDORF]: 'Duesseldorf',
  [CITY_IDS.DORTMUND]: 'Dortmund',
  [CITY_IDS.ESSEN]: 'Essen',
  [CITY_IDS.LEIPZIG]: 'Leipzig',
  [CITY_IDS.BREMEN]: 'Bremen',
  [CITY_IDS.DRESDEN]: 'Dresden',
  [CITY_IDS.HANOVER]: 'Hannover',
  [CITY_IDS.NUREMBERG]: 'Nuernberg',
  [CITY_IDS.DUISBURG]: 'Duisburg',
};

/**
 * URL type prefix per category
 * 0 = WG-Zimmer, 1 = 1-Zimmer-Wohnung, 2 = Wohnung, 3+ = Wohnung
 */
const CATEGORY_URL_PREFIX: Record<string, string> = {
  '0': 'wg-zimmer',
  '1': '1-zimmer-wohnungen',
  '2': 'wohnungen',
  '3': 'wohnungen',
  '4': 'wohnungen',
  '5': 'haeuser',
  '6': 'wohnungen',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min: number, max: number) => delay(min + Math.random() * (max - min));

function getHeaders(): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': getRandomAcceptLanguage(),
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };
}

/**
 * Build list page URL
 * Pattern: https://www.wg-gesucht.de/{type}-in-{City}.{cityId}.{category}.1.{page}.html
 */
function buildListUrl(cityId: number, category: string, page: number): string {
  const cityName = CITY_URL_NAMES[cityId] || `City-${cityId}`;
  const prefix = CATEGORY_URL_PREFIX[category] || 'wohnungen';
  return `https://www.wg-gesucht.de/${prefix}-in-${cityName}.${cityId}.${category}.1.${page}.html`;
}

/**
 * Parse listing cards from HTML list page
 */
function parseListPage(html: string, cityId: number, category: string): WGGesuchtOffer[] {
  const $ = cheerio.load(html);
  const offers: WGGesuchtOffer[] = [];

  $('.wgg_card.offer_list_item').each((_i, el) => {
    const card = $(el);
    const id = card.attr('data-id');
    if (!id) return;

    // Skip premium/sponsored ads from external partners
    const linkEl = card.find('a[href*=".html"]').first();
    const href = linkEl.attr('href') || '';
    if (href.includes('asset_id=') || href.includes('campaign_partner=')) return;

    // Title
    const title = card.find('.truncate_title a').first().attr('title')?.replace('Anzeige ansehen: ', '') ||
                  card.find('.truncate_title a').first().text().trim();

    // Detail URL
    const detailHref = card.find('.truncate_title a').first().attr('href') || '';
    const detailUrl = detailHref.startsWith('/') ? `https://www.wg-gesucht.de${detailHref}` : detailHref;

    // Location line: "2-Zimmer-Wohnung | Berlin Neukölln | Innstr. 11"
    const locationText = card.find('.col-xs-11.hidable_content span').first().text().trim();
    const locationParts = locationText.split('|').map(s => s.trim());
    const categoryText = locationParts[0] || '';
    const cityDistrict = locationParts[1] || '';
    const street = locationParts[2] || '';

    // Parse city and district from "Berlin Neukölln"
    const cityDistrictParts = cityDistrict.split(/\s+/);
    const city = cityDistrictParts[0] || '';
    const district = cityDistrictParts.slice(1).join(' ') || undefined;

    // Price, dates, size from the middle row
    const middleRow = card.find('.row.middle.hidable_content');
    const priceText = middleRow.find('.col-xs-3').first().text().trim();
    const price = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;

    const dateText = middleRow.find('.col-xs-5').text().trim();
    const dateParts = dateText.split('-').map(s => s.trim());
    const availableFrom = parseDateDE(dateParts[0]);
    const availableTo = dateParts[1] ? parseDateDE(dateParts[1]) : undefined;

    const sizeText = middleRow.find('.col-xs-3').last().text().trim();
    const size = parseFloat(sizeText.replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;

    // Image
    const imgSrc = card.find('img.img-responsive').first().attr('src');

    const offer: WGGesuchtOffer = {
      id,
      title: title || undefined,
      category: categoryText || mapCategoryCode(category),
      city: city || CITY_URL_NAMES[cityId],
      district,
      street: street || undefined,
      rent: price,
      size,
      available_from: availableFrom,
      available_to: availableTo || null,
      url: detailUrl || undefined,
      thumbnail: imgSrc || undefined,
    };

    offers.push(offer);
  });

  return offers;
}

/**
 * Parse German date format (DD.MM.YYYY) to ISO string
 */
function parseDateDE(dateStr: string): string | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return undefined;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
}

function mapCategoryCode(code: string): string {
  const map: Record<string, string> = {
    '0': 'WG-Zimmer',
    '1': '1-Zimmer-Wohnung',
    '2': '2-Zimmer-Wohnung',
    '3': '3-Zimmer-Wohnung',
    '4': '4+-Zimmer-Wohnung',
    '5': 'Haus',
    '6': 'Wohnung',
  };
  return map[code] || 'Wohnung';
}

/**
 * Fetch and parse a list page (public, no auth needed)
 */
export async function fetchListPage(cityId: number, category: string, page: number): Promise<WGGesuchtOffer[]> {
  const url = buildListUrl(cityId, category, page);

  const response = await axios.get(url, {
    headers: getHeaders(),
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return parseListPage(response.data, cityId, category);
}

/**
 * Fetch and parse a detail page (public, no auth needed)
 */
export async function fetchDetailPage(detailUrl: string): Promise<Partial<WGGesuchtOffer>> {
  const response = await axios.get(detailUrl, {
    headers: getHeaders(),
    timeout: 30000,
    validateStatus: (status) => status < 500,
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status} for ${detailUrl}`);
  }

  return parseDetailPage(response.data);
}

/**
 * Parse detail page HTML for additional fields
 */
function parseDetailPage(html: string): Partial<WGGesuchtOffer> {
  const $ = cheerio.load(html);
  const detail: Partial<WGGesuchtOffer> = {};

  // Key facts: Größe, Gesamtmiete, Zimmer
  $('.key_fact_detail').each((_i, el) => {
    const label = $(el).text().trim().toLowerCase();
    const valueEl = $(el).parent().find('.key_fact_value');
    const value = valueEl.text().trim();

    if (label.includes('größe') || label.includes('groesse')) {
      detail.size = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
    } else if (label.includes('gesamtmiete')) {
      detail.rent = parseFloat(value.replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
    } else if (label.includes('zimmer')) {
      detail.rooms = parseInt(value, 10) || undefined;
    }
  });

  // Cost section
  const costSection = parseSectionPanel($, 'Kosten');
  if (costSection['Miete']) {
    detail.rent_cold = parseFloat(costSection['Miete'].replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
  }
  if (costSection['Nebenkosten']) {
    detail.utilities = parseFloat(costSection['Nebenkosten'].replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
  }
  if (costSection['Kaution']) {
    detail.deposit = parseFloat(costSection['Kaution'].replace(/[^\d.,]/g, '').replace(',', '.')) || undefined;
  }

  // Dates
  const dateSection = parseSectionPanelByDetail($);
  if (dateSection['frei ab']) {
    detail.available_from = parseDateDE(dateSection['frei ab']);
  }
  if (dateSection['frei bis']) {
    detail.available_to = parseDateDE(dateSection['frei bis']) || null;
  }

  // Description
  const descEl = $('#ad_description_text, .ad_text, #freitext_0, #freitext_1');
  if (descEl.length > 0) {
    detail.description = descEl.map((_i, el) => $(el).text().trim()).get().join('\n\n').trim() || undefined;
  }

  // Address/Location from section panel
  const addressSection = parseSectionPanelByDetail($);
  if (addressSection['Adresse']) {
    detail.street = addressSection['Adresse'];
  }

  // Images
  const images: string[] = [];
  $('img[data-src], .sp-slide img').each((_i, el) => {
    const src = $(el).attr('data-src') || $(el).attr('src');
    if (src && src.includes('wg-gesucht.de/media') && !src.includes('.small.')) {
      images.push(src);
    }
  });
  // Also try gallery images
  $('a[data-featherlight]').each((_i, el) => {
    const src = $(el).attr('data-featherlight') || $(el).attr('href');
    if (src && src.includes('wg-gesucht.de/media')) {
      images.push(src);
    }
  });
  if (images.length > 0) {
    detail.images = [...new Set(images)];
    detail.image_count = detail.images.length;
  }

  // Features from checkboxes/icons
  $('.section_panel .mdi-check').each((_i, el) => {
    const text = $(el).parent().text().trim().toLowerCase();
    if (text.includes('balkon') || text.includes('balcony')) detail.balcony = true;
    if (text.includes('aufzug') || text.includes('elevator')) detail.elevator = true;
    if (text.includes('garten') || text.includes('garden')) detail.garden = true;
    if (text.includes('parkplatz') || text.includes('parking') || text.includes('garage')) detail.parking = true;
    if (text.includes('möbliert') || text.includes('furnished')) detail.furnished = true;
    if (text.includes('internet') || text.includes('wlan')) detail.internet = true;
    if (text.includes('küche') || text.includes('kitchen')) detail.kitchen = true;
    if (text.includes('barrierefrei')) detail.barrier_free = true;
  });

  // Flatmates info (for WG rooms)
  const flatmateSection = $('.wg_detail');
  if (flatmateSection.length > 0) {
    const flatmateText = flatmateSection.text();
    const totalMatch = flatmateText.match(/(\d+)er\s*WG/);
    if (totalMatch) {
      detail.flatmates = detail.flatmates || {};
      detail.flatmates.total = parseInt(totalMatch[1], 10);
    }
  }

  // Online since
  const onlineSinceEl = $('b:contains("Online:")').parent();
  if (onlineSinceEl.length > 0) {
    const onlineText = onlineSinceEl.text().replace('Online:', '').trim();
    detail.online_since = parseDateDE(onlineText);
  }

  return detail;
}

/**
 * Parse section_panel key-value pairs by title
 */
function parseSectionPanel($: any, title: string): Record<string, string> {
  const result: Record<string, string> = {};
  const panel = $(`.section_panel_title:contains("${title}")`).closest('.section_panel');

  panel.find('.row').each((_i: any, row: any) => {
    const key = $(row).find('.section_panel_detail').first().text().trim().replace(':', '');
    const value = $(row).find('.section_panel_value').first().text().trim();
    if (key && value) {
      result[key] = value;
    }
  });

  return result;
}

/**
 * Parse all section_panel_detail / section_panel_value pairs
 */
function parseSectionPanelByDetail($: any): Record<string, string> {
  const result: Record<string, string> = {};

  $('.section_panel_detail').each((_i: any, el: any) => {
    const key = $(el).text().trim().replace(':', '').toLowerCase();
    const valueEl = $(el).closest('.row').find('.section_panel_value').first();
    const value = valueEl.text().trim();
    if (key && value) {
      result[key] = value;
    }
  });

  return result;
}

/**
 * Scrape all listings for a city+category combination, paginating through all pages
 */
export async function scrapeListings(
  cityId: number,
  category: string,
  onPage?: (offers: WGGesuchtOffer[], page: number) => void
): Promise<WGGesuchtOffer[]> {
  const allOffers: WGGesuchtOffer[] = [];
  let page = 0;
  const maxPages = 50;

  while (page < maxPages) {
    const offers = await fetchListPage(cityId, category, page);

    if (offers.length === 0) break;

    allOffers.push(...offers);
    onPage?.(offers, page);

    // Rate limiting: 3-6 second delays between pages
    await randomDelay(3000, 6000);

    page++;

    // Longer pause every 5 pages
    if (page % 5 === 0) {
      await randomDelay(5000, 10000);
    }
  }

  return allOffers;
}
