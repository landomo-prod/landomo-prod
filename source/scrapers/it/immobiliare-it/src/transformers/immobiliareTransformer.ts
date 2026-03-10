import { ImmobiliareResult, SearchConfig } from '../types/immobiliareTypes';
import { transformImmobiliareApartment } from './apartments/apartmentTransformer';
import { transformImmobiliareHouse } from './houses/houseTransformer';
import { transformImmobiliareLand } from './land/landTransformer';
import { transformImmobiliareCommercial } from './commercial/commercialTransformer';

/**
 * Main transformer with category detection
 * Routes to category-specific transformer based on search config or listing type
 */
export function transformImmobiliareToStandard(
  result: ImmobiliareResult,
  config?: SearchConfig
): any {
  const contract = config?.contract || detectContract(result);
  const category = config?.category || detectCategory(result);

  switch (category) {
    case 'apartments':
      return transformImmobiliareApartment(result, contract);
    case 'houses':
      return transformImmobiliareHouse(result, contract);
    case 'land':
      return transformImmobiliareLand(result, contract);
    case 'commercial':
      return transformImmobiliareCommercial(result, contract);
    default:
      // Default to apartment
      return transformImmobiliareApartment(result, contract);
  }
}

function detectContract(result: ImmobiliareResult): 'sale' | 'rent' {
  const contract = result.realEstate?.contract?.toLowerCase();
  if (contract === 'affitto' || contract === 'rent') return 'rent';
  return 'sale';
}

function detectCategory(result: ImmobiliareResult): 'apartments' | 'houses' | 'land' | 'commercial' {
  const typology = (result.properties?.[0]?.typologyGA4Translation || '').toLowerCase();
  const type = (result.realEstate?.type || '').toLowerCase();
  const searchText = `${typology} ${type}`;

  // Land detection
  if (searchText.includes('terreno') || searchText.includes('terreni')) return 'land';

  // Commercial detection
  if (searchText.includes('ufficio') || searchText.includes('negozio') ||
      searchText.includes('capannone') || searchText.includes('commerciale') ||
      searchText.includes('locale')) return 'commercial';

  // House detection
  if (searchText.includes('villa') || searchText.includes('casa') ||
      searchText.includes('villetta') || searchText.includes('rustico') ||
      searchText.includes('casale') || searchText.includes('indipendente')) return 'houses';

  // Apartment detection (default)
  return 'apartments';
}
