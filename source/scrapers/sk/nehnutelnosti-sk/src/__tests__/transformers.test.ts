import { transformNehnutelnostiApartment } from '../transformers/apartments/apartmentTransformer';
import { transformNehnutelnostiHouse } from '../transformers/houses/houseTransformer';
import { transformNehnutelnostiLand } from '../transformers/land/landTransformer';
import { NehnutelnostiListing } from '../types/nehnutelnostiTypes';

// ============================================================================
// Minimal fixture factories
// ============================================================================

function makeApartmentListing(overrides: Partial<NehnutelnostiListing> = {}): NehnutelnostiListing {
  return {
    id: 'apt-001',
    name: '3-izbový byt na predaj',
    price: 195000,
    currency: 'EUR',
    locality: 'Bratislava - Staré Mesto',
    city: 'Bratislava',
    transaction_type: 'predaj',
    url: 'https://www.nehnutelnosti.sk/detail/apt-001',
    area: 78,
    rooms: 3,
    status: 'active',
    is_active: true,
    ...overrides,
  };
}

function makeHouseListing(overrides: Partial<NehnutelnostiListing> = {}): NehnutelnostiListing {
  return {
    id: 'house-001',
    name: '4-izbový rodinný dom',
    price: 340000,
    currency: 'EUR',
    locality: 'Košice',
    city: 'Košice',
    transaction_type: 'predaj',
    url: 'https://www.nehnutelnosti.sk/detail/house-001',
    area: 140,
    area_land: 600,
    rooms: 4,
    status: 'active',
    is_active: true,
    ...overrides,
  };
}

function makeLandListing(overrides: Partial<NehnutelnostiListing> = {}): NehnutelnostiListing {
  return {
    id: 'land-001',
    name: 'Stavebný pozemok',
    price: 85000,
    currency: 'EUR',
    locality: 'Nitra',
    city: 'Nitra',
    transaction_type: 'predaj',
    url: 'https://www.nehnutelnosti.sk/detail/land-001',
    area: 900,
    area_land: 900,
    status: 'active',
    is_active: true,
    ...overrides,
  };
}

// ============================================================================
// Apartment Transformer Tests
// ============================================================================

describe('transformNehnutelnostiApartment', () => {
  it('sets property_category to apartment', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(result.property_category).toBe('apartment');
  });

  it('sets status to active when is_active is true', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ is_active: true }));
    expect(result.status).toBe('active');
  });

  it('sets status to active when status field is active', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ status: 'active', is_active: undefined }));
    expect(result.status).toBe('active');
  });

  it('sets status to removed when neither is_active nor status=active', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ status: undefined, is_active: false }));
    expect(result.status).toBe('removed');
  });

  it('sets source_platform to nehnutelnosti-sk', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.source_platform).toBe('string');
    expect(result.source_platform).toBe('nehnutelnosti-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number >= 0', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.bedrooms).toBe('number');
    expect(result.bedrooms).toBeGreaterThanOrEqual(0);
  });

  it('returns sqm as a number >= 0', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.sqm).toBe('number');
    expect(result.sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps area field to sqm', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ area: 85 }));
    expect(result.sqm).toBe(85);
  });

  it('has_elevator is boolean', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.has_elevator).toBe('boolean');
  });

  it('has_balcony is boolean', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.has_balcony).toBe('boolean');
  });

  it('has_parking is boolean', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.has_parking).toBe('boolean');
  });

  it('has_basement is boolean', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing());
    expect(typeof result.has_basement).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ transaction_type: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ transaction_type: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects elevator from features array', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ features: ['výťah'] }));
    expect(result.has_elevator).toBe(true);
  });

  it('detects balcony from features array', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ features: ['balkón'] }));
    expect(result.has_balcony).toBe(true);
  });

  it('detects parking from amenities array', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ amenities: ['parkovanie'] }));
    expect(result.has_parking).toBe(true);
  });

  it('uses name field as title', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ name: 'Test Apartment' }));
    expect(result.title).toBe('Test Apartment');
  });

  it('falls back to title field when name missing', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ name: undefined, title: 'Fallback Title' }));
    expect(result.title).toBe('Fallback Title');
  });

  it('defaults sqm to 0 when area is missing', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ area: undefined }));
    expect(result.sqm).toBe(0);
  });

  it('handles listing with no features or amenities', () => {
    const result = transformNehnutelnostiApartment(makeApartmentListing({ features: undefined, amenities: undefined }));
    expect(result.has_elevator).toBe(false);
    expect(result.has_balcony).toBe(false);
    expect(result.has_parking).toBe(false);
    expect(result.has_basement).toBe(false);
  });
});

// ============================================================================
// House Transformer Tests
// ============================================================================

describe('transformNehnutelnostiHouse', () => {
  it('sets property_category to house', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(result.property_category).toBe('house');
  });

  it('sets status to active when is_active is true', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ is_active: true }));
    expect(result.status).toBe('active');
  });

  it('sets source_platform to nehnutelnosti-sk', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(result.source_platform).toBe('nehnutelnosti-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(typeof result.bedrooms).toBe('number');
  });

  it('returns sqm_living as a number >= 0', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(typeof result.sqm_living).toBe('number');
    expect(result.sqm_living).toBeGreaterThanOrEqual(0);
  });

  it('maps area to sqm_living', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ area: 160 }));
    expect(result.sqm_living).toBe(160);
  });

  it('uses area_land for sqm_plot', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ area_land: 800 }));
    expect(result.sqm_plot).toBe(800);
  });

  it('has_garden is boolean', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(typeof result.has_garden).toBe('boolean');
  });

  it('has_garage is boolean', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing());
    expect(typeof result.has_garage).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ transaction_type: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ transaction_type: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects garden from features when sqm_plot > sqm_living', () => {
    // sqm_plot (area_land=600) > sqm_living (area=140) → has_garden = true
    const result = transformNehnutelnostiHouse(makeHouseListing({ area: 140, area_land: 600 }));
    expect(result.has_garden).toBe(true);
  });

  it('detects garage from features array', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ features: ['garáž'] }));
    expect(result.has_garage).toBe(true);
  });

  it('handles minimal listing with no features', () => {
    const result = transformNehnutelnostiHouse(makeHouseListing({ features: undefined, amenities: undefined }));
    expect(result.property_category).toBe('house');
    expect(result.status).toBe('active');
  });
});

// ============================================================================
// Land Transformer Tests
// ============================================================================

describe('transformNehnutelnostiLand', () => {
  it('sets property_category to land', () => {
    const result = transformNehnutelnostiLand(makeLandListing());
    expect(result.property_category).toBe('land');
  });

  it('sets status to active when is_active is true', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ is_active: true }));
    expect(result.status).toBe('active');
  });

  it('sets source_platform to nehnutelnosti-sk', () => {
    const result = transformNehnutelnostiLand(makeLandListing());
    expect(result.source_platform).toBe('nehnutelnosti-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformNehnutelnostiLand(makeLandListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformNehnutelnostiLand(makeLandListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns area_plot_sqm as a number >= 0', () => {
    const result = transformNehnutelnostiLand(makeLandListing());
    expect(typeof result.area_plot_sqm).toBe('number');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps area_land to area_plot_sqm', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ area_land: 1200 }));
    expect(result.area_plot_sqm).toBe(1200);
  });

  it('falls back to area when area_land is missing', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ area_land: undefined, area: 500 }));
    expect(result.area_plot_sqm).toBe(500);
  });

  it('defaults area_plot_sqm to 0 when no area fields', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ area_land: undefined, area: undefined }));
    expect(result.area_plot_sqm).toBe(0);
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ transaction_type: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ transaction_type: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects water utility from features', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ features: ['voda'] }));
    expect(result.water_supply).toBe('mains');
  });

  it('detects sewage utility from features', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ features: ['kanalizácia'] }));
    expect(result.sewage).toBe('mains');
  });

  it('handles minimal listing with no features', () => {
    const result = transformNehnutelnostiLand(makeLandListing({ features: undefined, amenities: undefined }));
    expect(result.property_category).toBe('land');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });
});
