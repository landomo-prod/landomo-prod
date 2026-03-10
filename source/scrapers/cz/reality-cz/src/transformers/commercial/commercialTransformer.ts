import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  normalizeCondition,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeEnergyRating,
  normalizeFurnished,
} from '../../../../shared/czech-value-mappings';

/**
 * Transform Reality.cz API Commercial property to CommercialPropertyTierI
 *
 * API data provides structured information[] array and GPS coordinates
 */
export function transformRealityCommercial(listing: RealityListing): CommercialPropertyTierI {
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

  // Commercial Details
  const sqm_total = parseArea(info['Plocha'] || info['Celková plocha'] || info['Užitná plocha'] || info['Podlahová plocha'] || info['Plocha bytu']) ?? extractSqmFromType(listing.api_type) ?? undefined;
  const sqm_usable = parseArea(info['Užitná plocha']);
  const sqm_office = parseArea(info['Kancelářská plocha'] || info['Plocha kanceláří']);
  const sqm_retail = parseArea(info['Prodejní plocha']);
  const sqm_storage = parseArea(info['Skladová plocha'] || info['Sklad']);
  const sqm_plot = parseArea(info['Plocha pozemku'] || info['Pozemek']);

  // Floors
  const floor = parseNumber(info['Podlaží'] || info['Patro']);
  const total_floors = parseNumber(info['Počet podlaží'] || info['Celkem podlaží'] || info['Počet NP']);
  const floor_location = determineFloorLocation(floor, total_floors);

  // Amenities (REQUIRED booleans)
  const has_elevator = parseBooleanInfo(info['Výtah']);
  const has_parking = parseBooleanInfo(info['Parkování']) ?? parseBooleanInfo(info['Parkovací stání']);
  const has_bathrooms = parseBooleanInfo(info['WC']) ?? parseBooleanInfo(info['Sociální zařízení']);

  // Commercial-specific amenities
  const parking_spaces = parseNumber(info['Počet parkovacích míst'] || info['Počet stání']);
  const has_loading_dock = parseBooleanInfo(info['Rampa'] || info['Nakládací rampa']);
  const has_hvac = parseBooleanInfo(info['Klimatizace']) || parseBooleanInfo(info['Vzduchotechnika']);
  const has_air_conditioning = parseBooleanInfo(info['Klimatizace']);
  const has_security_system = parseBooleanInfo(info['Bezpečnostní systém'] || info['Alarm']);
  const has_reception = parseBooleanInfo(info['Recepce']);
  const has_kitchen = parseBooleanInfo(info['Kuchyňka'] || info['Kuchyň']);
  const has_disabled_access = parseBooleanInfo(info['Bezbariérový']);
  const has_fiber_internet = parseBooleanInfo(info['Optický internet'] || info['Internet']);

  // Property subtype detection
  const property_subtype = detectCommercialSubtype(info['Typ'] || info['Druh'] || listing.title);

  // Office rooms
  const office_rooms = parseNumber(info['Počet místností'] || info['Počet kanceláří']);
  const ceiling_height = parseDecimal(info['Světlá výška'] || info['Výška stropu']);

  // Building
  const rawCondition = info['Stav'] || info['Stav objektu'];
  const normalizedCondition = rawCondition ? normalizeCondition(rawCondition) : undefined;
  const condition = mapConditionToTierI(normalizedCondition);

  const rawHeating = info['Topení'] || info['Vytápění'];
  const heating_type = rawHeating ? normalizeHeatingType(rawHeating) : undefined;

  const rawConstruction = info['Stavba'] || info['Druh budovy'] || info['Konstrukce'] || info['Typ budovy'];
  const construction_type = rawConstruction ? normalizeConstructionType(rawConstruction) as CommercialPropertyTierI['construction_type'] : undefined;

  const rawEnergy = info['Energetická třída'] || info['PENB'] || info['Energetický štítek'] || info['Energet. náročnost'];
  const energy_class = rawEnergy ? normalizeEnergyRating(rawEnergy) : undefined;

  const yearBuiltStr = info['Rok výstavby'] || info['Rok kolaudace'];
  const year_built = yearBuiltStr ? parseYear(yearBuiltStr) : undefined;
  const renovationStr = info['Rok rekonstrukce'] || info['Rekonstrukce rok'];
  const renovation_year = renovationStr ? parseYear(renovationStr) : undefined;

  // Financials
  const monthly_rent = transaction_type === 'rent' ? price : undefined;
  const price_per_sqm = price != null && sqm_total ? Math.round(price / sqm_total) : undefined;
  const deposit = parsePrice(info['Kauce'] || info['Vratná kauce'] || info['Jistina']);
  const operating_costs = parsePrice(info['Provozní náklady']);
  const service_charges = parsePrice(info['Poplatky za služby']);

  // Availability
  const available_from = parseDate(info['K nastěhování'] || info['Dostupné od'] || info['Volné od']);

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
    property_category: 'commercial' as const,
    property_type: classifyCommercialPropertyType(title),
    title,
    price,
    currency,
    transaction_type,
    location,
    property_subtype,
    sqm_total,
    sqm_usable,
    sqm_office,
    sqm_retail,
    sqm_storage,
    sqm_plot,
    total_floors,
    floor,
    floor_location,
    office_rooms,
    ceiling_height,
    has_elevator,
    has_parking,
    parking_spaces,
    has_loading_dock,
    has_hvac,
    has_air_conditioning,
    has_security_system,
    has_reception,
    has_kitchen,
    has_bathrooms,
    has_disabled_access,
    has_fiber_internet,
    year_built,
    renovation_year,
    condition,
    heating_type,
    construction_type,
    energy_class,
    monthly_rent,
    price_per_sqm,
    deposit,
    operating_costs,
    service_charges,
    is_commission: listing.has_commission ?? undefined,
    commission_note: listing.price_note || undefined,
    published_date: listing.created_at || undefined,
    available_from,
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
        condition: normalizedCondition,
        heating_type: heating_type || undefined,
        construction_type: construction_type || undefined,
        energy_rating: energy_class,
        furnished: (info['Vybavení'] || info['Vybavenost'] || info['Zařízení nábytkem']) ? normalizeFurnished(info['Vybavení'] || info['Vybavenost'] || info['Zařízení nábytkem']) : undefined,
        zoning: detectZoning(info['Využití'] || info['Určení'])
      }
    }
  }) as CommercialPropertyTierI;
}

/**
 * Classify commercial property_type from Czech title
 */
function classifyCommercialPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('kancelář') || t.includes('kancelar')) return 'office';
  if (t.includes('sklad')) return 'warehouse';
  if (t.includes('obchod')) return 'retail';
  if (t.includes('výrob') || t.includes('hal')) return 'production';
  if (t.includes('restaur')) return 'restaurant';
  if (t.includes('ubytovací') || t.includes('hotel') || t.includes('penzion')) return 'accommodation';
  if (t.includes('činžovní')) return 'apartment_building';
  if (t.includes('ordinac')) return 'medical_office';
  if (t.includes('zemědělský')) return 'agricultural';
  return 'other';
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

function parseDecimal(str?: string): number | undefined {
  if (!str) return undefined;
  const match = str.match(/([\d.,]+)/);
  return match ? parseFloat(match[1].replace(',', '.')) : undefined;
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

/** Extract sqm from api_type string like "obchodní prostory, plocha 1.800 m²" */
function extractSqmFromType(apiType?: string): number | undefined {
  if (!apiType) return undefined;
  const match = apiType.match(/([\d.,\s]+)\s*m[²2]/);
  if (!match) return undefined;
  let num = match[1].replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(num)) {
    num = num.replace(/\./g, '');
  }
  return parseFloat(num.replace(',', '.'));
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

function mapConditionToTierI(normalized?: string): CommercialPropertyTierI['condition'] {
  if (!normalized) return undefined;
  if (normalized === 'very_good') return 'excellent';
  if (normalized === 'before_renovation') return 'requires_renovation';
  if (normalized === 'project' || normalized === 'under_construction') return 'new';
  return normalized as CommercialPropertyTierI['condition'];
}

function determineFloorLocation(floor?: number, total_floors?: number): CommercialPropertyTierI['floor_location'] {
  if (floor === undefined) return undefined;
  if (floor === 0) return 'ground_floor';
  if (floor < 0) return 'basement';

  if (total_floors !== undefined) {
    if (floor === total_floors || floor === total_floors - 1) return 'top_floor';
    return 'middle_floor';
  }

  return 'middle_floor';
}

function detectCommercialSubtype(typeStr?: string): CommercialPropertyTierI['property_subtype'] {
  if (!typeStr) return undefined;

  const t = typeStr.toLowerCase();
  if (t.includes('kancelář') || t.includes('kancelar') || t.includes('office')) return 'office';
  if (t.includes('prodej') || t.includes('obchod') || t.includes('retail')) return 'retail';
  if (t.includes('sklad') || t.includes('warehouse')) return 'warehouse';
  if (t.includes('výrob') || t.includes('průmysl') || t.includes('industrial')) return 'industrial';
  if (t.includes('hotel')) return 'hotel';
  if (t.includes('restaurace') || t.includes('restaurant')) return 'restaurant';
  if (t.includes('ordinace') || t.includes('medical') || t.includes('zdravotní')) return 'medical';
  if (t.includes('showroom') || t.includes('výstavní')) return 'showroom';
  if (t.includes('smíšen') || t.includes('mixed')) return 'mixed_use';

  return undefined;
}

function detectZoning(zoneStr?: string): string | undefined {
  if (!zoneStr) return undefined;

  const z = zoneStr.toLowerCase();
  if (z.includes('komerční') || z.includes('obchod')) return 'commercial';
  if (z.includes('průmysl') || z.includes('výrob')) return 'industrial';
  if (z.includes('smíšen')) return 'mixed_use';
  if (z.includes('kancelář')) return 'office';
  if (z.includes('prodej')) return 'retail';

  return undefined;
}

function extractFeatures(information: Array<{ key: string; value: string }>): string[] {
  const featureKeys = ['Parkování', 'Výtah', 'Klimatizace', 'Recepce', 'Bezbariérový', 'Rampa', 'Internet'];
  return information
    .filter(i => featureKeys.includes(i.key) && parseBooleanInfo(i.value) === true)
    .map(i => i.key);
}
