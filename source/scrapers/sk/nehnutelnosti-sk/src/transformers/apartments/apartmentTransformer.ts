import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { NehnutelnostiListing } from '../../types/nehnutelnostiTypes';
import {
  normalizeCondition,
  normalizeEnergyRating,
  normalizeHeatingType,
  normalizeConstructionType
} from '../../shared/slovak-value-mappings';
import {
  extractCoordinates,
  extractCity,
  extractBedrooms,
  extractBathrooms,
  extractSqm,
  extractFloor,
  extractRoomsFromDisposition,
  extractImages,
  extractAvailableFrom,
  extractDeposit,
  extractYearBuilt,
  extractRenovationYear,
  ensureAbsoluteUrl,
  mapConditionToEnglish,
  mapHeatingToEnglish,
  mapConstructionToEnglish,
  mapCategoryToDisposition
} from '../helpers';

export function transformNehnutelnostiApartment(
  listing: NehnutelnostiListing
): ApartmentPropertyTierI {
  const title = listing.name || listing.title || listing.headline || 'Unknown';
  const price = listing.price || listing.price_value || listing.price_eur || 0;
  const currency = listing.currency || 'EUR';
  const transaction_type = (listing.transaction_type || '').toLowerCase().includes('prenajom') ? 'rent' : 'sale';

  // Build structured address from street + street_number if available
  const structuredAddress = listing.street
    ? [listing.street, listing.street_number].filter(Boolean).join(' ')
    : undefined;

  const location: PropertyLocation = {
    address: structuredAddress || listing.address || listing.locality,
    city: extractCity(listing.city || listing.locality || ''),
    region: listing.region || listing.district,
    country: 'sk',
    coordinates: extractCoordinates(listing),
  };

  const bedrooms = extractBedrooms(listing) || 1;
  const sqm = extractSqm(listing) || 0;
  const images = extractImages(listing);

  // Extract from _raw.parameters (actual API structure)
  const rawParams = (listing as any)._raw?.parameters;
  const rawFlags = (listing as any)._raw?.flags;
  const rawMedia = (listing as any)._raw?.media;
  const totalRoomsCount = rawParams?.totalRoomsCount;
  const realEstateState = rawParams?.realEstateState;
  const categorySubValue = rawParams?.category?.subValue;

  const checkFeature = (keywords: string[]) => {
    const allFeatures = [...(listing.features || []), ...(listing.amenities || [])].join(' ').toLowerCase();
    return keywords.some(kw => allFeatures.includes(kw.toLowerCase()));
  };

  return {
    property_category: 'apartment',
    title,
    price,
    currency,
    transaction_type,
    location,
    bedrooms: totalRoomsCount || (listing.bedrooms_count ?? bedrooms),
    bathrooms: listing.bathrooms ?? extractBathrooms(listing),
    sqm,
    floor: extractFloor(listing),
    total_floors: listing.total_floors,
    rooms: totalRoomsCount || listing.rooms || extractRoomsFromDisposition(listing.disposition),
    has_elevator: listing.has_elevator ?? checkFeature(['výťah', 'vytah', 'elevator']),
    has_balcony: listing.has_balcony ?? checkFeature(['balkón', 'balkon', 'balcony']),
    has_parking: listing.has_parking ?? checkFeature(['parkovanie', 'parking']),
    has_basement: listing.has_basement ?? checkFeature(['pivnica', 'sklep', 'basement']),
    has_loggia: listing.loggia_area !== undefined || checkFeature(['lodžia', 'loggia']),
    has_terrace: listing.terrace_area !== undefined || checkFeature(['terasa', 'terrace']),
    has_garage: listing.has_garage ?? checkFeature(['garáž', 'garaz', 'garage']),
    parking_spaces: listing.parking_spaces_count,
    balcony_area: listing.balcony_area,
    cellar_area: listing.cellar_area,
    terrace_area: listing.terrace_area,
    loggia_area: listing.loggia_area,
    year_built: listing.year_built ?? extractYearBuilt(listing),
    renovation_year: listing.renovation_year ?? extractRenovationYear(listing),
    construction_type: mapConstructionToEnglish(normalizeConstructionType(listing.construction_type)) as any,
    condition: (listing.condition || realEstateState) ? normalizeCondition(listing.condition || realEstateState) as any : undefined,
    heating_type: mapHeatingToEnglish(normalizeHeatingType(listing.heating)),
    energy_class: normalizeEnergyRating(listing.energy_rating),
    deposit: extractDeposit(listing),
    utility_charges: transaction_type === 'rent' && listing.utility_cost
      ? (() => { const m = listing.utility_cost.replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : undefined; })()
      : undefined,
    available_from: extractAvailableFrom(listing),
    published_date: listing.published_date ?? listing.created_at,
    media: images.length > 0 ? { images } : undefined,
    features: listing.features || listing.amenities,
    description: listing.description || listing.text,
    source_url: ensureAbsoluteUrl(listing.url || listing.detail_url || `/detail/${listing.id}`),
    source_platform: 'nehnutelnosti-sk',
    portal_id: String(listing.id || listing.hash_id || ''),
    status: (listing.status === 'active' || listing.is_active) ? 'active' : 'removed',

    // ============ Tier II: Legacy Media Fields ============
    images,
    videos: undefined,

    // ============ Tier III: Portal & Country Metadata ============
    portal_metadata: {
      nehnutelnosti: {
        id: String(listing.id || listing.hash_id || ''),
        category: listing.category,
        category_main_cb: listing.category_main_cb,
        category_type_cb: listing.category_type_cb,
        locality: listing.locality,
        district: listing.district,
        price_note: listing.price_note,
        image_count: listing.image_count || listing.photo_count,
        is_active: listing.is_active,
        created_at: listing.created_at,
        updated_at: listing.updated_at,
        agent_name: listing.agent_name,
        agency_name: listing.agency_name,
        price_per_sqm: listing.price_per_sqm,
        advertiser_type: listing.advertiser_type,
        agent_profile_url: listing.agent_profile_url,
        agency_profile_url: listing.agency_profile_url,
        agency_website: listing.agency_website,
        agency_address: listing.agency_address,
        phone_partial: listing.phone_partial,
        listing_tier: rawFlags?.isTop ? 'top' : rawFlags?.isPremium ? 'premium' : undefined
      }
    },
    country_specific: {
      slovakia: {
        // Map category.subValue to disposition ("TWO_ROOM_APARTMENT" → "2-room")
        disposition: categorySubValue ? mapCategoryToDisposition(categorySubValue) : undefined,
        ownership: listing.ownership, // Not available in API
        condition: realEstateState ? normalizeCondition(realEstateState) : undefined,
        heating_type: normalizeHeatingType(listing.heating), // Not available in API
        construction_type: normalizeConstructionType(listing.construction_type), // Not available in API
        energy_rating: normalizeEnergyRating(listing.energy_rating), // Not available in API
        // Media flags from adv.media (not adv.flags)
        has_floor_plan: rawMedia?.floorPlans?.length > 0,
        has_3d_tour: rawMedia?.inspections3d?.length > 0,
        has_video: rawMedia?.videos?.length > 0,
        orientation: listing.orientation,
        wc_count: listing.wc_count,
        loggia_count: listing.loggia_count,
        year_approved: listing.year_approved,
        heat_source: listing.heat_source,
        balcony_count: listing.balcony_count,
        utility_included: listing.utility_included
      }
    }
  };
}
