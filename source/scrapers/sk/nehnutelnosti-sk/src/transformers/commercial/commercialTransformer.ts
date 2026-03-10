import { CommercialPropertyTierI } from '@landomo/core';
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
  extractSqm,
  extractYearBuilt,
  extractRenovationYear,
  extractImages,
  extractAvailableFrom,
  extractDeposit,
  ensureAbsoluteUrl,
  mapConditionToEnglish,
  mapHeatingToEnglish,
  mapConstructionToEnglish
} from '../helpers';

/**
 * Transform Nehnutelnosti.sk commercial listing to CommercialPropertyTierI
 */
export function transformNehnutelnostiCommercial(listing: NehnutelnostiListing): CommercialPropertyTierI {
  const images = extractImages(listing);
  const sqm_total = extractSqm(listing) || 0;

  const rawParams = (listing as any)._raw?.parameters;
  const rawFlags = (listing as any)._raw?.flags;
  const rawMedia = (listing as any)._raw?.media;
  const realEstateState = rawParams?.realEstateState;

  const checkFeature = (keywords: string[]) => {
    const allFeatures = [...(listing.features || []), ...(listing.amenities || [])].join(' ').toLowerCase();
    return keywords.some(kw => allFeatures.includes(kw.toLowerCase()));
  };

  const description = (listing.description || listing.text || '').toLowerCase();

  return {
    property_category: 'commercial',
    title: listing.name || listing.title || listing.headline || 'Unknown',
    price: listing.price || listing.price_value || listing.price_eur || 0,
    currency: listing.currency || 'EUR',
    transaction_type: (listing.transaction_type || '').toLowerCase().includes('prenajom') ? 'rent' : 'sale',
    location: {
      address: listing.address || listing.locality,
      city: extractCity(listing.city || listing.locality || ''),
      region: listing.region || listing.district,
      country: 'sk',
      coordinates: extractCoordinates(listing),
    },

    sqm_total,
    has_elevator: checkFeature(['výťah', 'vytah', 'elevator']),
    has_parking: checkFeature(['parkovanie', 'parking', 'garáž', 'garaz']),
    has_bathrooms: checkFeature(['kúpeľňa', 'kupelna', 'wc', 'bathroom', 'toilet']) || description.includes('wc') || description.includes('kúpeľ'),

    floor: listing.floor || listing.floor_number,
    total_floors: listing.total_floors,
    year_built: extractYearBuilt(listing),
    renovation_year: extractRenovationYear(listing),
    construction_type: mapConstructionToEnglish(normalizeConstructionType(listing.construction_type)) as any,
    condition: realEstateState ? normalizeCondition(realEstateState) as any : undefined,
    heating_type: mapHeatingToEnglish(normalizeHeatingType(listing.heating)),
    energy_class: normalizeEnergyRating(listing.energy_rating),
    deposit: extractDeposit(listing),
    available_from: extractAvailableFrom(listing),

    media: images.length > 0 ? { images } : undefined,
    features: listing.features || listing.amenities,
    description: listing.description || listing.text,
    source_url: ensureAbsoluteUrl(listing.url || listing.detail_url || `/detail/${listing.id}`),
    source_platform: 'nehnutelnosti-sk',
    portal_id: String(listing.id || listing.hash_id || ''),
    status: (listing.status === 'active' || listing.is_active) ? 'active' : 'removed',

    images,
    videos: undefined,

    portal_metadata: {
      nehnutelnosti: {
        id: String(listing.id || listing.hash_id || ''),
        category: listing.category,
        category_main_cb: listing.category_main_cb,
        category_type_cb: listing.category_type_cb,
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
        condition: realEstateState ? normalizeCondition(realEstateState) : undefined,
        heating_type: normalizeHeatingType(listing.heating),
        construction_type: normalizeConstructionType(listing.construction_type),
        energy_rating: normalizeEnergyRating(listing.energy_rating),
        // Media flags from adv.media (not adv.flags)
        has_floor_plan: rawMedia?.floorPlans?.length > 0,
        has_3d_tour: rawMedia?.inspections3d?.length > 0,
        has_video: rawMedia?.videos?.length > 0
      }
    }
  };
}
