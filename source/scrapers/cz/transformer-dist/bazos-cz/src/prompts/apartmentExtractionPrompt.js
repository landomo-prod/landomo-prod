"use strict";
/**
 * Apartment-Specific LLM Extraction Prompt (Tier I)
 *
 * Focused on apartment-relevant fields only (70% smaller than generic prompt).
 * Excludes: plot area, garden, garage, zoning, land utilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.APARTMENT_EXTRACTION_PROMPT = void 0;
exports.APARTMENT_EXTRACTION_PROMPT = `You are extracting apartment data from a Czech real estate listing.

Extract ONLY the following apartment fields from the HTML:

**Core Details**:
- title: Property title
- price: Numeric price only (without currency). IMPORTANT: Parse Czech formats:
  * "195 000 Kč" → 195000
  * "1 500 000" → 1500000
  * "2.500.000" → 2500000
  * "dohodou" or "info u RK" → null (use price_note instead)
- currency: "CZK"
- transaction_type: "sale" or "rent"
- price_note: Use ONLY for "dohodou", "na vyžádání", "info u RK" (when price is not numeric)

**Location** (CRITICAL - Extract carefully):
- city: Main city name. Parse from formats like:
  * "Praha 2 - Vinohrady" → "Praha"
  * "Brno - Černovice" → "Brno"
  * "Pardubice" → "Pardubice"
- district: District/neighborhood after the dash:
  * "Praha 2 - Vinohrady" → "Vinohrady"
  * "Brno - Černovice" → "Černovice"
- street: Street name and number (e.g., "Palackého 1245")
- postal_code: 5-digit code (e.g., "530 02" or "53002")

**Apartment Dimensions**:
- sqm: Living area in square meters (užitná plocha)
- bedrooms: Number of bedrooms (if "2+kk" then 1 bedroom, "3+1" then 2 bedrooms, "1+kk" then 0 bedrooms)
- bathrooms: Number of bathrooms
- rooms: Total rooms (e.g., "2+kk" = 2 rooms)

**Building Context**:
- floor: Which floor the apartment is on (0 = ground floor, "přízemí" or "1. patro" = 0)
- total_floors: Total floors in building
- year_built: Year of construction
- condition: "new" | "excellent" | "good" | "after_renovation" | "requires_renovation"
- construction_type: "panel" | "brick" | "concrete" | "mixed"

**Apartment Amenities** (boolean true/false only):
- has_elevator: Building has elevator (výtah)
- has_balcony: Apartment has balcony (balkón)
- has_parking: Has parking space (parkování, parkovací stání)
- has_basement: Has cellar/storage (sklep)
- has_garage: Has garage (garáž)
- has_loggia: Has loggia (lodžie)
- has_terrace: Has terrace (terasa)

**Optional Areas** (when explicitly stated):
- balcony_area: Balcony size in sqm
- cellar_area: Cellar/storage size in sqm
- terrace_area: Terrace size in sqm
- loggia_area: Loggia size in sqm

**Czech-Specific** (if mentioned):
- property_subtype: "standard" | "penthouse" | "loft" | "atelier" | "maisonette" | "studio"
- czech_disposition: "1+kk" | "2+kk" | "3+1" | "4+1" (exact format from listing)
- czech_ownership: "personal" (osobní vlastnictví, OV) | "cooperative" (družstevní, DB)

**Energy & Heating**:
- heating_type: "central_heating" (ústřední topení) | "individual_heating" (vlastní kotel) | "electric_heating" (elektřina) | "gas_heating" (plyn) | "water_heating" | "heat_pump" (tepelné čerpadlo) | "other"
- energy_class: Energy performance certificate class: "a" | "b" | "c" | "d" | "e" | "f" | "g" (PENB třída)

**Financials** (for rentals):
- deposit: Security deposit amount
- hoa_fees: Monthly HOA fees (poplatky za správu)
- utility_charges: Monthly utilities (energie, teplo, voda)

**Important Rules**:
- Return ONLY fields that are clearly stated in the listing
- Use null for missing fields (do not guess)
- Focus on accuracy over completeness
- **PRICE PARSING**: Remove spaces, dots, and "Kč" symbol. Convert to number. If text like "dohodou", set price=null and price_note="dohodou"
- **CITY EXTRACTION**: Always extract the main city before the dash. "Praha 2" → "Praha", "Brno - Černovice" → "Brno"
- Bedrooms formula: "1+kk" = 0 bedrooms, "2+kk" = 1 bedroom, "3+1" = 2 bedrooms, "4+1" = 3 bedrooms
- Floor numbering: Ground floor = 0, "1. patro" = 1
- All booleans must be true/false, never null
- **AREA VALIDATION**: Typical apartments are 20-200 m². If you extract >500 m², double-check the number

Return as JSON matching this structure:
{
  "title": "string",
  "price": number,
  "currency": "CZK",
  "transaction_type": "sale" | "rent",
  "location": { "street": "string", "postal_code": "string", "city": "string", "district": "string" },
  "sqm": number,
  "bedrooms": number,
  "bathrooms": number,
  "rooms": number,
  "floor": number,
  "total_floors": number,
  "year_built": number,
  "condition": "string",
  "construction_type": "string",
  "has_elevator": boolean,
  "has_balcony": boolean,
  "has_parking": boolean,
  "has_basement": boolean,
  "has_garage": boolean,
  "has_loggia": boolean,
  "has_terrace": boolean,
  "balcony_area": number,
  "cellar_area": number,
  "terrace_area": number,
  "loggia_area": number,
  "heating_type": "string",
  "energy_class": "string",
  "property_subtype": "string",
  "czech_disposition": "string",
  "czech_ownership": "string",
  "deposit": number,
  "hoa_fees": number,
  "utility_charges": number
}`;
