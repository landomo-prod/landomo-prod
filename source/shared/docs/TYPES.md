# Tier I Property Types

Category-specific TypeScript interfaces for the four main property categories plus "other". Each type enforces required fields relevant to that category and maps to a PostgreSQL partition.

All types are defined in `src/types/` and exported from `@landomo/core`.

## Common Base Fields

All five Tier I types share these fields:

### Required Fields (all categories)

| Field | Type | Description |
|-------|------|-------------|
| `property_category` | `string` literal | Category discriminator: `'apartment'`, `'house'`, `'land'`, `'commercial'`, `'other'` |
| `title` | `string` | Listing title |
| `price` | `number` | Listing price |
| `currency` | `string` | Currency code (CZK, EUR, etc.) |
| `transaction_type` | `'sale' \| 'rent'` | Transaction type |
| `location` | `PropertyLocation` | Location object (city and country required) |
| `source_url` | `string` | Original listing URL |
| `source_platform` | `string` | Portal name (sreality, bezrealitky, etc.) |
| `status` | `'active' \| 'removed' \| 'sold' \| 'rented'` | Listing lifecycle status |

### PropertyLocation

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `city` | `string` | Yes | City name |
| `country` | `string` | Yes | Country name |
| `address` | `string` | No | Full address |
| `region` | `string` | No | Region/state |
| `postal_code` | `string` | No | Postal/ZIP code |
| `coordinates` | `{lat: number, lon: number}` | No | GPS coordinates |
| `geohash` | `string` | No | Geohash string |

### Shared Optional Fields (all categories)

| Field | Type | Description |
|-------|------|-------------|
| `portal_id` | `string` | Portal-specific listing ID |
| `media` | `PropertyMedia` | Images, virtual tours, floor plans, videos |
| `agent` | `PropertyAgent` | Agent/agency contact info |
| `features` | `string[]` | Feature tags |
| `description` | `string` | Full description |
| `images` | `string[]` | **Deprecated.** Use `media.images` |
| `videos` | `string[]` | **Deprecated.** Use `media.videos` |
| `portal_metadata` | `any` | Portal-specific JSONB (Tier III) |
| `country_specific` | `any` | Country-specific JSONB (Tier II) |
| `first_seen_at` | `Date` | First ingestion timestamp |
| `last_seen_at` | `Date` | Last seen timestamp |
| `created_at` | `Date` | DB creation timestamp |
| `updated_at` | `Date` | DB update timestamp |

---

## ApartmentPropertyTierI

**File:** `src/types/ApartmentPropertyTierI.ts`
**Partition:** `properties_apartment`
**DB prefix:** `apt_*`
**Type guard:** `isApartmentProperty()`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_category` | `'apartment'` | Must be `'apartment'` |
| `bedrooms` | `number` | Bedroom count (rooms - 1 for Czech: 2+kk = 1 bedroom) |
| `sqm` | `number` | Living area in square meters |
| `has_elevator` | `boolean` | Building has elevator |
| `has_balcony` | `boolean` | Apartment has balcony |
| `has_parking` | `boolean` | Has parking space |
| `has_basement` | `boolean` | Has basement/cellar storage |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_subtype` | `'standard' \| 'penthouse' \| 'loft' \| 'atelier' \| 'maisonette' \| 'studio'` | Sub-type |
| `bathrooms` | `number` | Bathroom count |
| `floor` | `number` | Floor number (0 = ground) |
| `total_floors` | `number` | Total floors in building |
| `rooms` | `number` | Total room count |
| `balcony_area` | `number` | Balcony area in sqm |
| `parking_spaces` | `number` | Parking space count |
| `cellar_area` | `number` | Cellar area in sqm |
| `has_loggia` | `boolean` | Has loggia (covered balcony) |
| `loggia_area` | `number` | Loggia area in sqm |
| `has_terrace` | `boolean` | Has terrace |
| `terrace_area` | `number` | Terrace area in sqm |
| `has_garage` | `boolean` | Has garage |
| `garage_count` | `number` | Garage count |
| `year_built` | `number` | Construction year |
| `construction_type` | `'panel' \| 'brick' \| 'concrete' \| 'mixed'` | Construction type |
| `condition` | `'new' \| 'excellent' \| 'good' \| 'after_renovation' \| 'requires_renovation'` | Condition |
| `heating_type` | `string` | Heating system |
| `energy_class` | `string` | Energy class (A-G) |
| `floor_location` | `'ground_floor' \| 'middle_floor' \| 'top_floor'` | Floor classification |
| `furnished` | `'furnished' \| 'partially_furnished' \| 'not_furnished'` | Furnished status |
| `renovation_year` | `number` | Last renovation year |
| `published_date` | `string` | Portal publication date (ISO 8601) |
| `hoa_fees` | `number` | Monthly HOA fees |
| `deposit` | `number` | Security deposit (rentals) |
| `utility_charges` | `number` | Monthly utility charges |
| `service_charges` | `number` | Monthly service charges |
| `available_from` | `string` | Availability date (ISO) |
| `min_rent_days` | `number` | Minimum rental period (days) |
| `max_rent_days` | `number` | Maximum rental period (days) |

---

## HousePropertyTierI

**File:** `src/types/HousePropertyTierI.ts`
**Partition:** `properties_house`
**DB prefix:** `house_*`
**Type guard:** `isHouseProperty()`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_category` | `'house'` | Must be `'house'` |
| `bedrooms` | `number` | Bedroom count |
| `sqm_living` | `number` | Living area in sqm (interior usable space) |
| `sqm_plot` | `number` | Plot/land area in sqm |
| `has_garden` | `boolean` | Has garden/yard |
| `has_garage` | `boolean` | Has garage |
| `has_parking` | `boolean` | Has parking space |
| `has_basement` | `boolean` | Has basement/cellar |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_subtype` | `'detached' \| 'semi_detached' \| 'terraced' \| 'villa' \| 'cottage' \| 'farmhouse' \| 'townhouse' \| 'bungalow'` | Sub-type |
| `bathrooms` | `number` | Bathroom count |
| `sqm_total` | `number` | Total built area in sqm |
| `stories` | `number` | Number of stories |
| `rooms` | `number` | Total rooms |
| `garden_area` | `number` | Garden area in sqm |
| `garage_count` | `number` | Garage count |
| `parking_spaces` | `number` | Parking space count |
| `cellar_area` | `number` | Cellar area in sqm |
| `has_pool` | `boolean` | Has swimming pool |
| `has_fireplace` | `boolean` | Has fireplace |
| `has_terrace` | `boolean` | Has terrace |
| `terrace_area` | `number` | Terrace area in sqm |
| `has_attic` | `boolean` | Has usable attic |
| `has_balcony` | `boolean` | Has balcony |
| `balcony_area` | `number` | Balcony area in sqm |
| `year_built` | `number` | Construction year |
| `renovation_year` | `number` | Last renovation year |
| `construction_type` | `'brick' \| 'wood' \| 'stone' \| 'concrete' \| 'mixed'` | Construction type |
| `condition` | `'new' \| 'excellent' \| 'good' \| 'after_renovation' \| 'requires_renovation'` | Condition |
| `heating_type` | `string` | Heating system |
| `roof_type` | `'flat' \| 'gable' \| 'hip' \| 'mansard' \| 'gambrel'` | Roof type |
| `energy_class` | `string` | Energy class (A-G) |
| `furnished` | `'furnished' \| 'partially_furnished' \| 'not_furnished'` | Furnished status |
| `published_date` | `string` | Portal publication date (ISO 8601) |
| `property_tax` | `number` | Annual property tax |
| `hoa_fees` | `number` | Annual HOA fees |
| `deposit` | `number` | Security deposit |
| `utility_charges` | `number` | Monthly utility charges |
| `service_charges` | `number` | Monthly service charges |
| `available_from` | `string` | Availability date (ISO) |
| `min_rent_days` | `number` | Minimum rental period (days) |
| `max_rent_days` | `number` | Maximum rental period (days) |

---

## LandPropertyTierI

**File:** `src/types/LandPropertyTierI.ts`
**Partition:** `properties_land`
**DB prefix:** `land_*`
**Type guard:** `isLandProperty()`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_category` | `'land'` | Must be `'land'` |
| `area_plot_sqm` | `number` | Plot area in square meters (main metric) |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_subtype` | `'building_plot' \| 'agricultural' \| 'forest' \| 'vineyard' \| 'orchard' \| 'recreational' \| 'industrial'` | Sub-type |
| `zoning` | `'residential' \| 'commercial' \| 'agricultural' \| 'mixed' \| 'industrial' \| 'recreational'` | Zoning classification |
| `land_type` | `'arable' \| 'grassland' \| 'forest' \| 'vineyard' \| 'orchard' \| 'building_plot' \| 'meadow' \| 'pasture'` | Land type |
| `water_supply` | `'mains' \| 'well' \| 'connection_available' \| 'none'` | Water supply status |
| `sewage` | `'mains' \| 'septic' \| 'connection_available' \| 'none'` | Sewage status |
| `electricity` | `'connected' \| 'connection_available' \| 'none'` | Electricity status |
| `gas` | `'connected' \| 'connection_available' \| 'none'` | Gas status |
| `road_access` | `'paved' \| 'gravel' \| 'dirt' \| 'none'` | Road access |
| `has_water_connection` | `boolean` | **Deprecated.** Use `water_supply` |
| `has_electricity_connection` | `boolean` | **Deprecated.** Use `electricity` |
| `has_sewage_connection` | `boolean` | **Deprecated.** Use `sewage` |
| `has_gas_connection` | `boolean` | **Deprecated.** Use `gas` |
| `building_permit` | `boolean` | Has building permit |
| `max_building_coverage` | `number` | Max building coverage (%) |
| `max_building_height` | `number` | Max building height (meters) |
| `terrain` | `'flat' \| 'sloped' \| 'hilly' \| 'mountainous'` | Terrain type |
| `soil_quality` | `'excellent' \| 'good' \| 'fair' \| 'poor'` | Soil quality |
| `cadastral_number` | `string` | Land registry ID |
| `ownership_type` | `'personal' \| 'state' \| 'municipal' \| 'cooperative'` | Ownership type |
| `available_from` | `string` | Availability date (ISO) |
| `furnished` | `'furnished' \| 'partially_furnished' \| 'not_furnished'` | Furnished status (rare for land) |
| `renovation_year` | `number` | Last renovation year |
| `published_date` | `string` | Portal publication date (ISO 8601) |

---

## CommercialPropertyTierI

**File:** `src/types/CommercialPropertyTierI.ts`
**Partition:** `properties_commercial`
**DB prefix:** `comm_*`
**Type guard:** `isCommercialProperty()`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_category` | `'commercial'` | Must be `'commercial'` |
| `sqm_total` | `number` | Total floor area in sqm (main metric) |
| `has_elevator` | `boolean` | Building has elevator |
| `has_parking` | `boolean` | Has parking |
| `has_bathrooms` | `boolean` | Has bathroom facilities |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_subtype` | `'office' \| 'retail' \| 'industrial' \| 'warehouse' \| 'mixed_use' \| 'hotel' \| 'restaurant' \| 'medical' \| 'showroom'` | Sub-type |
| `sqm_usable` | `number` | Usable/leasable area in sqm |
| `sqm_office` | `number` | Office space area |
| `sqm_retail` | `number` | Retail space area |
| `sqm_storage` | `number` | Storage area |
| `sqm_plot` | `number` | Plot area |
| `total_floors` | `number` | Total floors |
| `floor` | `number` | Floor number |
| `floor_location` | `'ground_floor' \| 'middle_floor' \| 'top_floor' \| 'basement' \| 'multiple_floors'` | Floor classification |
| `office_rooms` | `number` | Office room count |
| `meeting_rooms` | `number` | Meeting room count |
| `ceiling_height` | `number` | Ceiling height (meters) |
| `elevator_count` | `number` | Elevator count |
| `parking_spaces` | `number` | Parking space count |
| `has_loading_dock` | `boolean` | Has loading dock |
| `loading_dock_count` | `number` | Loading dock count |
| `has_hvac` | `boolean` | Has HVAC system |
| `has_air_conditioning` | `boolean` | Has AC |
| `has_security_system` | `boolean` | Has security system |
| `has_security_staff` | `boolean` | Has 24/7 security |
| `has_reception` | `boolean` | Has reception |
| `has_kitchen` | `boolean` | Has kitchen |
| `bathroom_count` | `number` | Bathroom count |
| `has_disabled_access` | `boolean` | Wheelchair accessible |
| `has_server_room` | `boolean` | Has server room |
| `has_backup_generator` | `boolean` | Has backup generator |
| `has_fiber_internet` | `boolean` | Has fiber optic |
| `has_sprinklers` | `boolean` | Has sprinkler system |
| `has_racking_system` | `boolean` | Has warehouse racking |
| `has_showroom` | `boolean` | Has showroom area |
| `has_outdoor_space` | `boolean` | Has outdoor space |
| `outdoor_area` | `number` | Outdoor area in sqm |
| `year_built` | `number` | Construction year |
| `renovation_year` | `number` | Last renovation year |
| `construction_type` | `'brick' \| 'concrete' \| 'steel' \| 'mixed' \| 'prefab'` | Construction type |
| `condition` | `'new' \| 'excellent' \| 'good' \| 'fair' \| 'requires_renovation'` | Condition |
| `heating_type` | `string` | Heating system |
| `energy_class` | `string` | Energy class (A-G) |
| `building_class` | `'a' \| 'b' \| 'c'` | Building grade |
| `furnished` | `'furnished' \| 'partially_furnished' \| 'not_furnished'` | Furnished status |
| `published_date` | `string` | Portal publication date (ISO 8601) |
| `monthly_rent` | `number` | Monthly rent |
| `annual_rent` | `number` | Annual rent |
| `price_per_sqm` | `number` | Price per sqm |
| `operating_costs` | `number` | Monthly operating costs |
| `service_charges` | `number` | Monthly service charges |
| `utility_costs` | `number` | Monthly utility costs |
| `property_tax` | `number` | Annual property tax |
| `deposit` | `number` | Security deposit |
| `min_lease_months` | `number` | Minimum lease term (months) |
| `max_lease_months` | `number` | Maximum lease term (months) |
| `commission` | `number` | Broker commission |
| `cam_charges` | `number` | Common Area Maintenance charges |
| `business_rates` | `number` | Annual business rates (UK) |
| `available_from` | `string` | Availability date (ISO) |
| `lease_type` | `'triple_net' \| 'double_net' \| 'single_net' \| 'gross' \| 'modified_gross' \| 'percentage'` | Lease type |
| `occupancy_status` | `'vacant' \| 'partially_occupied' \| 'fully_occupied' \| 'owner_occupied'` | Occupancy status |
| `tenant_count` | `number` | Tenant count |
| `zoning` | `'commercial' \| 'industrial' \| 'mixed_use' \| 'retail' \| 'office'` | Zoning |
| `has_business_license` | `boolean` | Has business license |
| `has_occupancy_certificate` | `boolean` | Has occupancy certificate |
| `permitted_uses` | `string[]` | Permitted business types |

---

## OtherPropertyTierI

**File:** `src/types/OtherPropertyTierI.ts`
**Partition:** N/A
**Type guard:** `isOtherProperty()`

For garages, parking spaces, mobile homes, storage units, and miscellaneous properties.

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_category` | `'other'` | Must be `'other'` |
| `sqm_total` | `number` | Total area in sqm |
| `has_parking` | `boolean` | Has parking |
| `has_electricity` | `boolean` | Has electricity connection |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `property_subtype` | `'garage' \| 'parking_space' \| 'mobile_home' \| 'storage' \| 'other'` | Sub-type |
| `parking_spaces` | `number` | Parking space count |
| `has_water_connection` | `boolean` | Has water |
| `has_heating` | `boolean` | Has heating |
| `security_type` | `string` | Security system type |
| `access_type` | `'direct' \| 'remote' \| 'keycard'` | Access type |
| `year_built` | `number` | Construction year |
| `construction_type` | `'brick' \| 'concrete' \| 'steel' \| 'prefab' \| 'wood'` | Construction type |
| `condition` | `'new' \| 'excellent' \| 'good' \| 'fair' \| 'requires_renovation'` | Condition |
| `deposit` | `number` | Security deposit |
| `service_charges` | `number` | Monthly service charges |
| `available_from` | `string` | Availability date (ISO) |

---

## Country-Specific Tier II Types

JSONB fields stored in `country_specific` column. Defined in `src/types/property.ts`.

| Interface | Country | Key Fields |
|-----------|---------|------------|
| `CzechSpecificFields` | Czech Republic | `czech_disposition` (1+kk, 2+1, etc.), `czech_ownership`, geographic segmentation (is_prague, is_brno) |
| `AustrianSpecificFields` | Austria | `ownership_type` (eigentumsrecht, baurecht, etc.), `operating_costs`, `heating_costs` |
| `GermanSpecificFields` | Germany | `ownership_type` (eigentum, erbbaurecht, etc.), `hausgeld`, `courtage`, `kfw_standard`, `is_denkmalschutz` |
| `SlovakSpecificFields` | Slovakia | `disposition`, `comfort_level` not present (unlike Hungarian), geographic (is_bratislava, is_kosice) |
| `HungarianSpecificFields` | Hungary | `room_count`, `half_rooms`, `comfort_level` (luxury to no_comfort), `budapest_district` (I-XXIII), `kozos_koltseg`, `felujitasi_alap` |
| `FrenchSpecificFields` | France | `dpe_rating`/`ges_rating` (mandatory), `copropriete`, `loi_carrez`, `area_carrez`, diagnostics (amiante, plomb, termites), `taxe_fonciere`, `honoraires` |
| `SpanishSpecificFields` | Spain | `ibi_annual`, `community_fees`, `cedula_habitabilidad`, `nota_simple`, `referencia_catastral`, `vpo`, `orientacion` |
| `UKSpecificFields` | UK | `tenure` (freehold/leasehold), `council_tax_band` (A-H), `epc_rating`, `reception_rooms`, `stamp_duty_estimate`, `help_to_buy`, `shared_ownership` |

All Tier II interfaces include a `[key: string]: any` catch-all for portal-specific fields not covered by the typed fields.
