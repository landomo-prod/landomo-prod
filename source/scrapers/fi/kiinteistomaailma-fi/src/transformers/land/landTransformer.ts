import { LandPropertyTierI } from '@landomo/core';
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
 * Transform a Kiinteistömaailma listing to LandPropertyTierI.
 *
 * Covers:
 *   type=TO  → Tontti (land plot), group=To
 *
 * Field mapping:
 *   landOwnership.landArea_m2  → area_plot_sqm (primary)
 *   housingCompany.area        → area_plot_sqm (fallback for some listings)
 *   salesPriceUnencumbered     → price
 */
export function transformKMLand(listing: KMListing): LandPropertyTierI {
  const typeName = getFinnishTypeName(listing);
  const location = buildLocation(listing);
  const media = buildMedia(listing);
  const imageUrls = buildImageUrls(listing);
  const portalId = buildPortalId(listing);
  const price = resolvePrice(listing);
  const features = buildFeatures(listing);

  // Land area: prefer landOwnership.landArea_m2, fallback to housingCompany.area
  const area_plot_sqm =
    listing.landOwnership.landArea_m2 ??
    listing.housingCompany?.area ??
    undefined;

  return {
    property_category: 'land' as const,

    // Core
    title: buildTitle(listing, typeName),
    price: price ?? 0,
    currency: 'EUR',
    transaction_type: 'sale' as const, // Land plots are always for sale

    // Location
    location,

    // Land-specific required field (non-optional per TierI schema)
    area_plot_sqm: area_plot_sqm ?? 0,

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
      fi_land_area_ha: listing.landOwnership.landArea_ha ?? undefined,
      fi_sales_price: listing.salesPrice ?? undefined,
      fi_sales_price_unencumbered: listing.salesPriceUnencumbered ?? undefined,
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
