import { HousePropertyTierI } from '@landomo/core';
import { BieniciListingRaw } from '../types/bieniciTypes';

export function transformHouse(listing: BieniciListingRaw): HousePropertyTierI {
  const features: string[] = [];
  if (listing.hasGarden) features.push('jardin');
  if (listing.hasPool) features.push('piscine');
  if (listing.hasParking) features.push('parking');
  if (listing.hasTerrace) features.push('terrasse');
  if (listing.hasCellar) features.push('cave');
  if (listing.hasFireplace) features.push('cheminée');
  if (listing.hasBalcony) features.push('balcon');

  const images = listing.photos?.map(p => p.url || p.url_photo || '').filter(Boolean) || [];

  const bedrooms = listing.bedroomsQuantity ?? (listing.roomsQuantity ? Math.max(0, listing.roomsQuantity - 1) : 0);

  return {
    property_category: 'house',
    title: listing.title || `House ${listing.city}`,
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
    bedrooms,
    bathrooms: listing.bathroomsQuantity ?? undefined,
    sqm_living: listing.surfaceArea || 0,
    sqm_plot: listing.surfaceAreaLand || 0,
    has_garden: listing.hasGarden ?? false,
    has_garage: listing.hasParking ?? false,
    has_parking: listing.hasParking ?? false,
    has_basement: listing.hasCellar ?? false,
    has_pool: listing.hasPool ?? undefined,
    has_terrace: listing.hasTerrace ?? undefined,
    has_fireplace: listing.hasFireplace ?? undefined,
    condition: listing.newProperty ? 'new' as any : undefined,
    heating_type: listing.heatingType || undefined,
    energy_class: listing.energyClassification || undefined,
    furnished: listing.isFurnished ? 'furnished' as any : undefined,
    year_built: listing.yearOfConstruction ?? undefined,
    published_date: listing.publicationDate || undefined,
    description: listing.description != null ? String(listing.description) : undefined,
    features: features.length > 0 ? features : undefined,
    media: images.length > 0 ? { images: images.map((url, i) => ({ url, order: i })) } : undefined,
    agent: listing.agency?.name ? { name: listing.agency.name, phone: listing.agency.phone || undefined } : undefined,
    images: images.length > 0 ? images : undefined,
    source_url: `https://www.bienici.com/annonce/${listing.id}`,
    source_platform: 'bienici',
    portal_id: listing.portalId || `bienici-${listing.id}`,
    status: 'active',
    country_specific: {
      dpe_rating: listing.energyClassification || null,
      dpe_value: listing.energyValue ?? null,
      ges_rating: listing.greenhouseGasClassification || null,
      ges_value: listing.greenhouseGasValue ?? null,
      account_type: listing.accountType || null,
      is_new_property: listing.newProperty ?? false,
      surface_area_land: listing.surfaceAreaLand ?? null,
    },
  };
}
