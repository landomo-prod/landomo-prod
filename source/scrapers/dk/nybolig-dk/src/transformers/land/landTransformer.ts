import { LandPropertyTierI } from '@landomo/core';
import { NyboligCase } from '../../types/nyboligTypes';

export function transformLand(listing: NyboligCase): LandPropertyTierI {
  const postalCode = listing.addressSecondLine.split(' ')[0] ?? '';
  const city = listing.addressSecondLine.split(' ').slice(1).join(' ') || listing.addressCity;

  // Plot size: API provides plotSizeHa (hectares), convert to m²
  // Also check propertySize as fallback for plot area
  const sqmPlot = listing.plotSizeHa
    ? Math.round(listing.plotSizeHa * 10000)
    : listing.propertySize || 0;

  const images = listing.primaryImages.filter(Boolean);
  const price = listing.cashPrice || 0;

  return {
    property_category: 'land',
    title: `${listing.type}: ${listing.addressDisplayName}`,
    price: price,
    currency: 'DKK',
    transaction_type: 'sale',
    location: {
      country: 'Denmark',
      city: city || listing.addressCity,
      postal_code: postalCode || undefined,
      ...(listing.addressLatitude && listing.addressLongitude
        ? { coordinates: { lat: listing.addressLatitude, lon: listing.addressLongitude } }
        : {}),
    },
    area_plot_sqm: sqmPlot,
    images: images.length > 0 ? images : undefined,
    media: images.length > 0
      ? { images: images.map((url, i) => ({ url, order: i })) }
      : undefined,
    source_url: `https://www.nybolig.dk${listing.url}`,
    source_platform: 'nybolig-dk',
    portal_id: listing.caseNumber || listing.id,
    status: 'active',
    country_specific: {
      case_number: listing.caseNumber,
      nybolig_id: listing.id,
      site_name: listing.siteName,
      type_name: listing.type,
      plot_size_ha: listing.plotSizeHa || null,
      energy_classification: listing.energyClassification || null,
      is_new: listing.isNew,
    },
  };
}
