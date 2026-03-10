import { ApartmentPropertyTierI } from '@landomo/core';
import { BieniciListingRaw } from '../types/bieniciTypes';
import { parseFrenchFeatures } from '../../../shared/french-value-mappings';

export function transformApartment(listing: BieniciListingRaw): ApartmentPropertyTierI {
  const features: string[] = [];
  if (listing.hasElevator) features.push('ascenseur');
  if (listing.hasBalcony) features.push('balcon');
  if (listing.hasParking) features.push('parking');
  if (listing.hasTerrace) features.push('terrasse');
  if (listing.hasCellar) features.push('cave');
  if (listing.hasFireplace) features.push('cheminée');
  if (listing.hasIntercom) features.push('interphone');
  if (listing.hasDoorCode) features.push('digicode');
  if (listing.hasCaretaker) features.push('gardien');

  const amenities = parseFrenchFeatures(features);

  const images = listing.photos?.map(p => p.url || p.url_photo || '').filter(Boolean) || [];

  // bedroomsQuantity is directly available; fallback to rooms - 1
  const bedrooms = listing.bedroomsQuantity ?? (listing.roomsQuantity ? Math.max(0, listing.roomsQuantity - 1) : 0);

  return {
    property_category: 'apartment',
    title: listing.title || `Apartment ${listing.city}`,
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
    sqm: listing.surfaceArea || 0,
    floor: listing.floor ?? undefined,
    total_floors: listing.floorQuantity ?? undefined,
    rooms: listing.roomsQuantity ?? undefined,
    has_elevator: listing.hasElevator ?? false,
    has_balcony: listing.hasBalcony ?? false,
    has_parking: listing.hasParking ?? false,
    has_basement: listing.hasCellar ?? false,
    has_terrace: listing.hasTerrace ?? undefined,
    has_garage: amenities.garage ?? undefined,
    parking_spaces: listing.parkingQuantity ?? undefined,
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
    },
  };
}
