# BezRealitky - Field Mapping Reference

## Mapping Overview

| GraphQL Field | TierI Field | Category | Transformation | Required | Notes |
|---------------|-------------|----------|----------------|----------|-------|
| id | source_portal_id | all | `"bezrealitky-" + id` | ✅ | Prefixed ID |
| title | title | all | direct | ✅ | Property title |
| price | price | all | direct | ⚠️ | Can be null |
| currency | currency | all | default "CZK" | ✅ | Always CZK |
| offerType | transaction_type | all | `PRODEJ → "sale", PRONAJEM → "rent"` | ✅ | Enum mapping |
| surface | sqm / sqm_living / sqm_total | apt/house/comm | direct | ⚠️ | Main area field |
| surfaceLand | sqm_plot | house/land | direct | ❌ | Land area |
| disposition | bedrooms | apt/house | parse (see below) | ⚠️ | "2+kk" → 1 |
| lift | has_elevator | apt/comm | boolean | ⚠️ | Direct boolean |
| balcony | has_balcony | apt | boolean | ⚠️ | Direct boolean |
| parking | has_parking | all | boolean | ⚠️ | Direct boolean |
| cellar | has_basement | apt/house | boolean | ⚠️ | Direct boolean |
| garage | has_garage | house/apt | boolean | ⚠️ | Direct boolean |
| loggia | has_loggia | apt | boolean | ⚠️ | Direct boolean |
| terrace | has_terrace | apt | boolean | ⚠️ | Direct boolean |
| floor | floor | apt | parse (see below) | ❌ | "3" or "přízemí" |
| totalFloors | total_floors / num_floors | apt/house | direct | ❌ | Total floors |
| age | year_built | apt/house | `current_year - age` | ❌ | Calculated |
| gps.lat | coordinates.lat | all | direct | ❌ | Latitude |
| gps.lng | coordinates.lon | all | direct | ❌ | Longitude |
| city | city | all | direct | ⚠️ | City name |
| address | address | all | direct or construct | ⚠️ | Full address |
| timeActivated | published_date | all | `new Date(int * 1000)` | ❌ | Unix → ISO |
| estateType | property_category | all | enum mapping | ✅ | Category detection |

## Category: Apartment

### Required Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| estateType | property_category | always "apartment" | "BYT" | "apartment" |
| disposition | bedrooms | parse disposition | "2+kk" | 1 |
| surface | sqm | direct | 52 | 52 |
| lift | has_elevator | boolean | true | true |
| balcony | has_balcony | boolean | false | false |
| parking | has_parking | boolean | true | true |
| cellar | has_basement | boolean | true | true |

### Optional Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| balconySurface | balcony_area | direct | 6 | 6 |
| loggiaSurface | loggia_area | direct | 4 | 4 |
| cellarSurface | cellar_area | direct | 5 | 5 |
| terraceSurface | terrace_area | direct | 12 | 12 |
| loggia | has_loggia | boolean | true | true |
| terrace | has_terrace | boolean | false | false |
| garage | has_garage | boolean | false | false |
| floor | floor | parse floor | "3" | 3 |
| floor | floor | parse floor | "přízemí" | 0 |
| totalFloors | total_floors | direct | 8 | 8 |
| age | year_built | calculate | 45 | 1981 |
| condition | condition | normalize | "VELMI_DOBRY" | "very_good" |
| construction | construction_type | normalize | "PANEL" | "panel" |
| heating | heating_type | normalize | "USTREDNI_DOMOVNI" | "central_gas" |
| penb | energy_class | normalize | "B" | "B" |
| equipped | furnished | normalize | "ZARIZENY" | "furnished" |
| reconstruction | renovation_year | parse year | "2020" | 2020 |
| serviceCharges | hoa_fees | direct | 2500 | 2500 |
| deposit | deposit | direct | 19500 | 19500 |
| availableFrom | available_from | timestamp | "1709222400" | "2026-03-01..." |

### Tier II: Czech Specific

| GraphQL Field | Tier II Field | Transformation | Example Input | Example Output |
|---------------|---------------|----------------|---------------|----------------|
| disposition | czech.disposition | normalize | "2+kk" | "2+kk" |
| ownership | czech.ownership | normalize | "OSOBNI" | "personal" |
| condition | czech.condition | normalize | "VELMI_DOBRY" | "very_good" |
| heating | czech.heating_type | normalize | "USTREDNI_DOMOVNI" | "central_gas" |
| construction | czech.construction_type | normalize | "PANEL" | "panel" |

## Category: House

### Required Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| estateType | property_category | always "house" | "DUM" | "house" |
| disposition | bedrooms | parse or default | "4+1" | 4 |
| surface | sqm_living | direct | 150 | 150 |
| surfaceLand | sqm_plot | direct | 500 | 500 |
| frontGarden / surfaceLand | has_garden | infer | true / 500 | true |
| garage | has_garage | boolean | true | true |
| parking | has_parking | boolean | true | true |
| cellar | has_basement | boolean | true | true |

### Optional Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| totalFloors | num_floors | direct | 2 | 2 |
| age | year_built | calculate | 30 | 1996 |
| surfaceLand | garden_area | direct | 500 | 500 |
| construction | construction_type | normalize | "CIHLA" | "brick" |
| condition | condition | normalize | "DOBRY" | "good" |

## Category: Land

### Required Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| estateType | property_category | always "land" | "POZEMEK" | "land" |
| surfaceLand / surface | area_plot_sqm | direct | 1000 | 1000 |

### Optional Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| landType | land_type | normalize | "STAVEBNÍ" | "building" |
| water | has_utilities_water | boolean | "VODOVOD_OBECNI" | true |
| sewage | has_utilities_sewage | boolean | "KANALIZACE_OBECNI" | true |

## Category: Commercial

### Required Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| estateType | property_category | always "commercial" | "KANCELAR" | "commercial" |
| surface | sqm_total | direct | 80 | 80 |
| lift | has_elevator | boolean | true | true |
| parking | has_parking | boolean | true | true |
| - | bathrooms | default | - | 1 |

### Optional Fields

| GraphQL Field | TierI Field | Transformation | Example Input | Example Output |
|---------------|-------------|----------------|---------------|----------------|
| estateType | commercial_type | map | "KANCELAR" | "office" |
| estateType | commercial_type | map | "GARAZ" | "garage" |
| estateType | commercial_type | map | "NEBYTOVY_PROSTOR" | "retail" |

## Special Handling

### Calculated Fields

**bedrooms**: Derived from disposition
```
"2+kk" → 1 bedroom (2 rooms - 1 living = 1 bedroom)
"3+1" → 3 bedrooms (all rooms are bedrooms)
"4+kk" → 3 bedrooms (4 rooms - 1 living = 3 bedrooms)
```

**year_built**: Calculated from age
```
year_built = current_year - age
Example: 2026 - 45 = 1981
```

**has_garden**: Inferred from data
```
has_garden = frontGarden === true || sqm_plot > 0
```

**floor_location**: Calculated from floor/totalFloors
```
floor 0 or "přízemí" → "ground_floor"
floor === totalFloors → "top_floor"
floor < 0 or "suterén" → "ground_floor" (not semi_basement)
otherwise → "middle_floor"
```

### Default Values

| TierI Field | If GraphQL Missing | Strategy |
|-------------|-------------------|----------|
| property_category | Required | From estateType enum |
| status | Always "active" | From active boolean |
| country | Always "Czech Republic" | Hardcoded |
| currency | Always "CZK" | Default if null |
| bedrooms | 0 | If disposition unparseable |
| bathrooms | 1 | For commercial if missing |
| has_* amenities | false | If null or undefined |

### Missing Field Strategy

| TierI Field | If Portal Missing | Strategy |
|-------------|-------------------|----------|
| bedrooms | Use disposition | Parse "2+kk" format or default 0 |
| sqm | Required | Skip listing if missing |
| price | Allow null | "Price on request" |
| has_elevator | Default false | Assume no elevator |
| gps coordinates | Optional | Skip if privacy protected |
| description | Optional | Empty string if missing |

## Tier II: Country Specific

Fields stored in `country_specific.czech`:

| Field | Purpose | GraphQL Source | Example |
|-------|---------|---------------|---------|
| disposition | Czech room layout | disposition | "2+kk", "3+1" |
| ownership | Ownership type | ownership | "personal", "cooperative" |
| condition | Property condition | condition | "very_good", "good" |
| heating_type | Heating system | heating | "central_gas", "electric" |
| construction_type | Building material | construction | "panel", "brick" |

## Tier III: Portal Metadata

Fields stored in `portal_metadata`:

| Field | Purpose | GraphQL Source | Example |
|-------|---------|---------------|---------|
| bezrealitky_external_id | Portal display ID | externalId | "BR12345" |
| bezrealitky_hash | URL hash | hash | "abc123def456" |
| bezrealitky_code | Display code | code | "BR12345" |
| bezrealitky_visit_count | View count | visitCount | 234 |
| bezrealitky_conversation_count | Inquiry count | conversationCount | 5 |
| bezrealitky_is_new | New listing flag | isNew | true |
| bezrealitky_is_highlighted | Featured listing | highlighted | false |
| bezrealitky_reserved | Reservation status | reserved | false |
| bezrealitky_pet_friendly | Pets allowed | petFriendly | true |
| bezrealitky_barrier_free | Accessible | barrierFree | false |
| bezrealitky_roommate | Roommate friendly | roommate | false |

## Normalization Functions

### Disposition
```typescript
normalizeDisposition("2+kk") → "2+kk" (canonical format)
normalizeDisposition("2 + kk") → "2+kk" (normalized)
```

### Ownership
```typescript
normalizeOwnership("OSOBNI") → "personal"
normalizeOwnership("DRUZSTEVNI") → "cooperative"
normalizeOwnership("STATNI") → "state"
```

### Condition
```typescript
normalizeCondition("NOVOSTAVBA") → "new"
normalizeCondition("VELMI_DOBRY") → "very_good"
normalizeCondition("DOBRY") → "good"
normalizeCondition("PO_REKONSTRUKCI") → "after_renovation"
normalizeCondition("PRED_REKONSTRUKCI") → "requires_renovation"
```

### Furnished
```typescript
normalizeFurnished("ZARIZENY") → "furnished"
normalizeFurnished("CASTECNE_ZARIZENY") → "partly_furnished"
normalizeFurnished("NEZARIZENY") → "unfurnished"
```

### Heating Type
```typescript
normalizeHeatingType("USTREDNI_DOMOVNI") → "central_gas"
normalizeHeatingType("ETAZOVE") → "central_apartment"
normalizeHeatingType("ELEKTRICKY") → "electric"
normalizeHeatingType("PLYNOVY") → "gas"
```

### Construction Type
```typescript
normalizeConstructionType("PANEL") → "panel"
normalizeConstructionType("CIHLA") → "brick"
normalizeConstructionType("BETON") → "concrete"
normalizeConstructionType("DREVO") → "wood"
normalizeConstructionType("SMISENA") → "mixed"
```
