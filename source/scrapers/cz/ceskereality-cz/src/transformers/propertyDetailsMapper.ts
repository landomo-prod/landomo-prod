/**
 * Maps Czech property detail labels to standardized values
 */

export interface MappedPropertyDetails {
  floor?: number;
  totalFloors?: number;
  sqm?: number;
  sqmLiving?: number;
  sqmUsable?: number;
  sqmPlot?: number;
  sqmBuilt?: number;
  balconyArea?: number;
  cellarArea?: number;
  terraceArea?: number;
  loggiaArea?: number;
  garageCount?: number;
  parkingSpaces?: number;
  rooms?: number;
  bathrooms?: number;
  constructionType?: 'panel' | 'brick' | 'concrete' | 'mixed';
  condition?: 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation';
  yearBuilt?: number;
  renovationYear?: number;
  energyClass?: string;
  ownership?: string;
  propertyId?: string;
  heating?: string;
  water?: string;
  sewage?: string;
  electricity?: string;
  gas?: string;
  parking?: string;
  furnished?: 'furnished' | 'partially_furnished' | 'not_furnished';
  publishedDate?: string;
  hoaFees?: number;
  availableFrom?: string;
  deposit?: number;
  priceExcludes?: string;
  hasBalcony?: boolean;
  hasTerrace?: boolean;
  hasLoggia?: boolean;
  heatingDetails?: string;
  rentalEquipment?: string;
}

/**
 * Parse area value from Czech format
 * Examples: "43 m²", "43,5 m2", "43.5m²", "2 510 m²"
 */
function parseArea(value: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/([\d\s]+[.,]?\d*)/);
  if (match) {
    return parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
  }
  return undefined;
}

/**
 * Parse floor from Czech format
 * Examples: "2.", "1. patro", "přízemí"
 */
function parseFloor(value: string): number | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();

  if (lower.includes('přízemí') || lower.includes('parter')) return 0;
  if (lower.includes('suterén') || lower.includes('podzemní')) return -1;

  const match = value.match(/(-?\d+)/);
  if (match) {
    return parseInt(match[1]);
  }
  return undefined;
}

/**
 * Map construction type from Czech to enum
 */
function mapConstructionType(value: string): 'panel' | 'brick' | 'concrete' | 'mixed' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();

  if (lower.includes('panel')) return 'panel';
  if (lower.includes('cihla') || lower.includes('cihelná') || lower.includes('cihlová') || lower.includes('zděná')) return 'brick';
  if (lower.includes('beton') || lower.includes('železobeton')) return 'concrete';
  if (lower.includes('skelet') || lower.includes('ocel')) return 'concrete'; // Skeleton/steel frame → concrete
  if (lower.includes('smíšen') || lower.includes('kombinovan') || lower.includes('jiná') || lower.includes('jiné') || lower.includes('ostatní')) return 'mixed';

  return undefined;
}

/**
 * Map property condition from Czech to enum
 */
function mapCondition(value: string): 'new' | 'excellent' | 'good' | 'after_renovation' | 'requires_renovation' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();

  if (lower.includes('novostavba') || lower.includes('nový') || lower.includes('nová')) return 'new';
  if (lower.includes('vyžaduje') || lower.includes('k rekonstrukci') || lower.includes('před rekonstrukcí') || lower.includes('špatný') || lower.includes('k demolici')) {
    return 'requires_renovation';
  }
  if (lower.includes('po rekonstrukci') || lower.includes('po renovaci') || lower.includes('po rekonstrukc')) return 'after_renovation';
  if (lower.includes('výborný') || lower.includes('vynikající') || lower.includes('velmi dobrý') || lower.includes('bezvadný')) return 'excellent';
  if (lower.includes('dobrý') || lower.includes('udržovaný') || lower.includes('zachovalý')) return 'good';

  return undefined;
}

/**
 * Parse year from various formats
 */
function parseYear(value: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/(\d{4})/);
  if (match) {
    const year = parseInt(match[1]);
    if (year >= 1800 && year <= new Date().getFullYear() + 5) {
      return year;
    }
  }
  return undefined;
}

/**
 * Map furnished status from Czech to enum
 */
function mapFurnished(value: string): 'furnished' | 'partially_furnished' | 'not_furnished' | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();

  if (lower.includes('částečně') || lower.includes('částečné')) return 'partially_furnished';
  if (lower.includes('ano') || lower.includes('vybavený') || lower.includes('zařízený')) return 'furnished';
  if (lower.includes('ne') || lower.includes('nevybavený') || lower.includes('nezařízený')) return 'not_furnished';

  return undefined;
}

/**
 * Parse number from Czech format
 */
function parseNumber(value: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/([\d\s]+)/);
  if (match) {
    return parseInt(match[1].replace(/\s/g, ''));
  }
  return undefined;
}

/**
 * Map property details from Czech labels to standardized fields
 */
export function mapPropertyDetails(details: Record<string, string>): MappedPropertyDetails {
  const mapped: MappedPropertyDetails = {};

  // Iterate through all details
  for (const [label, value] of Object.entries(details)) {
    const lower = label.toLowerCase();

    // Floor
    if ((lower.includes('patro') || lower.includes('podlaží')) && !lower.includes('počet') && !lower.includes('celkem')) {
      mapped.floor = parseFloor(value);
    }

    // Total floors
    if (lower.includes('počet podlaží') || lower.includes('podlaží celkem') || lower.includes('celkem podlaží') || lower.includes('počet pater')) {
      mapped.totalFloors = parseFloor(value);
    }

    // Areas
    if ((lower.includes('celková plocha') || lower.includes('plocha celková') || lower === 'plocha') && !lower.includes('pozemku')) {
      mapped.sqm = parseArea(value);
    }
    if (lower.includes('plocha obytná') || lower.includes('obytná plocha')) {
      mapped.sqmLiving = parseArea(value);
    }
    if (lower.includes('plocha užitná') || lower.includes('užitná plocha')) {
      mapped.sqmUsable = parseArea(value);
    }
    if (lower.includes('plocha pozemku') || lower.includes('pozemek')) {
      mapped.sqmPlot = parseArea(value);
    }
    if (lower.includes('plocha zastavěná') || lower.includes('zastavěná plocha')) {
      mapped.sqmBuilt = parseArea(value);
    }
    if (lower.includes('plocha balkonu') || lower.includes('balkon') || lower.includes('balkón')) {
      // Check if value mentions specific outdoor space type
      const valueLower = value.toLowerCase();
      if (valueLower.includes('lodžie') || valueLower.includes('loggie')) {
        mapped.loggiaArea = parseArea(value) || 1; // Set flag even if no area specified
      } else if (valueLower.includes('terasa') || valueLower.includes('terrace')) {
        mapped.terraceArea = parseArea(value) || 1; // Set flag even if no area specified
      } else {
        mapped.balconyArea = parseArea(value) || 1; // Set flag even if no area specified
      }
    }
    if (lower.includes('plocha sklepa') || lower.includes('sklep')) {
      mapped.cellarArea = parseArea(value);
    }
    if (lower.includes('plocha terasy') || lower.includes('terasa')) {
      mapped.terraceArea = parseArea(value);
    }
    if (lower.includes('plocha lodžie') || lower.includes('lodžie') || lower.includes('loggie')) {
      mapped.loggiaArea = parseArea(value);
    }

    // Construction
    if (lower.includes('konstrukce') || lower.includes('typ stavby') || lower.includes('typ budovy') || lower.includes('materiál')) {
      mapped.constructionType = mapConstructionType(value);
    }

    // Condition
    if (lower.includes('stav') && !lower.includes('zastavěná')) {
      mapped.condition = mapCondition(value);
    }

    // Year built
    if (lower.includes('rok výstavby') || lower.includes('rok kolaudace')) {
      mapped.yearBuilt = parseYear(value);
    }

    // Energy
    if (lower.includes('energetická') || lower.includes('třída') || lower.includes('penb') || lower.includes('náročnost')) {
      const classMatch = value.match(/([A-G])/i);
      if (classMatch) {
        mapped.energyClass = classMatch[1].toUpperCase();
      }
    }

    // Ownership
    if (lower.includes('vlastnictví')) {
      mapped.ownership = value;
    }

    // Property ID
    if (lower.includes('id nemovitosti') || lower.includes('číslo nemovitosti')) {
      mapped.propertyId = value;
    }

    // Utilities
    if (lower.includes('topení') || lower.includes('typ topení') || (lower.includes('vytápění') && !lower.includes('podrobnosti'))) {
      mapped.heating = value;
    }
    if (lower.includes('vytápění') && lower.includes('podrobnosti')) {
      mapped.heatingDetails = value;
    }
    if (lower.includes('voda')) {
      mapped.water = value;
    }
    if (lower.includes('kanalizace')) {
      mapped.sewage = value;
    }
    if (lower.includes('elektřina') || lower.includes('proud')) {
      mapped.electricity = value;
    }
    if (lower.includes('plyn')) {
      mapped.gas = value;
    }
    if (lower.includes('parkování') || lower.includes('parkovací')) {
      mapped.parking = value;
    }

    // Rooms and bathrooms
    if (lower.includes('počet pokojů') || lower.includes('pokoje')) {
      mapped.rooms = parseNumber(value);
    }
    if (lower.includes('koupelna') || lower.includes('wc') || lower.includes('koupelen')) {
      mapped.bathrooms = parseNumber(value);
    }

    // Garage
    if (lower.includes('garáž') || lower.includes('garage')) {
      mapped.garageCount = parseNumber(value);
    }

    // Parking spaces
    if (lower.includes('počet parkovacích míst') || lower.includes('parkovacích stání')) {
      mapped.parkingSpaces = parseNumber(value);
    }

    // Renovation year
    if (lower.includes('rok rekonstrukce') || lower.includes('rekonstrukce')) {
      const year = parseYear(value);
      if (year) mapped.renovationYear = year;
    }

    // Furnished
    if (lower.includes('vybavení') || lower.includes('zařízení') || lower.includes('vybaven')) {
      const furnishedResult = mapFurnished(value);
      if (furnishedResult) {
        mapped.furnished = furnishedResult;
      } else {
        mapped.rentalEquipment = value;
      }
    }

    // Published date
    if (lower.includes('datum vložení') || lower.includes('datum zveřejnění')) {
      mapped.publishedDate = value;
    }

    // HOA fees
    if (lower.includes('poplatek') || lower.includes('měsíční náklady') || lower.includes('služby')) {
      const fee = parseArea(value); // parseArea works for any number
      if (fee) mapped.hoaFees = fee;
    }

    // Available from
    if (lower.includes('dostupné od') || lower.includes('nastěhování') || lower.includes('k dispozici od') || lower.includes('volné od')) {
      mapped.availableFrom = value;
    }

    // Deposit
    if (lower.includes('kauce') || lower.includes('jistota') || lower.includes('depozit')) {
      const deposit = parseArea(value);
      if (deposit) mapped.deposit = deposit;
    }

    // Price excludes (commission detection)
    if (lower.includes('cena nezahrnuje')) {
      mapped.priceExcludes = value;
    }

    // Balcony types (comma-separated: "Balkón, Terasa, Lodžie")
    if (lower === 'balkóny' || lower === 'balkony') {
      const valueLower = value.toLowerCase();
      if (/balkón|balkon/.test(valueLower)) mapped.hasBalcony = true;
      if (/terasa|terrace/.test(valueLower)) mapped.hasTerrace = true;
      if (/lodžie|loggie/.test(valueLower)) mapped.hasLoggia = true;
    }
  }

  // Use the most accurate area measurement
  if (!mapped.sqm) {
    mapped.sqm = mapped.sqmUsable || mapped.sqmLiving;
  }

  return mapped;
}
