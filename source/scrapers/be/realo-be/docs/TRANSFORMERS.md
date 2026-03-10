# Realo BE Transformers

## Architecture

Realo uses typed raw listings (`RawRealoListing`) with field extraction from Next.js, Apollo GraphQL state, JSON-LD, and HTML parsing. The raw type is identical in structure to Logic-Immo's `RawLogicImmoListing`.

## Raw Type: `RawRealoListing`

Same fields as Logic-Immo raw type. Key fields:

| Field | Type | Source |
|-------|------|--------|
| `id` | `string` | All strategies |
| `title` | `string?` | Next.js, Apollo, LD+JSON, HTML |
| `price` | `number?` | Next.js `item.price.value`, Apollo `item.price.amount` |
| `surface` | `number?` | Next.js/Apollo `item.surface` |
| `bedrooms` | `number?` | Next.js/Apollo `item.bedrooms` |
| `address` | `object` | Next.js/Apollo `item.address` |
| `agent` | `object?` | Next.js `item.agent` |

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Source | Target | Conversion |
|--------|--------|------------|
| `raw.title` | `title` | Direct, fallback generated |
| `raw.price` | `price` | Direct, default 0 |
| `raw.address.city` | `location.city` | Direct |
| `raw.address.lat/lng` | `location.coordinates` | Direct |
| `raw.bedrooms` | `bedrooms` | Fallback: `rooms - 1` |
| `raw.surface` / `raw.living_surface` | `sqm` | First available, default 0 |
| `raw.has_elevator` | `has_elevator` | Boolean, default false |
| `raw.has_balcony` | `has_balcony` | Boolean, default false |
| `raw.has_parking` | `has_parking` | Boolean, default false |
| `raw.has_basement` | `has_basement` | Boolean, default false |
| `raw.energy_class` | `energy_class` | Direct |
| `raw.heating_type` | `heating_type` | Direct |
| `raw.condition` | `condition` | `mapCondition()` |
| `raw.furnished` | `furnished` | Boolean to `'furnished'` string |
| `raw.agent` | `agent` | Direct mapping |

### Condition Mapping (Dutch + French + English)

| Realo Value | TierI Value |
|-------------|-------------|
| `nieuw`, `new`, `neuf` | `new` |
| `excellent`, `uitstekend` | `excellent` |
| `goed`, `good`, `bon` | `good` |
| `gerenoveerd`, `renovat` | `after_renovation` |
| `te renoveren`, `to renovate` | `requires_renovation` |

Note: Realo supports three languages (Dutch, French, English), so condition mapping handles all three.

---

## House, Land, Commercial Transformers

Follow same pattern as apartment transformer with category-specific fields.
