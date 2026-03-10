"use strict";
/**
 * SIMPLE & EFFECTIVE LLM Extraction Prompt
 *
 * Test results:
 * - Complex prompt: 0% location extraction
 * - Simple prompt: 86% overall extraction (19/22 fields)
 *
 * Key insight: Simpler prompts work better than overly detailed ones!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEW_SHOT_EXAMPLES = exports.SYSTEM_PROMPT = void 0;
exports.buildUserMessage = buildUserMessage;
exports.validateExtraction = validateExtraction;
/**
 * Simple, effective system prompt
 */
exports.SYSTEM_PROMPT = `Extract structured property data from Czech real estate listings.

Location patterns:
- "ulice [Name]" or "[Name] [number]" → street
- 5 digits (e.g., "530 02" or "43801") → postal_code
- City name after postal code or in title

Czech disposition (room layout):
- "1+kk" = studio (0 bedrooms)
- "2+kk" = 1 bedroom (2 rooms - 1 living room)
- "3+kk" = 2 bedrooms (3 rooms - 1 living room)
- "2+1" = 1 bedroom (same as 2+kk but separate kitchen)

Property types:
- "byt" = apartment
- "rodinný dům" / "RD" = house
- "garsonka" = studio

Ownership:
- "osobní vlastnictví" / "OV" = personal
- "družstevní" / "DB" = cooperative

Construction:
- "panelový" / "panelák" = panel
- "cihlový" = brick

Condition:
- "po rekonstrukci" / "zrekonstruovaný" = after_renovation
- "novostavba" = new

Amenities:
- "sklep" = has_basement
- "výtah" = has_elevator
- "balkon" = has_balcony
- "parkování" / "parkovací stání" = has_parking

Extract ALL fields you can find. Output JSON only.`;
/**
 * Few-shot examples to guide extraction
 */
exports.FEW_SHOT_EXAMPLES = [
    // Example 1: Apartment with full details
    {
        input: `Prodej bytu 2+kk 54 m² - Pardubice
Zelené Předměstí, ulice Palackého 1245
PSČ: 530 02
Cena: 3.450.000 Kč

Prodej bytu 2+kk o velikosti 54 m² v osobním vlastnictví.
Byt se nachází ve 3. patře panelového domu s výtahem.
Po kompletní rekonstrukci v roce 2020.

Dispozice: 2 pokoje + kuchyňský kout, koupelna s vanou a WC.
Plastová okna, plovoucí podlahy, nová kuchyňská linka.

Příslušenství: sklep 4 m², balkon 3 m².
Parkování: 1 parkovací stání v ceně.`,
        output: {
            property_type: 'apartment',
            transaction_type: 'sale',
            price: 3450000,
            location: {
                street: 'Palackého 1245',
                postal_code: '530 02',
                city: 'Pardubice',
                district: 'Zelené Předměstí'
            },
            details: {
                area_sqm: 54,
                bedrooms: 1,
                bathrooms: 1,
                rooms: 2,
                floor: 3,
                parking_spaces: 1,
                renovation_year: 2020
            },
            czech_specific: {
                disposition: '2+kk',
                ownership: 'personal',
                condition: 'after_renovation',
                construction_type: 'panel',
                area_balcony: 3,
                area_cellar: 4
            },
            amenities: {
                has_elevator: true,
                has_basement: true,
                has_balcony: true,
                has_parking: true,
                is_renovated: true
            },
            extraction_metadata: {
                confidence: 'high',
                missing_fields: ['total_floors', 'year_built'],
                assumptions: ['Bedrooms=1 from 2+kk disposition (2 rooms - 1 living room)'],
                original_text_snippet: 'Prodej bytu 2+kk 54 m² - Pardubice Zelené Předměstí, ulice Palackého 1245 PSČ: 530 02 Cena: 3.450.000 Kč Prodej bytu 2+kk o velikosti 54 m² v osobním vlastnictví. Byt se nachází ve 3. patře...'
            }
        }
    },
    // Example 2: House with land
    {
        input: `Rodinný dům 5+1, pozemek 800 m² - Brno-venkov
Moravská 234, 664 42 Modřice
Cena: 6.900.000 Kč

Prodej cihlového rodinného domu 5+1 se zahradou.
Užitná plocha 180 m², pozemek 800 m².
Postaveno 1985, částečná rekonstrukce 2015.`,
        output: {
            property_type: 'house',
            transaction_type: 'sale',
            price: 6900000,
            location: {
                street: 'Moravská 234',
                postal_code: '664 42',
                city: 'Modřice',
                region: 'Jihomoravský kraj'
            },
            details: {
                area_sqm: 180,
                area_plot_sqm: 800,
                bedrooms: 4,
                rooms: 5,
                year_built: 1985,
                renovation_year: 2015
            },
            czech_specific: {
                disposition: '5+1',
                construction_type: 'brick',
                condition: 'good'
            },
            amenities: {
                has_garden: true
            },
            extraction_metadata: {
                confidence: 'high',
                missing_fields: ['ownership', 'floor'],
                assumptions: ['Bedrooms=4 from 5+1 disposition', 'Region inferred from Brno-venkov'],
                original_text_snippet: 'Rodinný dům 5+1, pozemek 800 m² - Brno-venkov Moravská 234, 664 42 Modřice Cena: 6.900.000 Kč Prodej cihlového rodinného domu 5+1 se zahradou...'
            }
        }
    }
];
/**
 * Build user message for extraction
 */
function buildUserMessage(listingText) {
    return `Extract all property data from this listing:

${listingText}

Required fields:
- location (street, postal_code, city, district)
- price (number)
- details (area_sqm, bedrooms, bathrooms, rooms, floor, parking_spaces, renovation_year)
- czech_specific (disposition, ownership, construction_type, condition, area_balcony, area_cellar, utility_charges)
- amenities (has_elevator, has_basement, has_balcony, has_parking)
- extraction_metadata (confidence, missing_fields, assumptions)

Output JSON object.`;
}
/**
 * Validate extraction result
 */
function validateExtraction(data) {
    const errors = [];
    // Required fields
    if (!data.property_type)
        errors.push('property_type is required');
    if (!data.transaction_type)
        errors.push('transaction_type is required');
    if (!data.extraction_metadata?.confidence)
        errors.push('extraction_metadata.confidence is required');
    return {
        isValid: errors.length === 0,
        errors
    };
}
