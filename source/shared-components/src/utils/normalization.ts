/**
 * Normalization Functions
 * Standardize country-specific property attributes
 */

/**
 * Normalize Czech disposition format (e.g., "2+kk", "3+1")
 * Returns standardized format or original value if invalid
 */
export function normalizeDisposition(disposition?: string): string | undefined {
  if (!disposition) return undefined;

  const trimmed = disposition.trim().toUpperCase();

  // Valid Czech disposition formats
  const validFormats = [
    '1+KK', '1+1',
    '2+KK', '2+1',
    '3+KK', '3+1',
    '4+KK', '4+1',
    '5+KK', '5+1',
    '6+KK', '6+1'
  ];

  // Return if valid format
  if (validFormats.includes(trimmed)) {
    return trimmed;
  }

  // Try to parse and standardize
  const match = trimmed.match(/^(\d)\+(.+)$/);
  if (match) {
    const number = match[1];
    const suffix = match[2].toUpperCase();
    if (suffix === 'KK' || suffix === '1') {
      return `${number}+${suffix}`;
    }
  }

  // Return original if can't normalize
  return disposition;
}

/**
 * Normalize Czech ownership types
 * "Osobní" (Personal), "Družstevní" (Cooperative), "Státní" (State)
 */
export function normalizeOwnership(ownership?: string): string | undefined {
  if (!ownership) return undefined;

  const trimmed = ownership.trim();
  const normalized = trimmed.toLowerCase();

  // Map variations to standard values
  const ownershipMap: Record<string, string> = {
    'osobní': 'Osobní',
    'personal': 'Osobní',
    'private': 'Osobní',
    'družstevní': 'Družstevní',
    'cooperative': 'Družstevní',
    'družstevna': 'Družstevní',
    'státní': 'Státní',
    'state': 'Státní',
    'government': 'Státní'
  };

  return ownershipMap[normalized] || trimmed;
}

/**
 * Normalize property condition
 * Standardize condition descriptions across different portals
 */
export function normalizeCondition(condition?: string): string | undefined {
  if (!condition) return undefined;

  const trimmed = condition.trim().toLowerCase();

  // Map various condition descriptions to standard values
  const conditionMap: Record<string, string> = {
    // New
    'new': 'new',
    'nový': 'new',
    'novostavba': 'new',
    'new_construction': 'new',
    'newly_built': 'new',

    // Excellent/Very Good
    'excellent': 'excellent',
    'výborný': 'excellent',
    'very_good': 'excellent',
    'very good': 'excellent',

    // Good
    'good': 'good',
    'dobrý': 'good',

    // Fair/Average
    'fair': 'fair',
    'average': 'fair',
    'průměrný': 'fair',
    'medium': 'fair',

    // Poor/Needs Renovation
    'poor': 'poor',
    'špatný': 'poor',
    'needs_renovation': 'poor',
    'needs renovation': 'poor',
    'renovace': 'poor',
    'reconstruction': 'poor',

    // Renovated
    'renovated': 'renovated',
    'renovovaný': 'renovated',
    'reconstructed': 'renovated'
  };

  return conditionMap[trimmed] || trimmed;
}

/**
 * Normalize furnished/equipped status
 * Maps portal-specific codes to standard values
 */
export function normalizeFurnished(furnished?: string): string | undefined {
  if (!furnished) return undefined;

  const trimmed = furnished.trim().toUpperCase();
  const normalized = trimmed.toLowerCase();

  // Map various furnished formats
  const furnishedMap: Record<string, string> = {
    // True values
    'equipped': 'furnished',
    'furnished': 'furnished',
    'yes': 'furnished',
    'vybavený': 'furnished',
    'vybavena': 'furnished',
    '1': 'furnished',
    'true': 'furnished',

    // False values
    'unfurnished': 'unfurnished',
    'no': 'unfurnished',
    'nevybavený': 'unfurnished',
    'nevybavena': 'unfurnished',
    '0': 'unfurnished',
    'false': 'unfurnished',

    // Partially furnished
    'partially': 'partially_furnished',
    'partially_furnished': 'partially_furnished',
    'částečně': 'partially_furnished',
    'částečně_vybavený': 'partially_furnished'
  };

  return furnishedMap[normalized] || normalized;
}

/**
 * Normalize energy rating/class
 * Maps various energy rating systems to standard format
 */
export function normalizeEnergyRating(rating?: string): string | undefined {
  if (!rating) return undefined;

  const trimmed = rating.trim().toUpperCase();

  // Czech PENB system: A, B, C, D, E, F, G
  const validRatings = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  if (validRatings.includes(trimmed)) {
    return trimmed;
  }

  // Handle Czech spellings or variations
  const normalized = trimmed.toLowerCase();
  const ratingMap: Record<string, string> = {
    'třída_a': 'A',
    'třída a': 'A',
    'class_a': 'A',
    'třída_b': 'B',
    'třída b': 'B',
    'class_b': 'B',
    'třída_c': 'C',
    'třída c': 'C',
    'class_c': 'C',
    'třída_d': 'D',
    'třída d': 'D',
    'class_d': 'D',
    'třída_e': 'E',
    'třída e': 'E',
    'class_e': 'E',
    'třída_f': 'F',
    'třída f': 'F',
    'class_f': 'F',
    'třída_g': 'G',
    'třída g': 'G',
    'class_g': 'G'
  };

  return ratingMap[normalized] || trimmed;
}

/**
 * Normalize heating type
 * Standardize various heating system descriptions
 */
export function normalizeHeatingType(heating?: string): string | undefined {
  if (!heating) return undefined;

  const trimmed = heating.trim();
  const normalized = trimmed.toLowerCase();

  // Map various heating types to standard values
  const heatingMap: Record<string, string> = {
    // Central heating
    'central': 'central_heating',
    'ústředné': 'central_heating',
    'ústředné_topení': 'central_heating',
    'central_heating': 'central_heating',

    // Individual heating
    'individual': 'individual_heating',
    'individuální': 'individual_heating',
    'individuální_topení': 'individual_heating',
    'individual_heating': 'individual_heating',

    // Boiler
    'boiler': 'boiler',
    'plynový_kotel': 'boiler',
    'plynový kotel': 'boiler',
    'gas_boiler': 'boiler',

    // Electric heating
    'electric': 'electric_heating',
    'elektrické': 'electric_heating',
    'elektrické_topení': 'electric_heating',
    'electric_heating': 'electric_heating',

    // Heat pump
    'heat_pump': 'heat_pump',
    'tepelné_čerpadlo': 'heat_pump',
    'tepelné čerpadlo': 'heat_pump',
    'heat pump': 'heat_pump',

    // Solar
    'solar': 'solar_heating',
    'solární': 'solar_heating',
    'solární_topení': 'solar_heating',
    'solar_heating': 'solar_heating',

    // Fireplace
    'fireplace': 'fireplace',
    'krb': 'fireplace',
    'krbová': 'fireplace',

    // No heating
    'none': 'none',
    'bez topení': 'none',
    'bez_topení': 'none'
  };

  return heatingMap[normalized] || trimmed;
}
