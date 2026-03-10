import { ProvinceConfig } from '../types/pisosTypes';

/**
 * Spanish provinces for pisos.com crawling.
 * These are the URL slugs used by pisos.com for province-level search.
 */
export const SPANISH_PROVINCES: ProvinceConfig[] = [
  { slug: 'a_coruna', name: 'A Coruña' },
  { slug: 'alava', name: 'Álava' },
  { slug: 'albacete', name: 'Albacete' },
  { slug: 'alicante', name: 'Alicante' },
  { slug: 'almeria', name: 'Almería' },
  { slug: 'asturias', name: 'Asturias' },
  { slug: 'avila', name: 'Ávila' },
  { slug: 'badajoz', name: 'Badajoz' },
  { slug: 'barcelona', name: 'Barcelona' },
  { slug: 'bizkaia', name: 'Bizkaia' },
  { slug: 'burgos', name: 'Burgos' },
  { slug: 'caceres', name: 'Cáceres' },
  { slug: 'cadiz', name: 'Cádiz' },
  { slug: 'cantabria', name: 'Cantabria' },
  { slug: 'castellon', name: 'Castellón' },
  { slug: 'ciudad_real', name: 'Ciudad Real' },
  { slug: 'cordoba', name: 'Córdoba' },
  { slug: 'cuenca', name: 'Cuenca' },
  { slug: 'gipuzkoa', name: 'Gipuzkoa' },
  { slug: 'girona', name: 'Girona' },
  { slug: 'granada', name: 'Granada' },
  { slug: 'guadalajara', name: 'Guadalajara' },
  { slug: 'huelva', name: 'Huelva' },
  { slug: 'huesca', name: 'Huesca' },
  { slug: 'illes_balears', name: 'Illes Balears' },
  { slug: 'jaen', name: 'Jaén' },
  { slug: 'la_rioja', name: 'La Rioja' },
  { slug: 'las_palmas', name: 'Las Palmas' },
  { slug: 'leon', name: 'León' },
  { slug: 'lleida', name: 'Lleida' },
  { slug: 'lugo', name: 'Lugo' },
  { slug: 'madrid', name: 'Madrid' },
  { slug: 'malaga', name: 'Málaga' },
  { slug: 'murcia', name: 'Murcia' },
  { slug: 'navarra', name: 'Navarra' },
  { slug: 'ourense', name: 'Ourense' },
  { slug: 'palencia', name: 'Palencia' },
  { slug: 'pontevedra', name: 'Pontevedra' },
  { slug: 'salamanca', name: 'Salamanca' },
  { slug: 'santa_cruz_de_tenerife', name: 'Santa Cruz de Tenerife' },
  { slug: 'segovia', name: 'Segovia' },
  { slug: 'sevilla', name: 'Sevilla' },
  { slug: 'soria', name: 'Soria' },
  { slug: 'tarragona', name: 'Tarragona' },
  { slug: 'teruel', name: 'Teruel' },
  { slug: 'toledo', name: 'Toledo' },
  { slug: 'valencia', name: 'Valencia' },
  { slug: 'valladolid', name: 'Valladolid' },
  { slug: 'zamora', name: 'Zamora' },
  { slug: 'zaragoza', name: 'Zaragoza' },
];

/**
 * Parse pisos.com portal ID from detail URL or data-id attribute
 * Format: "61697778385.528715" or from URL path
 */
export function extractPortalId(detailUrl: string, dataId?: string): string {
  if (dataId) return dataId;

  // Extract from URL: /comprar/piso-location-61697778385_528715/
  const match = detailUrl.match(/(\d+_\d+)\/?$/);
  if (match) return match[1].replace('_', '.');
  return detailUrl;
}

/**
 * Build full URL from relative path
 */
export function buildUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `https://www.pisos.com${path}`;
}
