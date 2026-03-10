# Pararius Transformers

## Architecture

The detail queue worker (`detailQueue.ts`) routes to the appropriate transformer based on `propertyType` from the orchestrator. Since Pararius is rental-only, all transformers set `transaction_type: 'rent'`.

### Property Type Routing

| Orchestrator Type | Transformer |
|-------------------|-------------|
| `house` | `transformToHouse` |
| `apartment` (default) | `transformToApartment` |

Land and commercial transformers exist but are unused — Pararius only lists apartments and houses.

---

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Source (ParariusDetailData) | Target (TierI) | Conversion |
|-----------------------------|-----------------|------------|
| `address` | `title` | Direct |
| `price` | `price` | Monthly rent in EUR |
| (hardcoded) | `transaction_type` | Always `'rent'` |
| `address` | `location.address` | Direct |
| `city` | `location.city` | Direct |
| `postalCode` | `location.postal_code` | Direct |
| `latitude`, `longitude` | `location.coordinates` | `{lat, lng}` if both present |
| `bedrooms` or `rooms - 1` | `bedrooms` | Fallback: rooms minus 1, min 0 |
| `bathrooms` | `bathrooms` | Direct |
| `livingArea` | `sqm` | Direct, default 0 |
| `floor` | `floor` | Direct |
| `totalFloors` | `total_floors` | Direct |
| `rooms` | `rooms` | Direct |
| `hasElevator` | `has_elevator` | Boolean |
| `hasBalcony` | `has_balcony` | Boolean |
| `hasParking` | `has_parking` | Boolean |
| `hasBasement` | `has_basement` | Boolean |
| `hasGarage` | `has_garage` | Boolean |
| `energyLabel` | `energy_class` | Direct string (A-G) |
| `yearBuilt` | `year_built` | Direct number |
| `furnished` | `furnished` | Mapped: gemeubileerd/gestoffeerd/other |
| `availableFrom` | `available_from` | Direct string |
| `deposit` | `deposit` | EUR amount |
| `images` | `images` | Array of URLs |
| `agentName` | `agent.name` | Direct |

### Furnished Mapping

| Dutch Input | TierI Output |
|-------------|--------------|
| `*gemeubileerd*` | `furnished` |
| `*gestoffeerd*` | `partially_furnished` |
| (other non-empty) | `not_furnished` |

---

## House Transformer

File: `src/transformers/houseTransformer.ts`
Output: `HousePropertyTierI`

### House-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `livingArea` | `sqm_living` | Direct, default 0 |
| `plotArea` | `sqm_plot` | Direct, default 0 |
| `hasGarden` | `has_garden` | Boolean |
| `hasGarage` | `has_garage` | Boolean |
| `hasParking` | `has_parking` | Boolean |
| `hasBasement` | `has_basement` | Boolean |
| `availableFrom` | `available_from` | Direct string |
| `deposit` | `deposit` | EUR amount |

---

## Common Fields (All Categories)

All transformers set:
- `property_category` — category string
- `currency` — always `'EUR'`
- `transaction_type` — always `'rent'`
- `location.country` — always `'NL'`
- `source_platform` — always `'pararius'`
- `portal_id` — `pararius-{id}`
- `status` — always `'active'`

## Dutch Field Names Reference

| Dutch (Pararius HTML) | English | Used In |
|------------------------|---------|---------|
| woonoppervlakte / oppervlakte | Living area (sqm) | Features table |
| perceeloppervlakte | Plot area (sqm) | Features table |
| kamers / aantal kamers | Number of rooms | Features table |
| slaapkamers | Number of bedrooms | Features table |
| badkamers | Number of bathrooms | Features table |
| energielabel | Energy label (A-G) | Features table |
| bouwjaar | Year built | Features table |
| postcode | Postal code | Features table |
| borg / waarborgsom | Security deposit | Features table |
| beschikbaar vanaf | Available from | Features table |
| interieur / gemeubileerd | Furnished status | Features table |
| tuin | Garden | Feature detection |
| garage | Garage | Feature detection |
| kelder / berging | Basement / Storage | Feature detection |
| balkon | Balcony | Feature detection |
| lift | Elevator | Feature detection |
| parkeer / parking | Parking | Feature detection |
