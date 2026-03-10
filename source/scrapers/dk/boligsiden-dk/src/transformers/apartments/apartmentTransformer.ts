import { ApartmentPropertyTierI } from '@landomo/core';
import { BoligsidenCase } from '../../types/boligsidenTypes';
import { buildAddress, buildSourceUrl, getMainBuilding, normalizeEnergyLabel } from '../shared';

/**
 * Transform Boligsiden condo listing to ApartmentPropertyTierI
 *
 * Boligsiden apartment types:
 * - condo (Ejerlejlighed / Andelsbolig)
 *
 * Key fields available from API:
 * - housingArea    → sqm
 * - numberOfRooms  → rooms (bedrooms = rooms - 1)
 * - priceCash      → price
 * - hasElevator    → has_elevator
 * - hasBalcony     → has_balcony
 * - hasTerrace     → has_terrace
 * - coordinates    → lat/lng
 */
export function transformBoligsidenApartment(listing: BoligsidenCase): ApartmentPropertyTierI {
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

  // ============ Area & Rooms ============
  // housingArea from the case is the living area in sqm
  const sqm = listing.housingArea || building?.housingArea || building?.totalArea || 0;

  // numberOfRooms includes all rooms; in Danish convention, bedrooms = rooms - 1 (kitchen excluded)
  const numberOfRooms = listing.numberOfRooms || building?.numberOfRooms || 0;
  const bedrooms = numberOfRooms > 1 ? numberOfRooms - 1 : Math.max(0, numberOfRooms);

  // ============ Bathrooms ============
  const bathrooms = listing.numberOfBathrooms || building?.numberOfBathrooms || 1;

  // ============ Amenities ============
  const has_elevator = listing.hasElevator ?? false;
  const has_balcony = listing.hasBalcony ?? false;
  const has_terrace = listing.hasTerrace ?? false;
  const has_parking = false; // Not available in this API response
  const has_basement = false; // Not available for condos typically

  // ============ Building Details ============
  const year_built = listing.yearBuilt || building?.yearBuilt;
  const renovation_year = building?.yearRenovated;
  const numberOfFloors = listing.numberOfFloors || building?.numberOfFloors;

  // ============ Energy ============
  const energy_class = normalizeEnergyLabel(listing.energyLabel || addr.energyLabel);

  // ============ Features ============
  const features: string[] = [];
  if (has_elevator) features.push('elevator');
  if (has_balcony) features.push('balcony');
  if (has_terrace) features.push('terrace');
  if (listing.distinction) features.push('highlighted');

  // ============ Description ============
  const description = [listing.descriptionTitle, listing.descriptionBody]
    .filter(Boolean)
    .join('\n\n') || undefined;

  // ============ Country-Specific (Tier II) ============
  const country_specific: Record<string, unknown> = {
    municipality: addr.municipality?.name,
    municipality_code: addr.municipality?.municipalityCode,
    province: addr.province?.name,
    province_code: addr.province?.provinceCode,
    energy_label_raw: listing.energyLabel || addr.energyLabel,
    days_on_market: listing.daysOnMarket,
    monthly_expense: listing.monthlyExpense,
    per_area_price: listing.perAreaPrice,
    weighted_area: listing.weightedArea || addr.weightedArea,
    latest_valuation: addr.latestValuation,
    gstkvhx: addr.gstkvhx,
  };

  return {
    property_category: 'apartment' as const,

    // Core
    title: listing.descriptionTitle || `${addr.addressType} - ${fullAddress}`,
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

    // Apartment Details
    bedrooms,
    bathrooms,
    sqm,
    rooms: numberOfRooms || undefined,
    total_floors: numberOfFloors,

    // Amenities (required for ApartmentPropertyTierI)
    has_elevator,
    has_balcony,
    has_parking,
    has_basement,
    has_terrace,

    // Building Context
    year_built,
    renovation_year,
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
