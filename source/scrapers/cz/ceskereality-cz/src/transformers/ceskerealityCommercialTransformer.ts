import { CommercialPropertyTierI } from '@landomo/core';
import { mapPropertyDetails } from './propertyDetailsMapper';
import { normalizeHeatingType, normalizeOwnership, normalizeCondition, normalizeConstructionType, normalizeFurnished } from '../../../shared/czech-value-mappings';

interface CeskerealityJsonLd {
  '@context': string;
  '@type': string;
  additionalType?: string;
  name?: string;
  description?: string;
  image?: string;
  offers?: {
    '@type': string;
    price?: number;
    priceCurrency?: string;
    areaServed?: {
      address?: {
        addressLocality?: string;
        addressRegion?: string;
        streetAddress?: string;
        postalCode?: string;
      };
    };
    offeredby?: {
      name?: string;
      telephone?: string;
    };
  };
}

/**
 * Detect commercial subtype from title and description
 */
function detectCommercialSubtype(
  title?: string,
  description?: string
): 'office' | 'retail' | 'industrial' | 'warehouse' | 'mixed_use' | 'hotel' | 'restaurant' | 'medical' | 'showroom' | undefined {
  const text = `${title || ''} ${description || ''}`.toLowerCase();

  if (/kancel[aá]ř/.test(text)) return 'office';
  if (/obchod|prodejna|obchodní prostor/.test(text)) return 'retail';
  if (/sklad|skladov/.test(text)) return 'warehouse';
  if (/výrobn[íi]|průmyslov|hala/.test(text)) return 'industrial';
  if (/hotel|penzion|ubytov/.test(text)) return 'hotel';
  if (/restaurac|hospoda|kavárna|bar\b|gastro/.test(text)) return 'restaurant';
  if (/ordinace|lékař|zdravot|klinik/.test(text)) return 'medical';
  if (/showroom|autosalon|výstav/.test(text)) return 'showroom';

  return undefined;
}

/**
 * Classify commercial property_type from Czech title
 */
function classifyCommercialPropertyType(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('kancelář') || t.includes('kancelar')) return 'office';
  if (t.includes('sklad')) return 'warehouse';
  if (t.includes('obchod')) return 'retail';
  if (t.includes('výrob') || t.includes('hal')) return 'production';
  if (t.includes('restaur')) return 'restaurant';
  if (t.includes('ubytovací') || t.includes('hotel') || t.includes('penzion')) return 'accommodation';
  if (t.includes('činžovní')) return 'apartment_building';
  if (t.includes('ordinac')) return 'medical_office';
  if (t.includes('zemědělský')) return 'agricultural';
  return 'other';
}

/**
 * Classify floor location from floor number and total floors (for commercial)
 */
function classifyFloorLocation(
  floor?: number,
  totalFloors?: number
): 'ground_floor' | 'middle_floor' | 'top_floor' | 'basement' | 'multiple_floors' | undefined {
  if (floor === undefined || floor === null) return undefined;

  if (floor < 0) return 'basement';
  if (floor === 0) return 'ground_floor';

  if (totalFloors !== undefined && totalFloors !== null && floor >= totalFloors) {
    return 'top_floor';
  }

  return 'middle_floor';
}

export function transformCommercial(
  jsonLd: CeskerealityJsonLd,
  sourceUrl: string,
  htmlData?: { images?: string[]; propertyDetails?: Record<string, string>; energyRating?: string; coordinates?: { lat: number; lon: number } }
): CommercialPropertyTierI {
  const offers: any = jsonLd.offers || {};
  const address = offers.areaServed?.address || {};

  // Extract sqm from name
  let sqmTotal: number | undefined;
  const sqmMatch = jsonLd.name?.match(/([\d\s]+)\s*m[²2]/i);
  if (sqmMatch) {
    sqmTotal = parseInt(sqmMatch[1].replace(/\s/g, ''));
  }

  // Map property details from HTML
  const mappedDetails = htmlData?.propertyDetails
    ? mapPropertyDetails(htmlData.propertyDetails)
    : {};

  // Extract features from description and mapped details
  const description = jsonLd.description?.toLowerCase() || '';
  const hasElevator = /výtah|elevator/i.test(description);
  const hasParking = /parkování|parking|garáž|garage/i.test(description) || !!mappedDetails.parking;
  const hasBathrooms = /koupelna|wc|bathroom|toilet/i.test(description) || !!mappedDetails.bathrooms;

  const property: CommercialPropertyTierI = {
    property_category: 'commercial',
    property_type: classifyCommercialPropertyType(jsonLd.name || ''),
    source_url: sourceUrl,
    source_platform: 'ceskereality',
    status: 'active',

    // Required core fields
    title: jsonLd.name || 'Untitled',
    price: offers?.price ?? null,
    currency: offers?.priceCurrency || 'CZK',
    transaction_type: sourceUrl.includes('/pronajem/') ? 'rent' : 'sale',

    // Czech country fields
    country_specific: {
      czech_ownership: mappedDetails.ownership ? normalizeOwnership(mappedDetails.ownership) : undefined,
    },

    // Required location
    location: {
      city: address?.addressLocality || undefined,
      country: 'Czech Republic',
      address: address?.streetAddress,
      postal_code: address?.postalCode,
      region: address?.addressRegion,
      ...(htmlData?.coordinates && { coordinates: htmlData.coordinates })
    },

    // Commercial subtype and classification
    property_subtype: detectCommercialSubtype(jsonLd.name, jsonLd.description),
    floor_location: classifyFloorLocation(mappedDetails.floor, mappedDetails.totalFloors),

    // Required commercial fields
    sqm_total: mappedDetails.sqm ?? sqmTotal ?? null,
    has_elevator: hasElevator || undefined,
    has_parking: hasParking || undefined,
    has_bathrooms: hasBathrooms || undefined,

    // Price per sqm
    price_per_sqm: (offers?.price && (mappedDetails.sqm || sqmTotal))
      ? Math.round(offers.price / (mappedDetails.sqm || sqmTotal!))
      : undefined,

    // Optional fields from mapped details
    bathroom_count: mappedDetails.bathrooms,
    parking_spaces: mappedDetails.parkingSpaces,
    construction_type: normalizeConstructionType(mappedDetails.constructionType) as CommercialPropertyTierI['construction_type'],
    condition: normalizeCondition(mappedDetails.condition) as CommercialPropertyTierI['condition'],
    year_built: mappedDetails.yearBuilt,
    renovation_year: mappedDetails.renovationYear,
    heating_type: normalizeHeatingType(mappedDetails.heating),
    energy_class: mappedDetails.energyClass,
    furnished: normalizeFurnished(mappedDetails.furnished),
    published_date: mappedDetails.publishedDate,
    available_from: mappedDetails.availableFrom,
    deposit: mappedDetails.deposit,
    is_commission: mappedDetails.priceExcludes?.toLowerCase().includes('provize') ? true : undefined,
    commission_note: mappedDetails.priceExcludes || undefined,

    // Description
    description: jsonLd.description,

    // Images
    images: htmlData?.images && htmlData.images.length > 0 ? htmlData.images : (jsonLd.image ? [jsonLd.image] : undefined),

    // Media (structured format for ingest)
    media: {
      images: htmlData?.images && htmlData.images.length > 0
        ? htmlData.images
        : (jsonLd.image ? [jsonLd.image] : [])
    },

    // Contact
    portal_metadata: {
      agent_name: offers?.offeredby?.name,
      agent_phone: offers?.offeredby?.telephone,
      property_id: mappedDetails.propertyId,
      ownership: mappedDetails.ownership,
      hoa_fees: mappedDetails.hoaFees,
      original_details: htmlData?.propertyDetails
    }
  };

  const agentName = offers?.offeredby?.name?.trim();
  (property as any).agent_name  = agentName || undefined;
  (property as any).agent_phone = offers?.offeredby?.telephone?.trim() || undefined;
  (property as any).agent = agentName ? {
    name: agentName,
    phone: offers?.offeredby?.telephone?.trim(),
  } : undefined;

  return property;
}
