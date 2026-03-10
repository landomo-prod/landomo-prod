import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { ImmobiliareResult } from '../../types/immobiliareTypes';

export function transformImmobiliareLand(result: ImmobiliareResult, contract: 'sale' | 'rent'): LandPropertyTierI {
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

  const area = prop?.surface_value ? parseFloat(prop.surface_value) : 0;
  const photos = prop?.multimedia?.photos?.map(p => p.urls?.large || p.urls?.medium || '').filter(Boolean) || [];
  const mainImage = prop?.photo?.urls?.large || prop?.photo?.urls?.medium;
  const allImages = mainImage ? [mainImage, ...photos] : photos;

  const sourceUrl = result.seo?.url
    ? `https://www.immobiliare.it${result.seo.url}`
    : `https://www.immobiliare.it/annunci/${re.id}/`;

  return {
    property_category: 'land' as const,
    title: re.title || prop?.caption || 'Land',
    price: prop?.price?.value || 0,
    currency: 'EUR',
    transaction_type: contract,
    location,
    area_plot_sqm: area,
    media: { images: allImages},
    source_url: sourceUrl,
    source_platform: 'immobiliare.it',
    portal_id: `immobiliare-it-${re.id}`,
    status: 'active' as const,
    description: prop?.description || '',
    features: prop?.ga4features || [],
    images: allImages,
    portal_metadata: {
      immobiliare: {
        id: re.id,
        is_new: re.isNew,
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
