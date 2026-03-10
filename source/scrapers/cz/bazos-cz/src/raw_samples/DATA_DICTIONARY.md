# Bazos — Raw Data Dictionary

## Listing Page Response

### Endpoint: `https://www.bazos.cz/api/v1/ads.php?offset={offset}&limit={limit}&section=RE`

Query parameters:
- `offset` (number) — pagination offset, starts at 0
- `limit` (number) — results per page (e.g. 5, 20)
- `section` (string) — content section, `RE` for real estate

### Response Structure

Returns a JSON array of ad objects. Each element:

- `id` (string) — unique ad identifier, example: `"215430604"`
- `from` (string) — posted datetime in `YYYY-MM-DD HH:MM:SS` format, example: `"2026-02-26 20:05:54"`
- `title` (string) — ad title in Czech, example: `"Domek pro kempy, ubytovaní"`
- `price_formatted` (string) — human-readable price with currency, example: `"340 000 Kč"`
- `currency` (string) — ISO currency code, example: `"CZK"`
- `image_thumbnail` (string) — thumbnail image URL, example: `"https://www.bazos.cz/img/1m/604/215430604.jpg?t=1771959177"`
- `locality` (string) — city/district name, example: `"Kolín"`
- `topped` (string) — whether ad is pinned/promoted, `"true"` or `"false"` (string, not boolean)
- `image_thumbnail_width` (string) — thumbnail width in pixels, example: `"263"`
- `image_thumbnail_height` (string) — thumbnail height in pixels, example: `"350"`
- `favourite` (string) — whether current user favorited it, `"true"` or `"false"` (string, not boolean)
- `url` (string) — full URL to the ad detail page, example: `"https://reality.bazos.cz/inzerat/215430604/domek-pro-kempy-ubytovani.php"`
- `views` (string) — total view count, example: `"1067"`

### Notes

- The listing page provides only basic metadata. No description, coordinates, images array, category, price integer, or contact info.
- `topped`, `favourite` are string booleans (`"true"`/`"false"`), not native booleans.
- `views`, `image_thumbnail_width`, `image_thumbnail_height` are strings, not numbers.
- `price_formatted` includes currency symbol and spaces (e.g. `"340 000 Kc"`). The raw integer price is NOT provided on the listing page.

---

## Detail Page Response

### Endpoint: `https://www.bazos.cz/api/v1/ad-detail-2.php?ad_id={ad_id}`

Query parameters:
- `ad_id` (string) — the ad ID from the listing page

### Response Structure

Returns a single JSON object with the full ad data:

- `id` (string) — unique ad identifier, example: `"215430604"`
- `from` (string) — posted datetime in RFC 2822 format, example: `"Thu, 26 Feb 2026 20:06:00 +0100"`
- `status` (string) — ad status, example: `"active"` (also `"deleted"` for removed ads)
- `topped` (boolean) — whether ad is promoted, example: `true` (native boolean, unlike listing page)
- `title` (string) — ad title, example: `"Domek pro kempy, ubytovaní"`
- `description` (string) — full ad description in Czech, example: `"Nabízím domek pro kemp a nebo jako ubytování. Velikost je 6x4m, sedlová střecha..."`
- `price_formatted` (string) — human-readable price, example: `"340 000 Kč"`
- `currency` (string) — ISO currency code, example: `"CZK"`
- `price` (string) — integer price as string, example: `"340000"` (NOTE: string, not number)
- `price_type` (string) — price qualifier, example: `"EXACT"` (other possible values: negotiable, on request, etc.)
- `name` (string) — category display name (Czech), example: `"Domy"`
- `phone` (string) — partial phone number (first 3 digits), example: `"720"`
- `phone_id` (string) — phone reveal API identifier, example: `"6335774"`
- `email_id` (string) — email reveal API identifier, example: `"8329740"`
- `zip_code` (string) — postal code with space, example: `"280 02"`
- `locality` (string) — city/district name, example: `"Kolín"`
- `latitude` (string) — GPS latitude as string, example: `"50.037738"`
- `longitude` (string) — GPS longitude as string, example: `"15.170059"`
- `category` (object) — category classification:
  - `category.id` (string) — category ID, example: `"68"`
  - `category.title` (string) — Czech category name, example: `"Domy"`
  - `category.url` (string) — URL slug for the category, example: `"dum"`
- `type` (string) — transaction type, example: `"sell"` (also `"rent"`)
- `url` (string) — full detail page URL, example: `"https://reality.bazos.cz/inzerat/215430604/domek-pro-kempy-ubytovani.php"`
- `top_possible` (string) — whether topping is available, example: `"false"`
- `top_total` (string) — total available top slots, example: `"21"`
- `top_limit` (string) — max allowed top count, example: `"21"`
- `topped_for_days` (string) — days the ad has been topped, example: `"42"`
- `action_possible` (string) — whether admin actions are available, example: `"false"`
- `views` (string) — total view count, example: `"1067"`
- `section` (object) — portal section:
  - `section.id` (string) — section code, example: `"RE"` (real estate)
  - `section.title` (string) — section name, example: `"Reality"`
  - `section.url` (string) — section URL slug, example: `"reality"`
  - `section.image` (string) — section icon URL, example: `"https://www.bazos.cz/obrazky/api/reality.png"`
- `images` (string[]) — array of full-resolution image URLs, example: `["https://www.bazos.cz/img/1/604/215430604.jpg?t=1771959177", ...]`
- `image_thumbnail` (string) — main thumbnail URL (same as first image but may differ in resolution)
- `image_thumbnail_width` (string) — thumbnail width, example: `"900"`
- `image_thumbnail_height` (string) — thumbnail height, example: `"1200"`
- `favourite` (string) — user favorite status, example: `"false"`
- `user_ads_count` (string) — total ads by this seller, example: `"8"`
- `user_reviews_count` (string) — seller review count, example: `"16"`

### Notes

- `from` format differs between listing page (`YYYY-MM-DD HH:MM:SS`) and detail page (RFC 2822 `Thu, 26 Feb 2026 20:06:00 +0100`).
- `topped` is a native boolean on the detail page, but a string on the listing page.
- `price` is a string on the detail page (e.g. `"340000"`), must be parsed to integer.
- `latitude`, `longitude` are strings, must be parsed to float.
- `phone` only shows first 3 digits; full phone requires a separate API call using `phone_id`.
- `images` array contains full-resolution URLs (pattern: `/img/{index}/{suffix}/{ad_id}.jpg`).
- Category names are in Czech: `"Domy"` (houses), `"Byty"` (apartments), `"Pozemky"` (land), etc.
- `type` values: `"sell"` for sale, `"rent"` for rental.
- `price_type` values: `"EXACT"` for fixed price; other values may include negotiable/on-request.
- The `description` field contains unstructured Czech text. All structured property data (sqm, disposition, floor, condition, amenities) must be extracted from this text via regex or LLM.

### Known Category IDs

| `category.id` | `category.title` | `category.url` | Mapped Category |
|----------------|-------------------|-----------------|-----------------|
| 68 | Domy | dum | house |
| (varies) | Byty | byt | apartment |
| (varies) | Pozemky | pozemek | land |
| (varies) | Ostatní | ostatni | commercial/other |

---

## Mapping Status

### Listing Page Fields -> StandardProperty / TierI

| Raw Field | StandardProperty Target | Notes |
|-----------|------------------------|-------|
| `id` | `portal_id` | Direct mapping, stable unique ID |
| `from` | `published_date` | Parsed from `YYYY-MM-DD HH:MM:SS` to ISO 8601 |
| `title` | `title` | Direct mapping |
| `price_formatted` | `price` (via parsing) | Parsed by `parsePrice()` — strips `Kc`, spaces, commas |
| `currency` | `currency` | Direct mapping (`CZK`) |
| `image_thumbnail` | `media.images[0]` (fallback) | Used only if detail `images` unavailable |
| `locality` | `location.city`, `location.region` | Split on `-`/`,` for city extraction |
| `topped` | `portal_metadata.bazos.topped` | Stored in portal metadata |
| `image_thumbnail_width` | `portal_metadata.bazos.image_width` | Stored in portal metadata |
| `image_thumbnail_height` | `portal_metadata.bazos.image_height` | Stored in portal metadata |
| `favourite` | `portal_metadata.bazos.favourite` | Stored in portal metadata |
| `url` | `source_url` | Direct mapping |
| `views` | `portal_metadata.bazos.views` | Stored in portal metadata |

### Detail Page Fields -> StandardProperty / TierI

| Raw Field | StandardProperty Target | Notes |
|-----------|------------------------|-------|
| `id` | `portal_id` | Direct mapping |
| `from` | `published_date` | Parsed from RFC 2822 to ISO 8601 |
| `status` | `status` | `"active"` -> `"active"`, `"deleted"` -> skip |
| `topped` | `portal_metadata.bazos.topped` | Portal metadata |
| `title` | `title` | Direct mapping |
| `description` | `description` | Direct mapping; also input to LLM extraction |
| `price_formatted` | `price` (fallback) | Used if `price` field absent |
| `currency` | `currency` | Direct mapping |
| `price` | `price` | Parsed from string to integer |
| `price_type` | `portal_metadata.bazos.price_type` | Not currently mapped; could map to `price_note` |
| `name` | -- | Category display name; redundant with `category.title` |
| `phone` | `agent.phone` (partial) | Only first 3 digits; not currently mapped |
| `phone_id` | `portal_metadata.bazos.phone_id` | Not currently mapped |
| `email_id` | `portal_metadata.bazos.email_id` | Not currently mapped |
| `zip_code` | `location.postal_code` | Direct mapping (stored as `detail_zip_code`) |
| `locality` | `location.city`, `location.region` | Split and cleaned |
| `latitude` | `location.coordinates.lat` | Parsed from string to float |
| `longitude` | `location.coordinates.lon` | Parsed from string to float |
| `category.id` | `portal_metadata.bazos.category_id` | Used for category detection fallback |
| `category.title` | `portal_metadata.bazos.category_title` | Czech category name |
| `category.url` | -- | URL slug; used for category detection |
| `type` | `transaction_type` | `"sell"` -> `"sale"`, `"rent"` -> `"rent"` |
| `url` | `source_url` | Direct mapping |
| `top_possible` | -- | Not mapped (admin/seller feature) |
| `top_total` | -- | Not mapped |
| `top_limit` | -- | Not mapped |
| `topped_for_days` | -- | Not mapped |
| `action_possible` | -- | Not mapped (admin feature) |
| `views` | `portal_metadata.bazos.views` | Portal metadata |
| `section.id` | `portal_metadata.bazos.section` | Usually `"RE"` |
| `section.title` | -- | Always `"Reality"` for this scraper |
| `section.url` | -- | Not mapped |
| `section.image` | -- | Not mapped |
| `images` | `media.images`, `images` | Full-resolution image array |
| `image_thumbnail` | `portal_metadata.bazos.thumbnail_url` | Portal metadata |
| `image_thumbnail_width` | `portal_metadata.bazos.image_width` | Portal metadata |
| `image_thumbnail_height` | `portal_metadata.bazos.image_height` | Portal metadata |
| `favourite` | `portal_metadata.bazos.favourite` | Portal metadata |
| `user_ads_count` | -- | Not currently mapped |
| `user_reviews_count` | -- | Not currently mapped |

### LLM-Extracted Fields (from `description` text)

Bazos provides no structured property attributes in its API. All of the following are extracted from the `description` free-text field using LLM (Azure OpenAI / DeepSeek-V3) or regex fallbacks:

| Extracted Field | StandardProperty Target | Extraction Method |
|-----------------|------------------------|-------------------|
| disposition | `country_specific.czech.disposition`, `czech_disposition` | Regex from title (`\d+\+(?:kk\|1)`), LLM fallback |
| bedrooms | `bedrooms`, `details.bedrooms` | Calculated from disposition (rooms - 1) |
| rooms | `rooms`, `details.rooms` | Parsed from disposition digit |
| sqm / area | `sqm`, `details.area_sqm` | Regex from title/description (`\d+ m2`), LLM |
| sqm_living | `sqm_living` (house) | LLM extraction |
| sqm_plot | `sqm_plot` (house), `area_plot_sqm` (land) | Regex (`pozemek \d+ m2`), LLM |
| bathrooms | `bathrooms`, `details.bathrooms` | LLM extraction only |
| floor | `floor`, `details.floor` | LLM extraction only |
| total_floors | `total_floors`, `details.total_floors` | LLM extraction only |
| year_built | `year_built`, `details.year_built` | LLM extraction only |
| renovation_year | `renovation_year`, `details.renovation_year` | LLM extraction only |
| condition | `condition` | LLM extraction, mapped to enum |
| construction_type | `construction_type` | LLM extraction, mapped to enum |
| furnished | `furnished` | LLM extraction, normalized |
| heating_type | `country_specific.czech.heating_type` | LLM extraction only |
| energy_rating | `country_specific.czech.energy_rating` | LLM extraction only |
| ownership | `country_specific.czech.ownership`, `czech_ownership` | LLM extraction only |
| building_type | `country_specific.czech.building_type` | LLM extraction only |
| area_balcony | `country_specific.czech.area_balcony` | LLM extraction only |
| area_terrace | `country_specific.czech.area_terrace` | LLM extraction only |
| area_loggia | `country_specific.czech.area_loggia` | LLM extraction only |
| area_cellar | `country_specific.czech.area_cellar` | LLM extraction only |
| area_garden | `country_specific.czech.area_garden` | LLM extraction only |
| water_supply | `country_specific.czech.water_supply` | LLM extraction only |
| sewage_type | `country_specific.czech.sewage_type` | LLM extraction only |
| gas_supply | `country_specific.czech.gas_supply` | LLM extraction only |
| electricity_supply | `country_specific.czech.electricity_supply` | LLM extraction only |
| deposit | `deposit` | LLM extraction only |
| hoa_fees | `hoa_fees` | LLM extraction only |
| utility_charges | `utility_charges` | LLM extraction only |
| monthly_price | `country_specific.czech.monthly_price` | LLM extraction only |
| has_elevator | `has_elevator`, `amenities.has_elevator` | LLM extraction, defaults to `false` |
| has_balcony | `has_balcony`, `amenities.has_balcony` | LLM extraction, defaults to `false` |
| has_parking | `has_parking`, `amenities.has_parking` | LLM extraction, defaults to `false` |
| has_basement | `has_basement`, `amenities.has_basement` | LLM extraction, defaults to `false` |
| has_loggia | `has_loggia`, `amenities.has_loggia` | LLM extraction |
| has_terrace | `has_terrace`, `amenities.has_terrace` | LLM extraction |
| has_garden | `has_garden` (house) | LLM extraction, defaults to `false` |
| has_garage | `has_garage` (house) | LLM extraction, defaults to `false` |
| has_pool | `has_pool` (house) | LLM extraction |
| has_fireplace | `has_fireplace` (house) | LLM extraction |
| property_subtype | `property_subtype` | LLM extraction, mapped to enum |
| zoning | `zoning` (land) | LLM extraction, mapped to enum |
| land_type | `land_type` (land) | LLM extraction, mapped to enum |
| road_access | `road_access` (land) | LLM extraction, mapped to enum |
| building_permit | `building_permit` (land) | LLM extraction |
| terrain | `terrain` (land) | LLM extraction, mapped to enum |
| cadastral_number | `cadastral_number` (land) | LLM extraction |
| street | `location.street` | LLM extraction, regex fallback |
| city | `location.city` | LLM extraction, falls back to `locality` |
| district | `location.district` | LLM extraction only |
| region | `location.region` | LLM extraction, falls back to `locality` |
| postal_code | `location.postal_code` | LLM extraction, regex fallback, or `zip_code` from API |

### Fields NOT Currently Mapped

| Raw Field | Reason |
|-----------|--------|
| `price_type` | Could be mapped to `price_note` for "negotiable"/"on request" indicators |
| `phone` / `phone_id` | Only partial phone shown; full reveal requires separate API call |
| `email_id` | Email reveal requires separate API call |
| `user_ads_count` | Seller metadata, not property data |
| `user_reviews_count` | Seller metadata, not property data |
| `top_possible`, `top_total`, `top_limit`, `topped_for_days` | Ad promotion metadata, not property data |
| `action_possible` | Admin/seller feature flag |
| `section.image` | Portal UI asset |

### Category Detection

Bazos does not provide a reliable property category classification for individual listings. The scraper uses a two-tier approach:

1. **API `category` field**: The detail API returns a `category` object (e.g. `{ id: "68", title: "Domy", url: "dum" }`), but this maps to Bazos sections, not property types.
2. **Text-based detection**: `categoryDetection.ts` uses Czech keyword patterns on `title` + `description`:
   - Land: `pozemek`, `parcela`, `pole`, `louka`, `zahrada`, `orna puda`, `vinice`, `sad`
   - House: `rodinny dum`, `RD`, `vila`, `chalupa`, `chata`, `rekrecni objekt`
   - Apartment: `byt`, `\d+\+(?:kk|1)`, `garsoniera`, `garsonka`, `loft`, `mezonet`
   - Default: `apartment` (most common on Bazos)

### Transformer Architecture

The scraper routes listings to one of three category-specific transformers, each using a focused LLM prompt:

- **`bazosApartmentTransformer.ts`** -> `ApartmentPropertyTierI` (bedrooms, sqm, floor, elevator, balcony, etc.)
- **`bazosHouseTransformer.ts`** -> `HousePropertyTierI` (sqm_living, sqm_plot, garden, garage, roof_type, etc.)
- **`bazosLandTransformer.ts`** -> `LandPropertyTierI` (area_plot_sqm, zoning, utilities, terrain, etc.)

A legacy generic transformer (`transformBazosToStandard`) also exists for backward compatibility.
