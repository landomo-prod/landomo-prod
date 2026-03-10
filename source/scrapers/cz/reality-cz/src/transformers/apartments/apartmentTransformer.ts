import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  normalizeDisposition,
  normalizeOwnership,
  normalizeCondition,
  normalizeFurnished,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType,
  parseCzechFeatures
} from '../../../../shared/czech-value-mappings';

/**
 * Transform Reality.cz API Apartment to ApartmentPropertyTierI
 *
 * API data provides structured information[] array with key-value pairs
 * and GPS coordinates - significant improvement over HTML scraping
 */
export function transformRealityApartment(listing: RealityListing): ApartmentPropertyTierI {
  // Parse the structured information array into a lookup map
  const info = buildInfoMap(listing.information);

  // ============ Core Identification ============
  const title = listing.title;
  const price = listing.price ?? undefined;
  const currency = listing.currency || 'CZK';
  const transaction_type = listing.transaction_type;

  // ============ Location (with GPS from API!) ============
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

  // ============ Apartment Details from information[] ============
  const disposition = info['Dispozice'] || info['Velikost bytu'];
  const bedrooms = extractBedrooms(disposition) ?? undefined;
  const sqm = parseArea(info['Plocha'] || info['Užitná plocha'] || info['Podlahová plocha'] || info['Plocha bytu']) ?? extractSqmFromType(listing.api_type) ?? undefined;
  const floor = parseFloor(info['Podlaží'] || info['Patro']);
  const total_floors = parseNumber(info['Počet podlaží'] || info['Celkem podlaží'] || info['Počet NP']);
  const rooms = extractRooms(disposition);

  // ============ Area Breakdowns ============
  const balcony_area = parseArea(info['Plocha balkonu'] || info['Balkón plocha']);
  const loggia_area = parseArea(info['Plocha lodžie'] || info['Lodžie plocha']);
  const terrace_area = parseArea(info['Plocha terasy'] || info['Terasa plocha']);
  const cellar_area = parseArea(info['Plocha sklepa'] || info['Sklep plocha']);

  // ============ Amenities ============
  const has_elevator = parseBooleanInfo(info['Výtah']);
  const has_balcony = parseBooleanInfo(info['Balkon']) ?? ((info['Balkon, terasa'] !== undefined && info['Balkon, terasa'] !== '') || balcony_area !== undefined ? true : undefined);
  const has_basement = parseBooleanInfo(info['Sklep']) ?? (cellar_area !== undefined ? true : undefined);
  const has_parking = parseBooleanInfo(info['Parkování']) ?? parseBooleanInfo(info['Parkovací stání']) ?? (hasParking(info['Parkování']) ? true : undefined);
  const has_loggia = parseBooleanInfo(info['Lodžie']) ?? (loggia_area !== undefined ? true : undefined);
  const has_terrace = parseBooleanInfo(info['Terasa']) ?? (terrace_area !== undefined ? true : undefined);
  const has_garage = parseBooleanInfo(info['Garáž']);

  // ============ Building Context ============
  const rawCondition = info['Stav'] || info['Stav objektu'];
  const normalizedCondition = rawCondition ? normalizeCondition(rawCondition) : undefined;
  const condition = mapConditionToTierI(normalizedCondition);

  const rawHeating = info['Topení'] || info['Vytápění'];
  const heating_type = rawHeating ? normalizeHeatingType(rawHeating) : undefined;

  const rawConstruction = info['Stavba'] || info['Druh budovy'] || info['Konstrukce'] || info['Typ budovy'];
  const construction_type = rawConstruction ? normalizeConstructionType(rawConstruction) as ApartmentPropertyTierI['construction_type'] : undefined;

  const rawEnergy = info['Energetická třída'] || info['PENB'] || info['Energetický štítek'] || info['Energet. náročnost'];
  const energy_class = rawEnergy ? normalizeEnergyRating(rawEnergy) : undefined;

  const floor_location = extractFloorLocation(floor, total_floors);

  // ============ Financials ============
  const price_per_sqm = price != null && sqm ? Math.round(price / sqm) : undefined;
  const deposit = parsePrice(info['Kauce'] || info['Vratná kauce'] || info['Jistina']);
  const hoa_fees = parsePrice(info['Poplatky'] || info['Měsíční náklady'] || info['Poplatky SVJ'] || info['Poplatky za bydlení']);
  const service_charges = parsePrice(info['Poplatky za služby'] || info['Služby']);
  const utility_charges = parsePrice(info['Energie'] || info['Poplatky za energie'] || info['Náklady na energie']);

  // ============ Rental-Specific ============
  const available_from = parseDate(info['K nastěhování'] || info['Dostupné od'] || info['Volné od']);

  // ============ Media ============
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

  // ============ Portal & Lifecycle ============
  const source_url = listing.url;
  const source_platform = 'reality';
  const portal_id = `reality-${listing.id}`;
  const status = listing.outdated ? 'removed' as const : 'active' as const;

  // ============ Czech-Specific Fields ============
  const czech_disposition = normalizeDisposition(disposition);
  const rawOwnership = info['Vlastnictví'] || info['Forma vlastnictví'];
  const czech_ownership = rawOwnership ? normalizeOwnership(rawOwnership) : undefined;

  const rawFurnished = info['Vybavení'] || info['Zařízení'] || info['Vybavenost'] || info['Zařízení nábytkem'];
  const furnished = rawFurnished ? normalizeFurnished(rawFurnished) as ApartmentPropertyTierI['furnished'] : undefined;
  const yearBuiltStr = info['Rok výstavby'] || info['Rok kolaudace'];
  const year_built = yearBuiltStr ? parseYear(yearBuiltStr) : undefined;
  const renovationStr = info['Rok rekonstrukce'] || info['Rekonstrukce rok'];
  const renovation_year = renovationStr ? parseYear(renovationStr) : undefined;
  const published_date = listing.created_at || undefined;

  // ============ Assemble ApartmentPropertyTierI ============
  return ({
    property_category: 'apartment' as const,
    title,
    price,
    currency,
    transaction_type,
    location,
    property_subtype: detectApartmentSubtype(disposition, listing.title, listing.description),
    bedrooms,
    bathrooms: parseNumber(info['Koupelna'] || info['Koupelny']) ?? 1,
    sqm,
    floor,
    total_floors,
    rooms,
    has_elevator,
    has_balcony,
    balcony_area,
    has_basement,
    cellar_area,
    has_parking,
    has_loggia,
    loggia_area,
    has_terrace,
    terrace_area,
    has_garage,
    condition,
    heating_type,
    construction_type,
    energy_class,
    floor_location,
    year_built,
    furnished,
    renovation_year,
    published_date,
    hoa_fees,
    deposit,
    utility_charges,
    service_charges,
    is_commission: listing.has_commission ?? undefined,
    commission_note: listing.price_note || undefined,
    available_from,
    min_rent_days: undefined,
    max_rent_days: undefined,
    parking_spaces: parseNumber(info['Počet stání']),
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
        disposition: czech_disposition,
        ownership: czech_ownership,
        condition: normalizedCondition,
        heating_type: heating_type || undefined,
        construction_type: construction_type || undefined,
        energy_rating: energy_class,
        furnished: rawFurnished ? normalizeFurnished(rawFurnished) : undefined,
        floor_number: floor,
        is_barrier_free: parseBooleanInfo(info['Bezbariérový']),
        has_ac: parseBooleanInfo(info['Klimatizace'])
      }
    }
  }) as ApartmentPropertyTierI;
}

// ============ Helper Functions ============

/** Build a key-value map from API information[] array (strips trailing colons from keys) */
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

/** Extract city from place string like "Praha 1 - Stare Mesto" */
function extractCity(place?: string): string {
  if (!place) return 'Unknown';
  // Take the first part before " - "
  const parts = place.split(' - ');
  return parts[0].trim() || 'Unknown';
}

/** Extract region/district from place string */
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
  const baseRooms = parseInt(match[1]);
  const additional = match[2].toLowerCase() === 'kk' ? 0 : 1;
  return baseRooms + additional;
}

/** Parse area string like "75 m2" or "10.137 m²" (Czech thousands separator) to number */
function parseArea(areaStr?: string): number | undefined {
  if (!areaStr) return undefined;
  const match = areaStr.match(/([\d.,\s]+)/);
  if (!match) return undefined;
  let num = match[1].replace(/\s/g, '');
  // Czech format: "10.137" means 10137 (dot as thousands separator)
  if (/^\d{1,3}(\.\d{3})+$/.test(num)) {
    num = num.replace(/\./g, '');
  }
  return parseFloat(num.replace(',', '.'));
}

/** Parse floor string like "3. podlazi" or "3/5" to number */
function parseFloor(floorStr?: string): number | undefined {
  if (!floorStr) return undefined;
  const match = floorStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/** Parse a simple number from a string */
function parseNumber(str?: string): number | undefined {
  if (!str) return undefined;
  const match = str.match(/(\d+)/);
  return match ? parseInt(match[1]) : undefined;
}

/** Parse price string like "15 000 Kc" to number */
function parsePrice(priceStr?: string): number | undefined {
  if (!priceStr) return undefined;
  const cleaned = priceStr.replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned) : undefined;
}

/** Parse Czech boolean info values: "Ano" = true, "Ne" = false, null if field not present */
function parseBooleanInfo(value?: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const v = value.toLowerCase().trim();
  if (v === '') return undefined;
  if (v === 'ne' || v === 'no' || v === '0' || v === 'false' || v === 'není') return false;
  if (v === 'ano' || v === 'yes' || v === '1' || v === 'true' || v.startsWith('ano')) return true;
  return undefined;
}

/** Parse Czech date format DD.MM.YYYY to ISO date */
function parseDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const czechMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (czechMatch) {
    const [, day, month, year] = czechMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // Try ISO format
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  } catch { /* ignore */ }
  return undefined;
}

/** Parse year from string */
function parseYear(str: string): number | undefined {
  const match = str.match(/\b(1[8-9]\d{2}|20\d{2})\b/);
  if (match) {
    const year = parseInt(match[0]);
    if (year >= 1800 && year <= 2100) return year;
  }
  return undefined;
}

/** Map condition to Tier I values */
function mapConditionToTierI(normalized?: string): ApartmentPropertyTierI['condition'] {
  if (!normalized) return undefined;
  if (normalized === 'very_good') return 'excellent';
  if (normalized === 'before_renovation') return 'requires_renovation';
  if (normalized === 'project' || normalized === 'under_construction') return 'new';
  return normalized as ApartmentPropertyTierI['condition'];
}

function extractFloorLocation(floorNum?: number, totalFloors?: number): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floorNum === undefined) return undefined;
  if (floorNum === 0) return 'ground_floor';
  if (totalFloors !== undefined && (floorNum === totalFloors || floorNum === totalFloors - 1)) return 'top_floor';
  return 'middle_floor';
}

/** Check parking from descriptive values like "parkovací místo 1x", "ano, 1x", "Počet stání: 1" */
function hasParking(value?: string): boolean {
  if (!value) return false;
  const v = value.toLowerCase().trim();
  if (v === 'ne' || v === '') return false;
  return v.includes('parkov') || v.includes('stání') || v.includes('garáž') || /\d+x/.test(v);
}

/** Extract sqm from api_type string like "byt 2+1, 62 m², panel, osobní" */
function extractSqmFromType(apiType?: string): number | undefined {
  if (!apiType) return undefined;
  const match = apiType.match(/([\d.,]+)\s*m[²2]/);
  return match ? parseFloat(match[1].replace(/\./g, '').replace(',', '.')) : undefined;
}

/** Detect apartment subtype from disposition, title, and description */
function detectApartmentSubtype(disposition?: string, title?: string, description?: string): ApartmentPropertyTierI['property_subtype'] {
  const disp = disposition?.toLowerCase() || '';
  const t = title?.toLowerCase() || '';
  const d = description?.toLowerCase() || '';

  // Studio (1+kk or 1+0)
  if (disp === '1+kk' || disp === '1+0' || disp === 'garsoniéra') {
    return 'studio';
  }

  // Penthouse
  if (t.includes('penthouse') || d.includes('penthouse')) {
    return 'penthouse';
  }

  // Loft
  if (t.includes('loft') || d.includes('loft')) {
    return 'loft';
  }

  // Atelier
  if (t.includes('atelier') || t.includes('ateliér') || d.includes('ateliér')) {
    return 'atelier';
  }

  // Maisonette (mezonet in Czech)
  if (t.includes('mezonet') || d.includes('mezonet') || t.includes('maisonette')) {
    return 'maisonette';
  }

  return undefined;
}

/** Extract feature strings from information array */
function extractFeatures(information: Array<{ key: string; value: string }>): string[] {
  const featureKeys = ['Balkon', 'Terasa', 'Sklep', 'Výtah', 'Lodžie', 'Garáž', 'Parkování', 'Klimatizace', 'Bezbariérový'];
  return information
    .filter(i => featureKeys.includes(i.key) && parseBooleanInfo(i.value) === true)
    .map(i => i.key);
}
