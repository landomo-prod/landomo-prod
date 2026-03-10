import { StandardProperty } from '../property';

/**
 * United Kingdom specific property extensions
 */
export interface UKPropertyExtensions {
  uk_tenure?: 'freehold' | 'leasehold';
  uk_council_tax_band?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  uk_epc_rating?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  uk_leasehold_years_remaining?: number;
}

/**
 * Complete UK property type
 */
export type UKProperty = StandardProperty & UKPropertyExtensions;

/**
 * Type guard to check if property has UK extensions
 */
export function isUKProperty(property: StandardProperty): property is UKProperty {
  return 'uk_tenure' in property || 'uk_council_tax_band' in property;
}

/**
 * Council tax bands
 */
export const UK_COUNCIL_TAX_BANDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type UKCouncilTaxBand = typeof UK_COUNCIL_TAX_BANDS[number];

/**
 * Energy Performance Certificate ratings
 */
export const UK_EPC_RATINGS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export type UKEPCRating = typeof UK_EPC_RATINGS[number];

/**
 * Tenure types
 */
export const UK_TENURE_TYPES = ['freehold', 'leasehold'] as const;
export type UKTenure = typeof UK_TENURE_TYPES[number];
