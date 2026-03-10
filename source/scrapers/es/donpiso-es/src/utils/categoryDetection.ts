/**
 * Category detection for donpiso.com property types
 *
 * Donpiso is a single agency chain covering pisos/casas/locales.
 * Property type is extracted from the listing title and URL slug.
 */

const SLUG_TO_CATEGORY: Record<string, 'apartment' | 'house' | 'land' | 'commercial'> = {
  'piso': 'apartment',
  'pisos': 'apartment',
  'apartamento': 'apartment',
  'apartamentos': 'apartment',
  'atico': 'apartment',
  'aticos': 'apartment',
  'duplex': 'apartment',
  'duplexs': 'apartment',
  'estudio': 'apartment',
  'estudios': 'apartment',
  'loft': 'apartment',
  'lofts': 'apartment',
  'planta_baja': 'apartment',
  'casa': 'house',
  'casas': 'house',
  'chalet': 'house',
  'chalets': 'house',
  'casa_adosada': 'house',
  'casas_adosadas': 'house',
  'adosado': 'house',
  'adosados': 'house',
  'pareado': 'house',
  'pareados': 'house',
  'unifamiliar': 'house',
  'villa': 'house',
  'finca': 'house',
  'finca_rustica': 'house',
  'terreno': 'land',
  'terrenos': 'land',
  'parcela': 'land',
  'solar': 'land',
  'local': 'commercial',
  'locales': 'commercial',
  'local_comercial': 'commercial',
  'nave': 'commercial',
  'naves': 'commercial',
  'oficina': 'commercial',
  'oficinas': 'commercial',
  'garaje': 'commercial',
  'trastero': 'commercial',
  'edificio': 'commercial',
};

export function detectCategoryFromSlug(slug: string): 'apartment' | 'house' | 'land' | 'commercial' {
  const normalized = slug.toLowerCase().replace(/[-\s]/g, '_');
  return SLUG_TO_CATEGORY[normalized] || 'apartment';
}

/**
 * Detect category from listing title
 * e.g., "Piso en venta en Madrid" → 'apartment'
 *       "Casa adosada en venta" → 'house'
 *       "Local comercial en alquiler" → 'commercial'
 */
export function detectCategoryFromTitle(title: string): 'apartment' | 'house' | 'land' | 'commercial' {
  const t = title.toLowerCase();

  // Commercial first (more specific)
  if (t.includes('local') || t.includes('nave') || t.includes('oficina') ||
      t.includes('garaje') || t.includes('trastero') || t.includes('edificio')) {
    return 'commercial';
  }

  // Land
  if (t.includes('terreno') || t.includes('parcela') || t.includes('solar')) {
    return 'land';
  }

  // House types
  if (t.includes('casa') || t.includes('chalet') || t.includes('adosada') ||
      t.includes('adosado') || t.includes('pareado') || t.includes('unifamiliar') ||
      t.includes('villa') || t.includes('finca')) {
    return 'house';
  }

  // Apartment types (default for pisos, apartamentos, ático, dúplex, etc.)
  return 'apartment';
}

/**
 * Detect property subtype from title
 */
export function detectSubtypeFromTitle(title: string): string | undefined {
  const t = title.toLowerCase();

  if (t.includes('ático') || t.includes('atico')) return 'penthouse';
  if (t.includes('dúplex') || t.includes('duplex')) return 'duplex';
  if (t.includes('estudio')) return 'studio';
  if (t.includes('loft')) return 'loft';
  if (t.includes('planta baja')) return 'ground_floor';
  if (t.includes('adosada') || t.includes('adosado')) return 'terraced';
  if (t.includes('pareado')) return 'semi_detached';
  if (t.includes('chalet')) return 'detached';
  if (t.includes('unifamiliar')) return 'detached';
  if (t.includes('villa')) return 'villa';
  if (t.includes('finca rústica') || t.includes('finca rustica')) return 'farmhouse';

  return undefined;
}

/**
 * Detect transaction type from URL path
 */
export function detectTransactionType(url: string): 'sale' | 'rent' {
  if (url.includes('alquiler') || url.includes('alquilar') || url.includes('en-alquiler')) {
    return 'rent';
  }
  return 'sale';
}

/**
 * Extract property type slug from listing title for use in category detection
 */
export function extractPropertyTypeSlug(title: string): string {
  const t = title.toLowerCase();
  if (t.startsWith('piso')) return 'piso';
  if (t.startsWith('apartamento')) return 'apartamento';
  if (t.startsWith('ático') || t.startsWith('atico')) return 'atico';
  if (t.startsWith('dúplex') || t.startsWith('duplex')) return 'duplex';
  if (t.startsWith('estudio')) return 'estudio';
  if (t.startsWith('loft')) return 'loft';
  if (t.startsWith('planta baja')) return 'planta_baja';
  if (t.startsWith('casa adosada') || t.startsWith('adosado')) return 'casa_adosada';
  if (t.startsWith('chalet') || t.startsWith('casa pareada') || t.startsWith('pareado')) return 'chalet';
  if (t.startsWith('casa') || t.startsWith('unifamiliar')) return 'casa';
  if (t.startsWith('finca')) return 'finca';
  if (t.startsWith('villa')) return 'villa';
  if (t.startsWith('terreno')) return 'terreno';
  if (t.startsWith('parcela')) return 'parcela';
  if (t.startsWith('solar')) return 'solar';
  if (t.startsWith('local')) return 'local';
  if (t.startsWith('nave')) return 'nave';
  if (t.startsWith('oficina')) return 'oficina';
  if (t.startsWith('garaje')) return 'garaje';
  if (t.startsWith('trastero')) return 'trastero';
  if (t.startsWith('edificio')) return 'edificio';
  return 'piso';
}
