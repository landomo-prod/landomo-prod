import { fetchAllProperties } from '../utils/fetchData';

/**
 * Fetch all listings from ImmoScout24.ch for a given category
 *
 * NOTE: The exact API parameters (s, t) need verification against the live API.
 * Based on research: s=offerType (1=buy, 2=rent), t=propertyType string
 */
export async function fetchListings(params: {
  offerType: 'buy' | 'rent';
  propertyType: string;
}): Promise<any[]> {
  const response = await fetchAllProperties({
    s: params.offerType === 'buy' ? 1 : 2,
    t: params.propertyType,
  });
  return response.items;
}
