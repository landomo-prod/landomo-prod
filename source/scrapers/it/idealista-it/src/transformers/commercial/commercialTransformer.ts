import { CommercialPropertyTierI, PropertyLocation } from '@landomo/core';
import { IdealistaListing, IdealistaDetail } from '../../types/idealistaTypes';

export function transformIdealistaCommercial(listing: IdealistaListing, detail?: IdealistaDetail): CommercialPropertyTierI {
  const location: PropertyLocation = {
    address: listing.location.address || listing.title || 'Unknown',
    city: listing.location.city || 'Unknown',
    region: listing.location.province,
    country: 'Italy',
  };

  const sqmTotal = listing.size || detail?.builtArea || detail?.usableArea || 0;
  const features = [...(listing.features || []), ...(detail?.features || [])];
  const allImages = [...new Set([...(listing.thumbnails || []), ...(detail?.images || [])])];
  const sourceUrl = listing.url.startsWith('http') ? listing.url : `https://www.idealista.it${listing.url}`;

  return {
    property_category: 'commercial' as const,
    title: listing.title || 'Commercial Property',
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: listing.operation === 'rent' ? 'rent' : 'sale',
    location,
    sqm_total: sqmTotal,
    sqm_usable: detail?.usableArea,
    has_elevator: features.some(f => f.includes('ascensore')),
    has_parking: listing.hasParking || detail?.parkingIncluded || features.some(f => f.includes('parcheggio') || f.includes('garage')),
    has_bathrooms: features.some(f => f.includes('bagn')) || (detail?.bathrooms != null && detail.bathrooms > 0),
    bathroom_count: detail?.bathrooms,
    year_built: detail?.yearBuilt,
    heating_type: detail?.heatingType,
    energy_class: detail?.energyClass,
    condition: mapCommercialCondition(detail?.condition),
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
      },
    },
  };
}

function mapCommercialCondition(condition?: string): CommercialPropertyTierI['condition'] {
  if (!condition) return undefined;
  const c = condition.toLowerCase();
  if (c.includes('nuovo')) return 'new';
  if (c.includes('ottimo')) return 'excellent';
  if (c.includes('buono')) return 'good';
  if (c.includes('da ristrutturare')) return 'requires_renovation';
  return undefined;
}
