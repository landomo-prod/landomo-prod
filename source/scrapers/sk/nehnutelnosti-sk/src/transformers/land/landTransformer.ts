import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { NehnutelnostiListing } from '../../types/nehnutelnostiTypes';
import { normalizeEnergyRating } from '../../shared/slovak-value-mappings';
import {
  extractCoordinates,
  extractCity,
  extractLandArea,
  extractImages,
  extractAvailableFrom,
  ensureAbsoluteUrl
} from '../helpers';

export function transformNehnutelnostiLand(listing: NehnutelnostiListing): LandPropertyTierI {
  const images = extractImages(listing);

  // Extract from _raw.parameters (actual API structure)
  const rawParams = (listing as any)._raw?.parameters;
  const rawFlags = (listing as any)._raw?.flags;
  const rawMedia = (listing as any)._raw?.media;
  const categorySubValue = rawParams?.category?.subValue;

  const checkFeature = (keywords: string[]) => {
    const allFeatures = [...(listing.features || []), ...(listing.amenities || [])].join(' ').toLowerCase();
    return keywords.some(kw => allFeatures.includes(kw.toLowerCase()));
  };

  return {
    property_category: 'land',
    title: listing.name || listing.title || listing.headline || 'Unknown',
    price: listing.price || listing.price_value || listing.price_eur || 0,
    currency: listing.currency || 'EUR',
    transaction_type: (listing.transaction_type || '').toLowerCase().includes('prenajom') ? 'rent' : 'sale',
    location: {
      address: listing.street
        ? [listing.street, listing.street_number].filter(Boolean).join(' ')
        : listing.address || listing.locality,
      city: extractCity(listing.city || listing.locality || ''),
      region: listing.region || listing.district,
      country: 'sk',
      coordinates: extractCoordinates(listing),
    },
    area_plot_sqm: listing.area_land || extractLandArea(listing) || listing.area || 0,
    zoning: listing.land_use as any,
    water_supply: (listing.water_supply as any) ?? (checkFeature(['voda', 'water']) ? 'mains' : undefined),
    sewage: (listing.sewage as any) ?? (checkFeature(['kanalizácia', 'kanalizacia', 'sewage']) ? 'mains' : undefined),
    electricity: (listing.electricity as any) ?? (checkFeature(['elektrický', 'elektricky', 'electricity']) ? 'connected' : undefined),
    gas: (listing.gas as any) ?? undefined,
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
        disposition: categorySubValue,
        ownership: listing.ownership, // Not available in API
        energy_rating: normalizeEnergyRating(listing.energy_rating), // Not available in API
        // Media flags from adv.media (not adv.flags)
        has_floor_plan: rawMedia?.floorPlans?.length > 0,
        has_3d_tour: rawMedia?.inspections3d?.length > 0,
        has_video: rawMedia?.videos?.length > 0,
        terrain: listing.terrain,
        building_permit: listing.building_permit,
        land_use: listing.land_use,
        plot_width: listing.plot_width,
        plot_length: listing.plot_length,
        land_zone: listing.land_zone
      }
    }
  };
}
