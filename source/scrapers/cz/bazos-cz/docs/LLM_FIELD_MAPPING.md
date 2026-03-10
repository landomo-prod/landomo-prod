# LLM Extraction Field Mapping Guide

## Overview

This document maps the LLM extraction schema to the StandardProperty format for Bazos listings.

## Mapping Flow

```
Bazos Listing Text (unstructured)
    ↓ (LLM extraction)
LLMExtractedProperty (structured)
    ↓ (transformation)
StandardProperty (database)
```

---

## Core Field Mappings

### Property Type

**Czech Terms → LLM → StandardProperty**

| Czech Term | LLM Output | StandardProperty.property_type |
|------------|------------|-------------------------------|
| byt | `apartment` | `apartment` |
| garsonka | `studio` | `studio` |
| rodinný dům, RD | `house` | `house` |
| vila | `villa` | `villa` |
| pozemek | `land` | `land` |
| komerční | `commercial` | `commercial` |
| garáž | `garage` | `garage` |

### Transaction Type

| Czech Term | LLM Output | StandardProperty.transaction_type |
|------------|------------|----------------------------------|
| prodej, prodám | `sale` | `sale` |
| pronájem, k pronájmu | `rent` | `rent` |

---

## Czech-Specific Mappings

### Disposition (Room Layout)

**Czech → LLM → StandardProperty**

| Czech Format | LLM `disposition` | StandardProperty.country_specific.czech_disposition |
|--------------|-------------------|---------------------------------------------------|
| 1+kk | `1+kk` | `1+kk` |
| 2+1 | `2+1` | `2+1` |
| 3+kk | `3+kk` | `3+kk` |
| garsonka | `1+kk` | `1+kk` |
| atypical | `atypical` | `atypical` |

**Bedrooms Calculation:**
- `1+kk` / `1+1` → bedrooms: 1
- `2+kk` / `2+1` → bedrooms: 2
- `3+kk` / `3+1` → bedrooms: 3
- etc.

### Ownership Type

| Czech Term | LLM `ownership` | StandardProperty.country_specific.czech_ownership |
|------------|-----------------|--------------------------------------------------|
| osobní vlastnictví | `personal` | `personal` |
| družstevní vlastnictví | `cooperative` | `cooperative` |
| státní vlastnictví | `state` | `state` |
| obecní vlastnictví | `state` | `state` |

### Property Condition

| Czech Term | LLM `condition` | StandardProperty.condition |
|------------|----------------|---------------------------|
| novostavba | `new` | `new` |
| výborný stav | `excellent` | `excellent` |
| velmi dobrý stav | `very_good` | `very_good` |
| dobrý stav | `good` | `good` |
| po rekonstrukci | `after_renovation` | `after_renovation` |
| před rekonstrukcí | `before_renovation` | `before_renovation` |
| nutná rekonstrukce | `requires_renovation` | `requires_renovation` |
| projekt | `project` | `project` |
| výstavba | `under_construction` | `under_construction` |

### Construction Type

| Czech Term | LLM `construction_type` | StandardProperty.construction_type |
|------------|------------------------|-----------------------------------|
| panelový, panelák | `panel` | `panel` |
| cihlový | `brick` | `brick` |
| zděný | `stone` | `stone` |
| dřevěný | `wood` | `wood` |
| betonový | `concrete` | `concrete` |
| smíšená stavba | `mixed` | `mixed` |

### Heating Type

| Czech Term | LLM `heating_type` | StandardProperty.heating_type |
|------------|-------------------|------------------------------|
| ústřední topení | `central_heating` | `central_heating` |
| individuální topení | `individual_heating` | `individual_heating` |
| elektrické topení | `electric_heating` | `electric_heating` |
| plynové topení | `gas_heating` | `gas_heating` |
| teplá voda | `water_heating` | `water_heating` |
| tepelné čerpadlo | `heat_pump` | `heat_pump` |

### Energy Rating (PENB)

| Czech Format | LLM `energy_rating` | StandardProperty.energy_rating |
|--------------|--------------------|---------------------------------|
| třída A, energetická třída A | `a` | `a` |
| třída B | `b` | `b` |
| třída G | `g` | `g` |

### Furnished Status

| Czech Term | LLM `furnished` | StandardProperty.furnished |
|------------|----------------|---------------------------|
| vybaveno, kompletně vybaveno | `furnished` | `furnished` |
| částečně vybaveno | `partially_furnished` | `partially_furnished` |
| nevybaveno, bez vybavení | `not_furnished` | `not_furnished` |

---

## Area Mappings

### Basic Areas

| LLM Field | StandardProperty Field | Notes |
|-----------|------------------------|-------|
| `details.area_sqm` | `details.sqm` | Living area |
| `details.area_total_sqm` | `country_specific.area_total` | Total area |
| `details.area_plot_sqm` | `country_specific.area_plot` | Plot/land area |

### Detailed Areas (Czech-specific)

| LLM Field | StandardProperty Field | Czech Term |
|-----------|------------------------|-----------|
| `czech_specific.area_balcony` | `country_specific.area_balcony` | balkón |
| `czech_specific.area_terrace` | `country_specific.area_terrace` | terasa |
| `czech_specific.area_loggia` | `country_specific.area_loggia` | lodžie |
| `czech_specific.area_cellar` | `country_specific.area_cellar` | sklep |
| `czech_specific.area_garden` | `country_specific.area_garden` | zahrada |

---

## Amenities Mappings

| LLM Field | StandardProperty Field | Czech Terms |
|-----------|------------------------|-------------|
| `amenities.has_parking` | `amenities.has_parking` | parkování, parkoviště |
| `amenities.has_garage` | `amenities.has_garage` | garáž |
| `amenities.has_balcony` | `amenities.has_balcony` | balkón |
| `amenities.has_terrace` | `amenities.has_terrace` | terasa |
| `amenities.has_basement` | `amenities.has_basement` | sklep |
| `amenities.has_elevator` | `amenities.has_elevator` | výtah |
| `amenities.has_loggia` | `amenities.has_loggia` | lodžie |
| `amenities.is_barrier_free` | `amenities.is_barrier_free` | bezbariérový |
| `amenities.is_pet_friendly` | `amenities.is_pet_friendly` | zvířata povolena |
| `amenities.has_garden` | `amenities.has_garden` | zahrada |

---

## Infrastructure Mappings

| LLM Field | StandardProperty Field | Czech Terms |
|-----------|------------------------|-------------|
| `czech_specific.water_supply` | `country_specific.water_supply` | voda, studna |
| `czech_specific.sewage_type` | `country_specific.sewage_type` | kanalizace, septik |
| `czech_specific.gas_supply` | `country_specific.gas_supply` | plyn |
| `czech_specific.electricity_supply` | `country_specific.electricity_supply` | elektřina |

---

## Rental-Specific Mappings

| LLM Field | StandardProperty Field | Notes |
|-----------|------------------------|-------|
| `czech_specific.monthly_price` | `country_specific.monthly_price` | Monthly rent |
| `czech_specific.deposit` | `deposit` | Security deposit |
| `czech_specific.utility_charges` | `country_specific.utility_charges` | Utilities |
| `czech_specific.rental_period` | `country_specific.rental_period` | short_term/long_term |

---

## Location Mapping

| LLM Field | StandardProperty Field | Notes |
|-----------|------------------------|-------|
| `location.city` | `location.city` | Primary city |
| `location.region` | `location.region` | Region/kraj |
| `location.postal_code` | `location.postal_code` | PSČ |
| `location.district` | `country_specific.district` | District within city |
| `location.street` | `location.address` | Street address |

---

## Price Handling

### Sale Price

```typescript
if (transaction_type === 'sale') {
  StandardProperty.price = LLMExtracted.price;
  StandardProperty.transaction_type = 'sale';
}
```

### Rental Price

```typescript
if (transaction_type === 'rent') {
  StandardProperty.price = LLMExtracted.czech_specific.monthly_price;
  StandardProperty.transaction_type = 'rent';
  StandardProperty.country_specific.monthly_price = LLMExtracted.czech_specific.monthly_price;
  StandardProperty.deposit = LLMExtracted.czech_specific.deposit;
}
```

### Price Notes

```typescript
if (LLMExtracted.price_note) {
  // "dohodou", "na vyžádání", etc.
  StandardProperty.portal_metadata.bazos.price_note = LLMExtracted.price_note;
}
```

---

## Extraction Metadata

| LLM Field | Usage |
|-----------|-------|
| `extraction_metadata.confidence` | Log for quality monitoring |
| `extraction_metadata.missing_fields` | Track extraction coverage |
| `extraction_metadata.assumptions` | Document inference decisions |

### Confidence Levels

- **high**: 90%+ fields extracted, clear terminology, no ambiguity
- **medium**: 60-90% fields extracted, some missing or inferred values
- **low**: <60% fields extracted, significant uncertainty

---

## Example: Complete Mapping

**Input Text:**
```
Prodej bytu 2+kk 54 m²
Pardubice - Zelené Předměstí
Cena: 3.450.000 Kč
Byt se nachází ve 3. patře panelového domu s výtahem.
Po kompletní rekonstrukci. Sklep.
```

**LLM Extraction:**
```json
{
  "property_type": "apartment",
  "transaction_type": "sale",
  "price": 3450000,
  "location": {
    "city": "Pardubice",
    "district": "Zelené Předměstí"
  },
  "details": {
    "area_sqm": 54,
    "floor": 3,
    "bedrooms": 2
  },
  "czech_specific": {
    "disposition": "2+kk",
    "condition": "after_renovation",
    "construction_type": "panel"
  },
  "amenities": {
    "has_elevator": true,
    "has_basement": true
  }
}
```

**StandardProperty Output:**
```json
{
  "title": "Prodej bytu 2+kk 54 m²",
  "price": 3450000,
  "currency": "CZK",
  "property_type": "apartment",
  "transaction_type": "sale",
  "location": {
    "city": "Pardubice",
    "country": "Czech Republic"
  },
  "details": {
    "sqm": 54,
    "floor": 3,
    "bedrooms": 2
  },
  "condition": "after_renovation",
  "construction_type": "panel",
  "amenities": {
    "has_elevator": true,
    "has_basement": true
  },
  "country_specific": {
    "czech_disposition": "2+kk",
    "district": "Zelené Předměstí"
  }
}
```

---

## Implementation Notes

1. **Use normalization functions** from `shared/czech-value-mappings.ts` for validation
2. **Preserve original text** in portal_metadata for debugging
3. **Log confidence scores** for monitoring extraction quality
4. **Handle missing fields gracefully** - omit rather than guess
5. **Validate dispositions** against CZECH_DISPOSITIONS enum
6. **Calculate bedrooms** from disposition when not explicitly stated
7. **Map currency** from country code (CZ → CZK, SK → EUR)

---

## Testing Checklist

- [ ] Apartment listings (2+kk, 3+1, etc.)
- [ ] House listings (rodinný dům, vila)
- [ ] Land listings (pozemek)
- [ ] Rental listings (pronájem)
- [ ] Sale listings (prodej)
- [ ] Price variations (dohodou, na vyžádání)
- [ ] Different construction types (panel, cihla)
- [ ] Amenities extraction (výtah, sklep, balkón)
- [ ] Condition variations (novostavba, po rekonstrukci)
- [ ] Energy ratings (třída A-G)
- [ ] Missing data handling
- [ ] Czech vs. Slovak listings
