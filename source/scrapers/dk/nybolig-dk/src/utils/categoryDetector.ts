import { NyboligCase, LandomoCategory, TYPE_TO_CATEGORY } from '../types/nyboligTypes';

/**
 * Detect Landomo category from a nybolig case.
 * Uses the `type` field from the API response first, then falls back to URL slug parsing.
 */
export function detectCategory(caseData: NyboligCase): LandomoCategory {
  // Try direct type match
  const typeMatch = TYPE_TO_CATEGORY[caseData.type];
  if (typeMatch) return typeMatch;

  // Fallback: parse from URL slug (e.g. /ejerlejlighed/... /villa/... /helaarsgrund/...)
  const urlPart = caseData.url.split('/')[1]?.toLowerCase() ?? '';
  if (urlPart.includes('lejlighed') || urlPart.includes('andel') || urlPart.includes('villalejlighed')) {
    return 'apartment';
  }
  if (urlPart.includes('villa') || urlPart.includes('raekkehus') || urlPart.includes('fritidshus') ||
      urlPart.includes('sommerhus') || urlPart.includes('landejendom') || urlPart.includes('liebhaveri')) {
    return 'house';
  }
  if (urlPart.includes('grund')) {
    return 'land';
  }
  if (urlPart.includes('erhverv')) {
    return 'commercial';
  }

  // Default unknown to house (most common)
  return 'house';
}
