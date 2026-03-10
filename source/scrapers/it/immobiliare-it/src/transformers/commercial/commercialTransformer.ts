import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { ImmobiliareResult } from '../../types/immobiliareTypes';

function hasFeature(features: string[] | undefined, ...keywords: string[]): boolean {
  if (!features) return false;
  const normalized = features.map(f => f.toLowerCase());
  return keywords.some(kw => normalized.some(f => f.includes(kw)));
}

function mapSubtype(typology?: string): CommercialPropertyTierI['property_subtype'] {
  if (!typology) return undefined;
  const lower = typology.toLowerCase();
  if (lower.includes('ufficio') || lower.includes('office')) return 'office';
  if (lower.includes('negozio') || lower.includes('shop') || lower.includes('retail')) return 'retail';
  if (lower.includes('capannone') || lower.includes('warehouse')) return 'warehouse';
  if (lower.includes('hotel') || lower.includes('albergo')) return 'hotel';
  if (lower.includes('ristorante')) return 'restaurant';
  if (lower.includes('showroom')) return 'showroom';
  return 'office';
}

export function transformImmobiliareCommercial(result: ImmobiliareResult, contract: 'sale' | 'rent'): CommercialPropertyTierI {
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

  return {
    property_category: 'commercial' as const,
    title: re.title || prop?.caption || 'Commercial',
    price: prop?.price?.value || 0,
    currency: 'EUR',
    transaction_type: contract,
    location,
    property_subtype: mapSubtype(prop?.typologyGA4Translation),
    sqm_total: sqm,
    has_elevator: prop?.hasElevators === true,
    has_parking: !!prop?.ga4Garage,
    has_bathrooms: (prop?.bathrooms && parseInt(prop.bathrooms) > 0) || false,
    bathroom_count: prop?.bathrooms ? parseInt(prop.bathrooms) : undefined,
    condition: mapCommercialCondition(prop?.condition),
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

function mapCommercialCondition(condition?: string): CommercialPropertyTierI['condition'] {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('nuovo') || lower.includes('new')) return 'new';
  if (lower.includes('ottimo') || lower.includes('excellent')) return 'excellent';
  if (lower.includes('buono') || lower.includes('good')) return 'good';
  if (lower.includes('da ristrutturare') || lower.includes('to renovate')) return 'requires_renovation';
  return 'fair';
}
