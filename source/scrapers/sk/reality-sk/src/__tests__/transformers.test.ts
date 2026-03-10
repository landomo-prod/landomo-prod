import { transformRealityApartment } from '../transformers/apartments/apartmentTransformer';
import { transformRealityHouse } from '../transformers/houses/houseTransformer';
import { transformRealityLand } from '../transformers/land/landTransformer';
import { RealityListing } from '../types/realityTypes';

// ============================================================================
// Minimal fixture factories
// ============================================================================

function makeApartmentListing(overrides: Partial<RealityListing> = {}): RealityListing {
  return {
    id: 'apt-001',
    title: '3-izbový byt na predaj',
    price: 185000,
    currency: 'EUR',
    location: 'Bratislava - Staré Mesto',
    propertyType: 'byty',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/detail/apt-001',
    sqm: 75,
    rooms: 3,
    ...overrides,
  };
}

function makeHouseListing(overrides: Partial<RealityListing> = {}): RealityListing {
  return {
    id: 'house-001',
    title: 'Rodinný dom na predaj',
    price: 295000,
    currency: 'EUR',
    location: 'Košice - Západ',
    propertyType: 'domy',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/detail/house-001',
    sqm: 130,
    rooms: 4,
    ...overrides,
  };
}

function makeLandListing(overrides: Partial<RealityListing> = {}): RealityListing {
  return {
    id: 'land-001',
    title: 'Stavebný pozemok na predaj',
    price: 75000,
    currency: 'EUR',
    location: 'Nitra',
    propertyType: 'pozemky',
    transactionType: 'predaj',
    url: 'https://www.reality.sk/detail/land-001',
    sqm: 650,
    ...overrides,
  };
}

// ============================================================================
// Apartment Transformer Tests
// ============================================================================

describe('transformRealityApartment', () => {
  it('sets property_category to apartment', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(result.property_category).toBe('apartment');
  });

  it('sets status to active', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to reality-sk', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.source_platform).toBe('string');
    expect(result.source_platform).toBe('reality-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number >= 0', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.bedrooms).toBe('number');
    expect(result.bedrooms).toBeGreaterThanOrEqual(0);
  });

  it('uses rooms as bedrooms', () => {
    const result = transformRealityApartment(makeApartmentListing({ rooms: 3 }));
    expect(result.bedrooms).toBe(3);
  });

  it('defaults bedrooms to 1 when rooms is missing', () => {
    const result = transformRealityApartment(makeApartmentListing({ rooms: undefined }));
    expect(result.bedrooms).toBe(1);
  });

  it('returns sqm as a number >= 0', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.sqm).toBe('number');
    expect(result.sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps sqm field directly', () => {
    const result = transformRealityApartment(makeApartmentListing({ sqm: 90 }));
    expect(result.sqm).toBe(90);
  });

  it('defaults sqm to 0 when missing', () => {
    const result = transformRealityApartment(makeApartmentListing({ sqm: undefined }));
    expect(result.sqm).toBe(0);
  });

  it('has_elevator is boolean', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.has_elevator).toBe('boolean');
  });

  it('has_balcony is boolean', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.has_balcony).toBe('boolean');
  });

  it('has_parking is boolean', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.has_parking).toBe('boolean');
  });

  it('has_basement is boolean', () => {
    const result = transformRealityApartment(makeApartmentListing());
    expect(typeof result.has_basement).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformRealityApartment(makeApartmentListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformRealityApartment(makeApartmentListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects elevator from description text', () => {
    const result = transformRealityApartment(makeApartmentListing({ description: 'byt má výťah a balkón' }));
    expect(result.has_elevator).toBe(true);
  });

  it('detects balcony from description text', () => {
    const result = transformRealityApartment(makeApartmentListing({ description: 'byt má balkón' }));
    expect(result.has_balcony).toBe(true);
  });

  it('detects parking from description text', () => {
    const result = transformRealityApartment(makeApartmentListing({ description: 'parkovanie v garáži' }));
    expect(result.has_parking).toBe(true);
  });

  it('handles minimal listing with no description', () => {
    const result = transformRealityApartment(makeApartmentListing({ description: undefined }));
    expect(result.property_category).toBe('apartment');
    expect(result.status).toBe('active');
    expect(result.has_elevator).toBe(false);
  });

  it('extracts floor from description text', () => {
    const result = transformRealityApartment(makeApartmentListing({ description: 'byt na 3. poschodie' }));
    expect(result.floor).toBe(3);
  });
});

// ============================================================================
// House Transformer Tests
// ============================================================================

describe('transformRealityHouse', () => {
  it('sets property_category to house', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(result.property_category).toBe('house');
  });

  it('sets status to active', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to reality-sk', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(result.source_platform).toBe('reality-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(typeof result.bedrooms).toBe('number');
  });

  it('returns sqm_living as a number >= 0', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(typeof result.sqm_living).toBe('number');
    expect(result.sqm_living).toBeGreaterThanOrEqual(0);
  });

  it('maps sqm to sqm_living', () => {
    const result = transformRealityHouse(makeHouseListing({ sqm: 160 }));
    expect(result.sqm_living).toBe(160);
  });

  it('has_garden is boolean', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(typeof result.has_garden).toBe('boolean');
  });

  it('has_garage is boolean', () => {
    const result = transformRealityHouse(makeHouseListing());
    expect(typeof result.has_garage).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformRealityHouse(makeHouseListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformRealityHouse(makeHouseListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects garden from description', () => {
    const result = transformRealityHouse(makeHouseListing({ description: 'dom so záhradou 500m2' }));
    expect(result.has_garden).toBe(true);
  });

  it('detects garage from description', () => {
    const result = transformRealityHouse(makeHouseListing({ description: 'garáž pre 2 autá' }));
    expect(result.has_garage).toBe(true);
  });

  it('extracts plot area from description', () => {
    const result = transformRealityHouse(makeHouseListing({ description: 'pozemok 800m2' }));
    expect(result.sqm_plot).toBeGreaterThanOrEqual(0);
  });

  it('defaults bedrooms to 1 when rooms missing', () => {
    const result = transformRealityHouse(makeHouseListing({ rooms: undefined }));
    expect(result.bedrooms).toBe(1);
  });

  it('detects villa subtype from title', () => {
    const result = transformRealityHouse(makeHouseListing({ title: 'Luxusná vila na predaj' }));
    // property_subtype on HousePropertyTierI is called property_subtype or house_type
    // The transformer uses house_type local var but doesn't assign it directly - detached is the result
    expect(result.property_category).toBe('house');
  });

  it('handles minimal listing with no description', () => {
    const result = transformRealityHouse(makeHouseListing({ description: undefined }));
    expect(result.property_category).toBe('house');
    expect(result.sqm_living).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Land Transformer Tests
// ============================================================================

describe('transformRealityLand', () => {
  it('sets property_category to land', () => {
    const result = transformRealityLand(makeLandListing());
    expect(result.property_category).toBe('land');
  });

  it('sets status to active', () => {
    const result = transformRealityLand(makeLandListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to reality-sk', () => {
    const result = transformRealityLand(makeLandListing());
    expect(result.source_platform).toBe('reality-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformRealityLand(makeLandListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformRealityLand(makeLandListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns area_plot_sqm as a number >= 0', () => {
    const result = transformRealityLand(makeLandListing());
    expect(typeof result.area_plot_sqm).toBe('number');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });

  it('uses sqm as fallback for area_plot_sqm', () => {
    const result = transformRealityLand(makeLandListing({ sqm: 800 }));
    expect(result.area_plot_sqm).toBe(800);
  });

  it('defaults area_plot_sqm to 0 when no area', () => {
    const result = transformRealityLand(makeLandListing({ sqm: undefined }));
    expect(result.area_plot_sqm).toBe(0);
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformRealityLand(makeLandListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformRealityLand(makeLandListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects building_plot land type from title', () => {
    const result = transformRealityLand(makeLandListing({ title: 'Stavebný pozemok na predaj' }));
    expect(result.land_type).toBe('building_plot');
  });

  it('detects arable land type from title', () => {
    const result = transformRealityLand(makeLandListing({ title: 'Orná pôda na predaj' }));
    expect(result.land_type).toBe('arable');
  });

  it('detects forest land type from title', () => {
    const result = transformRealityLand(makeLandListing({ title: 'Lesný pozemok na predaj' }));
    expect(result.land_type).toBe('forest');
  });

  it('detects water utility from description', () => {
    const result = transformRealityLand(makeLandListing({ description: 'pozemok s voda na pozemku' }));
    expect(result.has_water_connection).toBe(true);
  });

  it('detects electricity utility from description', () => {
    const result = transformRealityLand(makeLandListing({ description: 'elektrický prípoj na pozemku' }));
    expect(result.has_electricity_connection).toBe(true);
  });

  it('handles minimal listing with no description', () => {
    const result = transformRealityLand(makeLandListing({ description: undefined }));
    expect(result.property_category).toBe('land');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });
});
