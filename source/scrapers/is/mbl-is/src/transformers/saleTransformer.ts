import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
} from '@landomo/core';
import { MblSaleListing, getCategoryFromTegEign, PropertyCategory } from '../types/mblTypes';

const PORTAL = 'mbl-is';

function getSaleSourceUrl(eignId: number): string {
  return `https://fasteignir.mbl.is/fasteignir/${eignId}/`;
}

function getFirstImage(listing: MblSaleListing): string[] {
  if (listing.images && listing.images.length > 0 && listing.images[0].big) {
    return [listing.images[0].big];
  }
  return [];
}

function toBoolean(val: boolean | null | undefined): boolean {
  return val === true;
}

function toNumber(val: number | null | undefined, fallback = 0): number {
  return val != null ? val : fallback;
}

function buildTitle(listing: MblSaleListing): string {
  const parts: string[] = [];
  if (listing.teg_eign) parts.push(listing.teg_eign);
  if (listing.heimilisfang) parts.push(listing.heimilisfang);
  else if (listing.gata) parts.push(listing.gata);
  if (listing.postal_code?.city) parts.push(listing.postal_code.city);
  return parts.length > 0 ? parts.join(', ') : `Fasteign ${listing.eign_id}`;
}

export function transformSaleListing(
  listing: MblSaleListing
): ApartmentPropertyTierI | HousePropertyTierI | LandPropertyTierI | CommercialPropertyTierI {
  const category: PropertyCategory = getCategoryFromTegEign(listing.teg_eign);
  const city = listing.postal_code?.city ?? 'Iceland';
  const zipCode = listing.postfang != null ? String(listing.postfang) : undefined;
  const images = getFirstImage(listing);
  const sourceUrl = getSaleSourceUrl(listing.eign_id);
  const title = buildTitle(listing);

  const location = {
    address: listing.heimilisfang ?? undefined,
    city,
    country: 'IS',
    postal_code: zipCode,
    coordinates:
      listing.latitude != null && listing.longitude != null
        ? { lat: listing.latitude, lon: listing.longitude }
        : undefined,
  };

  const common = {
    title,
    price: toNumber(listing.verd),
    currency: 'ISK',
    transaction_type: 'sale' as const,
    location,
    source_url: sourceUrl,
    source_platform: PORTAL,
    status: 'active' as const,
    description: listing.lysing ?? undefined,
    year_built: listing.bygg_ar ?? undefined,
    published_date: listing.created ?? undefined,
    images: images.length > 0 ? images : undefined,
    country_specific: {
      hverfi: listing.hverfi,
      teg_eign: listing.teg_eign,
      listing_type: 'sale',
    },
  };

  if (category === 'apartment') {
    const apt: ApartmentPropertyTierI = {
      ...common,
      property_category: 'apartment',
      sqm: toNumber(listing.fermetrar),
      bedrooms: toNumber(listing.fjoldi_svefnhb),
      rooms: listing.fjoldi_herb ?? undefined,
      bathrooms: listing.fjoldi_badherb ?? undefined,
      has_elevator: toBoolean(listing.lyfta),
      has_balcony: toBoolean(listing.svalir),
      has_parking: toBoolean(listing.parking),
      has_basement: false,
    };
    return apt;
  }

  if (category === 'house') {
    const house: HousePropertyTierI = {
      ...common,
      property_category: 'house',
      sqm_living: toNumber(listing.fermetrar),
      sqm_plot: 0,
      bedrooms: toNumber(listing.fjoldi_svefnhb),
      rooms: listing.fjoldi_herb ?? undefined,
      bathrooms: listing.fjoldi_badherb ?? undefined,
      has_garden: toBoolean(listing.gardur),
      has_garage: toBoolean(listing.bilskur),
      has_parking: toBoolean(listing.parking),
      has_basement: false,
    };
    return house;
  }

  if (category === 'land') {
    const land: LandPropertyTierI = {
      ...common,
      property_category: 'land',
      area_plot_sqm: toNumber(listing.fermetrar),
    };
    return land;
  }

  // commercial
  const commercial: CommercialPropertyTierI = {
    ...common,
    property_category: 'commercial',
    sqm_total: toNumber(listing.fermetrar),
    has_elevator: toBoolean(listing.lyfta),
    has_parking: toBoolean(listing.parking),
    has_bathrooms: listing.fjoldi_badherb != null && listing.fjoldi_badherb > 0,
  };
  return commercial;
}
