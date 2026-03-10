# CeskeReality - Transformer Field Mappings

## Category Routing

Category is determined by the scrape URL (not content detection):

| URL Path | Category | Transformer |
|----------|----------|-------------|
| `/prodej/byty/`, `/pronajem/byty/` | `apartment` | `ceskerealityApartmentTransformer` |
| `/prodej/rodinne-domy/`, `/pronajem/rodinne-domy/` | `house` | `ceskerealityHouseTransformer` |
| `/prodej/pozemky/` | `land` | `ceskerealityLandTransformer` |
| `/prodej/komercni-prostory/`, `/pronajem/komercni-prostory/` | `commercial` | `ceskerealityCommercialTransformer` |
| `/prodej/chaty-chalupy/` | `house` | `ceskerealityHouseTransformer` |

## Common Fields (All Categories)

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `title` | `jsonLd.name` | Direct, fallback `'Untitled'` |
| `price` | `jsonLd.offers.price` | Direct, fallback `0` |
| `currency` | `jsonLd.offers.priceCurrency` | Direct, fallback `'CZK'` |
| `transaction_type` | Hardcoded | `'sale'` |
| `location.city` | `jsonLd.offers.areaServed.address.addressLocality` | Direct, fallback `'Unknown'` |
| `location.country` | Hardcoded | `'Czech Republic'` |
| `location.address` | `jsonLd.offers.areaServed.address.streetAddress` | Direct |
| `location.postal_code` | `jsonLd.offers.areaServed.address.postalCode` | Direct |
| `location.coordinates` | `htmlData.coordinates` | From geo/data-attrs/scripts |
| `description` | `jsonLd.description` | Direct |
| `images` | `htmlData.images` or `jsonLd.image` | HTML gallery preferred, JSON-LD fallback |
| `media.images` | Same as `images` | Structured format |
| `portal_metadata.agent_name` | `jsonLd.offers.offeredby.name` | Direct |
| `portal_metadata.agent_phone` | `jsonLd.offers.offeredby.telephone` | Direct |
| `portal_metadata.original_details` | `htmlData.propertyDetails` | Raw Czech key-value pairs |

## Apartment-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `bedrooms` | `jsonLd.name` | Regex `(\d+)\+(?:kk\|\d)` → `N-1`, fallback from description or `mappedDetails.rooms - 1` |
| `sqm` | `jsonLd.name` or `mappedDetails.sqm` | Regex `([\d\s]+)\s*m[²2]`, mapped details preferred |
| `floor` | `mappedDetails.floor` | From HTML property details table |
| `total_floors` | `mappedDetails.totalFloors` | From HTML property details table |
| `has_elevator` | `jsonLd.description` | Regex `/výtah\|elevator/i` |
| `has_balcony` | `mappedDetails.balconyArea` or description | Area > 0 or regex `/balkon\|balkón\|lodžie\|loggie\|terasa/i` |
| `has_parking` | `mappedDetails.parking` or description | Exists or regex `/parkování\|parking/i` |
| `has_basement` | `mappedDetails.cellarArea` or description | Area > 0 or regex `/sklep\|basement\|cellar/i` |
| `rooms` | `mappedDetails.rooms` | From HTML details |
| `bathrooms` | `mappedDetails.bathrooms` | From HTML details |
| `hoa_fees` | `mappedDetails.hoaFees` | From HTML details |

## House-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `bedrooms` | `jsonLd.name` | Regex `(\d+)\+(?:kk\|\d)` → `N-1`, fallback from description rooms/ložnic patterns |
| `sqm_living` | `mappedDetails.sqmLiving` or `jsonLd.name` | Mapped details preferred, name regex fallback |
| `sqm_plot` | `mappedDetails.sqmPlot` or description | Mapped details preferred, description patterns: `pozemek`, `zahrada`, `plocha pozemku` |
| `has_garden` | Description | Regex `/zahrada\|garden/i` |
| `has_garage` | Description or `mappedDetails.garageCount` | Regex `/garáž\|garage/i` or count > 0 |
| `has_parking` | Description or `mappedDetails.parking` | Regex `/parkování\|parking/i` or exists |
| `has_basement` | Description or `mappedDetails.cellarArea` | Regex `/sklep\|basement\|cellar/i` or area > 0 |
| `stories` | `mappedDetails.totalFloors` | From HTML details |
| `garage_count` | `mappedDetails.garageCount` | From HTML details |

## Land-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `area_plot_sqm` | `mappedDetails.sqmPlot` or `jsonLd.name` or description | Regex `([\d\s]+)\s*m[²2]`, handles space-separated numbers like `2 510 m²` |

## Commercial-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `sqm_total` | `mappedDetails.sqm` or `jsonLd.name` | Mapped details preferred |
| `has_elevator` | Description | Regex `/výtah\|elevator/i` |
| `has_parking` | Description or `mappedDetails.parking` | Regex `/parkování\|parking\|garáž\|garage/i` |
| `has_bathrooms` | Description or `mappedDetails.bathrooms` | Regex `/koupelna\|wc\|bathroom\|toilet/i` |

## Property Details Mapper (`propertyDetailsMapper.ts`)

Maps Czech HTML labels from `.i-info` elements to standardized fields:

| Czech Label Pattern | Mapped Field | Parser |
|---------------------|-------------|--------|
| `patro`, `podlaží` (not `počet`/`celkem`) | `floor` | `parseFloor` (přízemí→0, suterén→-1) |
| `počet podlaží`, `podlaží celkem` | `totalFloors` | `parseFloor` |
| `celková plocha`, `plocha` | `sqm` | `parseArea` |
| `plocha obytná` | `sqmLiving` | `parseArea` |
| `plocha užitná` | `sqmUsable` | `parseArea` |
| `plocha pozemku`, `pozemek` | `sqmPlot` | `parseArea` |
| `plocha zastavěná` | `sqmBuilt` | `parseArea` |
| `balkon`, `balkón` | `balconyArea` | `parseArea` (or 1 as flag) |
| `sklep` | `cellarArea` | `parseArea` |
| `terasa` | `terraceArea` | `parseArea` |
| `lodžie`, `loggie` | `loggiaArea` | `parseArea` |
| `konstrukce`, `typ stavby`, `materiál` | `constructionType` | panel/cihla→brick/beton→concrete/smíšen→mixed |
| `stav` (not zastavěná) | `condition` | novostavba→new/po rekonstrukci→after_renovation/dobrý→good |
| `rok výstavby`, `rok kolaudace` | `yearBuilt` | 4-digit year (1800–current+5) |
| `energetická`, `třída`, `penb` | `energyClass` | Single letter A–G |
| `vlastnictví` | `ownership` | Direct |
| `id nemovitosti` | `propertyId` | Direct |
| `topení`, `vytápění` | `heating` | Direct |
| `voda` | `water` | Direct |
| `kanalizace` | `sewage` | Direct |
| `elektřina`, `proud` | `electricity` | Direct |
| `plyn` | `gas` | Direct |
| `parkování` | `parking` | Direct |
| `počet pokojů` | `rooms` | `parseNumber` |
| `koupelna`, `wc` | `bathrooms` | `parseNumber` |
| `garáž` | `garageCount` | `parseNumber` |
| `rok rekonstrukce` | `renovationYear` | `parseYear` |
| `vybavení`, `zařízení` | `furnished` | částečně→partially_furnished/ano→furnished/ne→not_furnished |
| `datum vložení` | `publishedDate` | Direct |
| `poplatek`, `měsíční náklady` | `hoaFees` | `parseArea` |
| `dostupné od`, `nastěhování` | `availableFrom` | Direct |
| `kauce`, `jistota`, `depozit` | `deposit` | `parseArea` |
