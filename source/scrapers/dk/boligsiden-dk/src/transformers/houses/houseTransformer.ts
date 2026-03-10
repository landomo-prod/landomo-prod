import { HousePropertyTierI } from '@landomo/core';
import { BoligsidenCase } from '../../types/boligsidenTypes';
import { buildAddress, buildSourceUrl, getMainBuilding, normalizeEnergyLabel } from '../shared';

/**
 * Transform Boligsiden house listings to HousePropertyTierI
 *
 * Boligsiden house types:
 * - villa           (Villa / parcelhus)
 * - terraced house  (Rækkehus)
 * - holiday house   (Fritidsbolig / sommerhus)
 * - cattle farm     (Kvæggård)
 * - farm            (Landbrug)
 * - hobby farm      (Hobbyland)
 *
 * Key fields:
 * - housingArea    → sqm_living
 * - lotArea        → sqm_plot
 * - numberOfRooms  → bedrooms (rooms - 1)
 * - priceCash      → price
 * - hasBalcony / hasTerrace → has_garden (approximation)
 */
export function transformBoligsidenHouse(listing: BoligsidenCase): HousePropertyTierI {
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
  const sqm_living = listing.housingArea || building?.housingArea || building?.totalArea || 0;
  // lotArea is the plot/land area in sqm
  const sqm_plot = listing.lotArea || 0;

  // ============ Rooms ============
  const numberOfRooms = listing.numberOfRooms || building?.numberOfRooms || 0;
  const bedrooms = numberOfRooms > 1 ? numberOfRooms - 1 : Math.max(0, numberOfRooms);

  // ============ Bathrooms ============
  const bathrooms = listing.numberOfBathrooms || building?.numberOfBathrooms || 1;

  // ============ Amenities ============
  // Houses with a plot are assumed to have a garden
  const has_garden = (sqm_plot > 0) || listing.hasTerrace || listing.hasBalcony || false;
  const has_garage = detectGarage(listing);
  const has_parking = has_garage; // Garage implies parking; standalone parking not in API
  const has_basement = detectBasement(listing);

  // ============ Building Details ============
  const year_built = listing.yearBuilt || building?.yearBuilt;
  const renovation_year = building?.yearRenovated;
  const numberOfFloors = listing.numberOfFloors || building?.numberOfFloors;

  // ============ Energy ============
  const energy_class = normalizeEnergyLabel(listing.energyLabel || addr.energyLabel);

  // ============ Features ============
  const features: string[] = [];
  if (has_garden) features.push('garden');
  if (has_garage) features.push('garage');
  if (has_basement) features.push('basement');
  if (listing.hasBalcony) features.push('balcony');
  if (listing.hasTerrace) features.push('terrace');
  if (listing.hasElevator) features.push('elevator');
  if (listing.distinction) features.push('highlighted');
  if (isHolidayProperty(listing.addressType)) features.push('holiday_property');
  if (isFarm(listing.addressType)) features.push('agricultural');

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
    energy_label_raw: listing.energyLabel || addr.energyLabel,
    days_on_market: listing.daysOnMarket,
    monthly_expense: listing.monthlyExpense,
    per_area_price: listing.perAreaPrice,
    weighted_area: listing.weightedArea || addr.weightedArea,
    latest_valuation: addr.latestValuation,
    number_of_floors: numberOfFloors,
    gstkvhx: addr.gstkvhx,
  };

  return {
    property_category: 'house' as const,

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

    // House Details
    bedrooms,
    bathrooms,
    sqm_living,
    sqm_plot,
    rooms: numberOfRooms || undefined,

    // Amenities (required for HousePropertyTierI)
    has_garden,
    has_garage,
    has_parking,
    has_basement,

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

/**
 * Detect if property has a garage based on address buildings
 */
function detectGarage(listing: BoligsidenCase): boolean {
  const buildings = listing.address?.buildings || [];
  return buildings.some(b =>
    b.buildingName?.toLowerCase().includes('garage') ||
    b.buildingName?.toLowerCase().includes('carport')
  );
}

/**
 * Detect if property has a basement based on building data
 */
function detectBasement(listing: BoligsidenCase): boolean {
  const buildings = listing.address?.buildings || [];
  return buildings.some(b =>
    b.buildingName?.toLowerCase().includes('kælder') ||
    b.buildingName?.toLowerCase().includes('basement')
  );
}

/**
 * Check if addressType represents a holiday/recreational property
 */
function isHolidayProperty(addressType: string): boolean {
  return addressType === 'holiday house';
}

/**
 * Check if addressType represents a farm/agricultural property
 */
function isFarm(addressType: string): boolean {
  return ['cattle farm', 'farm', 'hobby farm'].includes(addressType);
}
