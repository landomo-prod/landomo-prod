import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { ImmobiliareResult } from '../../types/immobiliareTypes';

function parseFloor(floorValue?: string): number | undefined {
  if (!floorValue) return undefined;
  const lower = floorValue.toLowerCase();
  if (lower === 't' || lower === 'terra' || lower === 'ground') return 0;
  if (lower === 's' || lower === 'seminterrato') return -1;
  const num = parseInt(floorValue);
  return isNaN(num) ? undefined : num;
}

function hasFeature(features: string[] | undefined, ...keywords: string[]): boolean {
  if (!features) return false;
  const normalized = features.map(f => f.toLowerCase());
  return keywords.some(kw => normalized.some(f => f.includes(kw)));
}

function mapCondition(condition?: string): ApartmentPropertyTierI['condition'] {
  if (!condition) return undefined;
  const lower = condition.toLowerCase();
  if (lower.includes('nuovo') || lower.includes('new')) return 'new';
  if (lower.includes('ottimo') || lower.includes('excellent')) return 'excellent';
  if (lower.includes('buono') || lower.includes('good')) return 'good';
  if (lower.includes('ristrutturato') || lower.includes('renovated')) return 'after_renovation';
  if (lower.includes('da ristrutturare') || lower.includes('to renovate')) return 'requires_renovation';
  return undefined;
}

export function transformImmobiliareApartment(result: ImmobiliareResult, contract: 'sale' | 'rent'): ApartmentPropertyTierI {
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

  const bedrooms = prop?.bedRoomsNumber ? parseInt(prop.bedRoomsNumber) : 0;
  const rooms = prop?.rooms ? parseInt(prop.rooms) : undefined;
  const sqm = prop?.surface_value ? parseFloat(prop.surface_value) : 0;

  const features = prop?.ga4features;
  const photos = prop?.multimedia?.photos?.map(p => p.urls?.large || p.urls?.medium || '').filter(Boolean) || [];
  const mainImage = prop?.photo?.urls?.large || prop?.photo?.urls?.medium;
  const allImages = mainImage ? [mainImage, ...photos] : photos;

  const sourceUrl = result.seo?.url
    ? `https://www.immobiliare.it${result.seo.url}`
    : `https://www.immobiliare.it/annunci/${re.id}/`;

  return {
    property_category: 'apartment' as const,
    title: re.title || prop?.caption || 'Apartment',
    price: prop?.price?.value || 0,
    currency: 'EUR',
    transaction_type: contract,
    location,
    property_subtype: mapApartmentSubtype(prop?.typologyGA4Translation),
    bedrooms: bedrooms || (rooms ? Math.max(0, rooms - 1) : 0),
    bathrooms: prop?.bathrooms ? parseInt(prop.bathrooms) : undefined,
    sqm,
    floor: parseFloor(prop?.floor?.value),
    total_floors: prop?.floors ? parseInt(prop.floors) : undefined,
    rooms,
    has_elevator: prop?.hasElevators === true,
    has_balcony: hasFeature(features, 'balcon'),
    has_parking: !!prop?.ga4Garage,
    has_basement: hasFeature(features, 'cantina'),
    has_loggia: hasFeature(features, 'loggia'),
    has_terrace: hasFeature(features, 'terrazzo', 'terrazza'),
    has_garage: !!prop?.ga4Garage && prop.ga4Garage.toLowerCase().includes('garage'),
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

function mapApartmentSubtype(typology?: string): ApartmentPropertyTierI['property_subtype'] {
  if (!typology) return undefined;
  const lower = typology.toLowerCase();
  if (lower.includes('attico') || lower.includes('penthouse')) return 'penthouse';
  if (lower.includes('loft')) return 'loft';
  if (lower.includes('mansarda')) return 'atelier';
  if (lower.includes('monolocale') || lower.includes('studio')) return 'studio';
  return 'standard';
}
