import { LandPropertyTierI, PropertyLocation, PropertyAgent } from '@landomo/core';
import { IdnesListing } from '../../types/idnesTypes';
import {
  mapTransactionType,
  extractCityFromLocation,
  extractAvailableFromAttrs,
  extractCommissionFromAttrs,
} from '../../utils/idnesHelpers';

/**
 * Transform Idnes Land to LandPropertyTierI
 *
 * Land-specific fields:
 * - area_plot_sqm (main metric!)
 * - zoning (residential, commercial, agricultural, etc.)
 * - utilities (water, electricity, sewage, gas)
 */
export function transformIdnesLand(listing: IdnesListing): LandPropertyTierI {
  // Core
  const title = listing.title || 'Untitled';
  const price = listing.price ?? null;
  const currency = 'CZK';
  const transaction_type = mapTransactionType(listing.transactionType);

  // Location
  const city = listing.location?.city || extractCityFromLocation(listing.location) || 'Unknown';
  const location: PropertyLocation = {
    address: listing.location?.address,
    city: city,
    region: listing.location?.region || listing.location?.district,
    country: 'Czech Republic',
    coordinates: listing.coordinates ? {
      lat: listing.coordinates.lat,
      lon: listing.coordinates.lng
    } : undefined
  };

  // Land Area (main metric!)
  const area_plot_sqm = listing.plotArea || listing.area || null;

  // Utilities (extract from _attributes if available)
  const water_supply = mapWaterSupply(listing._attributes?.['voda'] || listing._attributes?.['vodovod']);
  const sewage = mapSewage(listing._attributes?.['kanalizace'] || listing._attributes?.['odpad']);
  const electricity = mapElectricity(listing._attributes?.['elektřina'] || listing._attributes?.['elektrina'] || listing._attributes?.['proud']);
  const gas = mapGas(listing._attributes?.['plyn']);
  const road_access = mapRoadAccess(listing._attributes?.['přístupová komunikace']);
  const commission = extractCommissionFromAttrs(listing._attributes);

  // Agent
  const agent: PropertyAgent | undefined = listing.realtor?.name ? {
    name: listing.realtor.name,
    phone: listing.realtor.phone,
    email: listing.realtor.email,
  } : undefined;

  // Media
  const media = {
    images: listing.images || [],
    main_image: listing.images?.[0],
    virtual_tour_url: undefined
  };

  // Portal
  const source_url = listing.url;
  const source_platform = 'idnes-reality';
  const portal_id = `idnes-${listing.id}`;
  const status = 'active' as const;

  return ({
    property_category: 'land' as const,
    property_type: classifyLandPropertyType(title),
    title,
    price,
    currency,
    transaction_type,
    location,
    property_subtype: undefined,
    area_plot_sqm,
    zoning: undefined,
    land_type: undefined,
    water_supply,
    sewage,
    electricity,
    gas,
    road_access,
    building_permit: undefined,
    max_building_coverage: undefined,
    max_building_height: undefined,
    terrain: undefined,
    soil_quality: undefined,
    cadastral_number: undefined,
    ownership_type: listing.ownership as 'personal' | 'cooperative' | 'state' | 'municipal' | undefined,
    is_commission: commission?.is_commission,
    commission_note: commission?.commission_note,
    published_date: listing.metadata?.published || undefined,
    available_from: extractAvailableFromAttrs(listing._attributes),
    media,
    agent,
    source_url,
    source_platform,
    portal_id,
    status,
    description: listing.description || listing.title || '',
    features: listing.features || [],

    // Top-level images (required by ingest API)
    images: listing.images || [],
  }) as LandPropertyTierI;
}

/**
 * Classify land property_type from Czech title
 */
function classifyLandPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('stavební')) return 'building_plot';
  if (t.includes('pole') || t.includes('orná')) return 'field';
  if (t.includes('zahrad')) return 'garden';
  if (t.includes('les')) return 'forest';
  if (t.includes('komerční')) return 'commercial_plot';
  if (t.includes('louk')) return 'meadow';
  if (t.includes('sad') || t.includes('vinic')) return 'orchard';
  if (t.includes('rybník') || t.includes('vodní')) return 'water';
  return 'other';
}

function mapWaterSupply(value?: string): 'mains' | 'well' | 'connection_available' | 'none' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('vodovod') || lower.includes('veřejný') || lower.includes('obecní')) return 'mains';
  if (lower.includes('studna') || lower.includes('studně') || lower.includes('vrt')) return 'well';
  if (lower.includes('možnost') || lower.includes('přípojka')) return 'connection_available';
  if (lower.includes('bez') || lower.includes('není') || lower.includes('ne')) return 'none';
  return undefined;
}

function mapSewage(value?: string): 'mains' | 'septic' | 'connection_available' | 'none' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('kanalizace') || lower.includes('veřejná') || lower.includes('obecní')) return 'mains';
  if (lower.includes('septik') || lower.includes('jímka') || lower.includes('žumpa')) return 'septic';
  if (lower.includes('možnost') || lower.includes('přípojka')) return 'connection_available';
  if (lower.includes('bez') || lower.includes('není') || lower.includes('ne')) return 'none';
  return undefined;
}

function mapElectricity(value?: string): 'connected' | 'connection_available' | 'none' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('ano') || lower.includes('230') || lower.includes('400') || lower.includes('připojen')) return 'connected';
  if (lower.includes('možnost') || lower.includes('přípojka')) return 'connection_available';
  if (lower.includes('bez') || lower.includes('není') || lower.includes('ne')) return 'none';
  return undefined;
}

function mapGas(value?: string): 'connected' | 'connection_available' | 'none' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('ano') || lower.includes('připojen') || lower.includes('plynovod')) return 'connected';
  if (lower.includes('možnost') || lower.includes('přípojka')) return 'connection_available';
  if (lower.includes('bez') || lower.includes('není') || lower.includes('ne')) return 'none';
  return undefined;
}

function mapRoadAccess(value?: string): 'paved' | 'gravel' | 'dirt' | 'none' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('asfalt') || lower.includes('dlažba') || lower.includes('beton')) return 'paved';
  if (lower.includes('štěrk') || lower.includes('šotolina')) return 'gravel';
  if (lower.includes('žádné úpravy') || lower.includes('polní') || lower.includes('nezpevněná')) return 'dirt';
  return undefined;
}
