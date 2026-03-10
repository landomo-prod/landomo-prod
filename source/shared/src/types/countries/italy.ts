import { StandardProperty } from '../property';

/**
 * Italy specific property extensions
 */
export interface ItalyPropertyExtensions {
  italy_cadastral_category?: string;
  italy_cadastral_income?: number;
}

/**
 * Complete Italy property type
 */
export type ItalyProperty = StandardProperty & ItalyPropertyExtensions;

/**
 * Type guard to check if property has Italy extensions
 */
export function isItalyProperty(property: StandardProperty): property is ItalyProperty {
  return 'italy_cadastral_category' in property || 'italy_cadastral_income' in property;
}
