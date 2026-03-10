import { LandPropertyTierI } from '@landomo/core';
import { BoligsidenCase } from '../../types/boligsidenTypes';
import { buildAddress, buildSourceUrl } from '../shared';

/**
 * Transform Boligsiden land/plot listings to LandPropertyTierI
 *
 * Boligsiden land types:
 * - full year plot  (Helårsgrund / Byggegrund)
 * - holiday plot    (Sommerhusgrund)
 *
 * Key fields:
 * - lotArea        → area_plot_sqm (the main area for land/plots)
 * - housingArea    → additional built area (if any structure exists)
 * - priceCash      → price
 */
export function transformBoligsidenLand(listing: BoligsidenCase): LandPropertyTierI {
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
  // For land plots, lotArea is the plot size. housingArea would be any existing building.
  const area_plot_sqm = listing.lotArea || listing.housingArea || listing.weightedArea || 0;

  // ============ Features ============
  const features: string[] = [];
  if (listing.addressType === 'holiday plot') features.push('holiday_plot');
  if (listing.addressType === 'full year plot') features.push('building_plot');
  if (listing.distinction) features.push('highlighted');

  // ============ Description ============
  const description = [listing.descriptionTitle, listing.descriptionBody]
    .filter(Boolean)
    .join('\n\n') || undefined;

  // ============ Country-Specific (Tier II) ============
  const country_specific: Record<string, unknown> = {
    address_type: listing.addressType,
    municipality: addr.municipality?.name,
    municipality_code: addr.municipality?.municipalityCode,
    province: addr.province?.name,
    province_code: addr.province?.provinceCode,
    days_on_market: listing.daysOnMarket,
    per_area_price: listing.perAreaPrice,
    latest_valuation: addr.latestValuation,
    gstkvhx: addr.gstkvhx,
    utilities_connection_fee: listing.utilitiesConnectionFee,
    // Land-specific municipal taxes
    land_value_tax_per_thousand: addr.municipality?.landValueTaxLevelPerThousand,
  };

  return {
    property_category: 'land' as const,

    // Core
    title: listing.descriptionTitle || `${listing.addressType} - ${fullAddress}`,
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

    // Land Details (required field)
    area_plot_sqm,

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
