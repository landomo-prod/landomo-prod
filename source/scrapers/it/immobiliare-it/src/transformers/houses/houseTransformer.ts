import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { ImmobiliareResult } from '../../types/immobiliareTypes';

function hasFeature(features: string[] | undefined, ...keywords: string[]): boolean {
  if (!features) return false;
  const normalized = features.map(f => f.toLowerCase());
  return keywords.some(kw => normalized.some(f => f.includes(kw)));
}

function mapCondition(condition?: string): HousePropertyTierI['condition'] {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('nuovo') || lower.includes('new')) return 'new';
  if (lower.includes('ottimo') || lower.includes('excellent')) return 'excellent';
  if (lower.includes('buono') || lower.includes('good')) return 'good';
  if (lower.includes('ristrutturato') || lower.includes('renovated')) return 'after_renovation';
  if (lower.includes('da ristrutturare') || lower.includes('to renovate')) return 'requires_renovation';
  return undefined;
}

function mapHouseSubtype(typology?: string): HousePropertyTierI['property_subtype'] {
  if (!typology) return undefined;
  const lower = typology.toLowerCase();
  if (lower.includes('villa singola') || lower.includes('villa')) return 'villa';
  if (lower.includes('villetta a schiera') || lower.includes('schiera')) return 'terraced';
  if (lower.includes('villetta')) return 'semi_detached';
  if (lower.includes('rustico') || lower.includes('casale')) return 'farmhouse';
  if (lower.includes('casa indipendente')) return 'detached';
  if (lower.includes('cottage')) return 'cottage';
  return 'detached';
}

export function transformImmobiliareHouse(result: ImmobiliareResult, contract: 'sale' | 'rent'): HousePropertyTierI {
  const re = result.realEstate;
  const prop = result.properties?.[0];
  const loc = prop?.location;

  const location: PropertyLocation = {
    address: loc?.address || 'Unknown',
    city: loc?.city?.name || 'Unknown',
    region: loc?.region?.name,
    country: 'Italy',
    coordinates: loc?.latitude && loc?.longitude
      ? { lat: loc.latitude, lon: loc.longitude }
      : undefined,
  };

  const sqm = prop?.surface_value ? parseFloat(prop.surface_value) : 0;
  const features = prop?.ga4features;
  const photos = prop?.multimedia?.photos?.map(p => p.urls?.large || p.urls?.medium || '').filter(Boolean) || [];
  const mainImage = prop?.photo?.urls?.large || prop?.photo?.urls?.medium;
  const allImages = mainImage ? [mainImage, ...photos] : photos;

  const sourceUrl = result.seo?.url
    ? `https://www.immobiliare.it${result.seo.url}`
    : `https://www.immobiliare.it/annunci/${re.id}/`;

  const bedrooms = prop?.bedRoomsNumber ? parseInt(prop.bedRoomsNumber) : 0;
  const rooms = prop?.rooms ? parseInt(prop.rooms) : undefined;

  return {
    property_category: 'house' as const,
    title: re.title || prop?.caption || 'House',
    price: prop?.price?.value || 0,
    currency: 'EUR',
    transaction_type: contract,
    location,
    property_subtype: mapHouseSubtype(prop?.typologyGA4Translation),
    bedrooms: bedrooms || (rooms ? Math.max(0, rooms - 1) : 0),
    bathrooms: prop?.bathrooms ? parseInt(prop.bathrooms) : undefined,
    sqm_living: sqm,
    sqm_plot: 0, // Not reliably available from list view
    rooms,
    has_garden: hasFeature(features, 'giardino', 'garden'),
    has_garage: !!prop?.ga4Garage && prop.ga4Garage.toLowerCase().includes('garage'),
    has_parking: !!prop?.ga4Garage,
    has_basement: hasFeature(features, 'cantina'),
    has_pool: hasFeature(features, 'piscina'),
    has_terrace: hasFeature(features, 'terrazzo', 'terrazza'),
    has_balcony: hasFeature(features, 'balcon'),
    condition: mapCondition(prop?.condition),
    heating_type: prop?.ga4Heating || undefined,
    energy_class: prop?.energy?.class || undefined,
    media: { images: allImages},
    source_url: sourceUrl,
    source_platform: 'immobiliare.it',
    portal_id: `immobiliare-it-${re.id}`,
    status: 'active' as const,
    description: prop?.description || '',
    features: features || [],
    images: allImages,
    portal_metadata: {
      immobiliare: {
        id: re.id,
        is_new: re.isNew,
        luxury: re.luxury,
        typology: prop?.typologyGA4Translation,
        agency: re.agency?.displayName || re.advertiser?.agency?.displayName,
      },
    },
    country_specific: {
      italy: {
        province: loc?.province?.abbreviation,
        macrozone: loc?.macrozone?.name,
        microzone: loc?.microzone?.name,
      },
    },
  };
}
