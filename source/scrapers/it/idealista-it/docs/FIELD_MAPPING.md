# Idealista.it Field Mapping

## Universal (All Categories)

| Idealista Field | TierI Field | Type | Notes |
|---|---|---|---|
| `id` | `portal_id` | string | Prefixed with "idealista-" |
| `url` | `source_url` | string | Full URL; prefixed with domain if relative |
| `title` | `title` | string | Fallback: "Apartment" |
| `price` | `price` | number | Always present from search pages |
| `currency` | `currency` | string | Always "EUR" |
| `operation` | `transaction_type` | enum | "rent" → "rent", else "sale" |
| `location.city` | `location.city` | string | City name from search config |
| `location.address` | `location.address` | string | Address from search listing or title |
| `location.province` | `location.region` | string | Province (from detail page if available) |
| (implicit) | `location.country` | string | Always "Italy" |
| (implicit) | `location.country_code` | string | Always "IT" |
| `latitude` | `location.coordinates.lat` | number | From detail page if available |
| `longitude` | `location.coordinates.lon` | number | From detail page if available |
| `description` | `description` | string | From detail page; fallback to empty string |
| `thumbnails[]` | `images[]` | array | From search pages, deduplicated with detail images |
| `thumbnails[]` + detail images | `media.images` | array | Combined unique image array |
| `propertyType` | `property_category` | enum | Derived from search config (apartment/house/land/commercial) |
| `features[]` | `features` | array | Text features from search + detail pages |
| (implicit) | `source_platform` | string | Always "idealista.it" |
| (implicit) | `status` | string | Always "active" |
| `id` + metadata | `portal_metadata.idealista.id` | string | Listing ID |
| `url` | `portal_metadata.idealista.original_url` | string | Original URL |
| `propertyType` | `portal_metadata.idealista.property_type` | string | Property type from search |
| `operation` | `portal_metadata.idealista.operation` | string | sale/rent |
| `location.city` | `portal_metadata.idealista.city` | string | City name |
| `location.neighborhood` | `portal_metadata.idealista.neighborhood` | string | Neighborhood if available |
| Detail agency | `portal_metadata.idealista.agency` | string | Agency name from detail page |

## Apartment

| Idealista Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `rooms` | `bedrooms` | number | `max(rooms - 1, 0)` |
| `rooms` | `rooms` | number | Direct copy |
| `bathrooms` (detail) | `bathrooms` | number | Optional |
| `size` | `sqm` | number | From search; fallback to detail.builtArea or detail.usableArea |
| `floor` (detail) | `floor` | number | Optional |
| `totalFloors` (detail) | `total_floors` | number | Optional |
| Feature: "ascensore" | `has_elevator` | boolean | true if found in features or search flag |
| Feature: "balcon*" | `has_balcony` | boolean | true if "balcone"/"balcon" in features |
| Feature: "parcheggio"/"garage"/"box" | `has_parking` | boolean | true if any parking variant found |
| Feature: "cantina"/"seminterrato" | `has_basement` | boolean | true if basement keyword found |
| Feature: "terrazza"/"terrazzo" | `has_terrace` | boolean | true if terrace keyword found |
| Detail: condition field | `condition` | enum | nuovo→new, ottimo→excellent, buono→good, ristrutturato→after_renovation, da ristrutturare→requires_renovation |
| Detail: heatingType | `heating_type` | string | Optional |
| Detail: energyClass | `energy_class` | string | Optional |
| Detail: yearBuilt | `year_built` | number | Optional |
| Detail: furnished | `furnished` | enum | arredato→furnished, parziale→partially_furnished, non arredato→not_furnished |
| Detail: agencyName | `agent.name` | string | Agency name if available |

## House

| Idealista Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `rooms` | `bedrooms` | number | `max(rooms - 1, 0)` |
| `size` | `sqm_living` | number | Living area |
| (not mapped) | `sqm_plot` | number | Not available from Idealista (set 0) |
| Feature: "giardino" | `has_garden` | boolean | true if garden keyword found |
| Feature: "garage" | `has_garage` | boolean | true if garage keyword found |
| Feature: "parcheggio" | `has_parking` | boolean | true if parking keyword found |
| Feature: "cantina" | `has_basement` | boolean | true if basement keyword found |
| Detail: yearBuilt | `year_built` | number | Optional |
| Detail: condition | `condition` | enum | See apartment mapping |

## Land

| Idealista Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `size` | `area_plot_sqm` | number | Land area from search |
| (inherited) | All universal fields | - | Same as apartment |

## Commercial

| Idealista Field | TierI Field | Type | Transformation |
|---|---|---|---|
| `size` | `sqm_total` | number | Commercial space area |
| Feature: "ascensore" | `has_elevator` | boolean | true if found |
| Feature: "parcheggio" | `has_parking` | boolean | true if found |
| `bathrooms` | `has_bathrooms` | boolean | true if count > 0 |
| Detail: heatingType | `heating_type` | string | Optional |

## Search Page Structure

**Base URL Pattern**: `https://www.idealista.it/{operation}-case/{city}/con-{property-type}/`

Examples:
- `/vendita-case/milano/con-appartamenti/` - Apartment sales in Milan
- `/affitto-case/roma/` - Apartment rentals in Rome
- `/vendita-case/torino/con-chalets/` - House sales in Turin
- `/vendita-terreni/napoli/` - Land sales in Naples
- `/vendita-locali-commerciali/firenze/` - Commercial sales in Florence

**Pagination**:
- Page 1: No suffix (just base URL)
- Page N>1: `pagina-{N}.htm` appended

## HTML Parsing Details

### Listing Card Parsing
- Main selector: `article.item`
- Link selector: `a.item-link` → extracts `href` and text
- ID extraction: `/(\d+)\.htm` regex or `data-adid` attribute
- Price: `.item-price` text, digits only
- Size: `.item-detail span` text searching for "m²" or "mq"
- Rooms: `.item-detail span` text searching for "local" or "stanz"
- Floor: `.item-detail span` text searching for "piano"
- Bathrooms: `.item-detail span` text searching for "bagn"
- Address: `.item-location` or `.item-detail` text
- Images: `img` src or data-src attributes (filtered for logo)
- Features: `.item-tags-container .item-tag` text collection

### Detail Page Parsing (if fetched)
- Title, description from various text sections
- Detailed attributes from table rows or structured data
- Additional images from gallery
- Agency info from contact section
- Year built, heating, energy class from attributes section

## Data Quality Notes
- **Prices**: Always present and reliable
- **Area**: Reliable for apartments/houses; may be 0 for commercial
- **Rooms**: Reliable from search pages
- **Bathrooms**: Only from detail pages; often null
- **Features**: Text-based extraction; some variations in Italian keywords
- **Images**: Typically 1-3 from search, more from detail pages
- **Condition**: Mapped from Italian descriptors; may be missing
- **Energy Class**: Only for newer properties; many null
- **Location**: City is accurate; full address only from detail pages

## Italian Feature Keywords Reference
| Feature | Italian Keywords |
|---|---|
| Elevator | ascensore, montacarichi |
| Balcony | balcone, balconata |
| Parking | parcheggio, garage, box, rimessa |
| Basement | cantina, seminterrato, soffitta |
| Terrace | terrazza, terrazzo |
| Garden | giardino, orto |
| Pool | piscina |
| Fireplace | camino |
| Furnished | arredato, parzialmente arredato, non arredato |
| Condition | nuovo, ottimo, buono, da ristrutturare, ristrutturato |
