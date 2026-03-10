import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  normalizeCondition,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeEnergyRating,
  normalizeFurnished,
  normalizeDisposition,
  normalizeOwnership,
} from '../../../../shared/czech-value-mappings';

/**
 * Transform Reality.cz API House to HousePropertyTierI
 *
 * API data provides structured information[] array and GPS coordinates
 */
export function transformRealityHouse(listing: RealityListing): HousePropertyTierI {
  const info = buildInfoMap(listing.information);

  // Core
  const title = listing.title;
  const price = listing.price ?? undefined;
  const currency = listing.currency || 'CZK';
  const transaction_type = listing.transaction_type;

  // Location (with GPS from API)
  const location: PropertyLocation = {
    address: listing.place,
    city: extractCity(listing.place),
    region: extractRegion(listing.place),
    country: 'Czech Republic',
    coordinates: listing.gps ? {
      lat: listing.gps.lat,
      lon: listing.gps.lng
    } : undefined
  };

  // House Details from information[]
  const disposition = info['Dispozice'] || info['Velikost bytu'];
  const bedrooms = extractBedrooms(disposition) ?? undefined;
  const sqm_living = parseArea(info['Plocha'] || info['Užitná plocha'] || info['Podlahová plocha'] || info['Obytná plocha']) ?? extractSqmFromType(listing.api_type) ?? undefined;
  const sqm_plot = parseArea(info['Plocha pozemku'] || info['Pozemek'] || info['Plocha parcely'] || info['Pozemek celkem']) ?? undefined;
  const rooms = extractRooms(disposition);

  // Amenities
  const has_garden = parseBooleanInfo(info['Zahrada']);
  const has_garage = parseBooleanInfo(info['Garáž']);
  const has_parking = parseBooleanInfo(info['Parkování']) ?? parseBooleanInfo(info['Parkovací stání']);
  const has_basement = parseBooleanInfo(info['Sklep']);
  const has_terrace = parseBooleanInfo(info['Terasa']);
  const has_balcony = parseBooleanInfo(info['Balkon']) ?? ((info['Balkon, terasa'] !== undefined && info['Balkon, terasa'] !== '') ? true : undefined);
  const has_pool = parseBooleanInfo(info['Bazén']);
  const has_fireplace = parseBooleanInfo(info['Krb']);

  // Building
  const rawCondition = info['Stav'] || info['Stav objektu'];
  const normalizedCondition = rawCondition ? normalizeCondition(rawCondition) : undefined;
  const condition = mapConditionToTierI(normalizedCondition);

  const rawHeating = info['Topení'] || info['Vytápění'];
  const heating_type = rawHeating ? normalizeHeatingType(rawHeating) : undefined;

  const rawConstruction = info['Stavba'] || info['Druh budovy'] || info['Konstrukce'] || info['Typ budovy'];
  const construction_type = rawConstruction ? normalizeConstructionType(rawConstruction) as HousePropertyTierI['construction_type'] : undefined;

  const rawEnergy = info['Energetická třída'] || info['PENB'] || info['Energetický štítek'] || info['Energet. náročnost'];
  const energy_class = rawEnergy ? normalizeEnergyRating(rawEnergy) : undefined;

  const yearBuiltStr = info['Rok výstavby'] || info['Rok kolaudace'];
  const year_built = yearBuiltStr ? parseYear(yearBuiltStr) : undefined;
  const renovationStr = info['Rok rekonstrukce'] || info['Rekonstrukce rok'];
  const renovation_year = renovationStr ? parseYear(renovationStr) : undefined;

  const stories = parseNumber(info['Počet podlaží'] || info['Podlaží'] || info['Počet NP']);

  // Media
  const virtual_tour_url = listing.virtual_tours?.[0]?.url;
  const video_tour_url = listing.videos?.[0]?.url
    ? `https://www.youtube.com/watch?v=${listing.videos[0].url}`
    : undefined;
  const media = {
    images: listing.images || [],
    main_image: listing.images?.[0],
    virtual_tour_url,
    video_tour_url
  };

  // Portal
  const source_url = listing.url;
  const source_platform = 'reality';
  const portal_id = `reality-${listing.id}`;
  const status = listing.outdated ? 'removed' as const : 'active' as const;

  return ({
    property_category: 'house' as const,
    title,
    price,
    currency,
    transaction_type,
    location,
    property_subtype: detectHouseSubtype(listing.api_type, listing.title, listing.description),
    bedrooms,
    bathrooms: parseNumber(info['Koupelna'] || info['Koupelny']) ?? 1,
    sqm_living,
    sqm_plot,
    sqm_total: undefined,
    rooms,
    has_garden,
    garden_area: parseArea(info['Plocha zahrady']),
    has_garage,
    garage_count: has_garage === true ? 1 : undefined,
    has_parking,
    parking_spaces: has_parking === true ? 1 : undefined,
    has_basement,
    cellar_area: parseArea(info['Plocha sklepa'] || info['Sklep plocha']),
    has_pool,
    has_terrace,
    terrace_area: parseArea(info['Plocha terasy'] || info['Terasa plocha']),
    has_fireplace,
    has_balcony,
    balcony_area: parseArea(info['Plocha balkonu'] || info['Balkón plocha']),
    stories,
    year_built,
    renovation_year,
    furnished: (info['Vybavení'] || info['Vybavenost'] || info['Zařízení nábytkem']) ? normalizeFurnished(info['Vybavení'] || info['Vybavenost'] || info['Zařízení nábytkem']) as HousePropertyTierI['furnished'] : undefined,
    published_date: listing.created_at || undefined,
    condition,
    heating_type,
    construction_type,
    energy_class,
    roof_type: undefined,
    property_tax: undefined,
    hoa_fees: parsePrice(info['Poplatky'] || info['Měsíční náklady'] || info['Poplatky SVJ'] || info['Poplatky za bydlení']),
    deposit: parsePrice(info['Kauce'] || info['Vratná kauce'] || info['Jistina']),
    utility_charges: parsePrice(info['Energie'] || info['Poplatky za energie'] || info['Náklady na energie']),
    service_charges: parsePrice(info['Poplatky za služby'] || info['Služby']),
    is_commission: listing.has_commission ?? undefined,
    commission_note: listing.price_note || undefined,
    available_from: parseDate(info['K nastěhování'] || info['Dostupné od'] || info['Volné od']),
    min_rent_days: undefined,
    max_rent_days: undefined,
    media,
    agent: (() => {
      const name = listing.contact?.broker?.name || listing.contact?.advertiser?.name;
      if (!name) return undefined;
      return {
        name,
        phone: listing.contact!.broker?.phones?.[0] || listing.contact!.advertiser?.phones?.[0] || listing.contact!.real_estate?.phones?.[0],
        email: listing.contact!.broker?.email || listing.contact!.advertiser?.email || listing.contact!.real_estate?.email,
        agency: listing.contact!.real_estate?.name,
      };
    })(),
    source_url,
    source_platform,
    portal_id,
    status,
    description: listing.description,
    features: extractFeatures(listing.information),

    // Tier II: Legacy Media Fields
    images: listing.images || [],
    videos: undefined,

    // Tier III: Portal & Country Metadata
    portal_metadata: {
      reality: {
        id: listing.id,
        custom_id: listing.custom_id,
        api_type: listing.api_type,
        price_note: listing.price_note,
        previous_price: listing.previous_price,
        has_commission: listing.has_commission,
        created_at: listing.created_at,
        modified_at: listing.modified_at,
        scraped_at: listing.scraped_at,
        outdated: listing.outdated,
        contact: listing.contact ? {
          company: listing.contact.real_estate?.name,
          broker: listing.contact.broker?.name
        } : undefined
      }
    },
    country_specific: {
      czech: {
        disposition: disposition ? normalizeDisposition(disposition) : undefined,
        ownership: (info['Vlastnictví'] || info['Forma vlastnictví']) ? normalizeOwnership(info['Vlastnictví'] || info['Forma vlastnictví']) : undefined,
        condition: normalizedCondition,
        heating_type: heating_type || undefined,
        construction_type: construction_type || undefined,
        energy_rating: energy_class,
        furnished: info['Vybavení'] ? normalizeFurnished(info['Vybavení']) : undefined,
        renovation_year,
        has_garden
      }
    }
  }) as HousePropertyTierI;
}

// ============ Helper Functions ============

function buildInfoMap(information: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of information) {
    if (entry.key && entry.value) {
      const key = entry.key.replace(/:$/, '').trim();
      map[key] = entry.value.replace(/\s+/g, ' ').trim();
    }
  }
  return map;
}

function extractCity(place?: string): string {
  if (!place) return 'Unknown';
  return place.split(' - ')[0].trim() || 'Unknown';
}

function extractRegion(place?: string): string | undefined {
  if (!place) return undefined;
  const parts = place.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : undefined;
}

function extractBedrooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;
  const match = disposition.match(/^(\d)/);
  return match ? parseInt(match[1]) : undefined;
}

function extractRooms(disposition?: string): number | undefined {
  if (!disposition) return undefined;
  const match = disposition.match(/^(\d)\+(\d|kk)/i);
  if (!match) return undefined;
  return parseInt(match[1]) + (match[2].toLowerCase() === 'kk' ? 0 : 1);
}

function parseArea(str?: string): number | undefined {
  if (!str) return undefined;
  const match = str.match(/([\d.,\s]+)/);
  if (!match) return undefined;
  let num = match[1].replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(num)) {
    num = num.replace(/\./g, '');
  }
  return parseFloat(num.replace(',', '.'));
}

function parseNumber(str?: string): number | undefined {
  if (!str) return undefined;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

function parsePrice(str?: string): number | undefined {
  if (!str) return undefined;
  const cleaned = str.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned) : undefined;
}

function parseBooleanInfo(value?: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const v = value.toLowerCase().trim();
  if (v === '') return undefined;
  if (v === 'ne' || v === 'no' || v === '0' || v === 'false' || v === 'není') return false;
  if (v === 'ano' || v === 'yes' || v === '1' || v === 'true' || v.startsWith('ano')) return true;
  return undefined;
}

/** Extract sqm from api_type string like "dům 273 m², pozemek 10.137 m²" */
function extractSqmFromType(apiType?: string): number | undefined {
  if (!apiType) return undefined;
  const match = apiType.match(/([\d.,]+)\s*m[²2]/);
  return match ? parseFloat(match[1].replace(/\./g, '').replace(',', '.')) : undefined;
}

function parseDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const czechMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (czechMatch) {
    const [, day, month, year] = czechMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
}

function parseYear(str: string): number | undefined {
  const match = str.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
  if (match) {
    const year = parseInt(match[0]);
    if (year >= 1800 && year <= 2100) return year;
  }
  return undefined;
}

function mapConditionToTierI(normalized?: string): HousePropertyTierI['condition'] {
  if (!normalized) return undefined;
  if (normalized === 'very_good') return 'excellent';
  if (normalized === 'before_renovation') return 'requires_renovation';
  if (normalized === 'project' || normalized === 'under_construction') return 'new';
  return normalized as HousePropertyTierI['condition'];
}

/** Detect house subtype from api_type, title, and description */
function detectHouseSubtype(apiType?: string, title?: string, description?: string): HousePropertyTierI['property_subtype'] {
  const t = (apiType || '').toLowerCase() + ' ' + (title || '').toLowerCase();
  const d = (description || '').toLowerCase();

  // Villa
  if (t.includes('vila') || t.includes('villa')) {
    return 'villa';
  }

  // Cottage (chalupa, chata = Czech recreational houses)
  if (t.includes('chalupa') || t.includes('chata') || d.includes('chalupa') || d.includes('chata') || t.includes('rekreační')) {
    return 'cottage';
  }

  // Farmhouse (statek, usedlost)
  if (t.includes('statek') || t.includes('usedlost') || d.includes('statek')) {
    return 'farmhouse';
  }

  // Bungalow
  if (t.includes('bungalov') || t.includes('bungalow') || d.includes('bungalov')) {
    return 'bungalow';
  }

  // Terraced (řadový)
  if (t.includes('řadový') || t.includes('radový') || d.includes('řadový')) {
    return 'terraced';
  }

  // Semi-detached (dvojdomek)
  if (t.includes('dvojdomek') || d.includes('dvojdomek')) {
    return 'semi_detached';
  }

  // Townhouse
  if (t.includes('městský dům') || t.includes('townhouse')) {
    return 'townhouse';
  }

  return undefined;
}

function extractFeatures(information: Array<{ key: string; value: string }>): string[] {
  const featureKeys = ['Balkon', 'Terasa', 'Sklep', 'Garáž', 'Parkování', 'Zahrada', 'Bazén', 'Krb'];
  return information
    .filter(i => featureKeys.includes(i.key) && parseBooleanInfo(i.value) === true)
    .map(i => i.key);
}
