/**
 * House-Specific LLM Extraction Prompt (Tier I)
 *
 * Focused on house-relevant fields only (70% smaller than generic prompt).
 * Excludes: floor number, elevator, complex apartment amenities.
 */

export const HOUSE_EXTRACTION_PROMPT = `You are extracting house data from a Czech real estate listing.

Extract ONLY the following house fields from the HTML:

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
- street: Street name and number (e.g., "Moravská 234")
- postal_code: 5-digit code (e.g., "664 42" or "66442")

**House Dimensions** (CRITICAL):
- sqm_living: Living area in square meters (užitná plocha, obytná plocha)
- sqm_plot: Plot/land area in square meters (plocha pozemku) - REQUIRED
- bedrooms: Number of bedrooms (if "5+1" then 4 bedrooms, "4+kk" then 3 bedrooms)
- bathrooms: Number of bathrooms
- rooms: Total rooms (e.g., "5+1" = 5 rooms)
- stories: Number of floors/stories in the house (počet podlaží)

**House Amenities** (boolean true/false only):
- has_garden: Has garden/yard (zahrada)
- has_garage: Has garage (garáž)
- has_parking: Has parking space (parkování)
- has_basement: Has cellar/basement (sklep)
- has_pool: Has swimming pool (bazén)
- has_fireplace: Has fireplace (krb)
- has_terrace: Has terrace/patio (terasa)
- has_balcony: Has balcony (balkón)

**Optional Areas** (when explicitly stated):
- garden_area: Garden size in sqm
- garage_count: Number of garages
- terrace_area: Terrace size in sqm
- cellar_area: Cellar/basement size in sqm
- balcony_area: Balcony size in sqm

**Building Details**:
- year_built: Year of construction
- renovation_year: Year of last major renovation (rekonstrukce)
- condition: "new" | "excellent" | "good" | "after_renovation" | "requires_renovation"
- construction_type: "brick" (cihlový) | "wood" | "stone" | "concrete" | "mixed"
- roof_type: "flat" | "gable" | "hip" | "mansard"

**Czech-Specific** (if mentioned):
- property_subtype: "detached" | "semi_detached" | "terraced" | "villa" | "cottage" | "farmhouse"
- czech_disposition: "5+1" | "6+kk" | "4+1" (exact format from listing)

**Energy & Heating**:
- heating_type: "central_heating" (ústřední topení) | "individual_heating" (vlastní kotel) | "electric_heating" (elektřina) | "gas_heating" (plyn) | "water_heating" | "heat_pump" (tepelné čerpadlo) | "other"
- energy_class: Energy performance certificate class: "a" | "b" | "c" | "d" | "e" | "f" | "g" (PENB třída)

**Financials** (for rentals):
- deposit: Security deposit amount
- utility_charges: Monthly utilities
- property_tax: Annual property tax (daň z nemovitosti)

**Important Rules**:
- Return ONLY fields that are clearly stated in the listing
- Use null for missing fields (do not guess)
- Focus on accuracy over completeness
- **PRICE PARSING**: Remove spaces, dots, and "Kč" symbol. Convert to number. If text like "dohodou", set price=null and price_note="dohodou"
- **CITY EXTRACTION**: Always extract the main city before the dash. "Praha 2" → "Praha", "Brno - Černovice" → "Brno"
- Bedrooms formula: "5+1" = 4 bedrooms, "4+kk" = 3 bedrooms, "3+1" = 2 bedrooms
- sqm_plot is CRITICAL for houses - extract "plocha pozemku" carefully
- All booleans must be true/false, never null
- Stories = number of floors ("dvoupodlažní" = 2 stories, "třípodlažní" = 3 stories)
- **AREA VALIDATION**: Typical houses are 50-500 m² living, 100-5000 m² plot. If you extract unusual values, double-check

Return as JSON matching this structure:
{
  "title": "string",
  "price": number,
  "currency": "CZK",
  "transaction_type": "sale" | "rent",
  "location": { "street": "string", "postal_code": "string", "city": "string", "region": "string" },
  "sqm_living": number,
  "sqm_plot": number,
  "bedrooms": number,
  "bathrooms": number,
  "rooms": number,
  "stories": number,
  "year_built": number,
  "renovation_year": number,
  "condition": "string",
  "construction_type": "string",
  "has_garden": boolean,
  "has_garage": boolean,
  "has_parking": boolean,
  "has_basement": boolean,
  "has_balcony": boolean,
  "has_terrace": boolean,
  "garden_area": number,
  "terrace_area": number,
  "cellar_area": number,
  "balcony_area": number,
  "heating_type": "string",
  "energy_class": "string",
  "property_subtype": "string",
  "czech_disposition": "string",
  "deposit": number
}`;
