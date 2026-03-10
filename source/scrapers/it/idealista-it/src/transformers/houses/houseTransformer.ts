import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { IdealistaListing, IdealistaDetail } from '../../types/idealistaTypes';

export function transformIdealistaHouse(listing: IdealistaListing, detail?: IdealistaDetail): HousePropertyTierI {
  const location: PropertyLocation = {
    address: listing.location.address || listing.title || 'Unknown',
    city: listing.location.city || 'Unknown',
    region: listing.location.province,
    country: 'Italy',
  };

  const sqmLiving = listing.size || detail?.usableArea || detail?.builtArea || 0;
  const sqmPlot = detail?.plotSize || 0;
  const bedrooms = Math.max((listing.rooms || 1) - 1, 0);

  const features = [...(listing.features || []), ...(detail?.features || [])];
  const allImages = [...new Set([...(listing.thumbnails || []), ...(detail?.images || [])])];

  const sourceUrl = listing.url.startsWith('http') ? listing.url : `https://www.idealista.it${listing.url}`;

  return {
    property_category: 'house' as const,
    title: listing.title || 'House',
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: listing.operation === 'rent' ? 'rent' : 'sale',
    location,
    bedrooms,
    bathrooms: detail?.bathrooms || listing.bathrooms,
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,
    sqm_total: detail?.builtArea,
    rooms: listing.rooms || undefined,
    has_garden: listing.hasGarden || features.some(f => f.includes('giardino')),
    has_garage: features.some(f => f.includes('garage') || f.includes('box auto')),
    has_parking: listing.hasParking || detail?.parkingIncluded || features.some(f => f.includes('parcheggio')),
    has_basement: features.some(f => f.includes('cantina') || f.includes('seminterrato')),
    has_pool: listing.hasSwimmingPool || features.some(f => f.includes('piscina')),
    has_terrace: listing.hasTerrace || features.some(f => f.includes('terrazza') || f.includes('terrazzo')),
    has_balcony: features.some(f => f.includes('balcon')),
    year_built: detail?.yearBuilt,
    heating_type: detail?.heatingType,
    energy_class: detail?.energyClass,
    condition: mapHouseCondition(detail?.condition),
    furnished: mapHouseFurnished(detail?.furnished),
    media: { images: allImages},
    source_url: sourceUrl,
    source_platform: 'idealista.it',
    portal_id: `idealista-${listing.id}`,
    status: 'active' as const,
    description: detail?.description || listing.description || '',
    features: listing.features || [],
    images: allImages,
    portal_metadata: {
      idealista: {
        id: listing.id,
        original_url: listing.url,
        property_type: listing.propertyType,
        operation: listing.operation,
        city: listing.location.city,
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

function mapHouseCondition(condition?: string): HousePropertyTierI['condition'] {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('nuovo')) return 'new';
  if (c.includes('ottimo')) return 'excellent';
  if (c.includes('buono')) return 'good';
  if (c.includes('ristrutturato')) return 'after_renovation';
  if (c.includes('da ristrutturare')) return 'requires_renovation';
  return undefined;
}

function mapHouseFurnished(furnished?: string): HousePropertyTierI['furnished'] {
  if (!furnished) return undefined;
  const f = furnished.toLowerCase();
  if (f.includes('non')) return 'not_furnished';
  if (f.includes('parzial')) return 'partially_furnished';
  if (f.includes('arredato')) return 'furnished';
  return undefined;
}
