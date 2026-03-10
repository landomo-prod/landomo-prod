import { CommercialPropertyTierI, PropertyLocation, PropertyAgent } from '@landomo/core';
import { IdnesListing } from '../../types/idnesTypes';
import {
  normalizeCondition,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeEnergyRating,
  normalizeFurnished,
} from '../../../../shared/czech-value-mappings';
import {
  mapTransactionType,
  parseAmenitiesFromAttrs,
  parseParkingSpacesFromAttrs,
  parseYearBuiltFromAttrs,
  parseFloorFromAttrs,
  parseTotalFloorsFromAttrs,
  extractRenovationYearFromAttrs,
  extractDepositFromAttrs,
  extractAvailableFromAttrs,
  extractCommissionFromAttrs,
} from '../../utils/idnesHelpers';

/**
 * Transform Idnes Commercial listing to CommercialPropertyTierI
 */
export function transformIdnesCommercial(listing: IdnesListing): CommercialPropertyTierI {
  const title = listing.title || 'Untitled';
  const price = listing.price ?? null;
  const currency = 'CZK';
  const transaction_type = mapTransactionType(listing.transactionType);

  const city = listing.location?.city || listing.location?.district || 'Unknown';
  const location: PropertyLocation = {
    address: listing.location?.address,
    city,
    region: listing.location?.region || listing.location?.district,
    country: 'Czech Republic',
    coordinates: listing.coordinates ? {
      lat: listing.coordinates.lat,
      lon: listing.coordinates.lng
    } : undefined
  };

  const sqm_total = listing.area ?? null;

  const amenities = parseAmenitiesFromAttrs(listing._attributes);
  const has_elevator = amenities.has_elevator;
  const has_parking = amenities.has_parking;
  const parking_spaces = parseParkingSpacesFromAttrs(listing._attributes);
  const commission = extractCommissionFromAttrs(listing._attributes);

  const normalizedCondition = listing.condition ? normalizeCondition(listing.condition) : undefined;
  const heating_type = listing.heatingType ? normalizeHeatingType(listing.heatingType) : undefined;

  // Detect subtype from propertyType / title
  const comm_property_subtype = detectCommercialSubtype(listing.propertyType, listing.title);

  // Year built & price per sqm
  const year_built = parseYearBuiltFromAttrs(listing._attributes);
  const price_per_sqm = (price && sqm_total) ? Math.round(price / sqm_total) : undefined;

  // Additional fields
  const floor = parseFloorFromAttrs(listing._attributes);
  const total_floors = parseTotalFloorsFromAttrs(listing._attributes);
  const construction_type = listing.constructionType ? normalizeConstructionType(listing.constructionType) as CommercialPropertyTierI['construction_type'] : undefined;
  const renovation_year = extractRenovationYearFromAttrs(listing._attributes);
  const deposit = extractDepositFromAttrs(listing._attributes);
  const furnished = listing.furnished ? normalizeFurnished(listing.furnished) as CommercialPropertyTierI['furnished'] : undefined;
  const available_from = extractAvailableFromAttrs(listing._attributes);
  const has_disabled_access = listing._attributes?.['bezbariérový přístup']?.toLowerCase().trim() === 'ano' ? true : undefined;

  // Agent
  const agent: PropertyAgent | undefined = listing.realtor?.name ? {
    name: listing.realtor.name,
    phone: listing.realtor.phone,
    email: listing.realtor.email,
  } : undefined;

  const media = {
    images: listing.images || [],
    main_image: listing.images?.[0],
  };

  return ({
    property_category: 'commercial' as const,
    property_type: classifyCommercialPropertyType(title),

    title,
    price,
    currency,
    transaction_type,
    location,

    sqm_total,
    has_elevator,
    has_parking,
    parking_spaces,
    has_bathrooms: undefined,
    property_subtype: comm_property_subtype,

    condition: normalizedCondition as CommercialPropertyTierI['condition'],
    heating_type,
    construction_type,
    energy_class: listing.energyRating ? normalizeEnergyRating(listing.energyRating) : undefined,
    year_built,
    renovation_year,
    floor,
    total_floors,
    price_per_sqm,
    deposit,
    furnished,
    available_from,
    has_disabled_access,
    is_commission: commission?.is_commission,
    commission_note: commission?.commission_note,
    published_date: listing.metadata?.published || undefined,

    media,
    agent,
    source_url: listing.url,
    source_platform: 'idnes-reality',
    portal_id: `idnes-${listing.id}`,
    status: 'active' as const,
    description: listing.description || listing.title || '',
    features: listing.features || [],

    // Top-level images (required by ingest API)
    images: listing.images || [],
  }) as unknown as CommercialPropertyTierI;
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

type CommercialSubtype = 'industrial' | 'office' | 'retail' | 'warehouse' | 'mixed_use' | 'hotel' | 'restaurant' | 'medical' | 'showroom';

function detectCommercialSubtype(propertyType?: string, title?: string): CommercialSubtype | undefined {
  const text = `${propertyType || ''} ${title || ''}`.toLowerCase();
  if (text.includes('kancelář') || text.includes('kancelar') || text.includes('office')) return 'office';
  if (text.includes('sklad') || text.includes('warehouse')) return 'warehouse';
  if (text.includes('obchod') || text.includes('retail') || text.includes('prodejna')) return 'retail';
  if (text.includes('výroba') || text.includes('industrial') || text.includes('hala')) return 'industrial';
  if (text.includes('restaurace') || text.includes('restaurant')) return 'restaurant';
  if (text.includes('hotel')) return 'hotel';
  return undefined;
}
