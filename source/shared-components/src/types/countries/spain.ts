import { StandardProperty } from '../property';

/**
 * Spain specific property extensions
 */
export interface SpainPropertyExtensions {
  spain_ibi_annual?: number;               // Annual property tax (IBI)
  spain_community_fees?: number;
  spain_cedula_habitabilidad?: boolean;     // Occupancy certificate
}

/**
 * Complete Spain property type
 */
export type SpainProperty = StandardProperty & SpainPropertyExtensions;

/**
 * Type guard to check if property has Spain extensions
 */
export function isSpainProperty(property: StandardProperty): property is SpainProperty {
  return 'spain_ibi_annual' in property || 'spain_community_fees' in property;
}
