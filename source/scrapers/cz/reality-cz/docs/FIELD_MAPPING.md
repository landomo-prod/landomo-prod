# Reality.cz - Field Mapping Reference

## Mapping Overview (All Categories)

| Portal Source | TierI Field | Category | Transformation | Notes |
|---|---|---|---|---|
| `id` | `portal_id` | all | `"reality-" + id` | Prefixed |
| `url` | `source_url` | all | `"https://reality.cz/{id}/"` | Constructed |
| - | `source_platform` | all | `"reality"` | Constant |
| `title` / `type` / `place` | `title` | all | First non-empty | Title often empty |
| `price.sale.price` / `price.rent.price` | `price` | all | Direct numeric | 0 if missing |
| `price.*.unit` | `currency` | all | "Kc"/"Kc" -> "CZK" | Default CZK |
| offer_type context | `transaction_type` | all | `'sale'` / `'rent'` | From scrape context |
| `place` | `location.address` | all | Direct | Full place string |
| `place` (split " - ") | `location.city` | all | First part before " - " | |
| `place` (split " - ") | `location.region` | all | Last part after " - " | |
| - | `location.country` | all | `"Czech Republic"` | Constant |
| `location.gps.lat` | `location.coordinates.lat` | all | Direct | |
| `location.gps.lng` | `location.coordinates.lon` | all | `lng` -> `lon` rename | |
| `outdated` | `status` | all | `true` -> `'removed'`, `false` -> `'active'` | |
| `description` | `description` | all | Direct | |
| `photos[].name` | `media.images` | all | Prefix `https://api.reality.cz` | |
| `photos[0].name` | `media.main_image` | all | First image URL | |
| `virtual_tours[0].url` | `media.virtual_tour_url` | all | Direct | |
| `images` | `images` (Tier II) | all | Same as media.images | Legacy field |
| `created_at` | `published_date` | all | Direct | |

## Category: Apartment

### Required Fields
| Info Key (Czech) | TierI Field | Transformation | Example |
|---|---|---|---|
| `Dispozice` | `bedrooms` | First digit: `/^(\d)/` | "2+kk" -> 2 |
| `Plocha` / `Uzitna plocha` / `Podlahova plocha` | `sqm` | Parse number from string | "75 m2" -> 75 |
| `Vytah` | `has_elevator` | "Ano" -> true | |
| `Balkon` | `has_balcony` | "Ano" -> true | |
| `Parkovani` / `Parkovaci stani` | `has_parking` | "Ano" -> true | |
| `Sklep` | `has_basement` | "Ano" -> true | |

### Optional Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Dispozice` | `rooms` | "2+1" -> 3, "2+kk" -> 2 | Full room count |
| `Podlazi` / `Patro` | `floor` | Parse first number | "3. podlazi" -> 3 |
| `Pocet podlazi` | `total_floors` | Parse number | "5" -> 5 |
| `Koupelna` / `Koupelny` | `bathrooms` | Parse number, default 1 | |
| `Lodzie` | `has_loggia` | Boolean | |
| `Terasa` | `has_terrace` | Boolean | |
| `Garaz` | `has_garage` | Boolean | |
| `Stav` / `Stav objektu` | `condition` | normalizeCondition() + mapConditionToTierI() | |
| `Topeni` / `Vytapeni` | `heating_type` | normalizeHeatingType() | |
| `Stavba` / `Konstrukce` | `construction_type` | normalizeConstructionType() | |
| `Energeticka trida` / `PENB` | `energy_class` | normalizeEnergyRating() | |
| `Vybaveni` / `Zarizeni` | `furnished` | normalizeFurnished() | |
| `Rok vystavby` / `Rok kolaudace` | `year_built` | Parse 4-digit year | |
| `Rok rekonstrukce` | `renovation_year` | Parse 4-digit year | |
| `Kauce` / `Vratna kauce` / `Jistina` | `deposit` | Parse price (strip non-digits) | |
| `K nastehavani` / `Dostupne od` | `available_from` | DD.MM.YYYY -> YYYY-MM-DD | |
| `floor` (computed) | `floor_location` | 0 -> ground_floor, else middle_floor | |

## Category: House

### Required Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Dispozice` | `bedrooms` | First digit, default 1 | "4+1" -> 4 |
| `Plocha` / `Uzitna plocha` / `Obytna plocha` | `sqm_living` | Parse number, default 0 | "120 m2" -> 120 |
| `Plocha pozemku` / `Pozemek` / `Plocha parcely` | `sqm_plot` | Parse number, default 0 | "850 m2" -> 850 |
| `Zahrada` | `has_garden` | Boolean | |
| `Garaz` | `has_garage` | Boolean | |
| `Parkovani` | `has_parking` | Boolean | |
| `Sklep` | `has_basement` | Boolean | |

### Optional Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Bazen` | `has_pool` | Boolean | |
| `Krb` | `has_fireplace` | Boolean | |
| `Terasa` | `has_terrace` | Boolean | |
| `Balkon` | `has_balcony` | Boolean | |
| `Pocet podlazi` | `stories` | Parse number | |
| `Plocha zahrady` | `garden_area` | Parse area | |
| has_garage (computed) | `garage_count` | 1 if has_garage else undefined | |
| has_parking (computed) | `parking_spaces` | 1 if has_parking else undefined | |
| Same building fields as apartment | condition, heating_type, etc. | Same transformations | |

## Category: Land

### Required Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Plocha` / `Plocha pozemku` / `Plocha parcely` | `area_plot_sqm` | Parse number, default 0 | "2500 m2" -> 2500 |

### Optional Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Voda` | `water_supply` | "Ano" -> `'mains'` | |
| `Kanalizace` | `sewage` | "Ano" -> `'mains'` | |
| `Elektrina` / `Elektrika` | `electricity` | "Ano" -> `'connected'` | |
| `Plyn` | `gas` | "Ano" -> `'connected'` | |
| `Prijezdova cesta` / `Komunikace` | `road_access` | "Ano" -> `'paved'` | |
| `Stavebni povoleni` | `building_permit` | "Ano" -> true | |
| `Katastralni cislo` | `cadastral_number` | Direct string | |
| `Vyuziti` / `Typ pozemku` | `zoning` | mapZoning() | See Transformation Logic |
| `Vlastnictvi` | `ownership_type` | normalizeOwnership() | |

## Category: Commercial

### Required Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Plocha` / `Celkova plocha` / `Uzitna plocha` | `sqm_total` | Parse number, default 0 | "250 m2" -> 250 |
| `Vytah` | `has_elevator` | Boolean | |
| `Parkovani` | `has_parking` | Boolean | |
| `WC` / `Socialni zarizeni` | `has_bathrooms` | Boolean, default true | |

### Optional Fields
| Info Key | TierI Field | Transformation | Example |
|---|---|---|---|
| `Uzitna plocha` | `sqm_usable` | Parse area | |
| `Kancelarska plocha` | `sqm_office` | Parse area | |
| `Prodejni plocha` | `sqm_retail` | Parse area | |
| `Skladova plocha` / `Sklad` | `sqm_storage` | Parse area | |
| `Plocha pozemku` | `sqm_plot` | Parse area | |
| `Podlazi` / `Patro` | `floor` | Parse number | |
| `Pocet podlazi` | `total_floors` | Parse number | |
| `Pocet mistnosti` / `Pocet kancelari` | `office_rooms` | Parse number | |
| `Svetla vyska` / `Vyska stropu` | `ceiling_height` | Parse decimal | |
| `Pocet parkovacich mist` | `parking_spaces` | Parse number | |
| `Rampa` / `Nakladaci rampa` | `has_loading_dock` | Boolean | |
| `Klimatizace` / `Vzduchotechnika` | `has_hvac` | Boolean | |
| `Klimatizace` | `has_air_conditioning` | Boolean | |
| `Bezpecnostni system` / `Alarm` | `has_security_system` | Boolean | |
| `Recepce` | `has_reception` | Boolean | |
| `Kuchynka` / `Kuchyn` | `has_kitchen` | Boolean | |
| `Bezbarierovy` | `has_disabled_access` | Boolean | |
| `Opticky internet` / `Internet` | `has_fiber_internet` | Boolean | |
| `Typ` / `Druh` / title | `property_subtype` | detectCommercialSubtype() | |
| price (when rent) | `monthly_rent` | Direct | |
| price / sqm_total | `price_per_sqm` | Calculated | |
| `Provozni naklady` | `operating_costs` | Parse price | |
| `Poplatky za sluzby` | `service_charges` | Parse price | |
| `Vyuziti` / `Urceni` | country_specific.czech.zoning | detectZoning() | |

## Special Handling

### Calculated Fields
- **`bedrooms`**: Derived from `Dispozice` - first digit of "2+kk" / "3+1" pattern
- **`rooms`**: Full room count from disposition: "2+1" = 3 rooms, "2+kk" = 2 rooms
- **`price_per_sqm`**: `price / sqm` (apartment) or `price / sqm_total` (commercial)
- **`floor_location`**: Derived from floor number (0 = ground, negative = basement, else middle/top)
- **`portal_id`**: `"reality-" + listing.id`
- **`source_url`**: `"https://reality.cz/{id}/"`
- **`media.images`**: Photo paths prefixed with `https://api.reality.cz`

### Default Values
| TierI Field | Default | Condition |
|---|---|---|
| `property_category` | - | Always set from detection |
| `status` | `'active'` | Unless `outdated` is true |
| `currency` | `'CZK'` | If unit missing or Czech |
| `location.country` | `'Czech Republic'` | Always |
| `source_platform` | `'reality'` | Always |
| `bedrooms` | 1 | If disposition missing |
| `bathrooms` | 1 | If info key missing |
| `sqm` / `sqm_living` / `sqm_total` / `area_plot_sqm` | 0 | If area missing |
| `has_bathrooms` (commercial) | true | Always for commercial |
| All `has_*` booleans | false | If info key missing |

### Missing Field Strategy
| TierI Field | If Portal Missing | Strategy |
|---|---|---|
| `bedrooms` | Missing disposition | Default to 1 |
| `sqm` / area fields | Missing area info | Default to 0 |
| `floor` | Missing floor info | `undefined` |
| `condition` | Missing Stav | `undefined` |
| `heating_type` | Missing Topeni | `undefined` |
| `gps` | Missing location | `coordinates: undefined` |
| `description` | Not in detail | `undefined` |

## Tier II: Country Specific (`country_specific.czech`)

| Field | Source | Category | Example |
|---|---|---|---|
| `disposition` | `Dispozice` via normalizeDisposition() | apt, house | "2+kk" |
| `ownership` | `Vlastnictvi` via normalizeOwnership() | apt, house, land | "personal" |
| `condition` | `Stav` via normalizeCondition() | apt, house, comm | "very_good" |
| `heating_type` | `Topeni` via normalizeHeatingType() | apt, house, comm | "central" |
| `construction_type` | `Stavba` via normalizeConstructionType() | apt, house, comm | "panel" |
| `energy_rating` | `Energeticka trida` via normalizeEnergyRating() | apt, house, comm | "B" |
| `furnished` | `Vybaveni` via normalizeFurnished() | apt, house, comm | "partially" |
| `floor_number` | `Podlazi` | apt | 3 |
| `is_barrier_free` | `Bezbarierovy` | apt | true |
| `has_ac` | `Klimatizace` | apt | true |
| `renovation_year` | `Rok rekonstrukce` | house | 2020 |
| `has_garden` | `Zahrada` | house | true |
| `zoning` | `Vyuziti` via mapZoning() | land | "residential" |
| `water_supply` | `Voda` | land | "mains" |
| `sewage` | `Kanalizace` | land | "mains" |
| `electricity` | `Elektrina` | land | "connected" |
| `gas` | `Plyn` | land | "connected" |
| `road_access` | `Prijezdova cesta` | land | "paved" |

## Tier III: Portal Metadata (`portal_metadata.reality`)

| Field | Source | Example |
|---|---|---|
| `id` | `listing.id` | "123456" |
| `custom_id` | `listing.custom_id` | "ABC-789" |
| `api_type` | `listing.api_type` | "byt 2+1, 62 m2" |
| `price_note` | `listing.price_note` | "Cena vcetne DPH" |
| `previous_price` | `listing.previous_price` | "5 800 000" |
| `has_commission` | `listing.has_commission` | true |
| `created_at` | `listing.created_at` | "2026-01-15T10:00:00Z" |
| `modified_at` | `listing.modified_at` | "2026-02-01T14:30:00Z" |
| `scraped_at` | `listing.scraped_at` | "2026-02-16T08:00:00Z" |
| `outdated` | `listing.outdated` | false |
| `contact.company` | `contact.real_estate.name` | "RE/MAX Czech" |
| `contact.broker` | `contact.broker.name` | "Jan Novak" |
