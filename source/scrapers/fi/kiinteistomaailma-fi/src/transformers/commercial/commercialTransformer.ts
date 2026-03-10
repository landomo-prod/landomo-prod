import { CommercialPropertyTierI } from '@landomo/core';
import { KMListing } from '../../types/kiinteistomaailmaTypes';
import { getFinnishTypeName } from '../../utils/categoryDetector';
import {
  buildPortalId,
  buildLocation,
  buildMedia,
  buildImageUrls,
  buildTitle,
  buildFeatures,
  resolvePrice,
} from '../shared';

/**
 * Transform a Kiinteistömaailma listing to CommercialPropertyTierI.
 *
 * Kiinteistömaailma is a residential-only agency chain, so commercial listings
 * are not expected in the current API. This transformer exists as a safeguard
 * in case the API introduces commercial properties in the future.
 *
 * Field mapping:
 *   totalArea ?? livingArea  → sqm_total
 *   salesPriceUnencumbered   → price
 */
export function transformKMCommercial(listing: KMListing): CommercialPropertyTierI {
  const typeName = getFinnishTypeName(listing);
  const location = buildLocation(listing);
  const media = buildMedia(listing);
  const imageUrls = buildImageUrls(listing);
  const portalId = buildPortalId(listing);
  const price = resolvePrice(listing);
  const features = buildFeatures(listing);

  const transaction_type: 'sale' | 'rent' = listing.rental ? 'rent' : 'sale';
  const sqm_total = listing.totalArea ?? listing.livingArea ?? undefined;

  return {
    property_category: 'commercial' as const,

    // Core
    title: buildTitle(listing, typeName),
    price: price ?? 0,
    currency: 'EUR',
    transaction_type,

    // Location
    location,

    // Commercial-specific required fields (non-optional per TierI schema)
    sqm_total: sqm_total ?? 0,

    // Amenity flags — not available from list-level API
    has_elevator: false,
    has_parking: false,
    has_bathrooms: false,

    // Finnish country-specific fields (stored in JSONB country_specific)
    country_specific: {
      fi_key: listing.key,
      fi_type_code: listing.type,
      fi_group_code: listing.group,
      fi_new_construction: listing.newConstruction,
      fi_online_offer: listing.onlineOffer,
      fi_postcode: listing.postcode,
      fi_municipality: listing.municipality,
      fi_county: listing.county,
      fi_sales_price: listing.salesPrice ?? undefined,
      fi_sales_price_unencumbered: listing.salesPriceUnencumbered ?? undefined,
      fi_rent_per_month: listing.rentInfo?.rentPerMonth ?? undefined,
      fi_open_houses_count: listing.openHouses.length,
    },

    // Media
    media,
    images: imageUrls,

    // Features
    features,

    // Portal
    source_url: listing.canonicalUrl,
    source_platform: 'kiinteistomaailma',
    portal_id: portalId,
    status: 'active' as const,
  };
}
