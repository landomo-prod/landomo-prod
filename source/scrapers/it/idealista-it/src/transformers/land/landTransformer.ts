import { LandPropertyTierI, PropertyLocation } from '@landomo/core';
import { IdealistaListing, IdealistaDetail } from '../../types/idealistaTypes';

export function transformIdealistaLand(listing: IdealistaListing, detail?: IdealistaDetail): LandPropertyTierI {
  const location: PropertyLocation = {
    address: listing.location.address || listing.title || 'Unknown',
    city: listing.location.city || 'Unknown',
    region: listing.location.province,
    country: 'Italy',
  };

  const areaPlotSqm = detail?.plotSize || listing.size || 0;
  const allImages = [...new Set([...(listing.thumbnails || []), ...(detail?.images || [])])];
  const sourceUrl = listing.url.startsWith('http') ? listing.url : `https://www.idealista.it${listing.url}`;

  return {
    property_category: 'land' as const,
    title: listing.title || 'Land',
    price: listing.price || 0,
    currency: listing.currency || 'EUR',
    transaction_type: listing.operation === 'rent' ? 'rent' : 'sale',
    location,
    area_plot_sqm: areaPlotSqm,
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
        operation: listing.operation,
        city: listing.location.city,
        agency: detail?.agencyName,
      },
    },
    country_specific: {
      italian: {},
    },
  };
}
