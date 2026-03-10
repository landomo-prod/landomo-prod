/**
 * Universal property_type classifier for land and commercial properties.
 *
 * Uses Czech title patterns to classify property sub-types.
 * Called during ingestion so ALL portals get consistent classification
 * without needing per-scraper logic.
 */

/**
 * Classify property_type from title and category.
 * Returns a sub-type string for land/commercial, or undefined for other categories.
 */
export function classifyPropertyType(title: string, category: string): string | undefined {
  if (category === 'land') return classifyLandType(title);
  if (category === 'commercial') return classifyCommercialType(title);
  return undefined;
}

function classifyLandType(title: string): string {
  const t = title.toLowerCase();

  if (t.includes('stavební')) return 'building_plot';
  if (t.includes('pole') || t.includes('orná')) return 'field';
  if (t.includes('zahrad')) return 'garden';
  // Match 'les' carefully: 'lesa', ' les ', 'Prodej lesa', but not 'lesy' in address context
  if (/\bles[ua]?\b/.test(t)) return 'forest';
  if (t.includes('komerční') && t.includes('pozemk')) return 'commercial_plot';
  if (t.includes('louk')) return 'meadow';
  if (t.includes('sad') || t.includes('vinic')) return 'orchard';
  if (t.includes('rybník') || t.includes('vodní')) return 'water';

  return 'other';
}

function classifyCommercialType(title: string): string {
  const t = title.toLowerCase();

  // Check 'virtuální kancelář' before general 'kancelář'
  if (t.includes('virtuální kancelář')) return 'virtual_office';
  if (t.includes('kancelář') || t.includes('kancelar') || t.includes('kanceláře')) return 'office';
  if (t.includes('sklad')) return 'warehouse';
  if (t.includes('obchod')) return 'retail';
  if (t.includes('výrob') || t.includes('haly') || t.includes('halu')) return 'production';
  if (t.includes('restaur')) return 'restaurant';
  if (t.includes('ubytovací') || t.includes('hotel') || t.includes('penzion')) return 'accommodation';
  if (t.includes('činžovní')) return 'apartment_building';
  if (t.includes('ordinac')) return 'medical_office';
  if (t.includes('zemědělský')) return 'agricultural';

  return 'other';
}
