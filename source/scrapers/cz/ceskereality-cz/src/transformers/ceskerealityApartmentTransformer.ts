import { ApartmentPropertyTierI } from '@landomo/core';
import { mapPropertyDetails } from './propertyDetailsMapper';
import { normalizeHeatingType, normalizeDisposition, normalizeOwnership, normalizeCondition, normalizeConstructionType, normalizeFurnished } from '../../../shared/czech-value-mappings';

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

function parseEnergyFromHtml(energyRating?: string): string | undefined {
  if (!energyRating) return undefined;
  const match = energyRating.match(/([A-G])/i);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Classify floor location from floor number and total floors
 */
function classifyFloorLocation(
  floor?: number,
  totalFloors?: number
): 'ground_floor' | 'middle_floor' | 'top_floor' | undefined {
  if (floor === undefined || floor === null) return undefined;

  if (floor <= 0) return 'ground_floor';

  if (totalFloors !== undefined && totalFloors !== null && floor >= totalFloors) {
    return 'top_floor';
  }

  return 'middle_floor';
}

/**
 * Detect apartment subtype from title and description
 */
function detectApartmentSubtype(
  title?: string,
  description?: string
): 'standard' | 'penthouse' | 'loft' | 'atelier' | 'maisonette' | 'studio' | undefined {
  const text = `${title || ''} ${description || ''}`.toLowerCase();

  if (/penthouse|penthaus/.test(text)) return 'penthouse';
  if (/loft/.test(text)) return 'loft';
  if (/ateli[eé]r/.test(text)) return 'atelier';
  if (/mezonet|maisonette|maisonet/.test(text)) return 'maisonette';
  if (/garsoni[eé]r|garson[ií]|studio|1\+kk/.test(text)) return 'studio';

  return undefined;
}

export function transformApartment(
  jsonLd: CeskerealityJsonLd,
  sourceUrl: string,
  htmlData?: { images?: string[]; propertyDetails?: Record<string, string>; energyRating?: string; coordinates?: { lat: number; lon: number } }
): ApartmentPropertyTierI {
  const offers: any = jsonLd.offers || {};
  const address = offers.areaServed?.address || {};

  // Extract disposition and bedroom count from name (e.g., "Prodej bytu 2+kk 46 m²")
  let bedrooms: number | undefined;
  const dispositionMatch = jsonLd.name?.match(/(\d+\+(?:kk|\d))/i);
  const nameMatch = dispositionMatch; // backward compat alias
  if (nameMatch) {
    bedrooms = parseInt(nameMatch[1]) - 1; // 2+kk = 1 bedroom, 3+kk = 2 bedrooms
  }

  // Extract sqm from name
  let sqm: number | undefined;
  const sqmMatch = jsonLd.name?.match(/([\d\s]+)\s*m[²2]/i);
  if (sqmMatch) {
    sqm = parseInt(sqmMatch[1].replace(/\s/g, ''));
  }

  // Map property details from HTML
  const mappedDetails = htmlData?.propertyDetails
    ? mapPropertyDetails(htmlData.propertyDetails)
    : {};

  // Extract features from description and property details
  const description = jsonLd.description?.toLowerCase() || '';
  const hasElevator = /výtah|elevator/i.test(description);
  const hasBalcony = /balkon|balcony|terasa|terrace/i.test(description) || !!mappedDetails.balconyArea || !!mappedDetails.terraceArea || !!mappedDetails.loggiaArea;
  const hasParking = /parkování|parking|garáž|garage/i.test(description) || !!mappedDetails.parking;
  const hasBasement = /sklep|basement|cellar/i.test(description) || !!mappedDetails.cellarArea;

  const property: ApartmentPropertyTierI = {
    property_category: 'apartment',
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
      czech_disposition: dispositionMatch ? normalizeDisposition(dispositionMatch[1]) : undefined,
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

    // Required apartment fields
    bedrooms: bedrooms ?? null,
    sqm: mappedDetails.sqm ?? sqm ?? null,
    has_elevator: hasElevator || undefined,
    has_balcony: mappedDetails.hasBalcony || hasBalcony || undefined,
    has_parking: hasParking || undefined,
    has_basement: hasBasement || undefined,

    // Subtype and floor classification
    property_subtype: detectApartmentSubtype(jsonLd.name, jsonLd.description),
    floor_location: classifyFloorLocation(mappedDetails.floor, mappedDetails.totalFloors),

    // Optional apartment fields from mapped details
    floor: mappedDetails.floor,
    total_floors: mappedDetails.totalFloors,
    rooms: mappedDetails.rooms,
    bathrooms: mappedDetails.bathrooms ?? 1,
    balcony_area: mappedDetails.balconyArea,
    cellar_area: mappedDetails.cellarArea,
    terrace_area: mappedDetails.terraceArea,
    loggia_area: mappedDetails.loggiaArea,
    has_loggia: mappedDetails.hasLoggia || !!mappedDetails.loggiaArea,
    has_terrace: mappedDetails.hasTerrace || !!mappedDetails.terraceArea,
    has_garage: !!mappedDetails.garageCount,
    garage_count: mappedDetails.garageCount,
    parking_spaces: mappedDetails.parkingSpaces,
    construction_type: normalizeConstructionType(mappedDetails.constructionType) as ApartmentPropertyTierI['construction_type'],
    condition: normalizeCondition(mappedDetails.condition) as ApartmentPropertyTierI['condition'],
    year_built: mappedDetails.yearBuilt,
    renovation_year: mappedDetails.renovationYear,
    heating_type: normalizeHeatingType(mappedDetails.heating),
    energy_class: mappedDetails.energyClass || parseEnergyFromHtml(htmlData?.energyRating),
    furnished: normalizeFurnished(mappedDetails.furnished),
    published_date: mappedDetails.publishedDate,
    hoa_fees: mappedDetails.hoaFees,
    available_from: mappedDetails.availableFrom,
    deposit: mappedDetails.deposit,
    is_commission: mappedDetails.priceExcludes?.toLowerCase().includes('provize') ? true : undefined,
    commission_note: mappedDetails.priceExcludes || undefined,

    // Description
    description: jsonLd.description,

    // Images - prefer HTML gallery images (more complete) over JSON-LD single image
    images: htmlData?.images && htmlData.images.length > 0
      ? htmlData.images
      : (jsonLd.image ? [jsonLd.image] : undefined),

    // Media (structured format for ingest)
    media: {
      images: htmlData?.images && htmlData.images.length > 0
        ? htmlData.images
        : (jsonLd.image ? [jsonLd.image] : [])
    },

    // Contact and metadata
    portal_metadata: {
      agent_name: offers?.offeredby?.name,
      agent_phone: offers?.offeredby?.telephone,
      property_id: mappedDetails.propertyId,
      ownership: mappedDetails.ownership,
      water: mappedDetails.water,
      sewage: mappedDetails.sewage,
      electricity: mappedDetails.electricity,
      gas: mappedDetails.gas,
      parking_info: mappedDetails.parking,
      original_details: htmlData?.propertyDetails // Keep original for reference
    }
  };

  // Attach contact fields
  const agentName = offers?.offeredby?.name?.trim();
  (property as any).agent_name  = agentName || undefined;
  (property as any).agent_phone = offers?.offeredby?.telephone?.trim() || undefined;
  (property as any).agent = agentName ? {
    name: agentName,
    phone: offers?.offeredby?.telephone?.trim(),
  } : undefined;

  return property;
}
