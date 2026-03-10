import { SearchConfig } from '../types/pisosTypes';

/**
 * URL slug to category mapping
 * Based on pisos.com URL patterns:
 * /venta/pisos-madrid/ (apartments for sale)
 * /alquiler/casas-barcelona/ (houses for rent)
 */
const SLUG_TO_CATEGORY: Record<string, 'apartment' | 'house' | 'land' | 'commercial'> = {
  'pisos': 'apartment',
  'piso': 'apartment',
  'apartamentos': 'apartment',
  'apartamento': 'apartment',
  'aticos': 'apartment',
  'atico': 'apartment',
  'duplexs': 'apartment',
  'duplex': 'apartment',
  'estudios': 'apartment',
  'estudio': 'apartment',
  'lofts': 'apartment',
  'loft': 'apartment',
  'casas': 'house',
  'casa': 'house',
  'chalets': 'house',
  'chalet': 'house',
  'casa_pareada': 'house',
  'casas_pareadas': 'house',
  'fincas_rusticas': 'house',
  'finca_rustica': 'house',
  'terrenos': 'land',
  'terreno': 'land',
  'parcelas': 'land',
  'parcela': 'land',
  'locales': 'commercial',
  'local': 'commercial',
  'naves': 'commercial',
  'nave': 'commercial',
  'oficinas': 'commercial',
  'oficina': 'commercial',
  'garajes': 'commercial',
  'garaje': 'commercial',
  'trasteros': 'commercial',
  'trastero': 'commercial',
  'edificios': 'commercial',
  'edificio': 'commercial',
};

export function detectCategoryFromSlug(slug: string): 'apartment' | 'house' | 'land' | 'commercial' {
  const normalized = slug.toLowerCase().replace(/-/g, '_');
  return SLUG_TO_CATEGORY[normalized] || 'apartment';
}

export function detectCategoryFromDetailUrl(url: string): 'apartment' | 'house' | 'land' | 'commercial' {
  // Detail URLs: /comprar/piso-location-id/ or /alquilar/casa-location-id/
  const match = url.match(/\/(?:comprar|alquilar)\/([a-z_]+)-/);
  if (match) {
    return detectCategoryFromSlug(match[1]);
  }
  return 'apartment';
}

/**
 * Property subtype detection from URL slug
 */
export function detectSubtypeFromSlug(slug: string): string | undefined {
  const map: Record<string, string> = {
    'atico': 'penthouse',
    'aticos': 'penthouse',
    'duplex': 'duplex',
    'duplexs': 'duplex',
    'estudio': 'studio',
    'estudios': 'studio',
    'loft': 'loft',
    'lofts': 'loft',
    'chalet': 'detached',
    'chalets': 'detached',
    'casa_pareada': 'semi_detached',
    'casas_pareadas': 'semi_detached',
    'finca_rustica': 'farmhouse',
    'fincas_rusticas': 'farmhouse',
  };
  return map[slug.toLowerCase().replace(/-/g, '_')];
}

/**
 * All search configurations for pisos.com
 */
export function getAllSearchConfigs(): SearchConfig[] {
  const configs: SearchConfig[] = [];

  const types = [
    { slug: 'pisos', category: 'apartment' as const, label: 'Apartments' },
    { slug: 'aticos', category: 'apartment' as const, label: 'Penthouses' },
    { slug: 'duplexs', category: 'apartment' as const, label: 'Duplexes' },
    { slug: 'estudios', category: 'apartment' as const, label: 'Studios' },
    { slug: 'casas', category: 'house' as const, label: 'Houses' },
    { slug: 'chalets', category: 'house' as const, label: 'Chalets' },
    { slug: 'fincas_rusticas', category: 'house' as const, label: 'Rural estates' },
    { slug: 'terrenos', category: 'land' as const, label: 'Land' },
    { slug: 'locales', category: 'commercial' as const, label: 'Commercial' },
    { slug: 'naves', category: 'commercial' as const, label: 'Warehouses' },
    { slug: 'oficinas', category: 'commercial' as const, label: 'Offices' },
  ];

  const transactions = [
    { slug: 'venta', type: 'sale' as const },
    { slug: 'alquiler', type: 'rent' as const },
  ];

  for (const t of types) {
    for (const tx of transactions) {
      configs.push({
        typeSlug: t.slug,
        transactionSlug: tx.slug,
        category: t.category,
        transactionType: tx.type,
        label: `${t.label} ${tx.type}`,
      });
    }
  }

  return configs;
}
