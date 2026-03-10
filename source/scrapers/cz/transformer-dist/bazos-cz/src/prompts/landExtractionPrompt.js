"use strict";
/**
 * Land-Specific LLM Extraction Prompt (Tier I)
 *
 * Focused on land-relevant fields only (75% smaller than generic prompt).
 * Excludes: bedrooms, bathrooms, floor, elevator, building amenities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LAND_EXTRACTION_PROMPT = void 0;
exports.LAND_EXTRACTION_PROMPT = `You are extracting land/plot data from a Czech real estate listing.

Extract ONLY the following land fields from the HTML:

**Core Details**:
- title: Property title
- price: Numeric price only (without currency). IMPORTANT: Parse Czech formats:
  * "195 000 Kč" → 195000
  * "1 500 000" → 1500000
  * "2.500.000" → 2500000
  * "dohodou" or "info u RK" → null (use price_note instead)
- currency: "CZK"
- transaction_type: "sale" (land is rarely rented)
- price_note: Use ONLY for "dohodou", "na vyžádání", "info u RK" (when price is not numeric)

**Location** (CRITICAL - Extract carefully):
- city: Main city/village name. Parse from formats like:
  * "Praha 2 - Vinohrady" → "Praha"
  * "Brno - Černovice" → "Brno"
  * "Modřice" → "Modřice"
- district: District/neighborhood after the dash:
  * "Praha 2 - Vinohrady" → "Vinohrady"
  * "Brno - Černovice" → "Černovice"
- street: Street name if applicable
- postal_code: 5-digit code (e.g., "664 42" or "66442")

**Land Dimensions** (MAIN METRIC):
- area_plot_sqm: Plot area in square meters (plocha pozemku) - REQUIRED

**Land Classification**:
- zoning: "residential" | "commercial" | "agricultural" | "mixed" | "industrial" | "recreational"
- land_type: "arable" (orná půda) | "grassland" (louka) | "forest" (les) | "vineyard" (vinice) | "building_plot" (stavební pozemek) | "meadow" | "pasture"
- property_subtype: "building_plot" | "agricultural" | "forest" | "vineyard" | "orchard" | "recreational" | "industrial"

**Utilities** (CRITICAL for land development):
- water_supply: "mains" (vodovod) | "well" (studna) | "connection_available" (možnost připojení) | "none"
- sewage: "mains" (kanalizace) | "septic" (septik) | "connection_available" | "none"
- electricity: "connected" (elektřina) | "connection_available" | "none"
- gas: "connected" (plyn) | "connection_available" | "none"
- road_access: "paved" (asfaltová silnice) | "gravel" (štěrková cesta) | "dirt" (polní cesta) | "none"

**Development Potential**:
- building_permit: Has valid building permit (stavební povolení) - boolean
- max_building_coverage: Maximum building coverage percentage (e.g., 30 = 30% can be built on)
- terrain: "flat" (rovný) | "sloped" (svažitý) | "hilly" (kopcovitý) | "mountainous"

**Legal & Administrative**:
- cadastral_number: Land registry ID (katastrální číslo)
- ownership_type: "personal" (osobní) | "state" (státní) | "municipal" (obecní)

**Energy & Heating** (only if plot has an existing structure):
- heating_type: "central_heating" | "individual_heating" | "electric_heating" | "gas_heating" | "water_heating" | "heat_pump" | "other"
- energy_class: "a" | "b" | "c" | "d" | "e" | "f" | "g"

**Important Rules**:
- Return ONLY fields that are clearly stated in the listing
- Use null for missing fields (do not guess)
- Focus on accuracy over completeness
- **PRICE PARSING**: Remove spaces, dots, and "Kč" symbol. Convert to number. If text like "dohodou", set price=null and price_note="dohodou"
- **CITY EXTRACTION**: Always extract the main city before the dash. "Praha 2" → "Praha", "Brno - Černovice" → "Brno"
- area_plot_sqm is the MAIN METRIC - extract carefully
- Utilities are CRITICAL for valuation - extract "IS" terms (inženýrské sítě)
- All boolean fields must be true/false, never null
- Zoning and land_type are different: zoning = legal use, land_type = current state
- **AREA VALIDATION**: Typical plots are 500-50000 m². If you extract unusual values, double-check

**Czech Utility Terms**:
- "IS" = inženýrské sítě (utilities)
- "vodovod" = water mains
- "kanalizace" = sewage system
- "elektřina" = electricity
- "plyn" = gas
- "možnost připojení" = connection available
- "studna" = well
- "septik" = septic tank

Return as JSON matching this structure:
{
  "title": "string",
  "price": number,
  "currency": "CZK",
  "transaction_type": "sale",
  "location": { "street": "string", "postal_code": "string", "city": "string", "region": "string" },
  "area_plot_sqm": number,
  "zoning": "string",
  "land_type": "string",
  "property_subtype": "string",
  "water_supply": "string",
  "sewage": "string",
  "electricity": "string",
  "gas": "string",
  "road_access": "string",
  "building_permit": boolean,
  "max_building_coverage": number,
  "terrain": "string",
  "cadastral_number": "string",
  "ownership_type": "string",
  "heating_type": "string",
  "energy_class": "string"
}`;
