import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PropertyChangeEvent, PropertyFilterSnapshot, WatchdogFilters } from '@landomo/core';
import { WatchdogRow } from '../supabase-client';

// Mock external dependencies before importing the module under test
vi.mock('../supabase-client', () => ({
  getSupabaseAdmin: vi.fn(),
}));
vi.mock('../config', () => ({
  config: {
    country: 'czech',
    watchdog: { refreshIntervalMs: 300000 },
  },
}));
vi.mock('../metrics', () => ({
  watchdogsLoaded: { set: vi.fn() },
}));

import { WatchdogEvaluator, WatchdogMatch } from '../watchdog-evaluator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWatchdog(overrides: Partial<WatchdogRow> = {}): WatchdogRow {
  return {
    id: 'wd-1',
    user_id: 'user-1',
    name: 'Test Watchdog',
    country: 'czech',
    filters: {},
    trigger_events: ['new_listing'],
    frequency: 'instant',
    channels: ['in_app'],
    active: true,
    muted: false,
    max_notifications_per_day: 100,
    last_triggered_at: null,
    ...overrides,
  };
}

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
      region: 'Praha',
      currency: 'CZK',
    },
    ...overrides,
  };
}

/**
 * Helper: load watchdogs into the evaluator by calling the private rebuildIndex
 * through evaluate() after setting watchdogs via a refresh mock.
 */
function createEvaluatorWithWatchdogs(watchdogs: WatchdogRow[]): WatchdogEvaluator {
  const evaluator = new WatchdogEvaluator();
  // Access private field to inject test data without hitting Supabase
  (evaluator as any).watchdogs = watchdogs;
  (evaluator as any).rebuildIndex();
  return evaluator;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WatchdogEvaluator', () => {
  describe('evaluate() — matchesFilters logic', () => {
    // --- Empty / no filters -------------------------------------------------

    it('matches everything when filters are empty', () => {
      const wd = makeWatchdog({ filters: {} });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('matches when filter object has only undefined/null-like values', () => {
      const wd = makeWatchdog({
        filters: {
          property_category: undefined,
          city: undefined,
          price_min: undefined,
        } as any,
      });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    // --- Exact match filters ------------------------------------------------

    it('matches when property_category matches', () => {
      const wd = makeWatchdog({ filters: { property_category: 'apartment' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when property_category does not match', () => {
      const wd = makeWatchdog({ filters: { property_category: 'house' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    it('matches when transaction_type matches', () => {
      const wd = makeWatchdog({ filters: { transaction_type: 'sale' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when transaction_type does not match', () => {
      const wd = makeWatchdog({ filters: { transaction_type: 'rent' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    // --- City / region (case-insensitive) -----------------------------------

    it('matches city case-insensitively', () => {
      const wd = makeWatchdog({ filters: { city: 'praha' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('matches city case-insensitively (uppercase filter)', () => {
      const wd = makeWatchdog({ filters: { city: 'PRAHA' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when city does not match', () => {
      const wd = makeWatchdog({ filters: { city: 'Brno' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    it('rejects when filter has city but snapshot city is undefined', () => {
      const wd = makeWatchdog({ filters: { city: 'Praha' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', city: undefined },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('matches region case-insensitively', () => {
      const wd = makeWatchdog({ filters: { region: 'praha' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when region does not match', () => {
      const wd = makeWatchdog({ filters: { region: 'Jihomoravský' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    // --- Price range --------------------------------------------------------

    it('matches when price is within range', () => {
      const wd = makeWatchdog({ filters: { price_min: 4_000_000, price_max: 6_000_000 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('matches when price equals price_min', () => {
      const wd = makeWatchdog({ filters: { price_min: 5_000_000 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('matches when price equals price_max', () => {
      const wd = makeWatchdog({ filters: { price_max: 5_000_000 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when price is below price_min', () => {
      const wd = makeWatchdog({ filters: { price_min: 6_000_000 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    it('rejects when price is above price_max', () => {
      const wd = makeWatchdog({ filters: { price_max: 4_000_000 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    it('handles price = 0', () => {
      const wd = makeWatchdog({ filters: { price_min: 0, price_max: 100 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({ price: 0 });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    // --- Bedrooms range -----------------------------------------------------

    it('matches when bedrooms is within range', () => {
      const wd = makeWatchdog({ filters: { bedrooms_min: 2, bedrooms_max: 4 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', bedrooms: 3 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when bedrooms is below bedrooms_min', () => {
      const wd = makeWatchdog({ filters: { bedrooms_min: 3 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', bedrooms: 1 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('rejects when bedrooms is null and bedrooms_min is set', () => {
      const wd = makeWatchdog({ filters: { bedrooms_min: 2 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment' }, // bedrooms undefined
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    // --- Sqm range (with fallback fields) -----------------------------------

    it('matches sqm from snapshot.sqm', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 50, sqm_max: 100 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', sqm: 75 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches sqm from snapshot.sqm_total fallback', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 50 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'commercial', sqm_total: 200 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches sqm from snapshot.sqm_living fallback', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 50 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'house', sqm_living: 120 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches sqm from snapshot.sqm_plot fallback', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 500 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'house', sqm_plot: 800 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches sqm from snapshot.area_plot_sqm fallback', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 500 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'land', area_plot_sqm: 1000 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when sqm is below sqm_min', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 100 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', sqm: 50 },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('rejects when no sqm field exists and sqm_min is set', () => {
      const wd = makeWatchdog({ filters: { sqm_min: 100 } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    // --- Czech-specific exact match fields ----------------------------------

    it('matches disposition filter', () => {
      const wd = makeWatchdog({ filters: { disposition: '3+kk' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', disposition: '3+kk' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('rejects disposition mismatch', () => {
      const wd = makeWatchdog({ filters: { disposition: '3+kk' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', disposition: '2+1' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('matches ownership filter', () => {
      const wd = makeWatchdog({ filters: { ownership: 'personal' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', ownership: 'personal' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches building_type filter', () => {
      const wd = makeWatchdog({ filters: { building_type: 'brick' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', building_type: 'brick' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches condition filter', () => {
      const wd = makeWatchdog({ filters: { condition: 'new' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', condition: 'new' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    // --- Amenity boolean filters --------------------------------------------

    it('matches when amenity filter is true and property has it', () => {
      const wd = makeWatchdog({ filters: { has_parking: true } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', has_parking: true },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when amenity filter is true but property lacks it', () => {
      const wd = makeWatchdog({ filters: { has_parking: true } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment', has_parking: false },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('rejects when amenity filter is true but property field is undefined', () => {
      const wd = makeWatchdog({ filters: { has_elevator: true } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('does not reject when amenity filter is false/undefined', () => {
      const wd = makeWatchdog({ filters: { has_parking: false } as any });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: { property_category: 'apartment' },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches all amenity filters together', () => {
      const wd = makeWatchdog({
        filters: { has_balcony: true, has_terrace: true, has_garage: true, has_basement: true },
      });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        filter_snapshot: {
          property_category: 'apartment',
          has_balcony: true,
          has_terrace: true,
          has_garage: true,
          has_basement: true,
        },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    // --- Multiple filters (AND logic) ---------------------------------------

    it('matches when all filters match simultaneously', () => {
      const wd = makeWatchdog({
        filters: {
          property_category: 'apartment',
          transaction_type: 'sale',
          city: 'Praha',
          price_min: 3_000_000,
          price_max: 8_000_000,
          disposition: '3+kk',
          has_balcony: true,
        },
      });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({
        price: 5_000_000,
        filter_snapshot: {
          property_category: 'apartment',
          transaction_type: 'sale',
          city: 'Praha',
          disposition: '3+kk',
          has_balcony: true,
        },
      });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('rejects when one filter in a set of many does not match', () => {
      const wd = makeWatchdog({
        filters: {
          property_category: 'apartment',
          city: 'Praha',
          price_max: 4_000_000, // change price is 5M — too high
        },
      });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    // --- Trigger event filtering --------------------------------------------

    it('only evaluates watchdogs matching the event type', () => {
      const wd = makeWatchdog({ trigger_events: ['price_drop'] });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({ event_type: 'new_listing' });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(0);
    });

    it('matches when trigger event matches', () => {
      const wd = makeWatchdog({ trigger_events: ['price_drop'] });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const change = makeChange({ event_type: 'price_drop' });
      const matches = evaluator.evaluate([change]);
      expect(matches).toHaveLength(1);
    });

    it('matches when watchdog subscribes to multiple events', () => {
      const wd = makeWatchdog({ trigger_events: ['new_listing', 'price_drop', 'reactivated'] });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([makeChange({ event_type: 'reactivated' })]);
      expect(matches).toHaveLength(1);
    });

    // --- Multiple watchdogs / changes ---------------------------------------

    it('returns matches from multiple watchdogs for the same change', () => {
      const wd1 = makeWatchdog({ id: 'wd-1', filters: { city: 'Praha' } });
      const wd2 = makeWatchdog({ id: 'wd-2', filters: { property_category: 'apartment' } });
      const evaluator = createEvaluatorWithWatchdogs([wd1, wd2]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(2);
    });

    it('evaluates multiple changes in a batch', () => {
      const wd = makeWatchdog({ filters: { city: 'Praha' } });
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const changes = [
        makeChange({ property_id: 'p1', city: 'Praha', filter_snapshot: { property_category: 'apartment', city: 'Praha' } }),
        makeChange({ property_id: 'p2', city: 'Brno', filter_snapshot: { property_category: 'apartment', city: 'Brno' } }),
        makeChange({ property_id: 'p3', city: 'Praha', filter_snapshot: { property_category: 'house', city: 'Praha' } }),
      ];
      const matches = evaluator.evaluate(changes);
      expect(matches).toHaveLength(2);
      expect(matches.map((m) => m.change.property_id)).toEqual(['p1', 'p3']);
    });

    it('returns empty array when no watchdogs are loaded', () => {
      const evaluator = createEvaluatorWithWatchdogs([]);
      const matches = evaluator.evaluate([makeChange()]);
      expect(matches).toHaveLength(0);
    });

    it('returns empty array when changes array is empty', () => {
      const wd = makeWatchdog({});
      const evaluator = createEvaluatorWithWatchdogs([wd]);
      const matches = evaluator.evaluate([]);
      expect(matches).toHaveLength(0);
    });
  });

  describe('getStats()', () => {
    it('returns correct stats', () => {
      const wd1 = makeWatchdog({ id: 'wd-1', trigger_events: ['new_listing', 'price_drop'] });
      const wd2 = makeWatchdog({ id: 'wd-2', trigger_events: ['new_listing'] });
      const evaluator = createEvaluatorWithWatchdogs([wd1, wd2]);
      const stats = evaluator.getStats();
      expect(stats.totalWatchdogs).toBe(2);
      expect(stats.byTriggerEvent).toEqual({ new_listing: 2, price_drop: 1 });
    });
  });
});
