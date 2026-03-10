# SReality Extraction Improvement Roadmap: Before & After

## Current State vs. Potential State

### Data Coverage Metrics

| Metric | Current | Phase 1 | Phase 2 | Improvement |
|--------|---------|---------|---------|-------------|
| Total Fields | 45/59 | 51/59 | 54/59 | +20% |
| Coverage % | 76.3% | 86.4% | 91.5% | +15.2% |
| Data Dimensions | 8 | 11 | 13 | +5 new |
| Root Fields | 16/26 | 19/26 | 21/26 | +5 fields |
| Items Fields | 29/33 | 29/33 | 31/33 | +2 fields |

---

## What Users Can Do TODAY

### Current Capabilities (45 fields extracted)

#### Listing Discovery
- Search by property type, price, location, city
- Filter by bedrooms, bathrooms, square meters
- View floor number, building type, construction year
- See ownership type (personal/cooperative/etc.)
- Check furnishing status

#### Property Evaluation
- View condition (excellent/good/satisfactory/renovation)
- Check heating type and energy rating (PENB)
- Verify utilities (water, sewage, gas supply)
- See if recently renovated
- Check amenities: parking, garage, elevator, balcony, terrace, basement

#### Property Details
- Read full Czech description
- View all available images with multiple sizes
- Get exact coordinates and zoom level
- Estimate price per m²
- Calculate room layout from disposition

#### Czech Market Context
- Czech-specific field normalization (disposition notation: 2+kk, 3+1)
- Czech ownership types standardized
- Czech heating types standardized
- Czech energy rating scale (A-G)

---

## What Users Could Do AFTER PHASE 1 (11 hours)

### New Capabilities with POI + Seller + Accessibility

#### Neighborhood Discovery
- **NEW**: Filter by nearby amenities
  - "Show me apartments within 500m of public transport"
  - "Which properties have 3+ schools nearby?"
  - "Find rentals with restaurants within walking distance"
  
- **NEW**: Neighborhood quality scoring
  - Count of nearby points of interest by category
  - Average ratings of nearby amenities
  - Distance to nearest transport, school, doctor, grocery

#### Agent/Broker Information
- **NEW**: Agent filtering and direct contact
  - "Show listings from agents with 4+ star ratings"
  - "Find properties from specialists in my district"
  - "Call/email agent directly"
  
- **NEW**: Broker credibility assessment
  - Agent reviews and ratings
  - Company specialization breakdown
  - Operating hours and contact info
  - Company website and logo

#### Accessibility Support
- **NEW**: Filter for wheelchair accessible properties
  - "Show me barrier-free apartments"
  - Identify 10-15% of listings with accessibility features

#### Community Analysis
- "Move to neighborhood with 5+ good restaurants"
- "Find properties near highly-rated schools"
- "Live within 1km of metro station"

---

## What Users Could Do AFTER PHASE 2 (14.5 hours total)

### Additional Capabilities with Virtual Tours + Area Refinement

#### Enhanced Property Browsing
- **NEW**: View 3D/360° virtual tours
  - Matterport 3D walkthroughs (5-15% of listings)
  - Better property visualization without site visit

#### Area Precision
- **NEW**: Built area field
  - Distinguish built area vs. plot area vs. living area
  - More accurate cost analysis

#### Result
- **90%+ field coverage**
- All data available to maximize search and filtering capabilities

---

## Sample Data Structures Unlocked

### Phase 1: POI Data
```json
{
  "neighborhood_amenities": {
    "transport": {
      "count": 5,
      "nearest_distance_m": 150,
      "items": [
        {
          "name": "Stanice metra Anděl",
          "distance_m": 450,
          "rating": 4.6,
          "reviews": 1250,
          "location": [50.0612, 14.4089]
        }
      ]
    },
    "restaurants": { /* similar */ },
    "schools": { /* similar */ }
  }
}
```

### Phase 1: Seller Info
```json
{
  "seller": {
    "name": "Dagmar Suchardová",
    "company": {
      "name": "ORION Realit",
      "website": "https://orionreal.cz",
      "logo": "https://...",
      "ico": "25116371"
    },
    "contact": {
      "email": "info@orionreal.cz",
      "phones": ["739544411"],
      "hours": [
        { "day": "Monday", "open": "09:00", "close": "17:30" }
      ]
    },
    "reviews": {
      "rating": 4.0,
      "count": 11,
      "url": "https://www.firmy.cz/..."
    },
    "specialization": {
      "apartments": 48,
      "houses": 10,
      "commercial": 27,
      "sales": 7,
      "rentals": 82
    }
  }
}
```

### Phase 2: Virtual Tour
```json
{
  "media": {
    "virtual_tour_url": "https://matterport.com/show/..."
  }
}
```

---

## User Experience Improvement

### Search Filtering Before
- Basic: price, type, location, rooms
- Limited neighborhood context
- No agent information

### Search Filtering After Phase 1
- **New**: Neighborhood-based search
  - "Apartments near metro" (transport filter)
  - "Family-friendly" (schools+parks filter)
  - "Foodie haven" (restaurants filter)
  - "Senior accessible" (accessibility+doctors filter)

- **New**: Agent-based search
  - Find specialists in your district
  - See agent reviews before contacting
  - Direct contact from listing

### Search Filtering After Phase 2
- All Phase 1 features
- **New**: Virtual tour available indicator
- **New**: More precise area metrics

---

## Business Impact

### Immediate Value (Phase 1)
- Unlock lifestyle/neighborhood search dimension
- Enable agent/broker filtering
- Support accessibility-focused users
- **Estimated User Engagement**: +20-30% (new search modes)
- **Estimated Listing Value**: +15% (more discoverable)

### Medium-term Value (Phase 2)
- Near-complete field coverage (90%+)
- Enhanced property browsing experience
- More precise property evaluation
- **Estimated User Engagement**: +35-50% cumulative
- **Estimated Listing Value**: +25% (best-in-class data)

---

## Implementation Priority Justification

### Why POI First?
1. Available in 100% of listings
2. High user value (neighborhood quality)
3. Moderate implementation complexity (4 hours)
4. Enables new search dimension

### Why Seller Info Second?
1. Available in 100% of listings
2. High user value (contact + credibility)
3. Complex implementation (6 hours, but well-scoped)
4. Enables agent filtering

### Why Accessibility Third?
1. Quick to implement (1 hour)
2. Important for accessibility-focused users
3. Available in 10-15% of listings
4. Completes Phase 1 with broad impact

### Why Virtual Tours Fourth?
1. Available in 5-15% of listings
2. Medium user value (enhanced browsing)
3. Quick to implement (1 hour)
4. Lower priority than core features

---

## Risk Assessment

### Phase 1 Risks: LOW
- All data already available in API (100% coverage)
- No external API dependencies
- Straightforward data transformation
- No breaking changes to existing code

### Phase 2 Risks: LOW
- All data available (5-15% for tours, 5-10% for built area)
- Optional fields (no impact if missing)
- Simple implementation
- No quality concerns

### Overall Risk: MINIMAL
- Data quality is assured (SReality API quality)
- No performance impact (same API calls)
- Backward compatible implementation
- Easy to test with existing samples

---

## Effort Breakdown

### Phase 1 (High Priority)
```
POI Extraction:           4 hours
  - Parse 6 POI categories: 2h
  - Create data structure: 1h
  - Calculate aggregates: 1h

Seller Information:       6 hours
  - Extract company info: 2h
  - Extract contact data: 2h
  - Extract reviews/ratings: 1h
  - Data structure design: 1h

Accessibility Flag:       1 hour
  - Add items parser: 0.5h
  - Add to StandardProperty: 0.5h

Testing & Documentation: 2 hours

Total Phase 1:           13 hours
```

### Phase 2 (Medium Priority)
```
Virtual Tour URLs:        1 hour
Built Area Field:         1 hour
Alternative Field Names:  0.5 hours
Testing & Documentation:  1 hour

Total Phase 2:            3.5 hours
```

### Grand Total: 16.5 hours for 95%+ coverage

---

## Recommendation

**Implement Phase 1 immediately** (11 hours of development):
- Highest ROI for user value
- Moderate implementation effort
- Low risk (data already available)
- Unlocks major search capabilities

**Schedule Phase 2** for next sprint (3.5 hours):
- Polish and completeness
- Already designed and scoped
- Can be done incrementally

---

## Conclusion

The current 76.3% extraction coverage is solid for core property data, but misses significant value in neighborhood context (POI), agent information, and accessibility features. Phase 1 implementation (11 hours) would add 10+ percentage points to coverage while unlocking major new search and filtering capabilities for users. This represents a **high-impact, moderate-effort improvement** that directly enhances user experience and listing discoverability.

