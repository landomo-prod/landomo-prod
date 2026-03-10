import { FotocasaListing, FOTOCASA_PROPERTY_TYPES, FOTOCASA_VIVIENDA_SUBTYPES } from '../types/fotocasaTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Detect property category from Fotocasa listing
 *
 * Fotocasa typeId mapping:
 * - 2 = vivienda (apartments + houses, distinguished by subtypeId)
 * - 4 = terreno (land)
 * - 6 = oficina (offices)
 * - 8 = local (retail/shops)
 * - 9 = nave (warehouses)
 *
 * Vivienda subtypeId mapping:
 * - 1 = piso (apartment)
 * - 2 = ático (penthouse → apartment)
 * - 3 = chalet (house)
 * - 4 = dúplex (apartment)
 * - 5 = estudio (studio → apartment)
 * - 6 = casa rural (house)
 * - 7 = finca (house)
 */
export function detectCategory(listing: FotocasaListing): PropertyCategory {
  const { typeId, subtypeId } = listing;

  // Land
  if (typeId === FOTOCASA_PROPERTY_TYPES.TERRENO) {
    return 'land';
  }

  // Commercial (offices, retail, warehouses)
  if (
    typeId === FOTOCASA_PROPERTY_TYPES.OFICINA ||
    typeId === FOTOCASA_PROPERTY_TYPES.LOCAL ||
    typeId === FOTOCASA_PROPERTY_TYPES.NAVE
  ) {
    return 'commercial';
  }

  // Vivienda - distinguish apartment vs house by subtypeId
  if (typeId === FOTOCASA_PROPERTY_TYPES.VIVIENDA) {
    // Houses: chalet, casa rural, finca
    if (
      subtypeId === FOTOCASA_VIVIENDA_SUBTYPES.CHALET ||
      subtypeId === FOTOCASA_VIVIENDA_SUBTYPES.CASA_RURAL ||
      subtypeId === FOTOCASA_VIVIENDA_SUBTYPES.FINCA
    ) {
      return 'house';
    }

    // Everything else is apartment (piso, ático, dúplex, estudio)
    return 'apartment';
  }

  // Default to apartment for unknown types
  return 'apartment';
}

/**
 * Get apartment subtype from Fotocasa subtypeId
 */
export function getApartmentSubtype(subtypeId: number): 'standard' | 'penthouse' | 'studio' | 'maisonette' | undefined {
  switch (subtypeId) {
    case FOTOCASA_VIVIENDA_SUBTYPES.PISO: return 'standard';
    case FOTOCASA_VIVIENDA_SUBTYPES.ATICO: return 'penthouse';
    case FOTOCASA_VIVIENDA_SUBTYPES.ESTUDIO: return 'studio';
    case FOTOCASA_VIVIENDA_SUBTYPES.DUPLEX: return 'maisonette';
    default: return undefined;
  }
}

/**
 * Get house subtype from Fotocasa subtypeId
 */
export function getHouseSubtype(subtypeId: number): 'detached' | 'villa' | 'farmhouse' | 'cottage' | undefined {
  switch (subtypeId) {
    case FOTOCASA_VIVIENDA_SUBTYPES.CHALET: return 'detached';
    case FOTOCASA_VIVIENDA_SUBTYPES.FINCA: return 'villa';
    case FOTOCASA_VIVIENDA_SUBTYPES.CASA_RURAL: return 'cottage';
    default: return undefined;
  }
}

/**
 * Get commercial subtype from Fotocasa typeId
 */
export function getCommercialSubtype(typeId: number): 'office' | 'retail' | 'warehouse' | undefined {
  switch (typeId) {
    case FOTOCASA_PROPERTY_TYPES.OFICINA: return 'office';
    case FOTOCASA_PROPERTY_TYPES.LOCAL: return 'retail';
    case FOTOCASA_PROPERTY_TYPES.NAVE: return 'warehouse';
    default: return undefined;
  }
}
