import { StandardProperty } from '../property';

/**
 * United States specific property extensions
 */
export interface USAPropertyExtensions {
  usa_lot_size_sqft?: number;
  usa_hoa_name?: string;
  usa_mls_number?: string;
  usa_property_tax_annual?: number;
  usa_parcel_number?: string;
}

/**
 * Complete USA property type
 */
export type USAProperty = StandardProperty & USAPropertyExtensions;

/**
 * Type guard to check if property has USA extensions
 */
export function isUSAProperty(property: StandardProperty): property is USAProperty {
  return 'usa_lot_size_sqft' in property || 'usa_mls_number' in property;
}
