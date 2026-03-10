import { DanboligFactItem, DanboligParsedFacts } from '../types/danboligTypes';

/**
 * Parse the factsDesktop array from danbolig.dk API responses into structured values.
 *
 * Known fact names:
 *   Price         - "5.695.000 kr." or "3.500 kr./md." (rent)
 *   LivingAreaM2  - "145 m&sup2;"
 *   Rooms         - "5 rum"
 *   EnergyLabel   - "C", "A2015", "B"
 *   MonthlyPayment - "3.500 kr." (for rentals)
 */
export function parseFacts(facts: DanboligFactItem[]): DanboligParsedFacts {
  const result: DanboligParsedFacts = {};

  for (const fact of facts) {
    switch (fact.name) {
      case 'Price':
      case 'Købspris': {
        const price = parseDanishNumber(fact.value);
        if (price !== null) result.price = price;
        break;
      }
      case 'LivingAreaM2': {
        const area = parseDanishNumber(fact.value);
        if (area !== null) result.livingAreaM2 = area;
        break;
      }
      case 'Rooms': {
        const rooms = parseDanishNumber(fact.value);
        if (rooms !== null) result.rooms = rooms;
        break;
      }
      case 'EnergyLabel': {
        // Normalize energy label: "A2015" -> "A+", keep "A"–"G" as-is
        result.energyLabel = normalizeEnergyLabel(fact.value);
        break;
      }
      case 'MonthlyPayment': {
        const monthly = parseDanishNumber(fact.value);
        if (monthly !== null) result.monthlyPayment = monthly;
        break;
      }
    }
  }

  return result;
}

/**
 * Parse a Danish-formatted number string.
 * Handles: "5.695.000 kr.", "145 m&sup2;", "5 rum", "3.500"
 * Danish uses period as thousands separator, comma as decimal.
 */
export function parseDanishNumber(value: string): number | null {
  if (!value) return null;

  // Remove HTML entities, currency symbols, units
  const cleaned = value
    .replace(/&sup2;/g, '')
    .replace(/&[a-z]+;/gi, '')
    .replace(/kr\./gi, '')
    .replace(/\/md\./gi, '')
    .replace(/m2/gi, '')
    .replace(/rum/gi, '')
    .trim();

  // Remove periods used as thousands separators (Danish convention)
  // Replace comma decimal separator with period
  const normalized = cleaned
    .replace(/\./g, '')   // remove thousands separators
    .replace(',', '.')     // decimal separator
    .trim();

  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

/**
 * Normalize Danish energy labels to standard A/B/C/D/E/F/G format.
 * danbolig uses "A2015", "A2020", etc. for newer efficiency classes.
 */
function normalizeEnergyLabel(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim().toUpperCase();

  // Already a single letter A-G
  if (/^[A-G]$/.test(trimmed)) return trimmed;

  // "A2015" or "A2020" style -> normalize to "A"
  const match = trimmed.match(/^([A-G])\d{4}$/);
  if (match) return match[1];

  return trimmed;
}
