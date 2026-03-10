import { LandPropertyTierI } from '@landomo/core';
import { BieniciListingRaw } from '../types/bieniciTypes';

export function transformLand(listing: BieniciListingRaw): LandPropertyTierI {
  const images = listing.photos?.map(p => p.url || p.url_photo || '').filter(Boolean) || [];

  const plotArea = listing.surfaceAreaLand || listing.surfaceArea || 0;

  return {
    property_category: 'land',
    title: listing.title || `Land ${listing.city}`,
    price: listing.price || 0,
    currency: 'EUR',
    transaction_type: listing.adType === 'rent' ? 'rent' : 'sale',
    location: {
      country: 'France',
      city: listing.city || '',
      postal_code: listing.postalCode || undefined,
      region: listing.district != null ? String(listing.district) : undefined,
      ...(listing.latitude && listing.longitude ? { coordinates: { lat: listing.latitude, lon: listing.longitude } } : {}),
    },
    area_plot_sqm: plotArea,
    published_date: listing.publicationDate || undefined,
    description: listing.description != null ? String(listing.description) : undefined,
    media: images.length > 0 ? { images: images.map((url, i) => ({ url, order: i })) } : undefined,
    agent: listing.agency?.name ? { name: listing.agency.name, phone: listing.agency.phone || undefined } : undefined,
    images: images.length > 0 ? images : undefined,
    source_url: `https://www.bienici.com/annonce/${listing.id}`,
    source_platform: 'bienici',
    portal_id: listing.portalId || `bienici-${listing.id}`,
    status: 'active',
    country_specific: {
      account_type: listing.accountType || null,
      is_new_property: listing.newProperty ?? false,
    },
  };
}
