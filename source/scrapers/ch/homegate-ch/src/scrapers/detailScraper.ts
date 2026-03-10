import { fetchPropertyDetail } from '../utils/fetchData';

/**
 * Fetch detail for a single property from Homegate.ch
 */
export async function fetchDetail(propertyId: string, offerType: 'rent' | 'buy'): Promise<any> {
  return fetchPropertyDetail(propertyId, offerType);
}
