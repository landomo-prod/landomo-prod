/**
 * LLM Extraction Prompt Template for Bazos Real Estate Listings
 *
 * Designed for Azure AI Foundry with DeepSeek-V3
 * Uses forced JSON mode for structured extraction
 */

import { LLMExtractedProperty } from '../types/llmExtraction';

/**
 * JSON schema for forced JSON mode
 * This defines the exact structure the LLM must output
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  properties: {
    property_type: {
      type: 'string',
      enum: ['apartment', 'house', 'villa', 'studio', 'land', 'commercial', 'garage', 'other'],
      description: 'Type of property'
    },
    transaction_type: {
      type: 'string',
      enum: ['sale', 'rent'],
      description: 'Sale or rental listing'
    },
    price: {
      type: 'number',
      description: 'Numeric price value'
    },
    price_note: {
      type: 'string',
      description: 'Price notes like "dohodou", "na vyžádání"'
    },
    location: {
      type: 'object',
      properties: {
        city: { type: 'string' },
        region: { type: 'string' },
        postal_code: { type: 'string' },
        district: { type: 'string' },
        street: { type: 'string' }
      }
    },
    details: {
      type: 'object',
      properties: {
        bedrooms: { type: 'number', description: 'Number of bedrooms' },
        bathrooms: { type: 'number', description: 'Number of bathrooms' },
        area_sqm: { type: 'number', description: 'Living area in m²' },
        area_total_sqm: { type: 'number', description: 'Total area in m²' },
        area_plot_sqm: { type: 'number', description: 'Plot/land area in m²' },
        floor: { type: 'number', description: 'Floor number (0=ground floor)' },
        total_floors: { type: 'number', description: 'Total floors in building' },
        rooms: { type: 'number', description: 'Total room count' },
        year_built: { type: 'number', description: 'Year of construction' },
        renovation_year: { type: 'number', description: 'Year of last renovation' },
        parking_spaces: { type: 'number', description: 'Number of parking spaces' }
      }
    },
    czech_specific: {
      type: 'object',
      properties: {
        disposition: {
          type: 'string',
          enum: ['1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+kk', '5+1', '6+kk', '6+1', '7+kk', '7+1', 'atypical'],
          description: 'Czech room layout (disposition)'
        },
        ownership: {
          type: 'string',
          enum: ['personal', 'cooperative', 'state', 'other'],
          description: 'Ownership type'
        },
        condition: {
          type: 'string',
          enum: ['new', 'excellent', 'very_good', 'good', 'after_renovation', 'before_renovation', 'requires_renovation', 'project', 'under_construction'],
          description: 'Property condition'
        },
        furnished: {
          type: 'string',
          enum: ['furnished', 'partially_furnished', 'not_furnished'],
          description: 'Furnished status'
        },
        energy_rating: {
          type: 'string',
          enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
          description: 'Energy rating (PENB)'
        },
        heating_type: {
          type: 'string',
          enum: ['central_heating', 'individual_heating', 'electric_heating', 'gas_heating', 'water_heating', 'heat_pump', 'other'],
          description: 'Type of heating system'
        },
        construction_type: {
          type: 'string',
          enum: ['panel', 'brick', 'stone', 'wood', 'concrete', 'mixed', 'other'],
          description: 'Building construction material'
        },
        building_type: { type: 'string', description: 'Specific building type description' },
        area_balcony: { type: 'number', description: 'Balcony area in m²' },
        area_terrace: { type: 'number', description: 'Terrace area in m²' },
        area_loggia: { type: 'number', description: 'Loggia area in m²' },
        area_cellar: { type: 'number', description: 'Cellar area in m²' },
        area_garden: { type: 'number', description: 'Garden area in m²' },
        water_supply: { type: 'string', description: 'Water supply type' },
        sewage_type: { type: 'string', description: 'Sewage system type' },
        gas_supply: { type: 'boolean', description: 'Gas connection available' },
        electricity_supply: { type: 'boolean', description: 'Electricity available' },
        rental_period: {
          type: 'string',
          enum: ['short_term', 'long_term', 'seasonal', 'occasional'],
          description: 'Rental period type'
        },
        deposit: { type: 'number', description: 'Security deposit amount' },
        monthly_price: { type: 'number', description: 'Monthly rent' },
        utility_charges: { type: 'number', description: 'Monthly utility costs' }
      }
    },
    amenities: {
      type: 'object',
      properties: {
        has_parking: { type: 'boolean' },
        has_garage: { type: 'boolean' },
        has_garden: { type: 'boolean' },
        has_balcony: { type: 'boolean' },
        has_terrace: { type: 'boolean' },
        has_basement: { type: 'boolean' },
        has_elevator: { type: 'boolean' },
        has_pool: { type: 'boolean' },
        has_fireplace: { type: 'boolean' },
        has_sauna: { type: 'boolean' },
        has_gym: { type: 'boolean' },
        has_ac: { type: 'boolean' },
        has_wifi: { type: 'boolean' },
        has_security: { type: 'boolean' },
        has_storage: { type: 'boolean' },
        has_loggia: { type: 'boolean' },
        has_hot_water: { type: 'boolean' },
        is_barrier_free: { type: 'boolean' },
        is_pet_friendly: { type: 'boolean' },
        is_low_energy: { type: 'boolean' },
        is_renovated: { type: 'boolean' },
        is_furnished: { type: 'boolean' }
      }
    },
    extraction_metadata: {
      type: 'object',
      properties: {
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Confidence level in extraction accuracy'
        },
        missing_fields: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields that could not be extracted'
        },
        assumptions: {
          type: 'array',
          items: { type: 'string' },
          description: 'Assumptions made during extraction'
        },
        original_text_snippet: {
          type: 'string',
          description: 'First 200 characters of original text'
        }
      },
      required: ['confidence']
    }
  },
  required: ['property_type', 'transaction_type', 'extraction_metadata']
};

/**
 * System prompt for LLM extraction
 */
export const SYSTEM_PROMPT = `You are a specialized real estate data extraction assistant for Czech and Slovak property listings.

Your task is to extract structured property information from unstructured listing text (titles and descriptions from Bazos.cz and similar platforms).

IMPORTANT GUIDELINES:

1. **Language**: Understand Czech and Slovak real estate terminology
2. **Disposition Mapping**:
   - "byt 2+kk" → disposition: "2+kk", property_type: "apartment"
   - "3+1" → disposition: "3+1"
   - "garsonka" → disposition: "1+kk", property_type: "studio"
   - "rodinný dům" → property_type: "house"
   - "pozemek" → property_type: "land"

3. **Price Extraction**:
   - "195.000 Kč" → price: 195000
   - "cena dohodou" → price_note: "dohodou"
   - "pronájem 12.000 Kč/měsíc" → transaction_type: "rent", monthly_price: 12000

4. **Area Conversion**:
   - Always extract areas in m² (square meters)
   - "54 m²" → area_sqm: 54
   - "pozemek 600 m²" → area_plot_sqm: 600

5. **Czech-Specific Terms**:
   - "panelák" / "panelový dům" → construction_type: "panel"
   - "cihlový" → construction_type: "brick"
   - "nízkoenergetický" → is_low_energy: true
   - "bezbariérový" → is_barrier_free: true
   - "sklep" → has_basement: true
   - "výtah" → has_elevator: true
   - "balkon" → has_balcony: true
   - "terasa" → has_terrace: true
   - "garáž" / "parkování" → has_parking: true

6. **Condition Mapping**:
   - "novostavba" → condition: "new"
   - "výborný stav" → condition: "excellent"
   - "po rekonstrukci" → condition: "after_renovation"
   - "před rekonstrukcí" → condition: "before_renovation"
   - "nutná rekonstrukce" → condition: "requires_renovation"

7. **Ownership**:
   - "osobní vlastnictví" → ownership: "personal"
   - "družstevní vlastnictví" → ownership: "cooperative"

8. **Confidence Levels**:
   - high: Most key fields extracted, clear terminology
   - medium: Some key fields missing or ambiguous
   - low: Minimal information, significant uncertainty

9. **Missing Fields**: If a field cannot be determined, omit it. Do NOT make up values.

10. **Floor Numbers**: Use 0 for ground floor, 1 for first floor above ground, etc.

Output ONLY valid JSON matching the schema. No additional commentary.`;

/**
 * Few-shot examples for better extraction accuracy
 */
export const FEW_SHOT_EXAMPLES = [
  {
    input: `Prodej bytu 2+kk 54 m²
Pardubice - Zelené Předměstí
Cena: 3.450.000 Kč
Prodej bytu 2+kk o velikosti 54 m² v osobním vlastnictví, Pardubice - Zelené Předměstí.
Byt se nachází ve 3. patře panelového domu s výtahem. Po kompletní rekonstrukci.
Plastová okna, plovoucí podlahy, koupelna s vanou a WC. Sklep. Nízké náklady.`,
    output: {
      property_type: 'apartment',
      transaction_type: 'sale',
      price: 3450000,
      location: {
        city: 'Pardubice',
        district: 'Zelené Předměstí'
      },
      details: {
        area_sqm: 54,
        floor: 3,
        bathrooms: 1
      },
      czech_specific: {
        disposition: '2+kk',
        ownership: 'personal',
        condition: 'after_renovation',
        construction_type: 'panel'
      },
      amenities: {
        has_elevator: true,
        has_basement: true,
        is_renovated: true
      },
      extraction_metadata: {
        confidence: 'high',
        original_text_snippet: 'Prodej bytu 2+kk 54 m² Pardubice - Zelené Předměstí Cena: 3.450.000 Kč Prodej bytu 2+kk o velikosti 54 m² v osobním vlastnictví, Pardubice - Zelené Předměstí. Byt se nachází ve 3. p...'
      }
    }
  },
  {
    input: `Pronájem bytu 3+1, 72 m²
Praha 4 - Nusle
Cena: 18.500 Kč/měsíc + energie
Nabízím k pronájmu prostorný byt 3+1 v cihlovém domě.
2. patro, balkon 4 m², sklep. Částečně vybavený.
Klidná lokalita, dostupná MHD.`,
    output: {
      property_type: 'apartment',
      transaction_type: 'rent',
      location: {
        city: 'Praha 4',
        district: 'Nusle'
      },
      details: {
        area_sqm: 72,
        floor: 2
      },
      czech_specific: {
        disposition: '3+1',
        construction_type: 'brick',
        furnished: 'partially_furnished',
        monthly_price: 18500,
        area_balcony: 4
      },
      amenities: {
        has_balcony: true,
        has_basement: true
      },
      extraction_metadata: {
        confidence: 'high',
        original_text_snippet: 'Pronájem bytu 3+1, 72 m² Praha 4 - Nusle Cena: 18.500 Kč/měsíc + energie Nabízím k pronájmu prostorný byt 3+1 v cihlovém domě. 2. patro, balkon 4 m², sklep. Částečně vybavený. Klidná loka...'
      }
    }
  },
  {
    input: `Prodej RD 5+1, pozemek 800 m²
Brno - venkov
Cena dohodou
Rodinný dům 5+1 se zahradou. Cihlový. Podsklepený. Garáž.
Nutná rekonstrukce. Studna, septik.`,
    output: {
      property_type: 'house',
      transaction_type: 'sale',
      price_note: 'dohodou',
      location: {
        region: 'Brno - venkov'
      },
      details: {
        area_plot_sqm: 800
      },
      czech_specific: {
        disposition: '5+1',
        construction_type: 'brick',
        condition: 'requires_renovation',
        water_supply: 'well',
        sewage_type: 'septic'
      },
      amenities: {
        has_garage: true,
        has_basement: true,
        has_garden: true
      },
      extraction_metadata: {
        confidence: 'medium',
        missing_fields: ['area_sqm', 'year_built'],
        original_text_snippet: 'Prodej RD 5+1, pozemek 800 m² Brno - venkov Cena dohodou Rodinný dům 5+1 se zahradou. Cihlový. Podsklepený. Garáž. Nutná rekonstrukce. Studna, septik.'
      }
    }
  },
  {
    input: `Garsonka 28 m², Praha 10
2.850.000 Kč
Novostavba - kolaudace 2023. Cihlový dům.
5. patro s výtahem. Lodžie 3 m². Sklep.
Osobní vlastnictví. Energetická třída B.`,
    output: {
      property_type: 'studio',
      transaction_type: 'sale',
      price: 2850000,
      location: {
        city: 'Praha 10'
      },
      details: {
        area_sqm: 28,
        floor: 5,
        year_built: 2023
      },
      czech_specific: {
        disposition: '1+kk',
        ownership: 'personal',
        condition: 'new',
        construction_type: 'brick',
        energy_rating: 'b',
        area_loggia: 3
      },
      amenities: {
        has_elevator: true,
        has_loggia: true,
        has_basement: true
      },
      extraction_metadata: {
        confidence: 'high',
        original_text_snippet: 'Garsonka 28 m², Praha 10 2.850.000 Kč Novostavba - kolaudace 2023. Cihlový dům. 5. patro s výtahem. Lodžie 3 m². Sklep. Osobní vlastnictví. Energetická třída B.'
      }
    }
  },
  {
    input: `Pozemek 1200 m² - Stavba RD
Mladá Boleslav
890.000 Kč
Rovinatý stavební pozemek. Přípojky IS na hranici pozemku.
Elektřina, voda, plyn. Skvělá lokalita.`,
    output: {
      property_type: 'land',
      transaction_type: 'sale',
      price: 890000,
      location: {
        city: 'Mladá Boleslav'
      },
      details: {
        area_plot_sqm: 1200
      },
      czech_specific: {
        water_supply: 'mains',
        gas_supply: true,
        electricity_supply: true
      },
      amenities: {},
      extraction_metadata: {
        confidence: 'high',
        original_text_snippet: 'Pozemek 1200 m² - Stavba RD Mladá Boleslav 890.000 Kč Rovinatý stavební pozemek. Přípojky IS na hranici pozemku. Elektřina, voda, plyn. Skvělá lokalita.'
      }
    }
  }
];

/**
 * Build the complete extraction prompt
 */
export function buildExtractionPrompt(listingText: string): string {
  const examplesText = FEW_SHOT_EXAMPLES.map((ex, idx) =>
    `Example ${idx + 1}:
INPUT:
${ex.input}

OUTPUT:
${JSON.stringify(ex.output, null, 2)}
`
  ).join('\n\n');

  return `${SYSTEM_PROMPT}

Here are examples of correct extractions:

${examplesText}

Now extract structured data from the following listing:

INPUT:
${listingText}

OUTPUT (JSON only):`;
}

/**
 * Build user message for extraction
 */
export function buildUserMessage(listingText: string): string {
  return `Extract structured property data from this Czech/Slovak real estate listing:

${listingText}`;
}

/**
 * Validate extracted data structure
 */
export function validateExtraction(data: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!data.property_type) {
    errors.push('Missing required field: property_type');
  }
  if (!data.transaction_type) {
    errors.push('Missing required field: transaction_type');
  }
  if (!data.extraction_metadata?.confidence) {
    errors.push('Missing required field: extraction_metadata.confidence');
  }

  // Type validations
  const validPropertyTypes = ['apartment', 'house', 'villa', 'studio', 'land', 'commercial', 'garage', 'other'];
  if (data.property_type && !validPropertyTypes.includes(data.property_type)) {
    errors.push(`Invalid property_type: ${data.property_type}`);
  }

  const validTransactionTypes = ['sale', 'rent'];
  if (data.transaction_type && !validTransactionTypes.includes(data.transaction_type)) {
    errors.push(`Invalid transaction_type: ${data.transaction_type}`);
  }

  // Numeric validations
  if (data.price !== undefined && (typeof data.price !== 'number' || data.price < 0)) {
    errors.push('Price must be a positive number');
  }

  if (data.details?.area_sqm !== undefined && (typeof data.details.area_sqm !== 'number' || data.details.area_sqm <= 0)) {
    errors.push('area_sqm must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
