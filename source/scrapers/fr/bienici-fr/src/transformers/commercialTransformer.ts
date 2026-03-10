import { CommercialPropertyTierI } from '@landomo/core';
import { BieniciListingRaw } from '../types/bieniciTypes';

export function transformCommercial(listing: BieniciListingRaw): CommercialPropertyTierI {
  const features: string[] = [];
  if (listing.hasElevator) features.push('ascenseur');
  if (listing.hasParking) features.push('parking');

  const images = listing.photos?.map(p => p.url || p.url_photo || '').filter(Boolean) || [];

  const subtypeMap: Record<string, string> = {
    'premises': 'retail',
    'local': 'retail',
    'parking': 'parking',
    'garage': 'garage',
    'bureau': 'office',
    'office': 'office',
  };

  return {
    property_category: 'commercial',
    title: listing.title || `Commercial ${listing.city}`,
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
    property_subtype: subtypeMap[listing.propertyType?.toLowerCase()] as any || undefined,
    sqm_total: listing.surfaceArea || 0,
    has_elevator: listing.hasElevator ?? false,
    has_parking: listing.hasParking ?? false,
    has_bathrooms: listing.bathroomsQuantity != null && listing.bathroomsQuantity > 0,
    bathroom_count: listing.bathroomsQuantity ?? undefined,
    heating_type: listing.heatingType || undefined,
    energy_class: listing.energyClassification || undefined,
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
    },
  };
}
