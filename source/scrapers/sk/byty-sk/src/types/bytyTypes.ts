/**
 * Byty.sk Types
 * Byty.sk uses server-side rendering with Imperva WAF protection
 */

export interface BytyListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string;
  transactionType: string;
  url: string;

  // Optional details
  area?: number;         // m²
  rooms?: number;
  floor?: number;
  description?: string;
  imageUrl?: string;
  date?: string;
  details?: string[];    // From condition-info list
}

export interface BytySearchParams {
  category: string;      // 'byty', 'domy', 'pozemky'
  type: string;          // 'predaj', 'prenajom'
  location?: string;
  page?: number;
}
