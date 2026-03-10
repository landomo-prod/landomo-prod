/**
 * LuxuryEstate.com → HousePropertyTierI transformer
 *
 * Maps schema.org JSON-LD data from LuxuryEstate detail pages to the
 * Landomo HousePropertyTierI type for villas, houses, and country estates.
 */

import { HousePropertyTierI, PropertyLocation } from '@landomo/core';
import { LuxuryEstateListing, LuxuryEstateJsonLd, SchemaOrgOffer } from '../../types/luxuryEstateTypes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNumber(val: number | string | undefined | null): number | undefined {
  if (val === undefined || val === null) return undefined;
  const n = typeof val === 'string' ? parseFloat(val.replace(/[^\d.]/g, '')) : val;
  return isNaN(n) ? undefined : n;
}

function toInt(val: number | string | undefined | null): number | undefined {
  const n = toNumber(val);
  return n !== undefined ? Math.round(n) : undefined;
}

function resolveOffer(jsonLd: LuxuryEstateJsonLd): SchemaOrgOffer | undefined {
  if (!jsonLd.offers) return undefined;
  return Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
}

function resolvePrice(jsonLd: LuxuryEstateJsonLd): number {
  const offer = resolveOffer(jsonLd);
  if (!offer) return 0;
  return (
    toNumber(offer.price) ||
    toNumber(offer.priceSpecification?.price) ||
    0
  );
}

function resolveCurrency(jsonLd: LuxuryEstateJsonLd): string {
  const offer = resolveOffer(jsonLd);
  return offer?.priceCurrency || offer?.priceSpecification?.priceCurrency || 'EUR';
}

function resolveImages(jsonLd: LuxuryEstateJsonLd): string[] {
  if (!jsonLd.image) return [];
  if (typeof jsonLd.image === 'string') return [jsonLd.image];
  if (Array.isArray(jsonLd.image)) {
    return jsonLd.image
      .map(img => (typeof img === 'string' ? img : img.url || ''))
      .filter(Boolean);
  }
  return [];
}

function resolveSqmFromFloorSize(jsonLd: LuxuryEstateJsonLd): number {
  if (!jsonLd.floorSize) return 0;
  let value = toNumber(jsonLd.floorSize.value) || 0;
  if (jsonLd.floorSize.unitCode === 'FTK') {
    value = Math.round(value * 0.0929);
  }
  return value;
}

function resolvePlotSqm(jsonLd: LuxuryEstateJsonLd): number {
  if (!jsonLd.lotSize) return 0;
  let value = toNumber(jsonLd.lotSize.value) || 0;
  if (jsonLd.lotSize.unitCode === 'FTK') {
    value = Math.round(value * 0.0929);
  }
  // Convert hectares if very small number (lotSize in ha common for Italian estates)
  if (value > 0 && value < 10 && jsonLd.lotSize.unitCode !== 'MTK' && jsonLd.lotSize.unitCode !== 'FTK') {
    value = Math.round(value * 10000); // ha → m²
  }
  return value;
}

function hasAmenity(jsonLd: LuxuryEstateJsonLd, ...keywords: string[]): boolean {
  if (!jsonLd.amenityFeature) return false;
  for (const feature of jsonLd.amenityFeature) {
    const name = (feature.name || '').toLowerCase();
    if (keywords.some(kw => name.includes(kw))) {
      if (feature.value === true || String(feature.value).toLowerCase() === 'true' || String(feature.value).toLowerCase() === 'yes') {
        return true;
      }
      if (feature.value === undefined) return true;
    }
  }
  return false;
}

function descriptionContains(jsonLd: LuxuryEstateJsonLd, ...keywords: string[]): boolean {
  const text = (jsonLd.description || '').toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

function mapCondition(jsonLd: LuxuryEstateJsonLd): HousePropertyTierI['condition'] {
  const text = [jsonLd.description, jsonLd.name, jsonLd.keywords].join(' ').toLowerCase();
  if (text.includes('brand new') || text.includes('nuovo') || text.includes('new build') || text.includes('under construction')) return 'new';
  if (text.includes('recently renovated') || text.includes('ristrutturato') || text.includes('renovated')) return 'after_renovation';
  if (text.includes('to renovate') || text.includes('da ristrutturare') || text.includes('needs renovation')) return 'requires_renovation';
  if (text.includes('excellent condition') || text.includes('ottimo stato')) return 'excellent';
  if (text.includes('good condition') || text.includes('buono stato')) return 'good';
  return undefined;
}

function mapSubtype(jsonLd: LuxuryEstateJsonLd): HousePropertyTierI['property_subtype'] {
  const text = [jsonLd.name, jsonLd.description, jsonLd.keywords].join(' ').toLowerCase();
  const types = Array.isArray(jsonLd['@type']) ? jsonLd['@type'].join(' ').toLowerCase() : String(jsonLd['@type'] || '').toLowerCase();

  if (text.includes('villa') || types.includes('villa')) return 'villa';
  if (text.includes('casale') || text.includes('farmhouse') || text.includes('rustico') || text.includes('masseria')) return 'farmhouse';
  if (text.includes('cottage') || text.includes('chalet')) return 'cottage';
  if (text.includes('a schiera') || text.includes('terraced') || text.includes('townhouse')) return 'townhouse';
  if (text.includes('semi') || text.includes('bifamiliare')) return 'semi_detached';
  if (types.includes('singlefamilyresidence') || text.includes('indipendente')) return 'detached';
  return 'villa'; // Default for LuxuryEstate houses
}

// ─── Main transformer ─────────────────────────────────────────────────────────

export function transformLuxuryEstateHouse(listing: LuxuryEstateListing): HousePropertyTierI {
  const { jsonLd, url, id, transactionType } = listing;

  // Location
  const addr = jsonLd.address;
  const location: PropertyLocation = {
    address: addr?.streetAddress,
    city: addr?.addressLocality || 'Unknown',
    region: addr?.addressRegion,
    country: 'Italy',
    postal_code: addr?.postalCode,
    coordinates: jsonLd.geo?.latitude && jsonLd.geo?.longitude
      ? {
          lat: toNumber(jsonLd.geo.latitude) || 0,
          lon: toNumber(jsonLd.geo.longitude) || 0,
        }
      : undefined,
  };

  // Dimensions
  const sqmLiving = resolveSqmFromFloorSize(jsonLd);
  const sqmPlot = resolvePlotSqm(jsonLd);

  // Rooms
  const numberOfRooms = toInt(jsonLd.numberOfRooms);
  const numberOfBedrooms = toInt(jsonLd.numberOfBedrooms);
  const bedrooms = numberOfBedrooms ?? (numberOfRooms ? Math.max(0, numberOfRooms - 1) : 0);

  // Images
  const images = resolveImages(jsonLd);

  // Amenities
  const hasGarden =
    hasAmenity(jsonLd, 'garden', 'giardino', 'yard') ||
    descriptionContains(jsonLd, 'garden', 'giardino');
  const hasGarage =
    hasAmenity(jsonLd, 'garage') ||
    descriptionContains(jsonLd, 'garage');
  const hasParking =
    hasGarage ||
    hasAmenity(jsonLd, 'parking', 'parcheggio') ||
    descriptionContains(jsonLd, 'parking', 'parcheggio');
  const hasBasement =
    hasAmenity(jsonLd, 'cellar', 'basement', 'cantina') ||
    descriptionContains(jsonLd, 'cellar', 'cantina', 'basement');
  const hasPool =
    hasAmenity(jsonLd, 'pool', 'swimming', 'piscina') ||
    descriptionContains(jsonLd, 'swimming pool', 'piscina');
  const hasTerrace =
    hasAmenity(jsonLd, 'terrace', 'terrazza', 'terrazzo') ||
    descriptionContains(jsonLd, 'terrace', 'terrazza', 'terrazzo');
  const hasFireplace =
    hasAmenity(jsonLd, 'fireplace', 'camino') ||
    descriptionContains(jsonLd, 'fireplace', 'camino');

  const portalId = `luxuryestate-it-${id}`;

  return {
    property_category: 'house' as const,
    title: jsonLd.name || 'Luxury Villa',
    price: resolvePrice(jsonLd),
    currency: resolveCurrency(jsonLd),
    transaction_type: transactionType,
    location,
    property_subtype: mapSubtype(jsonLd),
    bedrooms,
    bathrooms: toInt(jsonLd.numberOfBathroomsTotal),
    sqm_living: sqmLiving,
    sqm_plot: sqmPlot,
    rooms: numberOfRooms,
    stories: toInt(jsonLd.numberOfFloors),
    has_garden: hasGarden,
    has_garage: hasGarage,
    has_parking: hasParking,
    has_basement: hasBasement,
    has_pool: hasPool,
    has_terrace: hasTerrace,
    has_fireplace: hasFireplace,
    year_built: toInt(jsonLd.yearBuilt),
    condition: mapCondition(jsonLd),
    published_date: jsonLd.datePublished,
    media: { images },
    images,
    description: jsonLd.description,
    source_url: url,
    source_platform: 'luxuryestate.com',
    portal_id: portalId,
    status: 'active' as const,
    portal_metadata: {
      luxuryestate: {
        id,
        schema_type: jsonLd['@type'],
        date_modified: jsonLd.dateModified,
        keywords: jsonLd.keywords,
        identifier: typeof jsonLd.identifier === 'object' ? jsonLd.identifier?.value : jsonLd.identifier,
      },
    },
    country_specific: {
      italy: {
        province: addr?.addressRegion,
        city: addr?.addressLocality,
        postal_code: addr?.postalCode,
        is_luxury: true,
      },
    },
  };
}
