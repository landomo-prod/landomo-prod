# Bazos - Transformer Field Mappings

## Category Routing

Category is detected from Czech text via `detectPropertyCategory()`:

| Detection Pattern | Category | Transformer |
|-------------------|----------|-------------|
| `byt`, `2+kk`, `garsoniéra` | `apartment` | `bazosApartmentTransformer` |
| `rodinný dům`, `vila`, `chalupa` | `house` | `bazosHouseTransformer` |
| `pozemek`, `parcela`, `zahrada` | `land` | `bazosLandTransformer` |
| _(fallback)_ | `apartment` | `bazosApartmentTransformer` |

## Common Fields (All Categories)

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `title` | `ad.title` | Direct from listing |
| `price` | `ad.price_formatted` | Parsed from Czech format (e.g., `2 500 000 Kč`) |
| `currency` | Hardcoded | `'CZK'` |
| `transaction_type` | LLM or title | Detected from text (`prodej`→sale, `pronájem`→rent) |
| `location.city` | `ad.locality` | Direct |
| `location.country` | Country parameter | `'Czech Republic'` / `'Slovakia'` / etc. |
| `description` | Detail page | From `div.popisdetail` on detail page |
| `source_url` | `ad.url` | Direct |
| `source_platform` | Hardcoded | `'bazos'` |
| `status` | Hardcoded | `'active'` |

## LLM-Extracted Fields

The LLM (DeepSeek-V3.2) extracts structured fields from unstructured Czech text. Each category has a specific extraction prompt.

## Apartment Fields (LLM-Extracted)

| TierI Field | LLM Field | Description |
|-------------|-----------|-------------|
| `bedrooms` | `bedrooms` | From disposition: `2+kk` → 2, `3+1` → 2 |
| `sqm` | `sqm` | Living area in m² |
| `floor` | `floor` | Floor number |
| `total_floors` | `total_floors` | Building floor count |
| `has_elevator` | `elevator` | Boolean |
| `has_balcony` | `balcony` | Boolean (includes terrace, loggia) |
| `has_parking` | `parking` | Boolean |
| `has_basement` | `basement` | Boolean (sklep, cellar) |
| `rooms` | `rooms` | Total room count |
| `construction_type` | `construction` | panel→prefab, cihla→brick |
| `condition` | `condition` | novostavba→new, po rekonstrukci→after_renovation |
| `energy_class` | `energy_class` | A–G |
| `furnished` | `furnished` | ano→furnished, ne→not_furnished |
| `heating_type` | `heating` | Gas/electric/central/etc. |

## House Fields (LLM-Extracted)

| TierI Field | LLM Field | Description |
|-------------|-----------|-------------|
| `bedrooms` | `bedrooms` | Extracted from text |
| `sqm_living` | `sqm_living` | Living area in m² |
| `sqm_plot` | `sqm_plot` | Plot area in m² |
| `has_garden` | `garden` | Boolean |
| `has_garage` | `garage` | Boolean |
| `has_parking` | `parking` | Boolean |
| `has_basement` | `basement` | Boolean |
| `stories` | `stories` | Number of floors |
| `construction_type` | `construction` | Mapped from Czech |
| `condition` | `condition` | Mapped from Czech |
| `heating_type` | `heating` | Mapped from Czech |
| `year_built` | `year_built` | 4-digit year |

## Land Fields (LLM-Extracted)

| TierI Field | LLM Field | Description |
|-------------|-----------|-------------|
| `area_plot_sqm` | `area_sqm` | Plot area in m² |
| `portal_metadata.land_type` | `land_type` | stavební/zahrada/pole/les/louka |
| `portal_metadata.water` | `water` | Water utility access |
| `portal_metadata.sewage` | `sewage` | Sewage connection |
| `portal_metadata.electricity` | `electricity` | Electricity access |
| `portal_metadata.gas` | `gas` | Gas connection |
| `portal_metadata.road` | `road` | Road access type |

## LLM Extraction Prompts

Each category uses a few-shot prompt with examples. The LLM returns JSON with the above fields extracted from the title + description text. Example apartment prompt structure:

```
Extract property details from this Czech real estate listing.
Return JSON with: disposition, sqm, floor, construction, condition, ...

Example input: "Prodej bytu 3+kk, 75 m², Praha 5"
Example output: { "disposition": "3+kk", "sqm": 75, "bedrooms": 3, ... }

Listing: {title} {description}
```

## Fallback Behavior

On LLM failure, basic data is returned:
- Title and price from listing
- Location from locality field
- Category from text detection
- All LLM-specific fields default to `undefined`/`0`/`false`
