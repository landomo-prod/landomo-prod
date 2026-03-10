import { LandPropertyTierI } from '@landomo/core';
import { HomeListingDetail } from '../../types/homeTypes';

export function transformLand(listing: HomeListingDetail): LandPropertyTierI {
  const stats = listing.stats;
  const address = listing.address;
  const offer = listing.offer;

  const price = offer.cashPrice?.amount ?? 0;

  const images = listing.presentationMedia
    .filter(m => m.type === 'Billede' || m.type === 'Foto')
    .sort((a, b) => Number(a.priority) - Number(b.priority))
    .map(m => m.url);

  // Plot area: prefer plotArea, fall back to floorArea for land
  const areaPlotSqm = stats.plotArea ?? stats.floorArea ?? 0;

  return {
    property_category: 'land',
    title: listing.headline ?? `Grund ${address.city}`,
    description: listing.salesPresentationDescription ?? undefined,
    price,
    currency: 'DKK',
    transaction_type: 'sale',
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
    area_plot_sqm: areaPlotSqm,
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
    status: listing.isSold ? 'removed' : 'active',
    country_specific: {
      home_dk_id: listing.id,
      property_type: listing.propertyCategory,
      shop_number: listing.shopNumber ?? null,
      is_under_sale: listing.isUnderSale,
      is_water_installed: stats.isWaterInstalled ?? null,
      is_sewered: stats.isSewered ?? null,
      is_electricity_installed: stats.isElectricityInstalled ?? null,
      distance_to_school: stats.distanceToSchool ?? null,
      distance_to_shopping: stats.distanceToShopping ?? null,
    },
  };
}
