/**
 * LuxuryEstate.com → ApartmentPropertyTierI transformer
 *
 * Maps schema.org JSON-LD data from LuxuryEstate detail pages to the
 * Landomo ApartmentPropertyTierI type.
 */

import { ApartmentPropertyTierI, PropertyLocation } from '@landomo/core';
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

function resolveFloorSizeSqm(jsonLd: LuxuryEstateJsonLd): number {
  if (!jsonLd.floorSize) return 0;
  let value = toNumber(jsonLd.floorSize.value) || 0;
  // Convert ft² to m² if needed
  if (jsonLd.floorSize.unitCode === 'FTK') {
    value = Math.round(value * 0.0929);
  }
  return value;
}

/**
 * Check amenity features for a keyword match.
 */
function hasAmenity(jsonLd: LuxuryEstateJsonLd, ...keywords: string[]): boolean {
  if (!jsonLd.amenityFeature) return false;
  for (const feature of jsonLd.amenityFeature) {
    const name = (feature.name || '').toLowerCase();
    if (keywords.some(kw => name.includes(kw))) {
      // value can be boolean true, or the string "True" / "Yes"
      if (feature.value === true || String(feature.value).toLowerCase() === 'true' || String(feature.value).toLowerCase() === 'yes') {
        return true;
      }
      // If value is not explicitly false, assume presence of feature = true
      if (feature.value === undefined) return true;
    }
  }
  return false;
}

/**
 * Search description text for keywords.
 */
function descriptionContains(jsonLd: LuxuryEstateJsonLd, ...keywords: string[]): boolean {
  const text = (jsonLd.description || '').toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

function mapCondition(jsonLd: LuxuryEstateJsonLd): ApartmentPropertyTierI['condition'] {
  const text = [jsonLd.description, jsonLd.name, jsonLd.keywords].join(' ').toLowerCase();
  if (text.includes('brand new') || text.includes('nuovo') || text.includes('new build') || text.includes('under construction')) return 'new';
  if (text.includes('recently renovated') || text.includes('ristrutturato') || text.includes('renovated')) return 'after_renovation';
  if (text.includes('to renovate') || text.includes('da ristrutturare') || text.includes('needs renovation')) return 'requires_renovation';
  if (text.includes('excellent condition') || text.includes('ottimo stato')) return 'excellent';
  if (text.includes('good condition') || text.includes('buono stato')) return 'good';
  return undefined;
}

function mapSubtype(jsonLd: LuxuryEstateJsonLd): ApartmentPropertyTierI['property_subtype'] {
  const text = [jsonLd.name, jsonLd.description, jsonLd.keywords].join(' ').toLowerCase();
  const types = Array.isArray(jsonLd['@type']) ? jsonLd['@type'].join(' ').toLowerCase() : String(jsonLd['@type'] || '').toLowerCase();
  if (text.includes('penthouse') || text.includes('attico')) return 'penthouse';
  if (text.includes('loft')) return 'loft';
  if (text.includes('studio') || text.includes('monolocale')) return 'studio';
  if (text.includes('maisonette') || text.includes('duplex') || text.includes('su due livelli')) return 'maisonette';
  if (types.includes('apartment')) return 'standard';
  return 'standard';
}

// ─── Main transformer ─────────────────────────────────────────────────────────

export function transformLuxuryEstateApartment(listing: LuxuryEstateListing): ApartmentPropertyTierI {
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
  const sqm = resolveFloorSizeSqm(jsonLd);

  // Rooms
  const numberOfRooms = toInt(jsonLd.numberOfRooms);
  const numberOfBedrooms = toInt(jsonLd.numberOfBedrooms);
  const bedrooms = numberOfBedrooms ?? (numberOfRooms ? Math.max(0, numberOfRooms - 1) : 0);

  // Images
  const images = resolveImages(jsonLd);

  // Amenities - check both amenityFeature array and description text
  const hasElevator =
    hasAmenity(jsonLd, 'elevator', 'lift', 'ascensore') ||
    descriptionContains(jsonLd, 'elevator', 'lift', 'ascensore');
  const hasBalcony =
    hasAmenity(jsonLd, 'balcony', 'balcone', 'balcon') ||
    descriptionContains(jsonLd, 'balcony', 'balcone');
  const hasParking =
    hasAmenity(jsonLd, 'parking', 'garage', 'parcheggio') ||
    descriptionContains(jsonLd, 'parking', 'parcheggio', 'garage');
  const hasBasement =
    hasAmenity(jsonLd, 'cellar', 'basement', 'cantina') ||
    descriptionContains(jsonLd, 'cellar', 'cantina', 'basement');
  const hasTerrace =
    hasAmenity(jsonLd, 'terrace', 'terrazza', 'terrazzo') ||
    descriptionContains(jsonLd, 'terrace', 'terrazza', 'terrazzo');
  // Resolve portal ID from URL
  const portalId = `luxuryestate-it-${id}`;

  return {
    property_category: 'apartment' as const,
    title: jsonLd.name || 'Luxury Apartment',
    price: resolvePrice(jsonLd),
    currency: resolveCurrency(jsonLd),
    transaction_type: transactionType,
    location,
    property_subtype: mapSubtype(jsonLd),
    bedrooms,
    bathrooms: toInt(jsonLd.numberOfBathroomsTotal),
    sqm,
    floor: toInt(jsonLd.floorLevel),
    total_floors: toInt(jsonLd.numberOfFloors),
    rooms: numberOfRooms,
    has_elevator: hasElevator,
    has_balcony: hasBalcony,
    has_parking: hasParking,
    has_basement: hasBasement,
    has_terrace: hasTerrace,
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
