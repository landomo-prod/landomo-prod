import { CommercialPropertyTierI } from '@landomo/core';
import { HomeListingDetail } from '../../types/homeTypes';

export function transformCommercial(listing: HomeListingDetail): CommercialPropertyTierI {
  const stats = listing.stats;
  const address = listing.address;
  const offer = listing.offer;

  const isRental = listing.isRentalCase || listing.type === 'rentalCase';
  const price = isRental
    ? (offer.rentalPricePerMonth?.amount ?? 0)
    : (offer.cashPrice?.amount ?? 0);
  const monthlyRent = isRental ? (offer.rentalPricePerMonth?.amount ?? undefined) : undefined;

  const yearBuilt = stats.yearBuilt ? parseInt(stats.yearBuilt.slice(0, 4), 10) : undefined;

  const images = listing.presentationMedia
    .filter(m => m.type === 'Billede' || m.type === 'Foto')
    .sort((a, b) => Number(a.priority) - Number(b.priority))
    .map(m => m.url);

  // Total commercial area: prefer totalCommercialArea, then floorArea
  const sqmTotal = stats.totalCommercialArea ?? stats.floorArea ?? 0;

  return {
    property_category: 'commercial',
    title: listing.headline ?? `Erhverv ${address.city}`,
    description: listing.salesPresentationDescription ?? undefined,
    price,
    currency: 'DKK',
    transaction_type: isRental ? 'rent' : 'sale',
    location: {
      country: 'Denmark',
      city: address.city,
      postal_code: address.postalCode || undefined,
      address: address.full || undefined,
      region: address.municipality ?? undefined,
      coordinates: address.latitude && address.longitude
        ? { lat: address.latitude, lon: address.longitude }
        : undefined,
    },
    sqm_total: sqmTotal,
    has_elevator: stats.hasElevator ?? false,
    has_parking: false,
    has_bathrooms: (stats.bathrooms != null && stats.bathrooms > 0) ? true : false,
    energy_class: stats.energyLabel ?? undefined,
    year_built: yearBuilt,
    monthly_rent: monthlyRent,
    published_date: listing.listingDate ?? undefined,
    images: images.length > 0 ? images : undefined,
    media: images.length > 0
      ? { images: images.map((url, i) => ({ url, order: i })) }
      : undefined,
    agent: listing.brokerEmail
      ? { name: `home ${address.city}`, email: listing.brokerEmail }
      : undefined,
    source_url: `https://home.dk/${listing.url}`,
    source_platform: 'home-dk',
    portal_id: `home-dk-${listing.id}`,
    status: listing.isSold || listing.isRented ? 'removed' : 'active',
    country_specific: {
      home_dk_id: listing.id,
      property_type: listing.propertyCategory,
      energy_label: stats.energyLabel ?? null,
      shop_number: listing.shopNumber ?? null,
      is_under_sale: listing.isUnderSale,
      yearly_rent: offer.yearlyRent ?? null,
      yearly_rental_revenue: offer.yearlyRentalRevenue ?? null,
      rate_of_return: offer.rateOfReturn ?? null,
      total_built_up_area: stats.totalBuiltUpArea ?? null,
      bathrooms: stats.bathrooms ?? null,
    },
  };
}
