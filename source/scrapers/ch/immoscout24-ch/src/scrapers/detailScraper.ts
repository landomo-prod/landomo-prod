import { fetchPropertyDetail } from '../utils/fetchData';

/**
 * Fetch detail for a single property from ImmoScout24.ch
 * Used by the detail queue worker
 */
export async function fetchDetail(propertyId: string | number): Promise<any> {
  return fetchPropertyDetail(propertyId);
}
