import {
  PropertyChangeEvent,
  PropertyEventType,
  PropertyFilterSnapshot,
  WatchdogFilters,
} from '@landomo/core';
import { getSupabaseAdmin, WatchdogRow } from './supabase-client';
import { config } from './config';
import { logger } from './logger';
import { watchdogsLoaded } from './metrics';

export interface WatchdogMatch {
  watchdog: WatchdogRow;
  change: PropertyChangeEvent;
}

/**
 * In-memory watchdog evaluator.
 *
 * Loads all active watchdogs for this country into memory and indexes them
 * by trigger_events for fast lookup. On each batch of property changes,
 * evaluates which watchdogs match which changes.
 */
export class WatchdogEvaluator {
  private watchdogs: WatchdogRow[] = [];
  private byTriggerEvent = new Map<string, WatchdogRow[]>();
  private byEventAndCity = new Map<string, Map<string, WatchdogRow[]>>();
  private refreshTimer: NodeJS.Timeout | null = null;
  private lastRefresh = 0;

  async start(): Promise<void> {
    await this.refresh();
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((err) =>
        logger.error({ err: err.message }, 'watchdog refresh failed')
      );
    }, config.watchdog.refreshIntervalMs);
    logger.info(
      { watchdogs: this.watchdogs.length, refresh_interval_s: config.watchdog.refreshIntervalMs / 1000 },
      'watchdog evaluator started'
    );
  }

  async stop(): Promise<void> {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refresh(): Promise<void> {
    const supabase = getSupabaseAdmin();
    const PAGE_SIZE = 1000;
    const allWatchdogs: WatchdogRow[] = [];
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from('watchdogs')
        .select('*')
        .eq('country', config.country)
        .eq('active', true)
        .eq('muted', false)
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        if (offset === 0) {
          throw new Error(`Failed to fetch watchdogs (first page): ${error.message}`);
        }
        logger.error({ err: error.message, offset }, 'failed to fetch watchdogs page, using partial data');
        break;
      }

      allWatchdogs.push(...(data as WatchdogRow[]));

      if (!data || data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    this.watchdogs = allWatchdogs;
    this.rebuildIndex();
    this.lastRefresh = Date.now();
    watchdogsLoaded.set({ country: config.country }, this.watchdogs.length);
    logger.info({ watchdogs: this.watchdogs.length }, 'watchdogs refreshed');
  }

  private rebuildIndex(): void {
    this.byTriggerEvent.clear();
    this.byEventAndCity.clear();
    for (const wd of this.watchdogs) {
      const cityKey = ((wd.filters as WatchdogFilters)?.city || '').trim().toLowerCase() || '*';
      for (const event of wd.trigger_events) {
        const list = this.byTriggerEvent.get(event) || [];
        list.push(wd);
        this.byTriggerEvent.set(event, list);

        let cityMap = this.byEventAndCity.get(event);
        if (!cityMap) {
          cityMap = new Map();
          this.byEventAndCity.set(event, cityMap);
        }
        const cityList = cityMap.get(cityKey) || [];
        cityList.push(wd);
        cityMap.set(cityKey, cityList);
      }
    }
  }

  /**
   * Evaluate a batch of property changes against all loaded watchdogs.
   * Returns matched pairs of (watchdog, change).
   */
  evaluate(changes: PropertyChangeEvent[]): WatchdogMatch[] {
    const matches: WatchdogMatch[] = [];

    for (const change of changes) {
      const cityMap = this.byEventAndCity.get(change.event_type);
      if (!cityMap) continue;

      const cityKey = (change.filter_snapshot.city || '').trim().toLowerCase();
      const candidates: WatchdogRow[] = [];

      // Watchdogs with no city filter match everything
      const wildcard = cityMap.get('*');
      if (wildcard) candidates.push(...wildcard);

      // Watchdogs filtering on this specific city
      if (cityKey) {
        const citySpecific = cityMap.get(cityKey);
        if (citySpecific) candidates.push(...citySpecific);
      }

      for (const wd of candidates) {
        if (this.matchesFilters(wd.filters as WatchdogFilters, change.filter_snapshot, change.price, change)) {
          matches.push({ watchdog: wd, change });
        }
      }
    }

    return matches;
  }

  /**
   * Check if a property's filter snapshot matches a watchdog's filter criteria.
   * All specified filter fields must match (AND logic).
   */
  private matchesFilters(
    filters: WatchdogFilters,
    snapshot: PropertyFilterSnapshot,
    price: number,
    change?: PropertyChangeEvent
  ): boolean {
    // Category
    if (filters.property_category && filters.property_category !== snapshot.property_category) {
      return false;
    }

    // Transaction type
    if (filters.transaction_type && filters.transaction_type !== snapshot.transaction_type) {
      return false;
    }

    // Location
    if (filters.city && filters.city.toLowerCase() !== snapshot.city?.toLowerCase()) {
      return false;
    }
    if (filters.region && filters.region.toLowerCase() !== snapshot.region?.toLowerCase()) {
      return false;
    }
    if (filters.district && filters.district.toLowerCase() !== snapshot.district?.toLowerCase()) {
      return false;
    }
    if (filters.neighbourhood && filters.neighbourhood.toLowerCase() !== snapshot.neighbourhood?.toLowerCase()) {
      return false;
    }
    if (filters.municipality && filters.municipality.toLowerCase() !== snapshot.municipality?.toLowerCase()) {
      return false;
    }

    // Price range
    if (filters.price_min != null && price < filters.price_min) return false;
    if (filters.price_max != null && price > filters.price_max) return false;

    // Bedrooms range (use snapshot.bedrooms which is unified across categories)
    const bedrooms = snapshot.bedrooms;
    if (filters.bedrooms_min != null && (bedrooms == null || bedrooms < filters.bedrooms_min)) {
      return false;
    }
    if (filters.bedrooms_max != null && (bedrooms == null || bedrooms > filters.bedrooms_max)) {
      return false;
    }

    // Bathrooms
    if (filters.bathrooms_min != null && (snapshot.bathrooms == null || snapshot.bathrooms < filters.bathrooms_min)) {
      return false;
    }

    // Floor range
    if (filters.floor_min != null && (snapshot.floor == null || snapshot.floor < filters.floor_min)) return false;
    if (filters.floor_max != null && (snapshot.floor == null || snapshot.floor > filters.floor_max)) return false;

    // Sqm range (use sqm or sqm_total or sqm_living or sqm_plot or area_plot_sqm depending on category)
    const sqm =
      snapshot.sqm ?? snapshot.sqm_total ?? snapshot.sqm_living ?? snapshot.sqm_plot ?? snapshot.area_plot_sqm;
    if (filters.sqm_min != null && (sqm == null || sqm < filters.sqm_min)) return false;
    if (filters.sqm_max != null && (sqm == null || sqm > filters.sqm_max)) return false;

    // Sqm plot range
    const sqmPlot = snapshot.sqm_plot ?? snapshot.area_plot_sqm;
    if (filters.sqm_plot_min != null && (sqmPlot == null || sqmPlot < filters.sqm_plot_min)) return false;
    if (filters.sqm_plot_max != null && (sqmPlot == null || sqmPlot > filters.sqm_plot_max)) return false;

    // Universal property attributes
    if (filters.furnished && filters.furnished !== snapshot.furnished) return false;
    if (filters.construction_type && filters.construction_type !== snapshot.construction_type) return false;
    if (filters.energy_class && filters.energy_class.toLowerCase() !== snapshot.energy_class?.toLowerCase()) {
      return false;
    }
    if (filters.year_built_min != null && (snapshot.year_built == null || snapshot.year_built < filters.year_built_min)) {
      return false;
    }
    if (filters.year_built_max != null && (snapshot.year_built == null || snapshot.year_built > filters.year_built_max)) {
      return false;
    }

    // Portal
    if (filters.portal && change && filters.portal !== change.portal_id) return false;

    // Czech-specific
    if (filters.disposition && filters.disposition !== snapshot.disposition) return false;
    if (filters.ownership && filters.ownership !== snapshot.ownership) return false;
    if (filters.building_type && filters.building_type !== snapshot.building_type) return false;
    if (filters.condition && filters.condition !== snapshot.condition) return false;

    // Amenities (if filter is true, property must have it)
    if (filters.has_parking && !snapshot.has_parking) return false;
    if (filters.has_garden && !snapshot.has_garden) return false;
    if (filters.has_pool && !snapshot.has_pool) return false;
    if (filters.has_balcony && !snapshot.has_balcony) return false;
    if (filters.has_terrace && !snapshot.has_terrace) return false;
    if (filters.has_elevator && !snapshot.has_elevator) return false;
    if (filters.has_garage && !snapshot.has_garage) return false;
    if (filters.has_basement && !snapshot.has_basement) return false;

    return true;
  }

  getStats() {
    return {
      totalWatchdogs: this.watchdogs.length,
      byTriggerEvent: Object.fromEntries(
        Array.from(this.byTriggerEvent.entries()).map(([k, v]) => [k, v.length])
      ),
      lastRefresh: this.lastRefresh,
    };
  }
}
