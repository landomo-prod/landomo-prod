import { transformApartmentToStandard } from '../transformers/apartments/apartmentTransformer';
import { transformHouseToStandard } from '../transformers/houses/houseTransformer';
import { transformLandToStandard } from '../transformers/land/landTransformer';
import { TopRealityListing } from '../types/toprealityTypes';

// ============================================================================
// Minimal fixture factories
// ============================================================================

function makeApartmentListing(overrides: Partial<TopRealityListing> = {}): TopRealityListing {
  return {
    id: 'apt-001',
    title: '3-izbový byt na predaj',
    price: 210000,
    currency: 'EUR',
    location: 'Bratislava - Petržalka',
    propertyType: 'byty',
    transactionType: 'predaj',
    url: 'https://www.topreality.sk/detail/apt-001',
    area: 72,
    rooms: 3,
    ...overrides,
  };
}

function makeHouseListing(overrides: Partial<TopRealityListing> = {}): TopRealityListing {
  return {
    id: 'house-001',
    title: 'Rodinný dom na predaj',
    price: 380000,
    currency: 'EUR',
    location: 'Žilina',
    propertyType: 'domy',
    transactionType: 'predaj',
    url: 'https://www.topreality.sk/detail/house-001',
    area: 155,
    rooms: 5,
    ...overrides,
  };
}

function makeLandListing(overrides: Partial<TopRealityListing> = {}): TopRealityListing {
  return {
    id: 'land-001',
    title: 'Stavebný pozemok',
    price: 65000,
    currency: 'EUR',
    location: 'Banská Bystrica',
    propertyType: 'pozemky',
    transactionType: 'predaj',
    url: 'https://www.topreality.sk/detail/land-001',
    area: 750,
    ...overrides,
  };
}

// ============================================================================
// Apartment Transformer Tests
// ============================================================================

describe('transformApartmentToStandard (topreality-sk)', () => {
  it('sets property_category to apartment', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(result.property_category).toBe('apartment');
  });

  it('sets status to active', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to topreality-sk', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.source_platform).toBe('string');
    expect(result.source_platform).toBe('topreality-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number >= 0', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.bedrooms).toBe('number');
    expect(result.bedrooms).toBeGreaterThanOrEqual(0);
  });

  it('uses rooms as bedrooms', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ rooms: 3 }));
    expect(result.bedrooms).toBe(3);
  });

  it('defaults bedrooms to 1 when rooms missing', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ rooms: undefined }));
    expect(result.bedrooms).toBe(1);
  });

  it('returns sqm as a number >= 0', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.sqm).toBe('number');
    expect(result.sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps area to sqm', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ area: 85 }));
    expect(result.sqm).toBe(85);
  });

  it('defaults sqm to 0 when area is missing', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ area: undefined }));
    expect(result.sqm).toBe(0);
  });

  it('has_elevator is boolean', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.has_elevator).toBe('boolean');
  });

  it('has_balcony is boolean', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.has_balcony).toBe('boolean');
  });

  it('has_parking is boolean', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.has_parking).toBe('boolean');
  });

  it('has_basement is boolean', () => {
    const result = transformApartmentToStandard(makeApartmentListing());
    expect(typeof result.has_basement).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects elevator from description text', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ description: 'byt má výťah' }));
    expect(result.has_elevator).toBe(true);
  });

  it('detects balcony from description text', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ description: 'byt s balkónom' }));
    expect(result.has_balcony).toBe(true);
  });

  it('detects parking from description text', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ description: 'parkovanie v garáži' }));
    expect(result.has_parking).toBe(true);
  });

  it('uses floor field directly when provided', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ floor: 4 }));
    expect(result.floor).toBe(4);
  });

  it('returns images as an array', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ images: ['https://example.com/img1.jpg'] }));
    expect(Array.isArray(result.images)).toBe(true);
    expect(result.images!.length).toBe(1);
  });

  it('returns empty images array when no images provided', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ images: undefined }));
    expect(Array.isArray(result.images)).toBe(true);
  });

  it('handles minimal listing with no description', () => {
    const result = transformApartmentToStandard(makeApartmentListing({ description: undefined }));
    expect(result.property_category).toBe('apartment');
    expect(result.status).toBe('active');
    expect(result.has_elevator).toBe(false);
  });
});

// ============================================================================
// House Transformer Tests
// ============================================================================

describe('transformHouseToStandard (topreality-sk)', () => {
  it('sets property_category to house', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(result.property_category).toBe('house');
  });

  it('sets status to active', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to topreality-sk', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(result.source_platform).toBe('topreality-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(typeof result.bedrooms).toBe('number');
  });

  it('returns sqm_living as a number >= 0', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(typeof result.sqm_living).toBe('number');
    expect(result.sqm_living).toBeGreaterThanOrEqual(0);
  });

  it('maps area to sqm_living', () => {
    const result = transformHouseToStandard(makeHouseListing({ area: 180 }));
    expect(result.sqm_living).toBe(180);
  });

  it('has_garden is boolean', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(typeof result.has_garden).toBe('boolean');
  });

  it('has_garage is boolean', () => {
    const result = transformHouseToStandard(makeHouseListing());
    expect(typeof result.has_garage).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformHouseToStandard(makeHouseListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformHouseToStandard(makeHouseListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects garden from description', () => {
    const result = transformHouseToStandard(makeHouseListing({ description: 'krásna záhrada 400m2' }));
    expect(result.has_garden).toBe(true);
  });

  it('detects garage from description', () => {
    const result = transformHouseToStandard(makeHouseListing({ description: 'dvojgaráž priamo pri dome' }));
    expect(result.has_garage).toBe(true);
  });

  it('sets has_garden true when plot area detected in text', () => {
    const result = transformHouseToStandard(makeHouseListing({ description: 'pozemok 600m2' }));
    expect(result.has_garden).toBe(true);
  });

  it('defaults bedrooms to 1 when rooms missing', () => {
    const result = transformHouseToStandard(makeHouseListing({ rooms: undefined }));
    expect(result.bedrooms).toBe(1);
  });

  it('handles minimal listing with no description', () => {
    const result = transformHouseToStandard(makeHouseListing({ description: undefined }));
    expect(result.property_category).toBe('house');
    expect(result.sqm_living).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Land Transformer Tests
// ============================================================================

describe('transformLandToStandard (topreality-sk)', () => {
  it('sets property_category to land', () => {
    const result = transformLandToStandard(makeLandListing());
    expect(result.property_category).toBe('land');
  });

  it('sets status to active', () => {
    const result = transformLandToStandard(makeLandListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to topreality-sk', () => {
    const result = transformLandToStandard(makeLandListing());
    expect(result.source_platform).toBe('topreality-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformLandToStandard(makeLandListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformLandToStandard(makeLandListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns area_plot_sqm as a number >= 0', () => {
    const result = transformLandToStandard(makeLandListing());
    expect(typeof result.area_plot_sqm).toBe('number');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps area field to area_plot_sqm', () => {
    const result = transformLandToStandard(makeLandListing({ area: 1000 }));
    expect(result.area_plot_sqm).toBe(1000);
  });

  it('defaults area_plot_sqm to 0 when area is missing', () => {
    const result = transformLandToStandard(makeLandListing({ area: undefined }));
    expect(result.area_plot_sqm).toBe(0);
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformLandToStandard(makeLandListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformLandToStandard(makeLandListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('returns images as an array', () => {
    const result = transformLandToStandard(makeLandListing({ images: ['https://example.com/img1.jpg'] }));
    expect(Array.isArray(result.images)).toBe(true);
  });

  it('returns empty images array when no images', () => {
    const result = transformLandToStandard(makeLandListing({ images: undefined }));
    expect(Array.isArray(result.images)).toBe(true);
  });

  it('handles minimal listing with no description', () => {
    const result = transformLandToStandard(makeLandListing({ description: undefined }));
    expect(result.property_category).toBe('land');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });
});
