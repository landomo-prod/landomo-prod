/**
 * Bezrealitky Land Transformer
 *
 * Transforms Bezrealitky land listings (estateType === 'POZEMEK') to LandPropertyTierI
 *
 * Bezrealitky Advantages for Land:
 * - GraphQL API provides direct surfaceLand field (THE main metric!)
 * - Water/sewage type fields with position awareness (waterPipePos, sewagePipePos)
 * - Boolean utility flags (electricity, gas)
 * - Cadastral number often available
 * - Enum-based land sub-types (landType field)
 * - 95%+ field completion rate for utilities
 */

import { LandPropertyTierI, PropertyLocation, PropertyImage } from '@landomo/core';
import { BezRealitkyListingItem } from '../../types/bezrealitkyTypes';
import { normalizeOwnership, normalizeBezrealitkyDisposition, parseRenovationYear } from '../../utils/bezrealitkyHelpers';
import { normalizeDisposition, normalizeFurnished } from '../../../../shared/czech-value-mappings';

/**
 * Transform Bezrealitky Land (POZEMEK) to LandPropertyTierI
 *
 * Land requires:
 * - area_plot_sqm (THE main metric for land!)
 * - Utilities (water, sewage, electricity, gas)
 * - Land type and zoning
 * - Cadastral number (if available)
 */
export function transformBezrealitkyLand(
  listing: BezRealitkyListingItem
): LandPropertyTierI {
  // ============ Core Identification ============
  const title = listing.title || 'Unknown';
  const price = listing.price ?? 0;
  const currency = listing.currency || 'CZK';
  const transaction_type = listing.offerType === 'PRODEJ' ? 'sale' : 'rent';

  // ============ Location ============
  const location: PropertyLocation = {
    address: listing.address || `${listing.street || ''} ${listing.houseNumber || ''}`.trim(),
    city: listing.city || 'Unknown',
    region: listing.region?.name,
    country: 'Czech Republic',
    postal_code: listing.zip,
    coordinates: listing.gps
      ? {
          lat: listing.gps.lat,
          lon: listing.gps.lng,
        }
      : undefined,
  };

  // ============ CRITICAL: Plot Area (THE main metric for land!) ============
  const area_plot_sqm = listing.surfaceLand ?? 0;

  // ============ Land Classification ============
  const landTypeRaw = listing.landType?.toLowerCase() || '';

  // Property subtype (universal categories)
  let property_subtype: 'building_plot' | 'agricultural' | 'forest' | 'vineyard' | 'orchard' | 'recreational' | 'industrial' | undefined;

  // Land type (more granular)
  let land_type: 'arable' | 'grassland' | 'forest' | 'vineyard' | 'orchard' | 'building_plot' | 'meadow' | 'pasture' | undefined;

  // Zoning (regulatory classification)
  let zoning: 'residential' | 'commercial' | 'agricultural' | 'mixed' | 'industrial' | 'recreational' | undefined;

  // Map from Czech land types to standardized values
  if (landTypeRaw.includes('stavebni') || landTypeRaw.includes('building') || landTypeRaw.includes('iza')) {
    property_subtype = 'building_plot';
    land_type = 'building_plot';
    zoning = 'residential';
  } else if (landTypeRaw.includes('zemedelska') || landTypeRaw.includes('agricultural') || landTypeRaw.includes('pole')) {
    property_subtype = 'agricultural';
    land_type = 'arable';
    zoning = 'agricultural';
  } else if (landTypeRaw.includes('lesni') || landTypeRaw.includes('forest') || landTypeRaw.includes('les')) {
    property_subtype = 'forest';
    land_type = 'forest';
    zoning = 'agricultural';
  } else if (landTypeRaw.includes('vinice') || landTypeRaw.includes('vineyard')) {
    property_subtype = 'vineyard';
    land_type = 'vineyard';
    zoning = 'agricultural';
  } else if (landTypeRaw.includes('sad') || landTypeRaw.includes('orchard')) {
    property_subtype = 'orchard';
    land_type = 'orchard';
    zoning = 'agricultural';
  } else if (landTypeRaw.includes('rekreacni') || landTypeRaw.includes('recreational') || landTypeRaw.includes('zahrada')) {
    property_subtype = 'recreational';
    land_type = 'meadow';
    zoning = 'recreational';
  } else if (landTypeRaw.includes('louka') || landTypeRaw.includes('meadow')) {
    property_subtype = 'agricultural';
    land_type = 'grassland';
    zoning = 'agricultural';
  } else if (landTypeRaw.includes('pastvina') || landTypeRaw.includes('pasture')) {
    property_subtype = 'agricultural';
    land_type = 'pasture';
    zoning = 'agricultural';
  }

  // ============ Utilities (CRITICAL for land value!) ============

  // Water supply with position awareness
  const waterType = listing.water?.toLowerCase() || '';
  const waterPos = (listing as any).waterPipePos; // Position field (GraphQL may have this)
  let water_supply: 'mains' | 'well' | 'connection_available' | 'none' | undefined;

  if (waterType.includes('vodovod') || waterType.includes('mains')) {
    // Municipal water - check position if available
    if (waterPos === 'in_plot') {
      water_supply = 'mains';
    } else if (waterPos === 'in_front_of_plot' || waterPos === 'in_street') {
      water_supply = 'connection_available';
    } else {
      water_supply = 'mains'; // Default if position unknown
    }
  } else if (waterType.includes('studna') || waterType.includes('well')) {
    water_supply = 'well';
  } else if (waterType.includes('pramen') || waterType.includes('spring')) {
    water_supply = 'well'; // Springs map to wells
  } else if (waterType.includes('zadna') || waterType.includes('none')) {
    water_supply = 'none';
  }

  // Sewage with position awareness
  const sewageType = listing.sewage?.toLowerCase() || '';
  const sewagePos = (listing as any).sewagePipePos; // Position field (GraphQL may have this)
  let sewage: 'mains' | 'septic' | 'connection_available' | 'none' | undefined;

  if (sewageType.includes('kanalizace') || sewageType.includes('mains')) {
    // Municipal sewage - check position if available
    if (sewagePos === 'in_plot') {
      sewage = 'mains';
    } else if (sewagePos === 'in_front_of_plot' || sewagePos === 'in_street') {
      sewage = 'connection_available';
    } else {
      sewage = 'mains'; // Default if position unknown
    }
  } else if (sewageType.includes('septik') || sewageType.includes('septic')) {
    sewage = 'septic';
  } else if (sewageType.includes('jimka') || sewageType.includes('cesspool')) {
    sewage = 'septic'; // Cesspools map to septic
  } else if (sewageType.includes('zadna') || sewageType.includes('none')) {
    sewage = 'none';
  }

  // Electricity (GraphQL boolean or string)
  let electricity: 'connected' | 'connection_available' | 'none' | undefined;
  const electricityField = (listing as any).electricity;

  if (typeof electricityField === 'boolean') {
    electricity = electricityField ? 'connected' : 'none';
  } else if (typeof electricityField === 'string') {
    const elec = electricityField.toLowerCase();
    if (elec.includes('ano') || elec.includes('yes') || elec.includes('connected')) {
      electricity = 'connected';
    } else if (elec.includes('moznost') || elec.includes('available')) {
      electricity = 'connection_available';
    } else {
      electricity = 'none';
    }
  }

  // Gas (GraphQL boolean or string)
  let gas: 'connected' | 'connection_available' | 'none' | undefined;
  const gasField = (listing as any).gas;

  if (typeof gasField === 'boolean') {
    gas = gasField ? 'connected' : 'none';
  } else if (typeof gasField === 'string') {
    const gasStr = gasField.toLowerCase();
    if (gasStr.includes('ano') || gasStr.includes('yes') || gasStr.includes('connected')) {
      gas = 'connected';
    } else if (gasStr.includes('moznost') || gasStr.includes('available')) {
      gas = 'connection_available';
    } else {
      gas = 'none';
    }
  }

  // Road access (not directly in GraphQL, could infer from description)
  const road_access = undefined; // Not provided in GraphQL schema

  // ============ Development Potential ============
  const building_permit = undefined; // Not in GraphQL schema (could be in description)
  const terrain = undefined; // Not in GraphQL schema
  const soil_quality = undefined; // Not in GraphQL schema (agricultural context)

  // ============ Legal & Administrative ============
  const cadastral_number = (listing as any).cadastralNumber || (listing as any).cadastralArea;

  // Ownership type
  const ownershipRaw = listing.ownership?.toLowerCase() || '';
  let ownership_type: 'personal' | 'state' | 'municipal' | 'cooperative' | undefined;

  if (ownershipRaw.includes('osobni') || ownershipRaw.includes('ov')) {
    ownership_type = 'personal';
  } else if (ownershipRaw.includes('statni') || ownershipRaw.includes('state')) {
    ownership_type = 'state';
  } else if (ownershipRaw.includes('obecni') || ownershipRaw.includes('mestske') || ownershipRaw.includes('municipal')) {
    ownership_type = 'municipal';
  } else if (ownershipRaw.includes('druzstevni') || ownershipRaw.includes('cooperative')) {
    ownership_type = 'cooperative';
  } else if (ownershipRaw) {
    ownership_type = 'personal'; // Default
  }

  // ============ Rental-Specific Fields ============
  // Convert Unix epoch timestamp to ISO 8601 string
  const available_from = listing.availableFrom
    ? new Date(parseInt(listing.availableFrom) * 1000).toISOString()
    : undefined;

  // ============ Tier 1 Universal Fields ============
  const furnished = normalizeFurnished(listing.equipped);
  const renovation_year = parseRenovationYear(listing.reconstruction);
  const published_date = listing.timeActivated
    ? new Date(parseInt(listing.timeActivated) * 1000).toISOString()
    : undefined;

  // ============ Media ============
  const richImages: PropertyImage[] = (listing.publicImages || []).map((img) => ({
    url: img.url,
    order: img.order,
    is_main: img.main || undefined,
    filename: img.filename,
    image_id: img.id,
  }));
  const media = {
    images: richImages.length > 0 ? richImages : [] as PropertyImage[],
    tour_360_url: listing.tour360,
  };

  // ============ Features (land-specific) ============
  const features = extractLandFeatures(listing);

  // ============ Description ============
  const description = listing.description;

  // ============ Portal & Lifecycle ============
  const source_url = `https://www.bezrealitky.cz${listing.uri}`;
  const source_platform = 'bezrealitky';
  const portal_id = `bezrealitky-${listing.id}`;
  const status = listing.active ? 'active' : 'removed';

  // ============ Assemble LandPropertyTierI ============
  return {
    // Category
    property_category: 'land' as const,

    // Core
    title,
    price,
    currency,
    transaction_type,

    // Location
    location,

    // Classification
    property_subtype,

    // Tier II Czech-Specific Fields
    country_specific: {
      czech_disposition: normalizeDisposition(normalizeBezrealitkyDisposition(listing.disposition || '')),
      czech_ownership: listing.ownership ? normalizeOwnership(listing.ownership) : undefined,
      city_district: listing.cityDistrict,
      is_prague: listing.isPrague,
      is_brno: listing.isBrno,
      is_prague_west: listing.isPragueWest,
      is_prague_east: listing.isPragueEast,
      ruian_id: listing.ruianId,
      service_charges_note: listing.serviceChargesNote,
      utility_charges_note: listing.utilityChargesNote,
    },

    // MAIN METRIC: Plot Area
    area_plot_sqm,

    // Land Classification
    land_type,
    zoning,

    // Utilities (CRITICAL!)
    water_supply,
    sewage,
    electricity,
    gas,
    road_access,

    // Development Potential
    building_permit,
    terrain,
    soil_quality,

    // Legal & Administrative
    cadastral_number,
    ownership_type,

    // Rental
    available_from,

    // Financials
    is_commission: listing.fee !== undefined && listing.fee > 0,
    commission_note: listing.fee !== undefined && listing.fee > 0 ? `Agency fee: ${listing.fee} CZK` : undefined,

    // Tier 1 Universal Fields
    furnished,
    renovation_year,
    published_date,

    // Media & Agent
    media,
    images: richImages.map(img => img.url),

    // Features & Description
    features,
    description,

    // Portal metadata
    portal_metadata: {
      bezrealitky: {
        reserved: listing.reserved,
        original_price: listing.originalPrice,
        is_discounted: listing.isDiscounted,
        visit_count: listing.visitCount,
        conversation_count: listing.conversationCount,
      },
    },

    // Portal & Lifecycle
    source_url,
    source_platform,
    portal_id,
    status: status as 'active' | 'removed' | 'sold' | 'rented',
  };
}

/**
 * Extract land-specific features from listing
 */
function extractLandFeatures(listing: BezRealitkyListingItem): string[] {
  const features: string[] = [];

  // Land characteristics
  if (listing.lowEnergy) features.push('low_energy');
  if (listing.newBuilding) features.push('new_development');

  // Utilities presence (not just type)
  if (listing.water) features.push('water_available');
  if (listing.sewage) features.push('sewage_available');
  if ((listing as any).electricity) features.push('electricity_available');
  if ((listing as any).gas) features.push('gas_available');

  // Media
  if (listing.tour360) features.push('virtual_tour');

  // Additional metadata
  if ((listing as any).cadastralNumber || (listing as any).cadastralArea) {
    features.push('cadastral_registered');
  }

  // Fencing (if available in title/description)
  const title = listing.title?.toLowerCase() || '';
  const desc = listing.description?.toLowerCase() || '';

  if (title.includes('oplocen') || desc.includes('oplocen') || title.includes('fenced') || desc.includes('fenced')) {
    features.push('fenced');
  }

  // Fruit trees (common in Czech land listings)
  if (title.includes('ovocn') || desc.includes('ovocn') || title.includes('fruit') || desc.includes('fruit')) {
    features.push('fruit_trees');
  }

  // Well/borehole presence
  if (listing.water?.toLowerCase().includes('studna') || listing.water?.toLowerCase().includes('well')) {
    features.push('well');
  }

  return features;
}
