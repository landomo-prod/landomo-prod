import { StandardProperty } from '../property';

/**
 * France specific property extensions
 */
export interface FrancePropertyExtensions {
  france_dpe_rating?: string;           // Energy performance diagnostic (A-G)
  france_ges_rating?: string;           // Greenhouse gas rating (A-G)
  france_copropriete?: boolean;         // Co-ownership building
}

/**
 * Complete France property type
 */
export type FranceProperty = StandardProperty & FrancePropertyExtensions;

/**
 * Type guard to check if property has France extensions
 */
export function isFranceProperty(property: StandardProperty): property is FranceProperty {
  return 'france_dpe_rating' in property || 'france_ges_rating' in property;
}

/**
 * DPE (Energy) and GES (Greenhouse) ratings
 */
export const FRANCE_ENERGY_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type FranceEnergyRating = typeof FRANCE_ENERGY_RATINGS[number];
