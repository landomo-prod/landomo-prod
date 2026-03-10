import { HousePropertyTierI } from '@landomo/core';
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
  deriveBedrooms,
} from '../shared';

/**
 * Transform a Kiinteistömaailma listing to HousePropertyTierI.
 *
 * Covers:
 *   type=RT  → Rivitalo (row house)
 *   type=PT  → Paritalo (semi-detached)
 *   type=OT  → Omakotitalo (detached/single-family)
 *   type=ET  → Erillistalo (detached variant)
 *   type=MO  → Mökki/Huvila (cottage/villa) - group=Va
 *
 * Field mapping:
 *   livingArea              → sqm_living
 *   landOwnership.landArea_m2 → sqm_plot
 *   roomAmount - 1          → bedrooms
 *   salesPriceUnencumbered  → price
 *   housingCompany.area     → fi_housing_company_area (for row houses)
 *
 * Note: has_garden/has_garage/has_parking/has_basement not available from
 * the list-level API. Fields default to false.
 */
export function transformKMHouse(listing: KMListing): HousePropertyTierI {
  const typeName = getFinnishTypeName(listing);
  const location = buildLocation(listing);
  const media = buildMedia(listing);
  const imageUrls = buildImageUrls(listing);
  const portalId = buildPortalId(listing);
  const price = resolvePrice(listing);
  const bedrooms = deriveBedrooms(listing.roomAmount);
  const features = buildFeatures(listing);

  const transaction_type: 'sale' | 'rent' = listing.rental ? 'rent' : 'sale';
  const sqm_plot = listing.landOwnership.landArea_m2 ?? undefined;

  // Deposit for rentals
  const deposit = listing.rentInfo?.deposit ?? undefined;

  // Cottages/vacation properties (group=Va, type=MO) — flag in features
  if (listing.group === 'Va') {
    features.push('vacation_property');
  }

  return {
    property_category: 'house' as const,

    // Core
    title: buildTitle(listing, typeName),
    price: price ?? 0,
    currency: 'EUR',
    transaction_type,

    // Location
    location,

    // House-specific required fields (non-optional per TierI schema)
    bedrooms: bedrooms ?? 0,
    sqm_living: listing.livingArea ?? 0,
    sqm_plot: sqm_plot ?? 0,

    // Amenity flags — not available from list-level API
    has_garden: false,
    has_garage: false,
    has_parking: false,
    has_basement: false,

    // Extended fields
    rooms: listing.roomAmount ?? undefined,

    // Financials
    deposit: deposit ? deposit : undefined,

    // Finnish country-specific fields (stored in JSONB country_specific)
    country_specific: {
      fi_key: listing.key,
      fi_type_code: listing.type,
      fi_group_code: listing.group,
      fi_room_types: listing.roomTypes ?? undefined,
      fi_new_construction: listing.newConstruction,
      fi_online_offer: listing.onlineOffer,
      fi_postcode: listing.postcode,
      fi_municipality: listing.municipality,
      fi_county: listing.county,
      fi_total_area_sqm: listing.totalArea ?? undefined,
      fi_housing_company_area: listing.housingCompany?.area ?? undefined,
      fi_land_area_ha: listing.landOwnership.landArea_ha ?? undefined,
      fi_sales_price: listing.salesPrice ?? undefined,
      fi_sales_price_unencumbered: listing.salesPriceUnencumbered ?? undefined,
      fi_rent_per_month: listing.rentInfo?.rentPerMonth ?? undefined,
      fi_rent_deposit: listing.rentInfo?.deposit ?? undefined,
      fi_rent_contract_time: listing.rentInfo?.contractTime ?? undefined,
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
