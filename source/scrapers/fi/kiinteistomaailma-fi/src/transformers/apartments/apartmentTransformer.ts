import { ApartmentPropertyTierI } from '@landomo/core';
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
 * Transform a Kiinteistömaailma listing to ApartmentPropertyTierI.
 *
 * Covers:
 *   type=KT  → Kerrostalo (apartment block), for sale or rental
 *
 * Field mapping:
 *   livingArea       → sqm
 *   roomAmount - 1   → bedrooms (Finnish rooms include living room)
 *   salesPriceUnencumbered → price (debt-free price)
 *   salesPrice       → price (fallback, includes housing company debt)
 *   rentInfo.rentPerMonth  → price (for rentals)
 *   housingCompany.area    → fi_housing_company_area (shared area in m²)
 *
 * Note: The search API does not expose elevator/balcony/parking/basement flags
 * at the list level. These require a separate detail page fetch, which is not
 * implemented to keep scraper complexity low. Fields default to false.
 */
export function transformKMApartment(listing: KMListing): ApartmentPropertyTierI {
  const typeName = getFinnishTypeName(listing);
  const location = buildLocation(listing);
  const media = buildMedia(listing);
  const imageUrls = buildImageUrls(listing);
  const portalId = buildPortalId(listing);
  const price = resolvePrice(listing);
  const bedrooms = deriveBedrooms(listing.roomAmount);
  const features = buildFeatures(listing);

  const transaction_type: 'sale' | 'rent' = listing.rental ? 'rent' : 'sale';

  // Deposit for rentals
  const deposit = listing.rentInfo?.deposit ?? undefined;

  return {
    property_category: 'apartment' as const,

    // Core
    title: buildTitle(listing, typeName),
    price: price ?? 0,
    currency: 'EUR',
    transaction_type,

    // Location
    location,

    // Apartment-specific required fields (non-optional per TierI schema)
    bedrooms: bedrooms ?? 0,
    sqm: listing.livingArea ?? 0,

    // Amenity flags — not available from list-level API
    has_elevator: false,
    has_balcony: false,
    has_parking: false,
    has_basement: false,

    // Extended fields
    rooms: listing.roomAmount ?? undefined,

    // Financials
    deposit: deposit ? deposit : undefined,

    // Dates
    published_date: undefined, // not in API response at list level

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
