/**
 * LLM Extraction Types - Bazos Real Estate Listings
 *
 * TypeScript interfaces for structured data extraction from unstructured
 * Bazos real estate listings using Azure AI Foundry with DeepSeek-V3.
 *
 * Designed to map Czech/Slovak real estate terminology to StandardProperty format.
 */

import { CzechSpecificFields } from '@landomo/core';

/**
 * Core extracted property data from LLM
 * This is the target structure for forced JSON mode
 */
export interface LLMExtractedProperty {
  // ========== BASIC INFO ==========
  property_type: PropertyType;
  transaction_type: TransactionType;
  price?: number;
  price_note?: string; // For "dohodou", "na vyžádání", etc.

  // ========== LOCATION ==========
  location: {
    city?: string;
    region?: string;
    postal_code?: string;
    district?: string;
    street?: string;
  };

  // ========== CORE DETAILS ==========
  details: {
    bedrooms?: number;
    bathrooms?: number;
    area_sqm?: number; // Living area
    area_total_sqm?: number;
    area_plot_sqm?: number; // Land/garden area
    floor?: number;
    total_floors?: number;
    rooms?: number; // Total rooms
    year_built?: number;
    renovation_year?: number;
    parking_spaces?: number;
  };

  // ========== CZECH-SPECIFIC FIELDS ==========
  czech_specific: {
    // Room layout (Czech disposition)
    disposition?: CzechDisposition;

    // Ownership type
    ownership?: CzechOwnership;

    // Condition
    condition?: PropertyCondition;

    // Furnished status
    furnished?: FurnishedStatus;

    // Energy rating (PENB)
    energy_rating?: EnergyRating;

    // Heating type
    heating_type?: HeatingType;

    // Construction type
    construction_type?: ConstructionType;

    // Building type details
    building_type?: string;

    // Areas breakdown
    area_balcony?: number;
    area_terrace?: number;
    area_loggia?: number;
    area_cellar?: number;
    area_garden?: number;

    // Infrastructure
    water_supply?: string;
    sewage_type?: string;
    gas_supply?: boolean;
    electricity_supply?: boolean;

    // Rental-specific
    rental_period?: RentalPeriod;
    deposit?: number;
    monthly_price?: number;
    utility_charges?: number;
  };

  // ========== AMENITIES ==========
  amenities: {
    has_parking?: boolean;
    has_garage?: boolean;
    has_garden?: boolean;
    has_balcony?: boolean;
    has_terrace?: boolean;
    has_basement?: boolean;
    has_elevator?: boolean;
    has_pool?: boolean;
    has_fireplace?: boolean;
    has_sauna?: boolean;
    has_gym?: boolean;
    has_ac?: boolean;
    has_wifi?: boolean;
    has_security?: boolean;
    has_storage?: boolean;
    has_loggia?: boolean;
    has_hot_water?: boolean;
    is_barrier_free?: boolean;
    is_pet_friendly?: boolean;
    is_low_energy?: boolean;
    is_renovated?: boolean;
    is_furnished?: boolean;
  };

  // ========== METADATA ==========
  extraction_metadata: {
    confidence: 'high' | 'medium' | 'low';
    missing_fields?: string[]; // Fields that couldn't be extracted
    assumptions?: string[]; // Any assumptions made during extraction
    original_text_snippet?: string; // First 200 chars for debugging
  };
}

/**
 * Property type enumeration
 */
export type PropertyType =
  | 'apartment'      // byt
  | 'house'          // dům, rodinný dům
  | 'villa'          // vila
  | 'studio'         // garsonka, studio
  | 'land'           // pozemek
  | 'commercial'     // komerční
  | 'garage'         // garáž
  | 'other';

/**
 * Transaction type
 */
export type TransactionType = 'sale' | 'rent';

/**
 * Czech disposition (room layout)
 */
export type CzechDisposition =
  | '1+kk'  // 1 room + kitchenette
  | '1+1'   // 1 room + separate kitchen
  | '2+kk'
  | '2+1'
  | '3+kk'
  | '3+1'
  | '4+kk'
  | '4+1'
  | '5+kk'
  | '5+1'
  | '6+kk'
  | '6+1'
  | '7+kk'
  | '7+1'
  | 'atypical'; // Non-standard layout

/**
 * Czech ownership type
 */
export type CzechOwnership =
  | 'personal'      // Osobní vlastnictví
  | 'cooperative'   // Družstevní vlastnictví
  | 'state'         // Státní/obecní
  | 'other';

/**
 * Property condition
 */
export type PropertyCondition =
  | 'new'                    // Novostavba
  | 'excellent'              // Výborný stav
  | 'very_good'              // Velmi dobrý stav
  | 'good'                   // Dobrý stav
  | 'after_renovation'       // Po rekonstrukci
  | 'before_renovation'      // Před rekonstrukcí
  | 'requires_renovation'    // Nutná rekonstrukce
  | 'project'                // Projekt
  | 'under_construction';    // Výstavba

/**
 * Furnished status
 */
export type FurnishedStatus =
  | 'furnished'              // Vybaveno
  | 'partially_furnished'    // Částečně vybaveno
  | 'not_furnished';         // Nevybaveno

/**
 * Energy rating (PENB Czech standard)
 */
export type EnergyRating = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

/**
 * Heating type
 */
export type HeatingType =
  | 'central_heating'        // Ústřední topení
  | 'individual_heating'     // Individuální topení
  | 'electric_heating'       // Elektrické topení
  | 'gas_heating'            // Plynové topení
  | 'water_heating'          // Teplá voda
  | 'heat_pump'              // Tepelné čerpadlo
  | 'other';

/**
 * Construction type
 */
export type ConstructionType =
  | 'panel'      // Panelový
  | 'brick'      // Cihlový
  | 'stone'      // Zděný
  | 'wood'       // Dřevěný
  | 'concrete'   // Betonový
  | 'mixed'      // Smíšená stavba
  | 'other';

/**
 * Rental period
 */
export type RentalPeriod =
  | 'short_term'   // Krátkodobý pronájem
  | 'long_term'    // Dlouhodobý pronájem
  | 'seasonal'     // Sezónní
  | 'occasional';  // Příležitostný

/**
 * Validation result for extracted data
 */
export interface ExtractionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Complete extraction result with validation
 */
export interface ExtractionResult {
  data: LLMExtractedProperty;
  validation: ExtractionValidation;
  rawResponse?: string; // Original LLM response for debugging
  tokensUsed?: number;
  processingTimeMs?: number;
}

/**
 * Extraction request metadata
 */
export interface ExtractionRequest {
  listingText: string;
  listingId: string;
  country: string;
  portal: string;
  maxTokens?: number;
  temperature?: number;
}
