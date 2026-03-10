# Funda Transformers

## Architecture

The detail queue worker (`detailQueue.ts`) determines the property type via `mapFundaType()` and routes to the appropriate category transformer. All transformers receive a `FundaDetailData` object parsed from the detail page.

### Property Type Detection

**Source:** `detail.propertyType` from `__NEXT_DATA__` or HTML, mapped via `mapFundaType()`

| Dutch Term | Category |
|------------|----------|
| appartement, flat, bovenwoning, benedenwoning, maisonnette, penthouse, portiek | `apartment` |
| woonhuis, villa, herenhuis, grachtenpand, landhuis, bungalow, twee-onder-een-kap, hoekwoning, tussenwoning, geschakelde, vrijstaand | `house` |
| bouwgrond, perceel, grond | `land` |
| bedrijfspand, kantoor, winkel, horeca, praktijk | `commercial` |

---

## Apartment Transformer

File: `src/transformers/apartmentTransformer.ts`
Output: `ApartmentPropertyTierI`

### Field Mapping

| Source (FundaDetailData) | Target (TierI) | Conversion |
|--------------------------|-----------------|------------|
| `address` | `title` | Direct |
| `price` | `price` | Direct number |
| `transactionType` | `transaction_type` | `'sale'` or `'rent'` |
| `address` | `location.address` | Direct |
| `city` | `location.city` | Direct |
| `postcode` | `location.postal_code` | Direct |
| `province` | `location.region` | Direct |
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
| `images` | `images` | Array of URLs from `cloud.funda.nl` |
| `agentName` | `agent.name` | Direct |

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

---

## Land Transformer

File: `src/transformers/landTransformer.ts`
Output: `LandPropertyTierI`

### Land-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `plotArea` or `livingArea` | `area_plot_sqm` | Fallback chain, default 0 |

---

## Commercial Transformer

File: `src/transformers/commercialTransformer.ts`
Output: `CommercialPropertyTierI`

### Commercial-Specific Fields

| Source | Target | Conversion |
|--------|--------|------------|
| `livingArea` | `sqm_total` | Direct, default 0 |
| `hasElevator` | `has_elevator` | Boolean |
| `hasParking` | `has_parking` | Boolean |
| `bathrooms` | `has_bathrooms` | Direct number, default 0 |

---

## Common Fields (All Categories)

All transformers set:
- `property_category` — category string
- `currency` — always `'EUR'`
- `location.country` — always `'NL'`
- `source_platform` — always `'funda'`
- `portal_id` — `funda-{id}`
- `status` — always `'active'`

## Dutch Field Names Reference

| Dutch (Funda) | English | Used In |
|----------------|---------|---------|
| KoopPrijs | Sale price | Search result |
| HuurPrijs | Rent price | Search result |
| WoonOppervlakte | Living area (sqm) | Search + detail |
| PercOppervlakte / Perceeloppervlakte | Plot area (sqm) | Search + detail |
| AantalKamers | Number of rooms | Search + detail |
| AantalSlaapkamers | Number of bedrooms | Search + detail |
| AantalBadkamers | Number of bathrooms | Search + detail |
| Energielabel | Energy label (A-G) | Search + detail |
| BouwJaar | Year built | Search + detail |
| Tuin | Garden | Feature detection |
| Garage | Garage | Feature detection |
| Balkon | Balcony | Feature detection |
| Lift | Elevator | Feature detection |
| Parkeren | Parking | Feature detection |
| Kelder / Berging | Basement / Storage | Feature detection |
| Woonplaats | City/Place | Location |
| Postcode | Postal code | Location |
| Provincie | Province | Location |
| Adres | Address | Location |
| MakelaarNaam | Agent name | Agent info |
