# iDNES Reality - Transformer Field Mappings

## Category Routing

Category is determined by the scrape URL path:

| URL Path | Property Type | Transaction |
|----------|--------------|-------------|
| `/s/prodej/byty/` | `apartment` | `sale` |
| `/s/pronajem/byty/` | `apartment` | `rent` |
| `/s/prodej/domy/` | `house` | `sale` |
| `/s/pronajem/domy/` | `house` | `rent` |
| `/s/prodej/pozemky/` | `land` | `sale` |
| `/s/pronajem/pozemky/` | `land` | `rent` |
| `/s/prodej/komercni-nemovitosti/` | `commercial` | `sale` |
| `/s/pronajem/komercni-nemovitosti/` | `commercial` | `rent` |
| `/s/prodej/chaty-chalupy/` | `recreation` (→ house) | `sale` |

The main `transformIdnesToStandard()` function routes to category-specific transformers.

## Common Fields (All Categories)

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `title` | `listing.title` | Direct from detail page |
| `price` | `listing.price` | Numeric from detail/dataLayer |
| `currency` | Hardcoded | `'CZK'` |
| `transaction_type` | `listing.transactionType` | From category URL (`sale`/`rent`) |
| `location.city` | `listing.location.city` | From dataLayer `listing_localityCity` |
| `location.country` | Hardcoded | `'Czech Republic'` |
| `location.address` | `listing.location` | `city - cityArea` if available |
| `location.coordinates` | `listing.coordinates` | From dataLayer `listing_lat`/`listing_lon` |
| `description` | `listing.description` | From detail page |
| `images` | `listing.images` | Gallery URLs from detail page |
| `source_url` | `listing.url` | Direct |
| `source_platform` | Hardcoded | `'idnes-reality'` |
| `status` | Hardcoded | `'active'` |

## Value Normalization

Uses shared `czech-value-mappings` for standardizing Czech text values:

### Construction Type Mapping
| Czech Input | Normalized Output |
|-------------|------------------|
| `cihlová`, `cihla`, `zděná` | `brick` |
| `panelová`, `panel` | `prefab` |
| `betonová`, `železobeton` | `concrete` |
| `dřevěná`, `dřevostavba` | `wood` |
| `montovaná` | `prefab` |
| `smíšená` | `mixed` |

### Condition Mapping
| Czech Input | Normalized Output |
|-------------|------------------|
| `novostavba`, `nový` | `new` |
| `výborný`, `velmi dobrý` | `excellent` |
| `dobrý`, `udržovaný` | `good` |
| `po rekonstrukci` | `after_renovation` |
| `před rekonstrukcí`, `k rekonstrukci` | `requires_renovation` |

### Furnished Mapping
| Czech Input | Normalized Output |
|-------------|------------------|
| `vybavený`, `ano` | `furnished` |
| `částečně` | `partially_furnished` |
| `nevybavený`, `ne` | `not_furnished` |

## Apartment-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `bedrooms` | `listing.title` or disposition | Regex `(\d+)\+(?:kk\|\d)` → `N-1` |
| `sqm` | `listing.area` | From dataLayer `listing_area` |
| `floor` | `listing._attributes['podlaží']` | Parsed (přízemí→0, else numeric) |
| `has_elevator` | `listing.features` | Feature badge detection |
| `has_balcony` | `listing.features` | Feature badge detection |
| `has_parking` | `listing.features` | Feature badge detection |
| `has_basement` | `listing.features` | Feature badge detection |
| `deposit` | `listing._attributes` | From deposit/kauce attribute |
| `renovation_year` | `listing._attributes` | Year extraction |
| `available_from` | `listing._attributes` | Date extraction |

## House-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `bedrooms` | Title or description | Disposition pattern extraction |
| `sqm_living` | `listing.area` | From dataLayer |
| `sqm_plot` | `listing._attributes` | `0` (not available in list view) |
| `has_garden` | Features/description | Feature detection |
| `has_garage` | Features/description | Feature detection |
| `has_parking` | Features/description | Feature detection |
| `has_basement` | Features/description | Feature detection |

## Land-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `area_plot_sqm` | `listing.area` | From dataLayer `listing_area` |

## Commercial-Specific Fields

| TierI Field | Source | Extraction |
|-------------|--------|------------|
| `sqm_total` | `listing.area` | From dataLayer |
| `commercial_subtype` | `listing.title` | `detectCommercialSubtype()` — office/warehouse/retail/restaurant/production/other |
| `has_elevator` | Features | Feature detection |
| `has_parking` | Features | Feature detection |
| `has_bathrooms` | Features | Feature detection |

## Checksum Fields

Fields used for change detection (`checksumExtractor.ts`):

| Field | Source |
|-------|--------|
| `price` | `listing.price` |
| `title` | `listing.title` |
| `description` | `listing.description` (truncated) |
| `sqm` | `listing.area` |
| `disposition` | Extracted from title |
| `floor` | `listing.floor` |
