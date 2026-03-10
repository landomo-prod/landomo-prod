import { ProvinceConfig } from '../types/donpisoTypes';

const BASE_URL = 'https://www.donpiso.com';

/**
 * Donpiso operates primarily in Catalonia, Madrid, and select other Spanish regions.
 * These are the provinces covered by the chain.
 */
export const DONPISO_PROVINCES: ProvinceConfig[] = [
  // Catalonia
  { slug: 'barcelona', name: 'Barcelona' },
  { slug: 'tarragona', name: 'Tarragona' },
  { slug: 'girona', name: 'Girona' },
  { slug: 'lleida', name: 'Lleida' },
  // Madrid
  { slug: 'madrid', name: 'Madrid' },
  // Other covered regions
  { slug: 'valencia', name: 'Valencia' },
  { slug: 'alicante', name: 'Alicante' },
  { slug: 'zaragoza', name: 'Zaragoza' },
  { slug: 'sevilla', name: 'Sevilla' },
  { slug: 'malaga', name: 'Málaga' },
];

/**
 * Extract portal ID from a donpiso detail URL
 * URL pattern: /pisos-y-casas/300813_piso-en-venta-madrid
 * Returns: "300813"
 */
export function extractPortalId(url: string): string {
  const match = url.match(/\/pisos-y-casas\/(\d+)_/);
  if (match) return match[1];

  // Fallback: extract any number from URL
  const numMatch = url.match(/\/(\d+)[_-]/);
  if (numMatch) return numMatch[1];

  // Last resort: hash the URL
  return url.split('/').pop()?.split('_')[0] || url;
}

/**
 * Build full URL from a relative or absolute URL
 */
export function buildUrl(url: string): string {
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Build sale listing URL for a province
 */
export function buildSaleUrl(provinceSlug: string, page?: number): string {
  const base = `${BASE_URL}/venta-casas-y-pisos/${provinceSlug}/listado`;
  if (page && page > 1) {
    return `${base}/pagina-${page}.html`;
  }
  return base;
}

/**
 * Build rental listing URL for a province
 */
export function buildRentUrl(provinceSlug: string, page?: number): string {
  const base = `${BASE_URL}/alquiler-casas-y-pisos/${provinceSlug}/listado`;
  if (page && page > 1) {
    return `${base}/pagina-${page}.html`;
  }
  return base;
}

/**
 * Parse total pages from HTML content
 * Look for patterns like "402 inmuebles" or "pag. 2 de 23"
 */
export function parseTotalPages(text: string): number {
  // Look for "de X" pattern (e.g., "pag. 2 de 23")
  const pagesMatch = text.match(/de\s+(\d+)/);
  if (pagesMatch) {
    return parseInt(pagesMatch[1], 10);
  }
  return 1;
}

/**
 * Parse total results from page
 */
export function parseTotalResults(text: string): number {
  // e.g., "402 inmuebles" or "402 propiedades"
  const match = text.match(/(\d+)\s+(?:inmuebles?|propiedades?|resultado)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}
