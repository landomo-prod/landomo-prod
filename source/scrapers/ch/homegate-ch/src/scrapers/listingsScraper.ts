import { fetchAllProperties } from '../utils/fetchData';

/**
 * Fetch all listings from Homegate.ch for a given offer type
 */
export async function fetchListings(params: {
  offerType: 'rent' | 'buy';
  location?: string;
}): Promise<any[]> {
  const response = await fetchAllProperties({
    offerType: params.offerType,
    location: params.location,
  });
  return response.items;
}
