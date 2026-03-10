import { FinnListing } from '../types/finnTypes';

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/**
 * Norwegian property type descriptions from finn.no API
 *
 * Homes search (SEARCH_ID_REALESTATE_HOMES):
 *   "Leilighet"             → apartment
 *   "Rekkehus"              → house (townhouse)
 *   "Enebolig"              → house
 *   "Enebolig, Tomannsbolig"→ house
 *   "Tomannsbolig"          → house (duplex)
 *   "Garasje/Parkering"     → commercial (parking)
 *
 * Lettings search (SEARCH_ID_REALESTATE_LETTINGS):
 *   "Leilighet"             → apartment
 *   "Hybel"                 → apartment (bedsit/studio)
 *   "Rom i bofellesskap"    → apartment (room in shared house)
 *   "Rekkehus"              → house
 *   "Tomannsbolig"          → house
 *   "Garasje/Parkering"     → commercial
 *
 * Plots search (SEARCH_ID_REALESTATE_PLOTS):
 *   "Tomter"                → land
 *
 * Leisure search (SEARCH_ID_REALESTATE_LEISURE_SALE):
 *   "Hytte"                 → house (cabin)
 *   "Fritidstomt"           → land
 *
 * Search key also provides strong category signal.
 */
export function detectCategory(listing: FinnListing): PropertyCategory {
  const searchKey = listing.main_search_key || '';
  const propType = (listing.property_type_description || '').toLowerCase().trim();

  // Plots search → always land
  if (searchKey === 'SEARCH_ID_REALESTATE_PLOTS') {
    return 'land';
  }

  // Use property type description for fine-grained routing
  if (propType) {
    // Apartments / rentable units
    if (
      propType === 'leilighet' ||
      propType === 'hybel' ||
      propType === 'rom i bofellesskap' ||
      propType === 'leilighet/hybel'
    ) {
      return 'apartment';
    }

    // Houses (all standalone / semi-detached types)
    if (
      propType === 'enebolig' ||
      propType === 'rekkehus' ||
      propType === 'tomannsbolig' ||
      propType === 'enebolig, tomannsbolig' ||
      propType === 'hytte' ||
      propType === 'fritidsbolig' ||
      propType === 'villa' ||
      propType === 'småbruk/gårdsbruk'
    ) {
      return 'house';
    }

    // Land
    if (
      propType === 'tomter' ||
      propType === 'fritidstomt' ||
      propType === 'tomt'
    ) {
      return 'land';
    }

    // Commercial / parking
    if (
      propType === 'garasje/parkering' ||
      propType === 'garasje' ||
      propType === 'parkering' ||
      propType === 'næringseiendom' ||
      propType === 'næringsbygg' ||
      propType === 'kontor' ||
      propType === 'lager' ||
      propType === 'butikk'
    ) {
      return 'commercial';
    }
  }

  // Fallback by search key
  if (
    searchKey === 'SEARCH_ID_REALESTATE_HOMES' ||
    searchKey === 'SEARCH_ID_REALESTATE_LETTINGS'
  ) {
    // Default to apartment for residential searches without a recognized type
    return 'apartment';
  }

  if (searchKey === 'SEARCH_ID_REALESTATE_LEISURE_SALE') {
    // Leisure cabins are houses
    return 'house';
  }

  // Final fallback
  return 'apartment';
}
