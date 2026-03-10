# LLM Extraction Optimization Plan

## Current Status
- **Fields Extracted:** 18 (up from 6)
- **Temperature:** 0.2 (up from 0)
- **Target:** 25-35+ fields
- **Gap:** Need 7-17 more fields

## What's Working
✅ Temperature increase (0 → 0.2) improved extraction (+12 fields)
✅ Basic fields extracted: property_type, transaction_type  
✅ Location: region, city, country, distance_to_sea
✅ Details: rooms, area_plot_sqm
✅ Amenities: garden, pool_possible, water_well_possible

## What's Missing (from sample listing)

### Available in Text but NOT Extracted:
1. **Price** - "2.200.000 Kč" → price: 2200000
2. **Building Details:**
   - "3. patro" → floor: 3 (NOT in this listing, but shows pattern)
   - "panelový dům" → construction_type: "panel" (NOT in this listing)
   - "trullo" (historical) → ✅ extracted as historical_building_type
   
3. **Property Features:**
   - "vzrostlé staleté borovice" → trees/landscaping (NOT extracted)
   - "uprostřed pozemku" → central_location (NOT extracted)
   - "obklopený poli" → surrounded_by_fields (NOT extracted)
   
4. **Potential Uses:**
   - "zázemí pro koně" → potential_use: "horses" or "equestrian" (NOT extracted)

5. **Renovation Details:**
   - "možné rozšíření" → ✅ extracted as additional_rooms_possible
   - "zapuštěný bazén" → ✅ extracted as can_build_pool

6. **Contact Info:**
   - WhatsApp number (NOT relevant for StandardProperty)

## Optimization Strategy

### 1. Enhanced System Prompt
**Goal:** Explicitly instruct LLM to extract ALL fields

**Changes:**
- Add "MAXIMIZE EXTRACTION" instruction at top
- List ALL extractable field categories
- Provide more Czech terminology examples
- Add "extract everything you can, err on side of extraction"

### 2. Reduce Few-Shot Examples (5 → 2)
**Goal:** Save tokens/cost while maintaining quality

**Changes:**
- Keep 2 most comprehensive examples
- Show examples with 20-30 fields each
- Remove redundant/simple examples

### 3. Explicit Field Extraction Rules
**Goal:** Guide LLM on edge cases

**Add:**
- "Extract price from text even if in structured data"
- "Infer bedrooms from 'pokoje' (rooms - 1 for kitchen)"
- "Extract ALL mentioned features, even minor ones"
- "Use assumptions field to note inferences"

### 4. Temperature Fine-Tuning
**Current:** 0.2  
**Test:** 0.3 (might extract more fields)  
**Risk:** May introduce hallucinations  
**Mitigation:** Use assumptions field to track inferences

## Implementation Plan

### Phase 1: Prompt Optimization (30-60 min)
1. ✅ Test current setup (18 fields baseline)
2. ⏳ Create enhanced system prompt
3. ⏳ Reduce to 2 comprehensive examples
4. ⏳ Test extraction (target: 25+ fields)

### Phase 2: Temperature Testing (15-30 min)
1. ⏳ Test at 0.2 (current)
2. ⏳ Test at 0.3 (more extraction)
3. ⏳ Test at 0.4 (edge case)
4. ⏳ Select optimal temperature

### Phase 3: Validation (15-30 min)
1. ⏳ Run full PoC test
2. ⏳ Validate accuracy (should be 75-85%)
3. ⏳ Check cost ($0.008-0.012 target)
4. ⏳ Document results

## Expected Results

### Field Coverage
- **Current:** 18 fields
- **After prompt optimization:** 25-30 fields
- **After temperature tuning:** 28-35 fields

### Cost Impact
- **Current:** $0.016/listing (3,182 tokens)
- **After reducing examples:** $0.010-0.012/listing (~2,000-2,400 tokens)
- **Savings:** ~35-40% cost reduction

### Performance
- **Processing time:** May increase 10-20% (more fields to extract)
- **Accuracy:** Should remain 75-85%
- **Confidence:** Expect more "medium" vs "high" (more inferences)

## Success Criteria

✅ **Minimum:** 25+ fields extracted  
✅ **Target:** 30+ fields extracted  
✅ **Accuracy:** 75-85%  
✅ **Cost:** <$0.012/listing  
✅ **Confidence:** Mostly "high" or "medium"  

---

**Next Step:** Create enhanced system prompt
