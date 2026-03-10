import { HousePropertyTierI, PropertyLocation, PropertyAgent } from '@landomo/core';
import { IdnesListing } from '../../types/idnesTypes';
import {
  normalizeCondition,
  normalizeHeatingType,
  normalizeConstructionType,
  normalizeEnergyRating,
  normalizeFurnished,
  normalizeDisposition,
  normalizeOwnership,
} from '../../../../shared/czech-value-mappings';
import {
  mapTransactionType,
  extractCityFromLocation,
  extractBedroomsFromDisposition,
  parseBathroomsFromAttrs,
  parseRooms,
  extractAreaFromAttrs,
  parseAmenitiesFromAttrs,
  parseParkingSpacesFromAttrs,
  checkGarageFromParking,
  parseBooleanFromAttr,
  parseMoneyFromAttrs,
  parseYearBuiltFromAttrs,
  extractDepositFromAttrs,
  extractRenovationYearFromAttrs,
  extractAvailableFromAttrs,
  extractCommissionFromAttrs,
} from '../../utils/idnesHelpers';

/**
 * Transform Idnes House to HousePropertyTierI
 *
 * House-specific fields:
 * - sqm_living, sqm_plot (plot area is critical!)
 * - has_garden, garden_area
 * - has_garage, has_parking
 * - stories
 */
export function transformIdnesHouse(listing: IdnesListing): HousePropertyTierI {
  // Core
  const title = listing.title || 'Untitled';
  const price = listing.price ?? null;
  const currency = 'CZK';
  const transaction_type = mapTransactionType(listing.transactionType);

  // Location
  const city = listing.location?.city || extractCityFromLocation(listing.location) || 'Unknown';
  const location: PropertyLocation = {
    address: listing.location?.address,
    city: city,
    region: listing.location?.region || listing.location?.district,
    country: 'Czech Republic',
    coordinates: listing.coordinates ? {
      lat: listing.coordinates.lat,
      lon: listing.coordinates.lng
    } : undefined
  };

  // House Areas
  const sqm_living = listing.area ?? extractAreaFromAttrs(listing._attributes, ['užitná plocha', 'plocha bytu']) ?? null;
  const sqm_plot = listing.plotArea ?? extractAreaFromAttrs(listing._attributes, ['plocha pozemku']) ?? null;
  const bedrooms = extractBedroomsFromDisposition(listing.rooms) ?? null;
  const bathrooms = parseBathroomsFromAttrs(listing._attributes);
  const rooms = parseRooms(listing.rooms);

  // Amenities (from _attributes, not features[] which is empty for idnes)
  const amenities = parseAmenitiesFromAttrs(listing._attributes);

  // Building
  const normalizedCondition = listing.condition ? normalizeCondition(listing.condition) : undefined;
  const condition = normalizedCondition === 'very_good' ? 'excellent' :
                    normalizedCondition === 'before_renovation' ? 'requires_renovation' :
                    normalizedCondition === 'project' ? 'new' :
                    normalizedCondition === 'under_construction' ? 'new' :
                    (normalizedCondition as HousePropertyTierI['condition']);
  const heating_type = listing.heatingType ? normalizeHeatingType(listing.heatingType) : undefined;
  const construction_type = listing.constructionType ? normalizeConstructionType(listing.constructionType) as HousePropertyTierI['construction_type'] : undefined;
  const energy_class = listing.energyRating ? normalizeEnergyRating(listing.energyRating) : undefined;

  // Year built & HOA fees
  const year_built = parseYearBuiltFromAttrs(listing._attributes);
  const hoa_fees = parseMoneyFromAttrs(listing._attributes, ['poplatky', 'měsíční náklady', 'náklady na bydlení', 'poplatky za služby']);

  // Agent
  const agent: PropertyAgent | undefined = listing.realtor?.name ? {
    name: listing.realtor.name,
    phone: listing.realtor.phone,
    email: listing.realtor.email,
  } : undefined;

  // Media
  const media = {
    images: listing.images || [],
    main_image: listing.images?.[0],
    virtual_tour_url: undefined
  };

  // Portal
  const source_url = listing.url;
  const source_platform = 'idnes-reality';
  const portal_id = `idnes-${listing.id}`;
  const status = 'active' as const;

  return ({
    property_category: 'house' as const,
    title,
    price,
    currency,
    transaction_type,
    location,

    // Czech country fields
    country_specific: {
      czech_disposition: normalizeDisposition(listing.rooms || listing._attributes?.['počet místností']),
      czech_ownership: normalizeOwnership(listing.ownership || listing._attributes?.['vlastnictví']),
    },

    property_subtype: mapHouseSubtype(listing._attributes?.['poloha domu']),
    bedrooms,
    bathrooms: bathrooms ?? 1,
    sqm_living,
    sqm_plot,
    sqm_total: extractAreaFromAttrs(listing._attributes, ['zastavěná plocha']),
    rooms,
    has_garden: amenities.has_garden,
    garden_area: extractAreaFromAttrs(listing._attributes, ['plocha zahrady']),
    has_garage: amenities.has_garage ?? checkGarageFromParking(listing._attributes),
    garage_count: (amenities.has_garage ?? checkGarageFromParking(listing._attributes)) ? 1 : undefined,
    has_parking: amenities.has_parking,
    parking_spaces: parseParkingSpacesFromAttrs(listing._attributes) ?? (amenities.has_parking ? 1 : undefined),
    has_basement: amenities.has_basement,
    cellar_area: undefined,
    has_pool: parseBooleanFromAttr(listing._attributes?.['bazén']),
    has_terrace: amenities.has_terrace,
    terrace_area: undefined,
    has_fireplace: undefined,
    has_balcony: amenities.has_balcony,
    balcony_area: undefined,
    stories: extractAreaFromAttrs(listing._attributes, ['počet podlaží']),
    year_built,
    renovation_year: extractRenovationYearFromAttrs(listing._attributes),
    furnished: listing.furnished ? normalizeFurnished(listing.furnished) as HousePropertyTierI['furnished'] : undefined,
    published_date: listing.metadata?.published || undefined,
    condition,
    heating_type,
    construction_type,
    energy_class,
    roof_type: undefined,
    property_tax: undefined,
    hoa_fees,
    deposit: extractDepositFromAttrs(listing._attributes),
    utility_charges: undefined,
    service_charges: undefined,
    is_commission: extractCommissionFromAttrs(listing._attributes)?.is_commission,
    commission_note: extractCommissionFromAttrs(listing._attributes)?.commission_note,
    available_from: extractAvailableFromAttrs(listing._attributes),
    min_rent_days: undefined,
    max_rent_days: undefined,
    media,
    agent,
    source_url,
    source_platform,
    portal_id,
    status,
    description: listing.description || listing.title || '',
    features: listing.features || [],

    // Top-level images (required by ingest API)
    images: listing.images || [],
  }) as HousePropertyTierI;
}

function mapHouseSubtype(polohaDomu?: string): 'detached' | 'terraced' | 'semi_detached' | undefined {
  if (!polohaDomu) return undefined;
  const lower = polohaDomu.toLowerCase().trim();
  if (lower === 'samostatný') return 'detached';
  if (lower === 'řadový') return 'terraced';
  if (lower === 'rohový') return 'semi_detached';
  if (lower === 'v bloku') return 'terraced';
  return undefined;
}
