/**
 * Category Detection Utility
 *
 * Detects property category (apartment/house/land) from Czech listing text.
 * Uses regex patterns for Czech real estate terminology.
 */

export type PropertyCategory = 'apartment' | 'house' | 'land';

/**
 * Detect property category from title and description
 *
 * Czech patterns:
 * - Apartment: "byt", "2+kk", "3+1", "garsoniera", "atypický byt"
 * - House: "rodinný dům", "RD", "vila", "chalupa", "chata"
 * - Land: "pozemek", "stavební parcela", "pole", "louka", "zahrada"
 *
 * @param title - Listing title
 * @param description - Listing description (optional)
 * @returns Property category
 */
export function detectPropertyCategory(
  title: string,
  description: string = ''
): PropertyCategory {
  const text = (title + ' ' + description).toLowerCase();

  // ========== LAND DETECTION (highest priority - most specific) ==========
  // Czech: "pozemek", "parcela", "stavební pozemek"
  const landPatterns = [
    /\bpozemek\b/i, // land/plot
    /\bparcela\b/i, // parcel
    /\bstavební pozemek\b/i, // building plot
    /\bstavební parcela\b/i, // building parcel
    /\bpole\b/i, // field (agricultural)
    /\blouka\b/i, // meadow
    /\bzahrada\b(?!\s+v\s+bytě)/i, // garden (but not "garden in apartment")
    /\borná půda\b/i, // arable land
    /\bvinice\b/i, // vineyard
    /\bsad\b/i, // orchard
  ];

  for (const pattern of landPatterns) {
    if (pattern.test(text)) {
      return 'land';
    }
  }

  // ========== HOUSE DETECTION (medium priority) ==========
  // Czech: "rodinný dům", "RD", "vila", "chalupa"
  const housePatterns = [
    /\brodinný dům\b/i, // family house
    /\b(?:rod\.?\s*dům|r\.?\s*d\.?)\b/i, // RD abbreviation
    /\bvila\b/i, // villa
    /\bchalupa\b/i, // cottage
    /\bchata\b/i, // cabin/cottage
    /\bdvoupodlažní\b/i, // two-story
    /\btřípodlažní\b/i, // three-story
    /\bpřízemní dům\b/i, // ground-floor house
    /\bzahrádkářská chatka\b/i, // garden cottage
    /\brekreační objekt\b/i, // recreational building
  ];

  for (const pattern of housePatterns) {
    if (pattern.test(text)) {
      return 'house';
    }
  }

  // ========== APARTMENT DETECTION (lowest priority - default) ==========
  // Czech: "byt", "2+kk", "3+1", "garsoniera"
  const apartmentPatterns = [
    /\bbyt\b/i, // apartment
    /\b\d+\s*\+\s*(?:kk|1)\b/i, // disposition: "2+kk", "3+1"
    /\bgarsoniera\b/i, // studio
    /\bgarsonka\b/i, // studio (informal)
    /\batypický byt\b/i, // atypical apartment
    /\bloft\b/i, // loft
    /\bmezonet\b/i, // maisonette
    /\bpodkroví\b/i, // attic apartment
  ];

  for (const pattern of apartmentPatterns) {
    if (pattern.test(text)) {
      return 'apartment';
    }
  }

  // ========== FALLBACK LOGIC ==========
  // If title contains disposition pattern (e.g., "2+kk"), default to apartment
  if (/\d+\s*\+\s*(?:kk|1)/.test(title)) {
    return 'apartment';
  }

  // Default to apartment (most common category on Bazos)
  return 'apartment';
}

/**
 * Get category confidence score (0-1)
 *
 * @param title - Listing title
 * @param description - Listing description (optional)
 * @returns Confidence score (0 = guessed, 1 = explicit match)
 */
export function getCategoryConfidence(
  title: string,
  description: string = ''
): number {
  const text = (title + ' ' + description).toLowerCase();
  const category = detectPropertyCategory(title, description);

  // Count matching patterns for detected category
  const patterns: Record<PropertyCategory, RegExp[]> = {
    land: [/\bpozemek\b/i, /\bparcela\b/i, /\bpole\b/i],
    house: [/\brodinný dům\b/i, /\bvila\b/i, /\bchalupa\b/i],
    apartment: [/\bbyt\b/i, /\b\d+\s*\+\s*(?:kk|1)\b/i, /\bgarsoniera\b/i],
  };

  const matches = patterns[category].filter((p) => p.test(text)).length;

  // Calculate confidence based on number of matches
  if (matches >= 2) return 1.0; // High confidence (multiple matches)
  if (matches === 1) return 0.8; // Medium confidence (single match)
  return 0.5; // Low confidence (fallback)
}

/**
 * Test category detection with sample titles
 */
export function testCategoryDetection(): void {
  const testCases: Array<{ title: string; expected: PropertyCategory }> = [
    { title: 'Prodej bytu 2+kk 54 m² Pardubice', expected: 'apartment' },
    { title: 'Prodej rodinného domu 5+1 Praha', expected: 'house' },
    { title: 'Prodej pozemku 1200 m² Brno', expected: 'land' },
    { title: 'RD 4+kk se zahradou', expected: 'house' },
    { title: 'Stavební parcela 800 m²', expected: 'land' },
    { title: 'Byt 3+1 s balkónem', expected: 'apartment' },
    { title: 'Chalupa v horách', expected: 'house' },
    { title: 'Pozemek k zastavění', expected: 'land' },
    { title: 'Garsoniera centrum', expected: 'apartment' },
    { title: 'Vila s bazénem', expected: 'house' },
  ];

  console.log('=== Category Detection Tests ===\n');

  let correct = 0;
  for (const test of testCases) {
    const detected = detectPropertyCategory(test.title);
    const confidence = getCategoryConfidence(test.title);
    const pass = detected === test.expected ? '✅' : '❌';

    console.log(`${pass} "${test.title}"`);
    console.log(`   Expected: ${test.expected}, Got: ${detected}, Confidence: ${confidence}`);

    if (detected === test.expected) correct++;
  }

  console.log(`\nAccuracy: ${correct}/${testCases.length} (${((correct / testCases.length) * 100).toFixed(1)}%)`);
}
