import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { RealityListing } from '../../types/realityTypes';
import {
  normalizeOwnership,
} from '../../../../shared/czech-value-mappings';

/**
 * Transform Reality.cz API Land to LandPropertyTierI
 *
 * API data provides structured information[] array and GPS coordinates
 */
export function transformRealityLand(listing: RealityListing): LandPropertyTierI {
  const info = buildInfoMap(listing.information);

  // Core
  const title = listing.title;
  const price = listing.price ?? undefined;
  const currency = listing.currency || 'CZK';
  const transaction_type = listing.transaction_type;

  // Location (with GPS from API)
  const location: PropertyLocation = {
    address: listing.place,
    city: extractCity(listing.place),
    region: extractRegion(listing.place),
    country: 'Czech Republic',
    coordinates: listing.gps ? {
      lat: listing.gps.lat,
      lon: listing.gps.lng
    } : undefined
  };

  // Land Area
  const area_plot_sqm = parseArea(info['Plocha'] || info['Plocha pozemku'] || info['Plocha parcely'] || info['Pozemek celkem']) ?? extractSqmFromType(listing.api_type) ?? undefined;

  // Utilities - map boolean Czech values to enum strings
  const waterBool = parseBooleanInfo(info['Voda']);
  const water_supply = waterBool === true ? 'mains' as const : waterBool === false ? 'none' as const : undefined;
  const sewageBool = parseBooleanInfo(info['Kanalizace']);
  const sewage = sewageBool === true ? 'mains' as const : sewageBool === false ? 'none' as const : undefined;
  const electricityBool = parseBooleanInfo(info['Elektřina'] || info['Elektrika']);
  const electricity = electricityBool === true ? 'connected' as const : electricityBool === false ? 'none' as const : undefined;
  const gasBool = parseBooleanInfo(info['Plyn']);
  const gas = gasBool === true ? 'connected' as const : gasBool === false ? 'none' as const : undefined;
  const roadBool = parseBooleanInfo(info['Příjezdová cesta'] || info['Komunikace']);
  const road_access = roadBool === true ? 'paved' as const : roadBool === false ? 'none' as const : undefined;

  // Terrain
  const rawTerrain = info['Terén pozemku'] || info['Terén'];
  const terrain = mapTerrain(rawTerrain);

  // Media
  const virtual_tour_url = listing.virtual_tours?.[0]?.url;
  const video_tour_url = listing.videos?.[0]?.url
    ? `https://www.youtube.com/watch?v=${listing.videos[0].url}`
    : undefined;
  const media = {
    images: listing.images || [],
    main_image: listing.images?.[0],
    virtual_tour_url,
    video_tour_url
  };

  // Portal
  const source_url = listing.url;
  const source_platform = 'reality';
  const portal_id = `reality-${listing.id}`;
  const status = listing.outdated ? 'removed' as const : 'active' as const;

  // Ownership
  const rawOwnership = info['Vlastnictví'];

  return ({
    property_category: 'land' as const,
    property_type: classifyLandPropertyType(title),
    title,
    price,
    currency,
    transaction_type,
    location,
    property_subtype: detectLandSubtype(info['Využití'] || info['Typ pozemku'] || info['Účel pozemku'] || listing.api_type),
    area_plot_sqm,
    zoning: mapZoning(info['Využití'] || info['Typ pozemku'] || info['Účel pozemku']),
    land_type: undefined,
    water_supply,
    sewage,
    electricity,
    gas,
    road_access,
    building_permit: parseBooleanInfo(info['Stavební povolení']) ?? undefined,
    max_building_coverage: undefined,
    max_building_height: undefined,
    terrain,
    soil_quality: undefined,
    cadastral_number: info['Katastrální číslo'] || undefined,
    ownership_type: rawOwnership ? normalizeOwnership(rawOwnership) as 'personal' | 'cooperative' | 'state' | 'municipal' | undefined : undefined,
    published_date: listing.created_at || undefined,
    is_commission: listing.has_commission ?? undefined,
    commission_note: listing.price_note || undefined,
    available_from: parseDate(info['K nastěhování'] || info['Dostupné od'] || info['Volné od']),
    media,
    agent: (() => {
      const name = listing.contact?.broker?.name || listing.contact?.advertiser?.name;
      if (!name) return undefined;
      return {
        name,
        phone: listing.contact!.broker?.phones?.[0] || listing.contact!.advertiser?.phones?.[0] || listing.contact!.real_estate?.phones?.[0],
        email: listing.contact!.broker?.email || listing.contact!.advertiser?.email || listing.contact!.real_estate?.email,
        agency: listing.contact!.real_estate?.name,
      };
    })(),
    source_url,
    source_platform,
    portal_id,
    status,
    description: listing.description,
    features: extractFeatures(listing.information),

    // Tier II: Legacy Media Fields
    images: listing.images || [],
    videos: undefined,

    // Tier III: Portal & Country Metadata
    portal_metadata: {
      reality: {
        id: listing.id,
        custom_id: listing.custom_id,
        api_type: listing.api_type,
        price_note: listing.price_note,
        previous_price: listing.previous_price,
        has_commission: listing.has_commission,
        created_at: listing.created_at,
        modified_at: listing.modified_at,
        scraped_at: listing.scraped_at,
        outdated: listing.outdated,
        contact: listing.contact ? {
          company: listing.contact.real_estate?.name,
          broker: listing.contact.broker?.name
        } : undefined
      }
    },
    country_specific: {
      czech: {
        ownership: rawOwnership ? normalizeOwnership(rawOwnership) : undefined,
        zoning: mapZoning(info['Využití'] || info['Typ pozemku'] || info['Účel pozemku']),
        water_supply,
        sewage,
        electricity,
        gas,
        road_access
      }
    }
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

// ============ Helper Functions ============

function buildInfoMap(information: Array<{ key: string; value: string }>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of information) {
    if (entry.key && entry.value) {
      const key = entry.key.replace(/:$/, '').trim();
      map[key] = entry.value.replace(/\s+/g, ' ').trim();
    }
  }
  return map;
}

function extractCity(place?: string): string {
  if (!place) return 'Unknown';
  return place.split(' - ')[0].trim() || 'Unknown';
}

function extractRegion(place?: string): string | undefined {
  if (!place) return undefined;
  const parts = place.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : undefined;
}

function parseArea(str?: string): number | undefined {
  if (!str) return undefined;
  const match = str.match(/([\d.,\s]+)/);
  if (!match) return undefined;
  let num = match[1].replace(/\s/g, '');
  if (/^\d{1,3}(\.\d{3})+$/.test(num)) {
    num = num.replace(/\./g, '');
  }
  return parseFloat(num.replace(',', '.'));
}

function parseBooleanInfo(value?: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const v = value.toLowerCase().trim();
  if (v === '') return undefined;
  if (v === 'ne' || v === 'no' || v === '0' || v === 'false' || v === 'není') return false;
  if (v === 'ano' || v === 'yes' || v === '1' || v === 'true' || v.startsWith('ano')) return true;
  return undefined;
}

/** Extract sqm from api_type string like "pozemek 680 m²" */
function extractSqmFromType(apiType?: string): number | undefined {
  if (!apiType) return undefined;
  const match = apiType.match(/([\d.,]+)\s*m[²2]/);
  return match ? parseFloat(match[1].replace(/\./g, '').replace(',', '.')) : undefined;
}

function parseDate(dateStr?: string): string | undefined {
  if (!dateStr) return undefined;
  const czechMatch = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (czechMatch) {
    const [, day, month, year] = czechMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return undefined;
}

function mapZoning(raw?: string): LandPropertyTierI['zoning'] {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes('bydl') || v.includes('obyt') || v.includes('rezidenční')) return 'residential';
  if (v.includes('komerční') || v.includes('obchod')) return 'commercial';
  if (v.includes('průmysl') || v.includes('výrob')) return 'industrial';
  if (v.includes('zeměděl') || v.includes('orná')) return 'agricultural';
  if (v.includes('rekrea') || v.includes('zahrad')) return 'recreational';
  if (v.includes('smíšen')) return 'mixed';
  return undefined;
}

/** Detect land subtype from zoning/type info */
function detectLandSubtype(typeStr?: string): LandPropertyTierI['property_subtype'] {
  if (!typeStr) return undefined;
  const v = typeStr.toLowerCase();

  if (v.includes('stavební') || v.includes('bydl') || v.includes('rezidenční')) return 'building_plot';
  if (v.includes('zeměděl') || v.includes('orná')) return 'agricultural';
  if (v.includes('les') || v.includes('lesní')) return 'forest';
  if (v.includes('vinic') || v.includes('vinohrad')) return 'vineyard';
  if (v.includes('ovocn') || v.includes('sad')) return 'orchard';
  if (v.includes('rekrea') || v.includes('zahrad')) return 'recreational';
  if (v.includes('průmysl') || v.includes('komerční')) return 'industrial';

  return undefined;
}

function extractFeatures(information: Array<{ key: string; value: string }>): string[] {
  const featureKeys = ['Voda', 'Kanalizace', 'Elektřina', 'Elektrika', 'Plyn', 'Příjezdová cesta', 'Komunikace'];
  return information
    .filter(i => featureKeys.includes(i.key) && parseBooleanInfo(i.value) === true)
    .map(i => i.key);
}

function mapTerrain(raw?: string): LandPropertyTierI['terrain'] {
  if (!raw) return undefined;
  const v = raw.toLowerCase();
  if (v.includes('rovný') || v.includes('rovinatý') || v === 'flat') return 'flat';
  if (v.includes('svažitý') || v.includes('svazitý') || v.includes('mírně svažitý') || v === 'sloped') return 'sloped';
  if (v.includes('členitý') || v.includes('kopcovitý') || v === 'hilly') return 'hilly';
  if (v.includes('hornatý') || v === 'mountainous') return 'mountainous';
  return undefined;
}
