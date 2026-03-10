import { transformBytyApartment } from '../transformers/apartments/apartmentTransformer';
import { transformBytyHouse } from '../transformers/houses/houseTransformer';
import { transformBytyLand } from '../transformers/land/landTransformer';
import { BytyListing } from '../types/bytyTypes';

// ============================================================================
// Minimal fixture factories
// ============================================================================

function makeApartmentListing(overrides: Partial<BytyListing> = {}): BytyListing {
  return {
    id: 'apt-001',
    title: '3-izbový byt na predaj',
    price: 185000,
    currency: 'EUR',
    location: 'Bratislava - Staré Mesto, Kresánkova',
    propertyType: 'byty',
    transactionType: 'predaj',
    url: 'https://www.byty.sk/detail/apt-001',
    area: 75,
    rooms: 3,
    ...overrides,
  };
}

function makeHouseListing(overrides: Partial<BytyListing> = {}): BytyListing {
  return {
    id: 'house-001',
    title: '4-izbový rodinný dom na predaj',
    price: 320000,
    currency: 'EUR',
    location: 'Košice - Západ',
    propertyType: 'domy',
    transactionType: 'predaj',
    url: 'https://www.byty.sk/detail/house-001',
    area: 150,
    rooms: 4,
    ...overrides,
  };
}

function makeLandListing(overrides: Partial<BytyListing> = {}): BytyListing {
  return {
    id: 'land-001',
    title: 'Stavebný pozemok na predaj',
    price: 95000,
    currency: 'EUR',
    location: 'Nitra - Zobor',
    propertyType: 'pozemky',
    transactionType: 'predaj',
    url: 'https://www.byty.sk/detail/land-001',
    area: 800,
    ...overrides,
  };
}

// ============================================================================
// Apartment Transformer Tests
// ============================================================================

describe('transformBytyApartment', () => {
  it('sets property_category to apartment', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(result.property_category).toBe('apartment');
  });

  it('sets status to active', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to byty-sk', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.source_platform).toBe('string');
    expect(result.source_platform).toBe('byty-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.source_url).toBe('string');
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number >= 0', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.bedrooms).toBe('number');
    expect(result.bedrooms).toBeGreaterThanOrEqual(0);
  });

  it('derives bedrooms from rooms in title (3-izbový → bedrooms=2)', () => {
    const result = transformBytyApartment(makeApartmentListing({ title: '3-izbový byt', rooms: undefined }));
    expect(result.bedrooms).toBe(2);
  });

  it('returns sqm as a number >= 0', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.sqm).toBe('number');
    expect(result.sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps area field to sqm', () => {
    const result = transformBytyApartment(makeApartmentListing({ area: 90 }));
    expect(result.sqm).toBe(90);
  });

  it('has_elevator is boolean', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.has_elevator).toBe('boolean');
  });

  it('has_balcony is boolean', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.has_balcony).toBe('boolean');
  });

  it('has_parking is boolean', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.has_parking).toBe('boolean');
  });

  it('has_basement is boolean', () => {
    const result = transformBytyApartment(makeApartmentListing());
    expect(typeof result.has_basement).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformBytyApartment(makeApartmentListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformBytyApartment(makeApartmentListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects elevator from details', () => {
    const result = transformBytyApartment(makeApartmentListing({ details: ['výťah'] }));
    expect(result.has_elevator).toBe(true);
  });

  it('detects balcony from details', () => {
    const result = transformBytyApartment(makeApartmentListing({ details: ['balkón'] }));
    expect(result.has_balcony).toBe(true);
  });

  it('detects parking from details', () => {
    const result = transformBytyApartment(makeApartmentListing({ details: ['parkovanie'] }));
    expect(result.has_parking).toBe(true);
  });

  it('handles missing area gracefully (sqm defaults to 0)', () => {
    const result = transformBytyApartment(makeApartmentListing({ area: undefined }));
    expect(result.sqm).toBe(0);
  });

  it('handles minimal listing with no details', () => {
    const listing = makeApartmentListing({ details: undefined, description: undefined, imageUrl: undefined });
    const result = transformBytyApartment(listing);
    expect(result.property_category).toBe('apartment');
    expect(result.status).toBe('active');
  });

  it('parses published_date from DD.MM.YYYY string', () => {
    const result = transformBytyApartment(makeApartmentListing({ date: '15.01.2026' }));
    expect(result.published_date).toBeDefined();
    expect(typeof result.published_date).toBe('string');
  });

  it('parses published_date from dnes (today)', () => {
    const result = transformBytyApartment(makeApartmentListing({ date: 'dnes' }));
    expect(result.published_date).toBeDefined();
  });

  it('includes images array when imageUrl is provided', () => {
    const result = transformBytyApartment(makeApartmentListing({ imageUrl: 'https://byty.sk/img/1.jpg' }));
    expect(Array.isArray(result.images)).toBe(true);
    expect(result.images).toHaveLength(1);
  });

  it('returns empty images array when no imageUrl', () => {
    const result = transformBytyApartment(makeApartmentListing({ imageUrl: undefined }));
    expect(Array.isArray(result.images)).toBe(true);
    expect(result.images).toHaveLength(0);
  });
});

// ============================================================================
// House Transformer Tests
// ============================================================================

describe('transformBytyHouse', () => {
  it('sets property_category to house', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(result.property_category).toBe('house');
  });

  it('sets status to active', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to byty-sk', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(typeof result.source_platform).toBe('string');
    expect(result.source_platform).toBe('byty-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns bedrooms as a number', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(typeof result.bedrooms).toBe('number');
  });

  it('returns sqm_living as a number >= 0', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(typeof result.sqm_living).toBe('number');
    expect(result.sqm_living).toBeGreaterThanOrEqual(0);
  });

  it('maps area to sqm_living', () => {
    const result = transformBytyHouse(makeHouseListing({ area: 180 }));
    expect(result.sqm_living).toBe(180);
  });

  it('has_garden is boolean', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(typeof result.has_garden).toBe('boolean');
  });

  it('has_garage is boolean', () => {
    const result = transformBytyHouse(makeHouseListing());
    expect(typeof result.has_garage).toBe('boolean');
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformBytyHouse(makeHouseListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformBytyHouse(makeHouseListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects garden from details', () => {
    const result = transformBytyHouse(makeHouseListing({ details: ['záhrada'] }));
    expect(result.has_garden).toBe(true);
  });

  it('detects garage from details', () => {
    const result = transformBytyHouse(makeHouseListing({ details: ['garáž'] }));
    expect(result.has_garage).toBe(true);
  });

  it('detects villa subtype from title', () => {
    const result = transformBytyHouse(makeHouseListing({ title: 'Luxusná vila na predaj' }));
    expect(result.property_subtype).toBe('villa');
  });

  it('defaults property_subtype to detached for generic house', () => {
    const result = transformBytyHouse(makeHouseListing({ title: 'Rodinný dom na predaj' }));
    expect(result.property_subtype).toBe('detached');
  });

  it('extracts plot area from details when present', () => {
    const result = transformBytyHouse(makeHouseListing({ details: ['pozemok 600m²'], area: 150 }));
    expect(result.sqm_plot).toBe(600);
  });

  it('falls back to area for sqm_plot when no plot detail', () => {
    const result = transformBytyHouse(makeHouseListing({ area: 150, details: [] }));
    expect(result.sqm_plot).toBe(150);
  });

  it('handles minimal listing with no details', () => {
    const listing = makeHouseListing({ details: undefined, description: undefined });
    const result = transformBytyHouse(listing);
    expect(result.property_category).toBe('house');
    expect(result.status).toBe('active');
  });
});

// ============================================================================
// Land Transformer Tests
// ============================================================================

describe('transformBytyLand', () => {
  it('sets property_category to land', () => {
    const result = transformBytyLand(makeLandListing());
    expect(result.property_category).toBe('land');
  });

  it('sets status to active', () => {
    const result = transformBytyLand(makeLandListing());
    expect(result.status).toBe('active');
  });

  it('sets source_platform to byty-sk', () => {
    const result = transformBytyLand(makeLandListing());
    expect(typeof result.source_platform).toBe('string');
    expect(result.source_platform).toBe('byty-sk');
  });

  it('sets source_url starting with http', () => {
    const result = transformBytyLand(makeLandListing());
    expect(result.source_url).toMatch(/^https?:\/\//);
  });

  it('sets location.country to Slovakia', () => {
    const result = transformBytyLand(makeLandListing());
    expect(result.location.country).toBe('Slovakia');
  });

  it('returns area_plot_sqm as a number >= 0', () => {
    const result = transformBytyLand(makeLandListing());
    expect(typeof result.area_plot_sqm).toBe('number');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });

  it('maps area field to area_plot_sqm', () => {
    const result = transformBytyLand(makeLandListing({ area: 1200 }));
    expect(result.area_plot_sqm).toBe(1200);
  });

  it('defaults area_plot_sqm to 0 when area is missing', () => {
    const result = transformBytyLand(makeLandListing({ area: undefined }));
    expect(result.area_plot_sqm).toBe(0);
  });

  it('sets transaction_type to sale for predaj', () => {
    const result = transformBytyLand(makeLandListing({ transactionType: 'predaj' }));
    expect(result.transaction_type).toBe('sale');
  });

  it('sets transaction_type to rent for prenajom', () => {
    const result = transformBytyLand(makeLandListing({ transactionType: 'prenajom' }));
    expect(result.transaction_type).toBe('rent');
  });

  it('detects building_plot subtype from title', () => {
    const result = transformBytyLand(makeLandListing({ title: 'Stavebný pozemok na predaj' }));
    expect(result.property_subtype).toBe('building_plot');
  });

  it('detects agricultural subtype from title', () => {
    const result = transformBytyLand(makeLandListing({ title: 'Orná pôda na predaj' }));
    expect(result.property_subtype).toBe('agricultural');
  });

  it('detects forest subtype from title', () => {
    const result = transformBytyLand(makeLandListing({ title: 'Les na predaj' }));
    expect(result.property_subtype).toBe('forest');
  });

  it('detects building permit from details', () => {
    const result = transformBytyLand(makeLandListing({ details: ['stavebné povolenie'] }));
    expect(result.building_permit).toBe(true);
  });

  it('detects no building permit from details', () => {
    const result = transformBytyLand(makeLandListing({ details: ['bez povolenia'] }));
    expect(result.building_permit).toBe(false);
  });

  it('returns undefined building_permit when not mentioned in details', () => {
    const result = transformBytyLand(makeLandListing({ details: [] }));
    expect(result.building_permit).toBeUndefined();
  });

  it('detects road access from details', () => {
    const result = transformBytyLand(makeLandListing({ details: ['prístupová cesta'] }));
    expect(result.road_access).toBe('paved');
  });

  it('detects residential zoning from details', () => {
    const result = transformBytyLand(makeLandListing({ details: ['bytová zóna'] }));
    expect(result.zoning).toBe('residential');
  });

  it('detects flat terrain from details', () => {
    const result = transformBytyLand(makeLandListing({ details: ['rovinný pozemok'] }));
    expect(result.terrain).toBe('flat');
  });

  it('handles minimal listing with no details', () => {
    const listing = makeLandListing({ details: undefined, description: undefined });
    const result = transformBytyLand(listing);
    expect(result.property_category).toBe('land');
    expect(result.status).toBe('active');
    expect(result.area_plot_sqm).toBeGreaterThanOrEqual(0);
  });
});
