import axios from 'axios';
import * as cheerio from 'cheerio';
import { DonpisoDetailRaw } from '../types/donpisoTypes';
import { getRealisticHeaders, getRandomDelay } from '../utils/headers';
import { donpisoRateLimiter } from '../utils/rateLimiter';
import { extractPortalId, buildUrl } from '../utils/donpisoHelpers';
import {
  parseSpanishPrice,
  parseSpanishNumber,
  parseSpanishArea,
  parseFloor,
  parseConstructionYear,
  normalizeEnergyRating,
} from '../../../shared/spanish-value-mappings';

/**
 * Fetch and parse a donpiso.com detail page
 * Data is available in both JSON-LD structured data and HTML elements
 */
export async function fetchDetailPage(detailUrl: string): Promise<DonpisoDetailRaw | null> {
  await donpisoRateLimiter.throttle();
  await new Promise(resolve => setTimeout(resolve, getRandomDelay(400, 1000)));

  const url = buildUrl(detailUrl);
  const headers = getRealisticHeaders('https://www.donpiso.com/');

  let response;
  try {
    response = await axios.get(url, {
      headers,
      timeout: 30000,
      validateStatus: (status) => status < 500,
    });
  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'error', service: 'donpiso-scraper',
      msg: 'Detail fetch failed', url, err: error.message,
    }));
    return null;
  }

  if (response.status === 404 || response.status === 410 || response.status === 301) {
    return null;
  }

  const $ = cheerio.load(response.data);

  // === JSON-LD extraction (primary) ===
  let jsonLdData: any = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || '';
      const parsed = JSON.parse(raw);

      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type'] === 'SingleFamilyResidence' ||
            item['@type'] === 'Apartment' || item['@type'] === 'RealEstateListing' ||
            item['@type'] === 'House') {
          jsonLdData = item;
          break;
        }
        if (item['@graph']) {
          for (const node of item['@graph']) {
            if (node['@type'] === 'Product' || node['@type'] === 'SingleFamilyResidence' ||
                node['@type'] === 'Apartment' || node['@type'] === 'RealEstateListing') {
              jsonLdData = node;
              break;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  });

  // === HTML extraction ===
  const bodyText = $('body').text();

  // Portal ID
  const portalId = extractPortalId(url);

  // Title
  const title = $('h1').first().text().trim() ||
                jsonLdData?.name || '';

  // Price
  let price: number | null = null;
  if (jsonLdData?.offers?.price) {
    price = parseSpanishPrice(String(jsonLdData.offers.price));
  }
  if (!price) {
    const priceText = $('[class*="price"], [class*="precio"], .price, #precio').first().text().trim();
    price = parseSpanishPrice(priceText);
  }
  if (!price) {
    // Look for price pattern in body text
    const priceMatch = bodyText.match(/([\d.]+)\s*€/);
    if (priceMatch) price = parseSpanishPrice(priceMatch[1]);
  }

  // Price per sqm
  let pricePerSqm: number | null = null;
  const pricePerSqmMatch = bodyText.match(/([\d.,]+)\s*€\/m[²2]/);
  if (pricePerSqmMatch) {
    pricePerSqm = parseSpanishNumber(pricePerSqmMatch[1]);
  }

  // Bedrooms
  let bedrooms: number | null = null;
  const bedroomsMatch = bodyText.match(/(\d+)\s*hab(?:itaci[oó]n|\.)/i);
  if (bedroomsMatch) bedrooms = parseInt(bedroomsMatch[1], 10);

  // Bathrooms
  let bathrooms: number | null = null;
  const bathroomsMatch = bodyText.match(/(\d+)\s*ba[ñn]/i);
  if (bathroomsMatch) bathrooms = parseInt(bathroomsMatch[1], 10);

  // Surface area (sqm)
  let sqm: number | null = null;
  const sqmMatch = bodyText.match(/([\d.,]+)\s*m[²2]/);
  if (sqmMatch) sqm = parseSpanishNumber(sqmMatch[1]);

  // Plot area
  let sqmPlot: number | null = null;
  const plotMatch = bodyText.match(/parcela[:\s]+([\d.,]+)\s*m[²2]/i) ||
                    bodyText.match(/terreno[:\s]+([\d.,]+)\s*m[²2]/i);
  if (plotMatch) sqmPlot = parseSpanishNumber(plotMatch[1]);

  // Floor
  let floorStr: string | null = null;
  const floorMatch = bodyText.match(/(?:planta|piso|plta\.?)\s+([^\n,\.]{1,30})/i);
  if (floorMatch) floorStr = floorMatch[0].trim();

  // Location from JSON-LD
  let latitude: number | null = null;
  let longitude: number | null = null;
  let city: string | null = null;
  let province: string | null = null;
  let address: string | null = null;
  let neighborhood: string | null = null;

  if (jsonLdData?.geo) {
    latitude = parseFloat(jsonLdData.geo.latitude) || null;
    longitude = parseFloat(jsonLdData.geo.longitude) || null;
  }

  if (jsonLdData?.address) {
    const addr = jsonLdData.address;
    city = addr.addressLocality || null;
    province = addr.addressRegion || null;
    address = addr.streetAddress || null;
    neighborhood = addr.name || null;
  }

  // Fallback location from HTML
  if (!city) {
    const breadcrumb = $('[class*="breadcrumb"], nav ol').text().trim();
    const parts = breadcrumb.split(/[>/\|]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) city = parts[parts.length - 1] || null;
  }

  // Features - collect all text items from feature lists
  const features: string[] = [];
  $('ul li, [class*="feature"], [class*="caracteristica"], [class*="detail"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 2 && text.length < 100) {
      features.push(text);
    }
  });

  // Energy certificate
  let energyCertificate: string | null = null;
  const energyMatch = bodyText.match(/(?:clase|letra|calificaci[oó]n)\s+energ[eé]tica[:\s]+([A-G]|en tr[áa]mite)/i) ||
                      bodyText.match(/certificado[:\s]+([A-G]|en tr[áa]mite)/i);
  if (energyMatch) {
    energyCertificate = normalizeEnergyRating(energyMatch[1]);
  }

  // Construction year
  let constructionYear: number | null = null;
  const yearMatch = bodyText.match(/(?:a[ñn]o\s+(?:de\s+)?construcci[oó]n|construido\s+en)[:\s]+(\d{4})/i);
  if (yearMatch) constructionYear = parseConstructionYear(yearMatch[1]);

  // Description
  let description: string | null = null;
  $('p, [class*="desc"], [class*="descrip"]').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 80 && !description) {
      description = text;
    }
  });
  if (!description && jsonLdData?.description) {
    description = jsonLdData.description;
  }

  // Images
  const images: string[] = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (src && src.includes('donpiso.com') && !src.includes('logo') &&
        !src.includes('icon') && !images.includes(src) && src.length > 20) {
      images.push(src);
    }
  });

  // Also check JSON-LD for images
  if (jsonLdData?.image) {
    const imgArr = Array.isArray(jsonLdData.image) ? jsonLdData.image : [jsonLdData.image];
    for (const img of imgArr) {
      const imgUrl = typeof img === 'string' ? img : img.url;
      if (imgUrl && !images.includes(imgUrl)) images.push(imgUrl);
    }
  }

  // Agent info
  let agentName: string | null = null;
  let agentPhone: string | null = null;
  let agentEmail: string | null = null;

  // Try to find agent from JSON-LD
  const agent = jsonLdData?.agent || jsonLdData?.broker;
  if (agent) {
    agentName = agent.name || null;
    agentPhone = agent.telephone || null;
    agentEmail = agent.email || null;
  }

  // Fallback from HTML
  if (!agentPhone) {
    const phoneMatch = bodyText.match(/(?:tel[eé]fono|telf?\.?)[:\s]+(\+?[\d\s\-]{9,15})/i) ||
                       bodyText.match(/(\+?34[\s\-]?[6-9]\d{8})/);
    if (phoneMatch) agentPhone = phoneMatch[1].replace(/\s/g, '').trim();
  }

  if (!agentName) {
    agentName = $('[class*="agency"], [class*="agencia"], [class*="office"]').first().text().trim() || null;
    if (agentName && agentName.length > 100) agentName = null;
  }

  // Is new development
  const isNewDevelopment = bodyText.toLowerCase().includes('obra nueva') ||
                           bodyText.toLowerCase().includes('promoción de obra nueva') ||
                           (jsonLdData?.['@type'] === 'NewConstruction');

  return {
    portalId,
    title,
    price,
    pricePerSqm,
    location: {
      address,
      neighborhood,
      city,
      province,
      latitude,
      longitude,
    },
    bedrooms,
    bathrooms,
    sqm,
    sqmPlot,
    floor: floorStr,
    features,
    description,
    energyCertificate,
    constructionYear,
    images,
    agentName,
    agentPhone,
    agentEmail,
    isNewDevelopment,
    sourceUrl: url,
  };
}
