import { describe, it, expect } from 'vitest';
import { PropertyChangeEvent } from '@landomo/core';
import { buildTitle, buildMessage } from '../notification-router';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChange(overrides: Partial<PropertyChangeEvent> = {}): PropertyChangeEvent {
  return {
    property_id: 'prop-1',
    portal_id: 'sreality',
    event_type: 'new_listing',
    property_category: 'apartment',
    city: 'Praha',
    price: 5_000_000,
    filter_snapshot: {
      property_category: 'apartment',
      transaction_type: 'sale',
      city: 'Praha',
      currency: 'CZK',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildTitle tests
// ---------------------------------------------------------------------------

describe('buildTitle', () => {
  it('returns correct title for new_listing', () => {
    const change = makeChange({ event_type: 'new_listing', property_category: 'apartment', city: 'Praha' });
    expect(buildTitle(change)).toBe('New apartment in Praha');
  });

  it('returns correct title for new_listing with house category', () => {
    const change = makeChange({ event_type: 'new_listing', property_category: 'house', city: 'Brno' });
    expect(buildTitle(change)).toBe('New house in Brno');
  });

  it('returns correct title for price_drop with percentage', () => {
    const change = makeChange({
      event_type: 'price_drop',
      price: 4_000_000,
      old_price: 5_000_000,
      city: 'Praha',
    });
    expect(buildTitle(change)).toBe('Price dropped 20% — Praha');
  });

  it('returns 0% drop when old_price is missing', () => {
    const change = makeChange({
      event_type: 'price_drop',
      price: 4_000_000,
      old_price: undefined,
      city: 'Praha',
    });
    expect(buildTitle(change)).toBe('Price dropped 0% — Praha');
  });

  it('rounds percentage correctly', () => {
    const change = makeChange({
      event_type: 'price_drop',
      price: 3_333_333,
      old_price: 5_000_000,
      city: 'Praha',
    });
    // (5M - 3.333M) / 5M * 100 = 33.33334 → rounds to 33
    expect(buildTitle(change)).toBe('Price dropped 33% — Praha');
  });

  it('returns correct title for price_increase', () => {
    const change = makeChange({ event_type: 'price_increase', city: 'Brno' });
    expect(buildTitle(change)).toBe('Price increased — Brno');
  });

  it('returns correct title for status_removed', () => {
    const change = makeChange({ event_type: 'status_removed', city: 'Ostrava' });
    expect(buildTitle(change)).toBe('Listing removed — Ostrava');
  });

  it('returns correct title for reactivated', () => {
    const change = makeChange({ event_type: 'reactivated', city: 'Plzeň' });
    expect(buildTitle(change)).toBe('Listing reactivated — Plzeň');
  });

  it('returns generic title for unknown event type', () => {
    const change = makeChange({ event_type: 'some_future_event' as any, city: 'Praha' });
    expect(buildTitle(change)).toBe('Property update — Praha');
  });
});

// ---------------------------------------------------------------------------
// buildMessage tests
// ---------------------------------------------------------------------------

describe('buildMessage', () => {
  it('returns correct message for new_listing', () => {
    const change = makeChange({
      event_type: 'new_listing',
      property_category: 'apartment',
      city: 'Praha',
      price: 5_000_000,
    });
    const msg = buildMessage(change);
    expect(msg).toContain('New apartment');
    expect(msg).toContain('CZK');
    expect(msg).toContain('Praha');
  });

  it('returns correct message for price_drop with old_price', () => {
    const change = makeChange({
      event_type: 'price_drop',
      price: 4_000_000,
      old_price: 5_000_000,
    });
    const msg = buildMessage(change);
    expect(msg).toContain('Price dropped from');
    expect(msg).toContain('CZK');
  });

  it('returns "?" when old_price is missing on price_drop', () => {
    const change = makeChange({
      event_type: 'price_drop',
      price: 4_000_000,
      old_price: undefined,
    });
    const msg = buildMessage(change);
    expect(msg).toContain('?');
    expect(msg).toContain('CZK');
  });

  it('returns correct message for price_increase with old_price', () => {
    const change = makeChange({
      event_type: 'price_increase',
      price: 6_000_000,
      old_price: 5_000_000,
    });
    const msg = buildMessage(change);
    expect(msg).toContain('Price increased from');
    expect(msg).toContain('CZK');
  });

  it('returns "?" when old_price is missing on price_increase', () => {
    const change = makeChange({
      event_type: 'price_increase',
      price: 6_000_000,
      old_price: undefined,
    });
    const msg = buildMessage(change);
    expect(msg).toContain('?');
  });

  it('returns correct message for status_removed', () => {
    const change = makeChange({
      event_type: 'status_removed',
      property_category: 'house',
      price: 10_000_000,
    });
    const msg = buildMessage(change);
    expect(msg).toMatch(/house/i);
    expect(msg).toContain('was removed');
    expect(msg).toContain('CZK');
  });

  it('returns correct message for reactivated', () => {
    const change = makeChange({
      event_type: 'reactivated',
      property_category: 'land',
      price: 2_000_000,
    });
    const msg = buildMessage(change);
    expect(msg).toMatch(/land/i);
    expect(msg).toContain('was reactivated');
    expect(msg).toContain('CZK');
  });

  it('returns generic message for unknown event type', () => {
    const change = makeChange({ event_type: 'future_event' as any, price: 1_000 });
    const msg = buildMessage(change);
    expect(msg).toContain('Property updated');
    expect(msg).toContain('CZK');
  });

  it('uses filter_snapshot.currency when set', () => {
    const change = makeChange({
      event_type: 'new_listing',
      filter_snapshot: { property_category: 'apartment', currency: 'EUR' },
    });
    const msg = buildMessage(change);
    expect(msg).toContain('EUR');
    expect(msg).not.toContain('CZK');
  });

  it('defaults to CZK when currency is not set', () => {
    const change = makeChange({
      event_type: 'new_listing',
      filter_snapshot: { property_category: 'apartment' },
    });
    const msg = buildMessage(change);
    expect(msg).toContain('CZK');
  });
});
