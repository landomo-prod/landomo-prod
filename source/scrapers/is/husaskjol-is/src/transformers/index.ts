import {
  ApartmentPropertyTierI,
  HousePropertyTierI,
  LandPropertyTierI,
  CommercialPropertyTierI,
  PropertyLocation,
} from '@landomo/core';

export type CategoryProperty =
  | ApartmentPropertyTierI
  | HousePropertyTierI
  | LandPropertyTierI
  | CommercialPropertyTierI;

export interface HusaskjolListing {
  id?: string | number;
  slug?: string;
  title?: string;
  type?: string;
  propertyType?: string;
  category?: string;
  price?: number | string;
  size?: number | string;
  sqm?: number | string;
  sqmPlot?: number | string;
  plotSize?: number | string;
  rooms?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  address?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  zipCode?: string;
  latitude?: number | string;
  longitude?: number | string;
  lat?: number | string;
  lng?: number | string;
  images?: unknown[];
  description?: string;
  isForRent?: boolean;
  listingType?: string;
  url?: string;
  [key: string]: unknown;
}

function parseNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^\d.]/g, ''));
  return isNaN(n) ? undefined : n;
}

function parseInteger(val: unknown): number | undefined {
  const n = parseNumber(val);
  return n !== undefined ? Math.round(n) : undefined;
}

function detectCategory(listing: HusaskjolListing): 'apartment' | 'house' | 'land' | 'commercial' {
  const typeStr = [
    listing.type,
    listing.propertyType,
    listing.category,
    listing.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    typeStr.includes('íbúð') ||
    typeStr.includes('ibuð') ||
    typeStr.includes('fjölbýlishús') ||
    typeStr.includes('fjölbýli') ||
    typeStr.includes('apartment') ||
    typeStr.includes('flat')
  ) {
    return 'apartment';
  }

  if (
    typeStr.includes('atvinnuhúsnæði') ||
    typeStr.includes('atvinnuhusnæði') ||
    typeStr.includes('verslun') ||
    typeStr.includes('skrifstofa') ||
    typeStr.includes('commercial') ||
    typeStr.includes('office') ||
    typeStr.includes('retail')
  ) {
    return 'commercial';
  }

  if (
    typeStr.includes('lóð') ||
    typeStr.includes('land') ||
    typeStr.includes('plot')
  ) {
    return 'land';
  }

  if (
    typeStr.includes('einbýlishús') ||
    typeStr.includes('einbýli') ||
    typeStr.includes('raðhús') ||
    typeStr.includes('parhús') ||
    typeStr.includes('house') ||
    typeStr.includes('villa')
  ) {
    return 'house';
  }

  return 'apartment';
}

function buildSourceUrl(listing: HusaskjolListing): string {
  if (listing.url) return String(listing.url);
  if (listing.slug) return `https://www.husaskjol.is/eign/${listing.slug}`;
  if (listing.id) return `https://www.husaskjol.is/eign/${listing.id}`;
  return 'https://www.husaskjol.is/eignir-til-solu/';
}

function isForRent(listing: HusaskjolListing): boolean {
  if (listing.isForRent === true) return true;
  if (listing.listingType) {
    const t = String(listing.listingType).toLowerCase();
    if (t.includes('rent') || t.includes('leiga') || t.includes('leigu')) return true;
  }
  return false;
}

function buildTitle(listing: HusaskjolListing): string {
  if (listing.title) return String(listing.title);
  const parts: string[] = [];
  if (listing.type ?? listing.propertyType) parts.push(String(listing.type ?? listing.propertyType));
  if (listing.address ?? listing.street) parts.push(String(listing.address ?? listing.street));
  if (listing.city) parts.push(String(listing.city));
  return parts.length > 0 ? parts.join(', ') : 'Husaskjol listing';
}

function buildLocation(listing: HusaskjolListing): PropertyLocation {
  const lat = parseNumber(listing.latitude ?? listing.lat);
  const lng = parseNumber(listing.longitude ?? listing.lng);

  return {
    address: listing.address ?? listing.street,
    city: listing.city ?? 'Iceland',
    country: 'IS',
    postal_code: listing.postalCode ?? listing.zipCode,
    coordinates: lat !== undefined && lng !== undefined
      ? { lat, lon: lng }
      : undefined,
  };
}

export function transformListing(listing: HusaskjolListing): CategoryProperty {
  const category = detectCategory(listing);
  const price = parseNumber(listing.price) ?? 0;
  const sqm = parseNumber(listing.size ?? listing.sqm) ?? 0;
  const sqmPlot = parseNumber(listing.sqmPlot ?? listing.plotSize) ?? 0;
  const rooms = parseInteger(listing.rooms);
  const bedrooms = parseInteger(listing.bedrooms) ?? (rooms !== undefined && rooms > 1 ? rooms - 1 : 0);
  const bathrooms = parseInteger(listing.bathrooms);
  const rent = isForRent(listing);
  const transactionType: 'sale' | 'rent' = rent ? 'rent' : 'sale';

  const shared = {
    title: buildTitle(listing),
    price,
    currency: 'ISK',
    transaction_type: transactionType,
    location: buildLocation(listing),
    source_url: buildSourceUrl(listing),
    source_platform: 'husaskjol-is' as const,
    status: 'active' as const,
    description: listing.description,
  };

  if (category === 'apartment') {
    const result: ApartmentPropertyTierI = {
      property_category: 'apartment',
      ...shared,
      sqm,
      bedrooms,
      bathrooms,
      rooms,
      has_elevator: false,
      has_balcony: false,
      has_parking: false,
      has_basement: false,
    };
    return result;
  }

  if (category === 'house') {
    const result: HousePropertyTierI = {
      property_category: 'house',
      ...shared,
      sqm_living: sqm,
      sqm_plot: sqmPlot,
      bedrooms,
      bathrooms,
      rooms,
      has_garden: false,
      has_garage: false,
      has_parking: false,
      has_basement: false,
    };
    return result;
  }

  if (category === 'land') {
    const result: LandPropertyTierI = {
      property_category: 'land',
      ...shared,
      area_plot_sqm: sqm,
    };
    return result;
  }

  // commercial
  const result: CommercialPropertyTierI = {
    property_category: 'commercial',
    ...shared,
    sqm_total: sqm,
    has_elevator: false,
    has_parking: false,
    has_bathrooms: bathrooms !== undefined && bathrooms > 0,
    bathroom_count: bathrooms,
  };
  return result;
}
