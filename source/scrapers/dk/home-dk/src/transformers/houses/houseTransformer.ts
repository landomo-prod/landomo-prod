import { HousePropertyTierI } from '@landomo/core';
import { HomeListingDetail } from '../../types/homeTypes';

export function transformHouse(listing: HomeListingDetail): HousePropertyTierI {
  const stats = listing.stats;
  const address = listing.address;
  const offer = listing.offer;

  const isRental = listing.isRentalCase || listing.type === 'rentalCase';
  const price = isRental
    ? (offer.rentalPricePerMonth?.amount ?? 0)
    : (offer.cashPrice?.amount ?? 0);
  const monthlyRent = isRental ? (offer.rentalPricePerMonth?.amount ?? undefined) : undefined;

  // Rooms: home.dk `rooms` includes living room; bedrooms = rooms - 1
  const rooms = stats.rooms ?? undefined;
  const bedrooms = rooms != null ? Math.max(0, rooms - 1) : 0;

  const yearBuilt = stats.yearBuilt ? parseInt(stats.yearBuilt.slice(0, 4), 10) : undefined;
  const yearRenovated = stats.yearRenovated ? parseInt(stats.yearRenovated.slice(0, 4), 10) : undefined;

  const images = listing.presentationMedia
    .filter(m => m.type === 'Billede' || m.type === 'Foto')
    .sort((a, b) => Number(a.priority) - Number(b.priority))
    .map(m => m.url);

  const hasGarage = stats.hasGarage ?? ((stats.garageArea != null && stats.garageArea > 0) ? true : false);

  return {
    property_category: 'house',
    title: listing.headline ?? `${listing.propertyCategory} ${address.city}`,
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
    bedrooms,
    bathrooms: stats.bathrooms ?? undefined,
    sqm_living: stats.floorArea ?? 0,
    sqm_plot: stats.plotArea ?? 0,
    rooms,
    stories: stats.floors ?? undefined,
    has_garden: true, // Houses in Denmark typically have gardens; refined below
    has_garage: hasGarage,
    has_parking: hasGarage || (stats.carportArea != null && stats.carportArea > 0),
    has_basement: (stats.basementArea != null && stats.basementArea > 0) ? true : false,
    has_pool: undefined,
    has_terrace: stats.hasBalcony ?? undefined,
    energy_class: stats.energyLabel ?? undefined,
    year_built: yearBuilt,
    renovation_year: yearRenovated ?? undefined,
    deposit: isRental ? (offer.rentalSecurityDeposit?.amount ?? undefined) : undefined,
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
      owner_costs_monthly: offer.ownerCostsTotalMonthlyAmount?.amount ?? null,
      total_built_up_area: stats.totalBuiltUpArea ?? null,
      carport_area: stats.carportArea ?? null,
      garage_area: stats.garageArea ?? null,
      has_annex: stats.hasAnnex ?? null,
      distance_to_school: stats.distanceToSchool ?? null,
      distance_to_transport: stats.distanceToPublicTransport ?? null,
      distance_to_beach: stats.distanceToBeach ?? null,
      distance_to_water: stats.distanceToWater ?? null,
    },
  };
}
