import { StandardProperty } from '../property';

/**
 * Australia specific property extensions
 */
export interface AustraliaPropertyExtensions {
  australia_land_size_sqm?: number;
  australia_council_rates_annual?: number;
}

/**
 * Complete Australia property type
 */
export type AustraliaProperty = StandardProperty & AustraliaPropertyExtensions;

/**
 * Type guard to check if property has Australia extensions
 */
export function isAustraliaProperty(property: StandardProperty): property is AustraliaProperty {
  return 'australia_land_size_sqm' in property || 'australia_council_rates_annual' in property;
}
