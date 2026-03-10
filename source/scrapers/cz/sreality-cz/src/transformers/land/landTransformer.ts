import { LandPropertyTierI, PropertyImage } from '@landomo/core';
import { SRealityListing } from '../../types/srealityTypes';
import { SRealityItemsParser, FIELD_NAMES } from '../../utils/itemsParser';
import {
  getStringOrValue,
  extractCity,
  isPositiveValue,
  ensureBoolean,
  extractImages,
  extractVirtualTourUrl,
  extractVideoUrl,
  extractHashIdFromUrl,
  extractAreaFromTitle,
  extractSourceUrl,
  extractCommissionInfo,
  extractSellerInfo,
  parseAvailableFrom,
} from '../../utils/srealityHelpers';
import {
  normalizeOwnership,
  normalizeCondition
} from '../../../../shared/czech-value-mappings';

/**
 * Transform SReality land listing to LandPropertyTierI
 *
 * Land-specific focus:
 * - area_plot_sqm (CRITICAL - THE main metric for land)
 * - Utilities (water, sewage, electricity, gas) - determines buildability
 * - Zoning and land type (agricultural, building plot, forest)
 * - Building permit status
 * - Road access quality
 * - Terrain and soil quality
 * - Cadastral number (Czech registry)
 */
export function transformLand(listing: SRealityListing): LandPropertyTierI {
  // Initialize type-safe parser (single O(n) pass)
  const parser = new SRealityItemsParser(listing.items || []);

  // === CRITICAL: Plot area is THE main metric for land! ===
  const area_plot_sqm = parser.getAreaOr(FIELD_NAMES.PLOT_AREA, FIELD_NAMES.AREA) ?? extractAreaFromTitle(getStringOrValue(listing.name) || '');

  // === Land Type and Zoning ===
  const landTypeStr = parser.getStringOr(FIELD_NAMES.LAND_TYPE, FIELD_NAMES.ZONING) || '';
  const { land_type, zoning, property_subtype } = extractLandTypeAndZoning(landTypeStr);

  // === UTILITIES (CRITICAL for land value and development potential!) ===
  // Water supply
  const waterStr = parser.getString(FIELD_NAMES.WATER) || '';
  const water_supply = extractWaterSupply(waterStr);

  // Sewage
  const sewageStr = parser.getString(FIELD_NAMES.SEWAGE) || '';
  const sewage = extractSewage(sewageStr);

  // Electricity
  const electricityStr = parser.getString(FIELD_NAMES.ELECTRICITY) || '';
  const electricity = extractElectricity(electricityStr);

  // Gas
  const gasStr = parser.getString(FIELD_NAMES.GAS) || '';
  const gas = extractGas(gasStr);

  // === Road Access ===
  const roadStr = parser.getStringOr(FIELD_NAMES.PRISTUP, FIELD_NAMES.PRISTUPOVA_CESTA, FIELD_NAMES.CESTA) || '';
  const road_access = extractRoadAccess(roadStr);

  // === Development Potential ===
  // Building permit
  const permitStr = parser.getString(FIELD_NAMES.STAVEBNI_POVOLENI) || '';
  const building_permit = extractBuildingPermit(permitStr);

  // Terrain
  const terrainStr = parser.getStringOr(FIELD_NAMES.TEREN, FIELD_NAMES.SVAZITOST) || '';
  const terrain = extractTerrain(terrainStr);

  // Soil quality (for agricultural land)
  const soilStr = parser.getString(FIELD_NAMES.KVALITA_PUDY) || '';
  const soil_quality = extractSoilQuality(soilStr);

  // Max building coverage
  const coverageStr = parser.getStringOr(FIELD_NAMES.ZASTAVITELNOST, FIELD_NAMES.MOZNOST_ZASTAVENI) || '';
  const max_building_coverage = extractPercentage(coverageStr);

  // === Legal & Administrative ===
  // Cadastral number (Czech registry)
  const cadastral_number = parser.getStringOr(FIELD_NAMES.CISLO_PARCELY, FIELD_NAMES.PARCELNI_CISLO, FIELD_NAMES.PARCELA);

  // Ownership type
  const ownershipStr = parser.getString(FIELD_NAMES.OWNERSHIP) || '';
  const ownership_type = extractOwnershipType(ownershipStr);

  // === Utility boolean flags ===
  const has_water = ensureBoolean(water_supply !== undefined && water_supply !== 'none');
  const has_sewage = ensureBoolean(sewage !== undefined && sewage !== 'none');
  const has_electricity = ensureBoolean(electricity !== undefined && electricity !== 'none');
  const has_gas = ensureBoolean(gas !== undefined && gas !== 'none');

  // === Features List ===
  const features = buildFeaturesList(
    parser,
    land_type,
    water_supply,
    sewage,
    electricity,
    gas,
    road_access,
    building_permit,
    terrain
  );

  // === F. Seller contact — from _embedded.seller (detail API) ===
  const sellerInfo = extractSellerInfo(listing._embedded);

  // Extract hash_id (fallback to URL extraction for detail API responses)
  const hashId = listing.hash_id ?? extractHashIdFromUrl(listing._links?.self?.href);

  // Extract images with multiple sizes
  const images = extractImages(listing);

  // Extract media URLs
  const virtualTourUrl = extractVirtualTourUrl(listing);
  const videoUrl = extractVideoUrl(listing);

  // === Property Type from category_sub_cb ===
  const landPropertyType = mapLandPropertyType(listing.seo?.category_sub_cb as number | undefined);

  // === Build Return Object ===
  return {
    // === Category Classification ===
    property_category: 'land' as const,
    property_subtype: (landPropertyType ?? property_subtype) as any,

    // === Tier I: Core Identification ===
    title: getStringOrValue(listing.name) || 'Unknown',
    price: listing.price_czk?.value_raw ?? listing.price as number,
    currency: 'CZK',
    transaction_type: listing.seo?.category_type_cb === 2 ? 'rent' : listing.seo?.category_type_cb === 3 ? 'auction' : 'sale',

    // Location
    location: {
      city: extractCity(getStringOrValue(listing.locality) || ''),
      country: 'cz',
      coordinates: (listing.gps?.lat && listing.gps?.lon) ? {
        lat: listing.gps.lat,
        lon: listing.gps.lon
      } : (listing.map?.lat && listing.map?.lon) ? {
        lat: listing.map.lat,
        lon: listing.map.lon
      } : undefined
    },

    // === Land Classification ===
    land_type,
    zoning,

    // === CRITICAL: Plot Area (MAIN METRIC!) ===
    area_plot_sqm: area_plot_sqm as number,

    // === UTILITIES (CRITICAL for land value!) ===
    water_supply,
    sewage,
    electricity,
    gas,
    road_access,

    // === Development Potential ===
    building_permit,
    max_building_coverage,
    terrain,
    soil_quality,

    // === Legal & Administrative ===
    cadastral_number,
    ownership_type,

    // Rental-Specific Fields
    available_from: parseAvailableFrom(parser.getStringOr(FIELD_NAMES.AVAILABLE_FROM, FIELD_NAMES.AVAILABLE_FROM_ALT)),

    // === FINANCIALS ===
    ...extractCommissionInfo(listing.price_czk?.name),

    // Tier 1 Universal Fields
    published_date: parser.getString(FIELD_NAMES.AKTUALIZACE),
    renovation_year: undefined, // Not applicable for land

    // === F. Seller contact (from _embedded.seller detail API fields) ===
    ...(sellerInfo ? {
      agent_name: sellerInfo.agent_name,
      agent_phone: sellerInfo.agent_phone,
      agent_email: sellerInfo.agent_email,
      agent_agency: sellerInfo.agent_agency,
    } : {}),

    // Media & Agent (enhanced with multiple sizes)
    media: images.length > 0 ? {
      images: images.map((img, i): PropertyImage => ({
        url: img.full || img.preview || img.thumbnail || '',
        thumbnail_url: img.thumbnail,
        order: i,
        ...(i === 0 ? { is_main: true } : {}),
      })).filter(img => img.url),
      total_images: listing.advert_images_count,
      virtual_tour_url: virtualTourUrl && virtualTourUrl !== 'available' ? virtualTourUrl : undefined,
      video_tour_url: videoUrl,
    } : undefined,

    // Legacy arrays (deprecated, but keep for backward compatibility)
    images: images.length > 0 ? images.map(img => img.preview || img.full || img.thumbnail).filter(Boolean) as string[] : undefined,
    videos: videoUrl ? [videoUrl] : undefined,

    agent: sellerInfo?.agent_name ? {
      name: sellerInfo.agent_name,
      phone: sellerInfo.agent_phone,
      email: sellerInfo.agent_email,
      agency: sellerInfo.agent_agency,
      agency_logo: sellerInfo.logo_url,
    } : undefined,

    // Description
    description: listing.text?.value,

    // Features array
    features,

    // === Tier II: Country-Specific (Czech Republic) ===
    // NOTE: Use flat keys (czech_ownership, not czech.ownership)
    // because ingest service reads country_specific.czech_ownership
    country_specific: {
      czech_ownership: normalizeOwnership(ownership_type),
      condition: normalizeCondition(parser.getString(FIELD_NAMES.CONDITION)),
    },

    // === Tier III: Portal Metadata (enhanced with all documented fields) ===
    portal_metadata: {
      sreality: {
        hash_id: hashId,
        name: getStringOrValue(listing.name),
        locality: getStringOrValue(listing.locality),
        price_czk: listing.price_czk?.value_raw,
        price_note: listing.price_czk?.name,
        category_main_cb: listing.seo?.category_main_cb,
        category_sub_cb: listing.seo?.category_sub_cb,
        category_type_cb: listing.seo?.category_type_cb,
        advert_images_count: listing.advert_images_count,

        // Marketing flags (newly documented)
        labels: listing.labels,
        new: listing.new,
        region_tip: listing.region_tip,
        exclusively_at_rk: listing.exclusively_at_rk === 1,

        // Media flags (newly documented)
        has_floor_plan: listing.has_floor_plan === 1,
        has_video: listing.has_video === 1,
        has_panorama: listing.has_panorama === 1,

        // Auction fields (newly documented)
        is_auction: listing.is_auction,
        auction_price: listing.is_auction ? listing.auctionPrice : undefined,

        // Media URLs (newly documented)
        virtual_tour_url: virtualTourUrl && virtualTourUrl !== 'available' ? virtualTourUrl : undefined,
        video_url: videoUrl
      }
    },

    // === Portal & Lifecycle ===
    source_url: extractSourceUrl(listing, hashId),
    source_platform: 'sreality',
    portal_id: `sreality-${hashId}`,
    status: 'active'
  };
}

// ============ HELPER FUNCTIONS ============

/**
 * Extract land type, zoning, and property subtype from Czech land type string
 */
function extractLandTypeAndZoning(raw: string): {
  land_type?: 'arable' | 'grassland' | 'forest' | 'vineyard' | 'orchard' | 'building_plot' | 'meadow' | 'pasture';
  zoning?: 'residential' | 'commercial' | 'agricultural' | 'mixed' | 'industrial' | 'recreational';
  property_subtype?: 'building_plot' | 'agricultural' | 'forest' | 'vineyard' | 'orchard' | 'recreational' | 'industrial';
} {
  const normalized = raw.toLowerCase();

  // Building plots (stavební pozemek)
  if (normalized.includes('stavební') || normalized.includes('stavebni')) {
    return {
      land_type: 'building_plot',
      zoning: 'residential',
      property_subtype: 'building_plot'
    };
  }

  // Agricultural land (zemědělský)
  if (normalized.includes('zemědělský') || normalized.includes('zemedelsky') || normalized.includes('orná')) {
    return {
      land_type: 'arable',
      zoning: 'agricultural',
      property_subtype: 'agricultural'
    };
  }

  // Forest (lesní)
  if (normalized.includes('lesní') || normalized.includes('lesni') || normalized.includes('les')) {
    return {
      land_type: 'forest',
      zoning: 'agricultural',
      property_subtype: 'forest'
    };
  }

  // Vineyard (vinice)
  if (normalized.includes('vinice') || normalized.includes('vinohrad')) {
    return {
      land_type: 'vineyard',
      zoning: 'agricultural',
      property_subtype: 'vineyard'
    };
  }

  // Orchard (sad)
  if (normalized.includes('sad') || normalized.includes('ovocný')) {
    return {
      land_type: 'orchard',
      zoning: 'agricultural',
      property_subtype: 'orchard'
    };
  }

  // Meadow/grassland (louka, pastvina)
  if (normalized.includes('louka') || normalized.includes('pastvina') || normalized.includes('travní')) {
    return {
      land_type: 'meadow',
      zoning: 'agricultural',
      property_subtype: 'agricultural'
    };
  }

  // Commercial (komerční)
  if (normalized.includes('komerční') || normalized.includes('komercni')) {
    return {
      land_type: 'building_plot',
      zoning: 'commercial',
      property_subtype: 'building_plot'
    };
  }

  // Industrial (průmyslový)
  if (normalized.includes('průmyslový') || normalized.includes('prumyslovy')) {
    return {
      land_type: 'building_plot',
      zoning: 'industrial',
      property_subtype: 'industrial'
    };
  }

  // Recreational (rekreační)
  if (normalized.includes('rekreační') || normalized.includes('rekrea')) {
    return {
      land_type: 'building_plot',
      zoning: 'recreational',
      property_subtype: 'recreational'
    };
  }

  return {};
}

/**
 * Extract water supply status
 */
function extractWaterSupply(raw: string): 'mains' | 'well' | 'connection_available' | 'none' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('vodovod') || normalized.includes('veřejný')) {
    return 'mains';
  }
  if (normalized.includes('studna') || normalized.includes('well')) {
    return 'well';
  }
  if (normalized.includes('přípojka') || normalized.includes('možnost') || normalized.includes('available')) {
    return 'connection_available';
  }
  if (normalized.includes('ne') || normalized.includes('no') || normalized.includes('není')) {
    return 'none';
  }

  // If value is positive (Ano, Yes, connected) but not specific type
  if (isPositiveValue(raw)) {
    return 'mains'; // Default to mains if positive
  }

  return undefined;
}

/**
 * Extract sewage status
 */
function extractSewage(raw: string): 'mains' | 'septic' | 'connection_available' | 'none' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('kanalizace') || normalized.includes('veřejná')) {
    return 'mains';
  }
  if (normalized.includes('septik') || normalized.includes('žumpa') || normalized.includes('septic')) {
    return 'septic';
  }
  if (normalized.includes('přípojka') || normalized.includes('možnost') || normalized.includes('available')) {
    return 'connection_available';
  }
  if (normalized.includes('ne') || normalized.includes('no') || normalized.includes('není')) {
    return 'none';
  }

  // If value is positive but not specific type
  if (isPositiveValue(raw)) {
    return 'mains'; // Default to mains if positive
  }

  return undefined;
}

/**
 * Extract electricity status
 */
function extractElectricity(raw: string): 'connected' | 'connection_available' | 'none' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  // Voltage values (230V, 400V) indicate electricity is connected
  if (/\d+v/i.test(normalized)) return 'connected';

  if (normalized.includes('ano') || normalized.includes('yes') || normalized.includes('elektřina') || normalized.includes('connected')) {
    return 'connected';
  }
  if (normalized.includes('přípojka') || normalized.includes('možnost') || normalized.includes('available')) {
    return 'connection_available';
  }
  if (normalized.includes('ne') || normalized.includes('no') || normalized.includes('není')) {
    return 'none';
  }

  return undefined;
}

/**
 * Extract gas status
 */
function extractGas(raw: string): 'connected' | 'connection_available' | 'none' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('ano') || normalized.includes('yes') || normalized.includes('plyn') || normalized.includes('connected')) {
    return 'connected';
  }
  if (normalized.includes('přípojka') || normalized.includes('možnost') || normalized.includes('available')) {
    return 'connection_available';
  }
  if (normalized.includes('ne') || normalized.includes('no') || normalized.includes('není')) {
    return 'none';
  }

  return undefined;
}

/**
 * Extract road access quality
 */
function extractRoadAccess(raw: string): 'paved' | 'gravel' | 'dirt' | 'none' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('asfalt') || normalized.includes('asphalt') || normalized.includes('zpevněná')) {
    return 'paved';
  }
  if (normalized.includes('štěrk') || normalized.includes('gravel') || normalized.includes('štrk')) {
    return 'gravel';
  }
  if (normalized.includes('polní') || normalized.includes('nezpevněná') || normalized.includes('dirt')) {
    return 'dirt';
  }
  if (normalized.includes('ne') || normalized.includes('no') || normalized.includes('není')) {
    return 'none';
  }

  return undefined;
}

/**
 * Extract building permit status
 */
function extractBuildingPermit(raw: string): boolean | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('ano') || normalized.includes('yes') || normalized.includes('platné')) {
    return true;
  }
  if (normalized.includes('ne') || normalized.includes('no') || normalized.includes('není')) {
    return false;
  }

  return undefined;
}

/**
 * Extract terrain type
 */
function extractTerrain(raw: string): 'flat' | 'sloped' | 'hilly' | 'mountainous' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('rovinatý') || normalized.includes('rovinný') || normalized.includes('plochý') || normalized.includes('flat')) {
    return 'flat';
  }
  if (normalized.includes('svažitý') || normalized.includes('svah') || normalized.includes('sloped')) {
    return 'sloped';
  }
  if (normalized.includes('kopcovitý') || normalized.includes('hilly')) {
    return 'hilly';
  }
  if (normalized.includes('horský') || normalized.includes('mountainous')) {
    return 'mountainous';
  }

  return undefined;
}

/**
 * Extract soil quality
 */
function extractSoilQuality(raw: string): 'excellent' | 'good' | 'fair' | 'poor' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('vynikající') || normalized.includes('výborná') || normalized.includes('excellent')) {
    return 'excellent';
  }
  if (normalized.includes('dobrá') || normalized.includes('good')) {
    return 'good';
  }
  if (normalized.includes('průměrná') || normalized.includes('střední') || normalized.includes('fair')) {
    return 'fair';
  }
  if (normalized.includes('špatná') || normalized.includes('slabá') || normalized.includes('poor')) {
    return 'poor';
  }

  return undefined;
}

/**
 * Extract percentage from string (e.g., "30%", "30 %", "30 procent")
 */
function extractPercentage(raw: string): number | undefined {
  if (!raw) return undefined;

  const match = raw.match(/(\d+)\s*%|(\d+)\s*procent/i);
  if (match) {
    const value = parseInt(match[1] || match[2]);
    return !isNaN(value) && value >= 0 && value <= 100 ? value : undefined;
  }

  return undefined;
}

/**
 * Extract ownership type
 */
function extractOwnershipType(raw: string): 'personal' | 'state' | 'municipal' | 'cooperative' | undefined {
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();

  if (normalized.includes('osobní') || normalized.includes('ov')) {
    return 'personal';
  }
  if (normalized.includes('státní')) {
    return 'state';
  }
  if (normalized.includes('obecní') || normalized.includes('městský')) {
    return 'municipal';
  }
  if (normalized.includes('družstevní')) {
    return 'cooperative';
  }

  return undefined;
}

/**
 * Build features list from land characteristics using parser
 */
function buildFeaturesList(
  parser: SRealityItemsParser,
  land_type?: string,
  water_supply?: string,
  sewage?: string,
  electricity?: string,
  gas?: string,
  road_access?: string,
  building_permit?: boolean,
  terrain?: string
): string[] {
  const features: string[] = [];

  // Land type features
  if (land_type === 'building_plot') features.push('building_plot');
  if (land_type === 'arable') features.push('agricultural');
  if (land_type === 'forest') features.push('forest');
  if (land_type === 'vineyard') features.push('vineyard');
  if (land_type === 'orchard') features.push('orchard');

  // Utility features (CRITICAL for land!)
  if (water_supply === 'mains') features.push('water_mains');
  if (water_supply === 'well') features.push('well');
  if (sewage === 'mains') features.push('sewage_mains');
  if (sewage === 'septic') features.push('septic_tank');
  if (electricity === 'connected') features.push('electricity');
  if (gas === 'connected') features.push('gas');

  // Road access
  if (road_access === 'paved') features.push('paved_road');
  if (road_access === 'gravel') features.push('gravel_road');

  // Development
  if (building_permit) features.push('building_permit');

  // Terrain
  if (terrain === 'flat') features.push('flat_terrain');

  // Check for fencing
  const fencingStr = parser.getString(FIELD_NAMES.OPLOCENI) || '';
  if (isPositiveValue(fencingStr)) {
    features.push('fenced');
  }

  // Check for irrigation
  const irrigationStr = parser.getStringOr(FIELD_NAMES.ZAVLAZOVANI, FIELD_NAMES.ZAVLAZOVACI_SYSTEM) || '';
  if (isPositiveValue(irrigationStr)) {
    features.push('irrigation');
  }

  // Check for fruit trees (common on Czech land)
  // Fruit trees check uses listing description, not parser field
  const description = '';
  if (description.toLowerCase().includes('ovocné stromy') || description.toLowerCase().includes('fruit trees')) {
    features.push('fruit_trees');
  }

  return features;
}

/**
 * Map SReality category_sub_cb to property_type for land
 */
function mapLandPropertyType(categorySubCb?: number): string | undefined {
  if (categorySubCb === undefined || categorySubCb === null) return undefined;

  const map: Record<number, string> = {
    19: 'building_plot',
    20: 'field',
    21: 'forest',
    22: 'meadow',
    23: 'garden',
    24: 'other',
    18: 'commercial_plot',
    48: 'orchard',
    46: 'water',
  };

  return map[categorySubCb] || 'other';
}
