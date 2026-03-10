import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
import { IdealistaListing, IdealistaDetail } from '../../types/idealistaTypes';

export function transformIdealistaApartment(listing: IdealistaListing, detail?: IdealistaDetail): ApartmentPropertyTierI {
  const price = listing.price || 0;
  const currency = listing.currency || 'EUR';
  const transaction_type = listing.operation === 'rent' ? 'rent' : 'sale';

  const location: PropertyLocation = {
    address: listing.location.address || listing.title || 'Unknown',
    city: listing.location.city || 'Unknown',
    region: listing.location.province,
    country: 'Italy',
  };

  const bedrooms = Math.max((listing.rooms || 1) - 1, 0);
  const sqm = listing.size || detail?.builtArea || detail?.usableArea || 0;

  const allImages = [...(listing.thumbnails || []), ...(detail?.images || [])];
  const uniqueImages = [...new Set(allImages)];
  const mainImage = uniqueImages[0];

  const features = [...(listing.features || []), ...(detail?.features || [])];

  const hasElevator = listing.hasElevator || features.some(f => f.includes('ascensore'));
  const hasBalcony = features.some(f => f.includes('balcon'));
  const hasParking = listing.hasParking || detail?.parkingIncluded || features.some(f => f.includes('parcheggio') || f.includes('garage') || f.includes('box'));
  const hasBasement = features.some(f => f.includes('cantina') || f.includes('seminterrato'));
  const hasTerrace = listing.hasTerrace || features.some(f => f.includes('terrazza') || f.includes('terrazzo'));

  const sourceUrl = listing.url.startsWith('http') ? listing.url : `https://www.idealista.it${listing.url}`;

  return {
    property_category: 'apartment' as const,
    title: listing.title || 'Apartment',
    price,
    currency,
    transaction_type,
    location,
    property_subtype: undefined,
    bedrooms,
    bathrooms: detail?.bathrooms || listing.bathrooms,
    sqm,
    floor: detail?.floor ?? undefined,
    total_floors: detail?.totalFloors ?? undefined,
    rooms: listing.rooms || undefined,
    has_elevator: hasElevator ?? false,
    has_balcony: hasBalcony,
    has_parking: hasParking ?? false,
    has_basement: hasBasement,
    has_terrace: hasTerrace,
    condition: mapCondition(detail?.condition),
    heating_type: detail?.heatingType,
    energy_class: detail?.energyClass,
    year_built: detail?.yearBuilt,
    furnished: mapFurnished(detail?.furnished),
    media: { images: uniqueImages},
    source_url: sourceUrl,
    source_platform: 'idealista.it',
    portal_id: `idealista-${listing.id}`,
    status: 'active' as const,
    description: detail?.description || listing.description || '',
    features: listing.features || [],
    images: uniqueImages,
    portal_metadata: {
      idealista: {
        id: listing.id,
        original_url: listing.url,
        property_type: listing.propertyType,
        operation: listing.operation,
        city: listing.location.city,
        neighborhood: listing.location.neighborhood,
        agency: detail?.agencyName,
      },
    },
    country_specific: {
      italian: {
        energy_class: detail?.energyClass,
        heating_type: detail?.heatingType,
        condition: detail?.condition,
      },
    },
  };
}

function mapCondition(condition?: string): ApartmentPropertyTierI['condition'] {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('nuovo') || c.includes('new')) return 'new';
  if (c.includes('ottimo') || c.includes('excellent')) return 'excellent';
  if (c.includes('buono') || c.includes('good')) return 'good';
  if (c.includes('ristrutturato') || c.includes('renovated')) return 'after_renovation';
  if (c.includes('da ristrutturare') || c.includes('to renovate')) return 'requires_renovation';
  return undefined;
}

function mapFurnished(furnished?: string): ApartmentPropertyTierI['furnished'] {
  if (!furnished) return undefined;
  const f = furnished.toLowerCase();
  if (f.includes('non') || f === 'not_furnished') return 'not_furnished';
  if (f.includes('parzial') || f.includes('partial')) return 'partially_furnished';
  if (f.includes('arredato') || f === 'furnished') return 'furnished';
  return undefined;
}
