# UlovDomov - Field Mapping Reference

## Mapping Overview

| Portal Field | TierI Field | Category | Transformation | Required | Notes |
|---|---|---|---|---|---|
| id | portal_metadata.ulovdomov.id | all | direct | Yes | |
| title | title | all | default "Unknown" | Yes | |
| offerType | transaction_type | all | "SALE"->"sale", "RENT"->"rent" | Yes | |
| propertyType | property_category | all | FLAT->apartment, etc. | Yes | |
| price | price | all | direct, default 0 | Yes | |
| url | source_url | all | fallback to constructed URL | Yes | |
| - | source_platform | all | hardcoded "ulovdomov-cz" | Yes | |
| - | currency | all | hardcoded "CZK" | Yes | |
| location.* | location.address | all | buildAddress() | No | |
| location.city | location.city | all | direct, default "Unknown" | Yes | |
| location.district | location.region | all | direct | No | |
| location.coordinates | location.coordinates | all | lat/lng -> lat/lon | No | |
| area | details.sqm | all | direct | No | |
| dispozice | details.bedrooms | apartment | extractBedrooms() | No | |
| dispozice | details.rooms | apartment | extractRooms() | No | |
| floor | details.floor | apartment | direct | No | |
| - | details.bathrooms | all | hardcoded 1 | - | API never provides |
| price/area | price_per_sqm | all | calculated | No | |

## Category: Apartment (FLAT)

### Required Fields
| Portal Field | TierI Field | Transformation | Example |
|---|---|---|---|
| propertyType="FLAT" | property_category="apartment" | mapPropertyType() | |
| dispozice | bedrooms | extractBedrooms("2+kk") -> 2 | "2+kk" -> 2 |
| area | sqm | direct | 65 |
| elevator | has_elevator | boolean via amenities | true |
| balcony | has_balcony | boolean via amenities | true |
| parking | has_parking | boolean via amenities | true |
| cellar | has_basement | boolean via amenities | true |

### Optional Fields
| Portal Field | TierI Field | Transformation | Example |
|---|---|---|---|
| floor | details.floor | direct | 3 |
| totalFloors | country_specific.total_floors | direct | 8 |
| ownership | country_specific.czech_ownership | normalizeOwnership() | "Osobni" |
| condition | condition (Tier 1) | normalizeCondition() | "Dobry" |
| construction | construction_type (Tier 1) | normalizeConstructionType() | "Cihla" |
| furnished | furnished (Tier 1) | normalizeFurnished() | "YES" -> "furnished" |
| energyEfficiency | country_specific.energy_rating | normalizeEnergyRating() | "C" |
| features | heating_type (Tier 1) | extractHeatingFromFeatures() + normalizeHeatingType() | |
| published | published_date (Tier 1) | direct | "2026-01-15" |

## Category: House (HOUSE)

Same core mappings as apartment. Key differences:
- `propertyType="HOUSE"` -> `property_category="house"`
- `area` maps to `sqm` (living area)
- No `sqm_plot` available from API (would need separate field)

## Category: Land (LAND)

- `propertyType="LAND"` -> `property_category="land"`
- `area` maps to `sqm` (plot area)
- Most apartment-specific fields (disposition, floor, elevator) are typically absent

## Category: Commercial (COMMERCIAL)

- `propertyType="COMMERCIAL"` -> `property_category="commercial"`
- Same transformation pipeline as apartment
- Amenities still mapped (parking, elevator)

## Tier 1 Universal Fields

| Portal Field | Tier 1 Field | Transformation |
|---|---|---|
| condition | condition | normalizeCondition() |
| features (array) | heating_type | extractHeatingFromFeatures() + normalizeHeatingType() |
| furnished | furnished | normalizeFurnished() |
| construction | construction_type | normalizeConstructionType() |
| published | published_date | direct |
| parking | parking_spaces | true -> 1, false -> undefined |
| - | available_from | not available |
| - | deposit | not available |
| - | renovation_year | not available |

## Tier II: Country Specific (country_specific JSONB)

| Field | Source | Example |
|---|---|---|
| czech_disposition | normalizeDisposition(offer.dispozice) | "2+kk" |
| czech_ownership | normalizeOwnership(offer.ownership) | "Osobni" |
| condition | normalizeCondition(offer.condition) | "good" |
| furnished | normalizeFurnished(offer.furnished) | "furnished" |
| energy_rating | normalizeEnergyRating(offer.energyEfficiency) | "C" |
| heating_type | normalizeHeatingType(extracted) | "central" |
| construction_type | normalizeConstructionType(offer.construction) | "brick" |
| building_type | offer.construction | "Cihla" |
| ownership_type | offer.ownership | "Osobni" |
| area_living | offer.area | 65 |
| total_floors | offer.totalFloors | 8 |
| floor_location | extractFloorLocation(offer.floor) | "middle_floor" |
| floor_number | offer.floor | 3 |
| city | offer.location.city | "Praha" |
| district | offer.location.district | "Praha 3" |
| street | offer.location.street | "Vinohradska" |
| coordinates | offer.location.coordinates | {lat, lon} |
| image_urls | offer.images | ["https://..."] |
| image_count | offer.images.length | 5 |
| published_date | offer.published | "2026-01-15" |
| updated_date | offer.updated | "2026-02-01" |

## Tier III: Portal Metadata (portal_metadata.ulovdomov JSONB)

| Field | Source | Notes |
|---|---|---|
| id | offer.id | Portal's internal ID |
| url | offer.url | Detail page URL |
| property_type | offer.propertyType | "FLAT", "HOUSE", etc. |
| offer_type | offer.offerType | "SALE", "RENT" |
| dispozice | offer.dispozice | Raw disposition |
| total_floors | offer.totalFloors | |
| floor | offer.floor | |
| ownership | offer.ownership | Raw ownership string |
| construction | offer.construction | Raw construction string |
| condition | offer.condition | Raw condition string |
| furnished | offer.furnished | "YES"/"NO"/"PARTIAL" |
| energy_efficiency | offer.energyEfficiency | Raw energy rating |
| location | offer.location | Full location object |
| parking/balcony/terrace/cellar/elevator/barrier_free | offer.* | Raw booleans |
| images | offer.images | Full URL array |
| images_count | offer.images.length | |
| features | offer.features | Raw feature strings |
| description | offer.description | Full Czech text |
| price_note | offer.priceNote | |
| published/updated | offer.published/updated | |
| contact_phone/contact_email | offer.contactPhone/Email | |
| agent_name/agent_company | offer.agent.name/company | |

## Special Handling

### Default Values
| TierI Field | Default | Condition |
|---|---|---|
| title | "Unknown" | When missing |
| price | 0 | When missing |
| currency | "CZK" | Always |
| location.city | "Unknown" | When missing |
| details.bathrooms | 1 | Always (API never provides) |
| status | "active" | Always |
| description_language | "cs" | Always |
| source_platform | "ulovdomov-cz" | Always |

### Missing Field Strategy
| TierI Field | If Missing | Strategy |
|---|---|---|
| bedrooms | Use disposition | Parse "2+kk" format |
| sqm | undefined | No fallback |
| has_elevator | undefined | Not assumed false |
| parking_spaces | undefined | Only set if parking=true (then 1) |
| coordinates | undefined | Listing still ingested |

### Amenity Merging
Amenities come from two sources, merged in the output:
1. **Direct API booleans**: `offer.parking`, `offer.balcony`, `offer.elevator`, etc.
2. **Parsed features**: `parseCzechFeatures(offer.features)` from shared mappings

The direct booleans take precedence via spread order in the `amenities` object.
