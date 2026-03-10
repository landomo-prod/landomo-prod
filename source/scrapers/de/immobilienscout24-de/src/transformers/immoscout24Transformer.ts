import { StandardProperty, GermanSpecificFields, ImmoScout24DEPortalMetadata } from '@landomo/core';
import { ImmoScout24Property } from '../types/immoscout24Types';

/**
 * Transform ImmobilienScout24 property to StandardProperty format
 */
export function transformImmoScout24ToStandard(
  property: ImmoScout24Property,
  country: 'germany' | 'austria' = 'germany'
): StandardProperty & Record<string, any> {
  const objectData = property.objectData || {};
  const priceInfo = objectData.priceInformation || property.priceInformation || {};
  const address = objectData.localization || objectData.address || property.address || {};
  const area = objectData.area || {};

  // Extract property type and transaction type
  const propertyType = mapPropertyType(property.realEstateType || property.type || property.estateType);
  const transactionType = mapTransactionType(priceInfo.marketingType);

  // Calculate price per sqm
  const price = priceInfo.price || property.mainPrice || 0;
  const livingArea = area.livingArea || area.livingSpace || property.livingSpace || 0;
  const pricePerSqm = price && livingArea ? Math.round(price / livingArea) : undefined;

  // Map to valid property_category for partitioned tables
  const propertyCategory = mapPropertyCategory(propertyType);

  return {
    // Category (required for partitioned ingestion)
    property_category: propertyCategory,

    // Basic info
    title: property.title || property.titleWithMarkup || `${propertyType} in ${address.city || 'Germany'}`,
    price: price,
    currency: priceInfo.currency || 'EUR',
    property_type: propertyType,
    transaction_type: transactionType,
    source_url: `https://www.immobilienscout24.de/expose/${property.id || property.exposeId}`,
    source_platform: 'immobilienscout24',

    // Location
    location: {
      address: formatAddress(address),
      city: address.city || address.geoHierarchy?.city?.name || 'Unknown',
      region: address.quarter || address.district || address.geoHierarchy?.quarter?.name,
      country: country === 'germany' ? 'Germany' : 'Austria',
      postal_code: address.postcode,
      coordinates: address.latitude && address.longitude ? {
        lat: address.latitude,
        lon: address.longitude
      } : undefined
    },

    // Details
    details: {
      bedrooms: objectData.numberOfBedRooms,
      bathrooms: objectData.numberOfBathRooms,
      sqm: livingArea,
      floor: objectData.floor,
      total_floors: objectData.numberOfFloors,
      rooms: area.numberOfRooms || property.numberOfRooms,
      year_built: objectData.constructionYear,
      renovation_year: objectData.lastRefurbishment,
      parking_spaces: objectData.numberOfParkingSpaces,
    },

    // Financial details
    price_per_sqm: pricePerSqm,
    hoa_fees: priceInfo.additionalCosts,

    // Media
    media: {
      images: extractImages(property),
      virtual_tour_url: (property as any).virtualTourUrl,
      total_images: property.pictures?.length || property.galleryAttachments?.length || 0
    },

    // Backward compatibility
    images: extractImageUrls(property),
    description: objectData.description,
    description_language: 'de',

    // Agent
    agent: property.contactDetails ? {
      name: formatContactName(property.contactDetails),
      phone: property.contactDetails.phoneNumber,
      email: property.contactDetails.email,
      agency: property.contactDetails.company,
      agency_logo: property.contactDetails.logoUrl
    } : undefined,

    // Amenities
    amenities: {
      has_parking: objectData.numberOfParkingSpaces ? objectData.numberOfParkingSpaces > 0 : undefined,
      has_garage: objectData.parkingSpaceType?.toLowerCase().includes('garage'),
      has_balcony: objectData.balcony || property.balcony,
      has_garden: objectData.garden || property.garden,
      has_basement: objectData.cellar || property.cellar,
      has_elevator: objectData.lift || property.lift,
      is_barrier_free: objectData.handicappedAccessible,
      is_furnished: objectData.builtInKitchen || property.builtInKitchen
    },

    // Energy rating
    energy_rating: objectData.energyCertificate?.energyEfficiencyClass?.toLowerCase(),

    // ============ Universal Tier 1 fields ============
    condition: normalizeCondition(objectData.condition),
    heating_type: normalizeHeatingType(objectData.heatingType),
    furnished: normalizeFurnished(objectData.builtInKitchen),
    construction_type: undefined, // ImmoScout24 does not provide construction material type
    available_from: undefined, // Not reliably available from ImmoScout24 API
    published_date: property.publicationDate || property.creationDate || undefined,
    deposit: priceInfo.deposit,
    parking_spaces: objectData.numberOfParkingSpaces,

    // Portal metadata (ImmoScout24-specific fields)
    portal_metadata: {
      immobilienscout24: {
        expose_id: property.id || property.exposeId || '',
        external_id: property.externalId,
        property_type: property.realEstateType,
        transaction_type: priceInfo.marketingType,
        original_price: priceInfo.originalPrice,
        price_reduction: priceInfo.priceReduction,
        additional_costs: priceInfo.additionalCosts,
        heating_costs: priceInfo.heatingCosts,
        operating_costs: priceInfo.operatingCosts,
        deposit: priceInfo.deposit,
        courtage: priceInfo.courtage,
        provision_free: property.provisionFree,
        buying_price: transactionType === 'sale' ? price : undefined,
        monthly_rent: transactionType === 'rent' ? price : undefined,
        base_rent: priceInfo.baseRent,
        total_rent: priceInfo.totalRent,
        advertisement_type: property.advertisementType,
        creation_date: property.creationDate,
        last_modification_date: property.modificationDate,
        published_date: property.publicationDate,
        precise_location: address.preciseLocation,
        building_type: objectData.buildingType,
        heating_type: objectData.heatingType,
        energy_certificate: objectData.energyCertificate ? {
          type: objectData.energyCertificate.type,
          value: objectData.energyCertificate.energyEfficiencyClass,
          year: objectData.energyCertificate.year
        } : undefined,
        image_count: property.pictures?.length || property.galleryAttachments?.length || 0,
        floor_plan_count: property.galleryAttachments?.filter(a => a.type?.toLowerCase() === 'floorplan').length || 0,
        virtual_tour: !!(property as any).virtualTourUrl,
        is_featured: property.isFeatured,
        is_premium: property.isPremium,
        is_top: property.isTop,
        agency_id: property.contactDetails?.agencyId,
        agency_name: property.contactDetails?.company,
        view_count: property.viewCount
      } as ImmoScout24DEPortalMetadata
    },

    // Country-specific fields (German real estate)
    country_specific: {
      // Condition
      condition: normalizeCondition(objectData.condition),

      // Furnished status
      furnished: normalizeFurnished(objectData.builtInKitchen),

      // Energy rating
      energy_rating: normalizeEnergyRating(objectData.energyCertificate?.energyEfficiencyClass),

      // Heating type
      heating_type: normalizeHeatingType(objectData.heatingType),

      // Building details
      building_type: normalizeBuildingType(objectData.buildingType),
      year_built: objectData.constructionYear,
      renovation_year: objectData.lastRefurbishment,

      // Areas
      area_living: livingArea,
      area_plot: area.plotArea,
      area_total: area.usableFloorSpace,
      area_balcony: area.balconyArea,
      area_terrace: area.terraceArea,
      area_cellar: area.cellarArea,

      // Building structure
      total_floors: objectData.numberOfFloors,

      // Financial details
      deposit: priceInfo.deposit,
      operating_costs: priceInfo.operatingCosts,
      heating_costs: priceInfo.heatingCosts,
      additional_costs: priceInfo.additionalCosts,
      courtage: priceInfo.courtage,

      // Amenities
      accessible: objectData.handicappedAccessible,
      pets_allowed: objectData.petsAllowed,
      has_fireplace: objectData.fireplace,
      has_air_conditioning: objectData.airConditioning,
      has_security_system: objectData.securitySystem,

      // Media
      image_urls: extractImageUrls(property),
      image_count: property.pictures?.length || property.galleryAttachments?.length || 0
    } as GermanSpecificFields,

    // Status
    status: 'active',

    // German-specific indexed columns (top-level for bulk-operations.ts)
    german_ownership: normalizeOwnership(objectData.ownershipType || (property as any).ownershipType),
    german_hausgeld: priceInfo.hausgeld,
    german_courtage: priceInfo.courtage ? parseCourtageAmount(priceInfo.courtage) : undefined,
    german_kfw_standard: objectData.energyCertificate?.kfwStandard,
    german_is_denkmalschutz: objectData.denkmalschutz || (property as any).listedBuilding || false,
  } as any;
}

/**
 * Map property type to valid property_category for partitioned tables
 */
function mapPropertyCategory(propertyType: string): 'apartment' | 'house' | 'land' | 'commercial' {
  if (propertyType === 'apartment') return 'apartment';
  if (propertyType === 'house') return 'house';
  if (propertyType === 'land') return 'land';
  if (propertyType === 'commercial') return 'commercial';
  // Default unmapped types to apartment
  return 'apartment';
}

/**
 * Map ImmoScout24 property type to standard type
 */
function mapPropertyType(realEstateType?: string): string {
  if (!realEstateType) return 'other';

  const type = realEstateType.toLowerCase();

  if (type.includes('apartment') || type.includes('wohnung')) return 'apartment';
  if (type.includes('house') || type.includes('haus')) return 'house';
  if (type.includes('land') || type.includes('grundstück')) return 'land';
  if (type.includes('commercial') || type.includes('gewerbe')) return 'commercial';
  if (type.includes('garage') || type.includes('stellplatz')) return 'parking';

  return 'other';
}

/**
 * Map marketing type to transaction type
 */
function mapTransactionType(marketingType?: string): 'sale' | 'rent' {
  if (!marketingType) return 'sale';

  const type = marketingType.toLowerCase();
  return type.includes('rent') || type.includes('miete') ? 'rent' : 'sale';
}

/**
 * Format address from components
 */
function formatAddress(address: any): string | undefined {
  if (address.address) return address.address;

  const parts: string[] = [];

  if (address.street) parts.push(address.street);
  if (address.houseNumber) parts.push(address.houseNumber);

  const streetAddress = parts.join(' ');

  const cityParts: string[] = [];
  if (address.postcode) cityParts.push(address.postcode);
  if (address.city) cityParts.push(address.city);

  const cityAddress = cityParts.join(' ');

  const fullParts: string[] = [];
  if (streetAddress) fullParts.push(streetAddress);
  if (cityAddress) fullParts.push(cityAddress);

  return fullParts.length > 0 ? fullParts.join(', ') : undefined;
}

/**
 * Format contact name
 */
function formatContactName(contact: any): string {
  const parts: string[] = [];

  if (contact.salutation) parts.push(contact.salutation);
  if (contact.firstName) parts.push(contact.firstName);
  if (contact.lastName) parts.push(contact.lastName);

  return parts.length > 0 ? parts.join(' ') : (contact.company || 'Unknown');
}

/**
 * Extract images with metadata
 */
function extractImages(property: ImmoScout24Property): any[] {
  const images: any[] = [];

  // Process galleryAttachments (preferred)
  if (property.galleryAttachments && property.galleryAttachments.length > 0) {
    property.galleryAttachments.forEach((attachment, index) => {
      if (attachment.type?.toLowerCase() !== 'floorplan') {
        images.push({
          url: attachment.urls?.ORIGINAL || attachment.urls?.SCALE_1600x1200 || '',
          thumbnail_url: attachment.urls?.SCALE_640x480 || attachment.urls?.SCALE_800x600,
          alt: attachment.title,
          order: index,
          is_main: attachment.titlePicture || index === 0,
          image_id: attachment.id
        });
      }
    });
  }
  // Fallback to pictures array
  else if (property.pictures && property.pictures.length > 0) {
    property.pictures.forEach((picture, index) => {
      if (!picture.floorplan) {
        images.push({
          url: picture.url || picture.urls?.ORIGINAL || '',
          alt: picture.title,
          order: index,
          is_main: index === 0,
          image_id: picture.id
        });
      }
    });
  }
  // Process objectData pictures
  else if (property.objectData?.pictures && property.objectData.pictures.length > 0) {
    property.objectData.pictures.forEach((picture, index) => {
      if (!picture.floorplan) {
        images.push({
          url: picture.url || picture.urls?.ORIGINAL || '',
          alt: picture.title,
          order: index,
          is_main: index === 0,
          image_id: picture.id
        });
      }
    });
  }

  return images;
}

/**
 * Extract image URLs (backward compatibility)
 */
function extractImageUrls(property: ImmoScout24Property): string[] {
  const images = extractImages(property);
  return images.map(img => img.url).filter(url => url);
}

/**
 * Normalize condition to standard format
 */
function normalizeCondition(condition?: string): GermanSpecificFields['condition'] {
  if (!condition) return undefined;

  const conditionLower = condition.toLowerCase();

  if (conditionLower.includes('neuwertig') || conditionLower.includes('erstbezug') || conditionLower.includes('new')) {
    return 'new';
  }

  if (conditionLower.includes('saniert') || conditionLower.includes('renoviert') || conditionLower.includes('renovated')) {
    return 'after_renovation';
  }

  if (conditionLower.includes('gepflegt') || conditionLower.includes('gut') || conditionLower.includes('good')) {
    return 'good';
  }

  if (conditionLower.includes('modernisiert') || conditionLower.includes('sehr gut')) {
    return 'very_good';
  }

  if (conditionLower.includes('hervorragend') || conditionLower.includes('excellent')) {
    return 'excellent';
  }

  if (conditionLower.includes('sanierungs') || conditionLower.includes('renovierungs') || conditionLower.includes('needs renovation')) {
    return 'requires_renovation';
  }

  if (conditionLower.includes('projekt') || conditionLower.includes('project')) {
    return 'project';
  }

  if (conditionLower.includes('im bau') || conditionLower.includes('neubau') || conditionLower.includes('under construction')) {
    return 'under_construction';
  }

  return undefined;
}

/**
 * Normalize furnished status
 */
function normalizeFurnished(builtInKitchen?: boolean): GermanSpecificFields['furnished'] {
  // ImmoScout24 doesn't have comprehensive furnished data
  if (builtInKitchen === true) {
    return 'partially_furnished';
  }
  return undefined;
}

/**
 * Normalize energy rating to standard format
 */
function normalizeEnergyRating(rating?: string): GermanSpecificFields['energy_rating'] {
  if (!rating) return undefined;

  // German energy ratings: A+ to H
  const ratingUpper = rating.toUpperCase().trim();

  // Extract letter rating
  const match = ratingUpper.match(/([A-G])[+]?/);
  if (match) {
    const letter = match[1].toLowerCase();
    if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(letter)) {
      return letter as 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
    }
  }

  return 'unknown';
}

/**
 * Normalize heating type to standard format
 */
function normalizeHeatingType(heatingType?: string): GermanSpecificFields['heating_type'] {
  if (!heatingType) return undefined;

  const heatingLower = heatingType.toLowerCase();

  if (heatingLower.includes('zentralheizung') || heatingLower.includes('zentral') || heatingLower.includes('central')) {
    return 'central_heating';
  }

  if (heatingLower.includes('fernwärme') || heatingLower.includes('district')) {
    return 'district_heating';
  }

  if (heatingLower.includes('fußbodenheizung') || heatingLower.includes('floor')) {
    return 'floor_heating';
  }

  if (heatingLower.includes('gas')) {
    return 'gas_heating';
  }

  if (heatingLower.includes('öl') || heatingLower.includes('oil')) {
    return 'oil_heating';
  }

  if (heatingLower.includes('wärmepumpe') || heatingLower.includes('heat pump')) {
    return 'heat_pump';
  }

  if (heatingLower.includes('elektro') || heatingLower.includes('electric')) {
    return 'electric_heating';
  }

  if (heatingLower.includes('warmwasser') || heatingLower.includes('warm') && heatingLower.includes('wasser')) {
    return 'hot_water';
  }

  if (heatingLower.includes('solar')) {
    return 'other';
  }

  return 'unknown';
}

/**
 * Normalize building type to standard format
 */
function normalizeBuildingType(buildingType?: string): string | undefined {
  if (!buildingType) return undefined;

  const buildingLower = buildingType.toLowerCase();

  // German terms
  if (buildingLower.includes('einfamilienhaus') || buildingLower.includes('detached house')) {
    return 'detached';
  }

  if (buildingLower.includes('doppelhaushälfte') || buildingLower.includes('semi-detached') || buildingLower.includes('semi detached')) {
    return 'semi_detached';
  }

  if (buildingLower.includes('reihenhaus') || buildingLower.includes('terraced') || buildingLower.includes('townhouse')) {
    return 'terraced';
  }

  if (buildingLower.includes('villa')) {
    return 'villa';
  }

  if (buildingLower.includes('bungalow')) {
    return 'bungalow';
  }

  if (buildingLower.includes('wohnhaus') || buildingLower.includes('residential')) {
    return 'residential';
  }

  if (buildingLower.includes('hochhaus') || buildingLower.includes('high-rise') || buildingLower.includes('high rise')) {
    return 'high_rise';
  }

  if (buildingLower.includes('mehrfamilienhaus') || buildingLower.includes('apartment building') || buildingLower.includes('multi-family')) {
    return 'residential';
  }

  // Return undefined for unmapped types (don't pass raw values)
  return undefined;
}

/**
 * Normalize ownership type for German indexed column
 */
function normalizeOwnership(ownership?: string): string | undefined {
  if (!ownership) return undefined;

  const lower = ownership.toLowerCase();

  if (lower.includes('eigentum') || lower.includes('freehold')) return 'eigentum';
  if (lower.includes('erbbaurecht') || lower.includes('leasehold')) return 'erbbaurecht';
  if (lower.includes('mietkauf')) return 'mietkauf';
  if (lower.includes('genossenschaft') || lower.includes('cooperative')) return 'genossenschaft';
  if (lower.includes('wohnungseigentum')) return 'wohnungseigentum';

  return undefined;
}

/**
 * Parse courtage amount from string (e.g., "3,57%" or "2 Monatsmieten")
 */
function parseCourtageAmount(courtage?: string | number): number | undefined {
  if (courtage === undefined || courtage === null) return undefined;
  if (typeof courtage === 'number') return courtage;

  const cleaned = courtage.replace(/\s/g, '').replace(',', '.');
  const match = cleaned.match(/([\d.]+)/);
  return match ? parseFloat(match[1]) : undefined;
}
