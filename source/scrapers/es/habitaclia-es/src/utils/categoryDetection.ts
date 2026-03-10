import { HabitacliaListingRaw, PropertyCategory } from '../types/habitacliaTypes';
import { normalizePropertyType } from '../../../shared/spanish-value-mappings';

export function detectCategory(listing: HabitacliaListingRaw): PropertyCategory {
  // First try by search config property type
  const searchType = listing.propertyType?.toLowerCase();
  if (searchType) {
    if (searchType === 'pisos') return 'apartment';
    if (searchType === 'casas') return 'house';
    if (searchType === 'terrenos') return 'land';
    if (searchType === 'locales' || searchType === 'oficinas' || searchType === 'naves' || searchType === 'garajes') return 'commercial';
  }

  // Try from title using spanish value mappings
  const title = listing.title?.toLowerCase() || '';
  const normalized = normalizePropertyType(title.split(' ')[0]);

  if (normalized) {
    if (['apartment', 'penthouse', 'duplex', 'studio', 'loft'].includes(normalized)) return 'apartment';
    if (['house', 'detached', 'semi_detached', 'terraced', 'villa', 'estate', 'rural_estate', 'farmhouse', 'country_house', 'village_house', 'manor', 'castle', 'prefab'].includes(normalized)) return 'house';
    if (['land', 'plot', 'building_land', 'agricultural_land'].includes(normalized)) return 'land';
    if (['shop', 'commercial', 'warehouse', 'industrial', 'office', 'garage', 'parking_space', 'storage', 'hotel', 'building'].includes(normalized)) return 'commercial';
  }

  // URL-based detection
  const url = listing.url?.toLowerCase() || '';
  if (url.includes('comprar-piso') || url.includes('alquiler-piso') || url.includes('atico') || url.includes('duplex')) return 'apartment';
  if (url.includes('comprar-casa') || url.includes('alquiler-casa') || url.includes('chalet')) return 'house';
  if (url.includes('terreno') || url.includes('parcela') || url.includes('solar')) return 'land';
  if (url.includes('local') || url.includes('oficina') || url.includes('nave') || url.includes('garaje')) return 'commercial';

  // Default to apartment (most common)
  return 'apartment';
}
