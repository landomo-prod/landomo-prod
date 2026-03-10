import { CommercialPropertyTierI } from '@landomo/core';
import { BoligsidenCase } from '../../types/boligsidenTypes';
import { buildAddress, buildSourceUrl, getMainBuilding, normalizeEnergyLabel } from '../shared';

/**
 * Transform Boligsiden commercial listings to CommercialPropertyTierI
 *
 * Note: Boligsiden's primary API does not expose commercial (Erhverv) listings
 * in the standard search/cases endpoint. This transformer handles any commercial
 * listings that might appear through the API.
 *
 * Key fields:
 * - housingArea    → sqm_total
 * - hasElevator    → has_elevator
 * - priceCash      → price
 */
export function transformBoligsidenCommercial(listing: BoligsidenCase): CommercialPropertyTierI {
  const building = getMainBuilding(listing);
  const addr = listing.address;

  // ============ Identification ============
  const caseID = listing.caseID;
  const source_url = buildSourceUrl(listing);
  const portal_id = `boligsiden-${caseID}`;

  // ============ Price ============
  const price = listing.priceCash || addr.casePrice || 0;
  const currency = 'DKK';

  // ============ Location ============
  const fullAddress = buildAddress(listing);
  const city = addr.cityName || addr.city?.name || '';
  const lat = listing.coordinates?.lat ?? addr.coordinates?.lat;
  const lng = listing.coordinates?.lon ?? addr.coordinates?.lon;

  // ============ Area ============
  const sqm_total = listing.housingArea || building?.housingArea || building?.totalArea || 0;

  // ============ Amenities (required for CommercialPropertyTierI) ============
  const has_elevator = listing.hasElevator ?? false;
  const has_parking = false; // Not available in API
  const has_bathrooms = (listing.numberOfBathrooms ?? building?.numberOfBathrooms ?? 0) > 0;

  // ============ Building Details ============
  const year_built = listing.yearBuilt || building?.yearBuilt;
  const energy_class = normalizeEnergyLabel(listing.energyLabel || addr.energyLabel);

  // ============ Features ============
  const features: string[] = [];
  if (has_elevator) features.push('elevator');
  if (has_parking) features.push('parking');
  if (listing.hasTerrace) features.push('terrace');

  // ============ Description ============
  const description = [listing.descriptionTitle, listing.descriptionBody]
    .filter(Boolean)
    .join('\n\n') || undefined;

  // ============ Country-Specific (Tier II) ============
  const country_specific: Record<string, unknown> = {
    municipality: addr.municipality?.name,
    municipality_code: addr.municipality?.municipalityCode,
    province: addr.province?.name,
    energy_label_raw: listing.energyLabel || addr.energyLabel,
    days_on_market: listing.daysOnMarket,
    per_area_price: listing.perAreaPrice,
    latest_valuation: addr.latestValuation,
    gstkvhx: addr.gstkvhx,
  };

  return {
    property_category: 'commercial' as const,

    // Core
    title: listing.descriptionTitle || `Commercial - ${fullAddress}`,
    price,
    currency,
    transaction_type: 'sale',

    // Location
    location: {
      address: fullAddress,
      city,
      country: 'Denmark',
      postal_code: String(addr.zipCode || addr.zip?.zipCode || ''),
      coordinates: lat && lng ? { lat, lon: lng } : undefined,
    },

    // Commercial Details (required fields)
    sqm_total,
    has_elevator,
    has_parking,
    has_bathrooms,

    // Building Context
    year_built,
    energy_class,

    // Features
    features,
    description,

    // Portal & Lifecycle
    source_url,
    source_platform: 'boligsiden',
    portal_id,
    status: 'active' as const,

    // Country-Specific (Tier II)
    country_specific,
  };
}
