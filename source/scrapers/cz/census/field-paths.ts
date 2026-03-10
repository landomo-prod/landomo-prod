/**
 * Per-portal field path configuration.
 * Maps each enum field to the JSON paths where its values live in the distinct-values.json output.
 *
 * Two modes:
 *   - "direct": field path points directly to the values (e.g., bezrealitky "disposition")
 *   - "kv": field is in a key-value array (e.g., sreality items[] where name=X, value=Y)
 *     NOTE: KV mode requires the fetch script to output per-key breakdowns.
 *     Since our fetch scripts aggregate items[].name and items[].value separately,
 *     KV mode is not yet supported. Sreality/reality use numeric code fields instead.
 *
 * null means the portal doesn't provide this field in its raw API response.
 */

export interface DirectPath {
  mode: 'direct';
  /** JSON paths in listing_fields and/or detail_fields from distinct-values.json */
  paths: string[];
}

export interface KVPath {
  mode: 'kv';
  /** The field report section: 'listing_fields' or 'detail_fields' */
  section: 'listing_fields' | 'detail_fields';
  /** Key field path in the report */
  keyPath: string;
  /** Value field path in the report */
  valuePath: string;
  /** Which key value to filter for */
  keyMatch: string;
}

export type FieldPath = DirectPath | KVPath | null;

export interface FieldConfig {
  label: string;
  canonicalValues: readonly string[];
  normalizerName: string;
  portals: Record<string, FieldPath>;
}

export const FIELD_CONFIGS: Record<string, FieldConfig> = {
  disposition: {
    label: 'Disposition (czech_disposition)',
    canonicalValues: ['1+kk', '1+1', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1', '5+kk', '5+1', '6+kk', '6+1', '7+kk', '7+1', 'atypical'],
    normalizerName: 'normalizeDisposition',
    portals: {
      // Sreality: seo.category_sub_cb is numeric code, items[].name="Typ bytu" has text but is KV.
      // Use room_count_cb (numeric 0-5) — limited but it's what we have in aggregated report.
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.recommendations_data.room_count_cb'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.disposition'] },
      // Reality: type field embeds disposition in "byt 3+1, 114 m², cihla, osobní" format
      'reality-cz': { mode: 'direct', paths: ['detail_fields.type', 'listing_fields.type'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Počet místností', 'listing_fields.title'] },
      // Realingo: disposition is embedded in category field (FLAT2_KK, FLAT31, etc.)
      'realingo-cz': { mode: 'direct', paths: ['listing_fields.category'] },
      'ulovdomov-cz': { mode: 'direct', paths: ['listing_fields.disposition'] },
      // Ceskereality: only in title, attributes.Druhy bytů is just "Klasický"
      'ceskereality-cz': { mode: 'direct', paths: ['listing_fields.title'] },
      'bazos-cz': null,  // Free text only
    },
  },
  ownership: {
    label: 'Ownership (czech_ownership)',
    canonicalValues: ['personal', 'cooperative', 'state', 'other'],
    normalizerName: 'normalizeOwnership',
    portals: {
      // Sreality: codeItems.ownership is numeric (1=Osobní, 2=Družstevní, 3=Státní)
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.codeItems.ownership'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.ownership'] },
      // Reality: in information[] KV, also embedded in type string
      'reality-cz': { mode: 'direct', paths: ['detail_fields.type'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Vlastnictví'] },
      'realingo-cz': null,  // Not available
      'ulovdomov-cz': null,  // Not available
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Vlastnictví'] },
      'bazos-cz': null,
    },
  },
  condition: {
    label: 'Condition (condition)',
    canonicalValues: ['new', 'excellent', 'very_good', 'good', 'after_renovation', 'before_renovation', 'requires_renovation', 'project', 'under_construction'],
    normalizerName: 'normalizeCondition',
    portals: {
      // Sreality: recommendations_data.building_condition is numeric code
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.recommendations_data.building_condition'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.condition'] },
      // Reality: in information[] KV
      'reality-cz': { mode: 'direct', paths: ['detail_fields.type'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Stav bytu', 'detail_fields.attributes.Stav budovy'] },
      'realingo-cz': null,  // Not available
      'ulovdomov-cz': null,  // Not available
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Stav nemovitosti'] },
      'bazos-cz': null,
    },
  },
  construction_type: {
    label: 'Construction Type (construction_type)',
    canonicalValues: ['panel', 'brick', 'stone', 'wood', 'concrete', 'mixed', 'other'],
    normalizerName: 'normalizeConstructionType',
    portals: {
      // Sreality: codeItems.building_type_search is numeric (1=Cihlová, 2=Panelová, 3=?)
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.codeItems.building_type_search'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.construction'] },
      // Reality: embedded in type string ("byt 3+1, 114 m², cihla, osobní")
      'reality-cz': { mode: 'direct', paths: ['detail_fields.type'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Konstrukce budovy'] },
      'realingo-cz': null,  // Not available
      'ulovdomov-cz': null,  // Not available
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Konstrukce'] },
      'bazos-cz': null,
    },
  },
  energy_rating: {
    label: 'Energy Rating (energy_rating)',
    canonicalValues: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    normalizerName: 'normalizeEnergyRating',
    portals: {
      // Sreality: recommendations_data.energy_efficiency_rating_cb is numeric (0-7)
      // items[].value_type has A-G letters but it's a KV sub-field
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.recommendations_data.energy_efficiency_rating_cb'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.penb'] },
      'reality-cz': null,  // In information[] KV, can't extract from aggregated report
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.PENB'] },
      'realingo-cz': null,  // Not available
      'ulovdomov-cz': null,  // Not available
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Energetická náročnost'] },
      'bazos-cz': null,
    },
  },
  heating_type: {
    label: 'Heating Type (heating_type)',
    canonicalValues: ['central_heating', 'individual_heating', 'electric_heating', 'gas_heating', 'water_heating', 'heat_pump', 'other'],
    normalizerName: 'normalizeHeatingType',
    portals: {
      // Sreality: in items[] KV with name="Topení" — can't extract from aggregated report
      'sreality-cz': null,
      'bezrealitky-cz': null,  // Field exists but always null
      'reality-cz': null,  // In information[] KV
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Topení'] },
      'realingo-cz': null,  // Not available
      'ulovdomov-cz': null,  // Not available
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Způsoby vytápění'] },
      'bazos-cz': null,
    },
  },
  furnished: {
    label: 'Furnished (furnished)',
    canonicalValues: ['furnished', 'partially_furnished', 'not_furnished'],
    normalizerName: 'normalizeFurnished',
    portals: {
      // Sreality: recommendations_data.furnished is numeric (0-3)
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.recommendations_data.furnished'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.equipped'] },
      'reality-cz': null,  // In information[] KV
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Vybavení', 'detail_fields.attributes.Vybavení domu'] },
      'realingo-cz': null,  // Not available
      'ulovdomov-cz': null,  // Not available
      'ceskereality-cz': null,  // attributes.Vybavení pronájem is equipment list, not furnished enum
      'bazos-cz': null,
    },
  },
};

export const SCRAPERS = [
  'sreality-cz',
  'bezrealitky-cz',
  'reality-cz',
  'idnes-reality-cz',
  'realingo-cz',
  'ulovdomov-cz',
  'ceskereality-cz',
  'bazos-cz',
] as const;

// ---- Per-Category Field Tracking ----

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

export interface CategoryFieldConfig {
  label: string;
  /** Which categories this field applies to */
  categories: readonly PropertyCategory[];
  /** Per-portal paths within the category-specific section of distinct-values.json */
  portals: Record<string, FieldPath>;
}

/**
 * Category-specific field configurations.
 *
 * These fields only make sense for certain property categories.
 * The paths reference fields within the per-category sections of distinct-values.json
 * (e.g., apartment.detail_fields.*, house.listing_fields.*).
 *
 * The section prefix (apartment/house/land/commercial) is added at lookup time
 * based on the category — paths here are relative within the category section.
 */
export const CATEGORY_FIELD_CONFIGS: Record<string, CategoryFieldConfig> = {
  // ---- Apartment-specific ----
  floor: {
    label: 'Floor',
    categories: ['apartment'],
    portals: {
      // Sreality: items[] with name="Podlaží"
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.recommendations_data.floor'] },
      // Bezrealitky: direct field
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.floor'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.type'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Podlaží'] },
      'realingo-cz': null,
      'ulovdomov-cz': { mode: 'direct', paths: ['listing_fields.floor'] },
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Podlaží'] },
      'bazos-cz': null,
    },
  },
  total_floors: {
    label: 'Total Floors in Building',
    categories: ['apartment'],
    portals: {
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.recommendations_data.total_floors'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.totalFloors'] },
      'reality-cz': null,
      'idnes-reality-cz': null,
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': null,
      'bazos-cz': null,
    },
  },
  balcony_area: {
    label: 'Balcony Area (sqm)',
    categories: ['apartment'],
    portals: {
      // Sreality: items[] with name="Balkón" or "Balkon" (area extracted from value)
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      // Bezrealitky: direct numeric field
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.balconySurface'] },
      'reality-cz': null,
      'idnes-reality-cz': null,
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': null,
      'bazos-cz': null,
    },
  },
  terrace_area: {
    label: 'Terrace Area (sqm)',
    categories: ['apartment'],
    portals: {
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.terraceSurface'] },
      'reality-cz': null,
      'idnes-reality-cz': null,
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': null,
      'bazos-cz': null,
    },
  },
  cellar_area: {
    label: 'Cellar Area (sqm)',
    categories: ['apartment'],
    portals: {
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.cellarSurface'] },
      'reality-cz': null,
      'idnes-reality-cz': null,
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': null,
      'bazos-cz': null,
    },
  },

  // ---- House-specific ----
  sqm_plot: {
    label: 'Plot Area (sqm)',
    categories: ['house'],
    portals: {
      // Sreality: items[] with name="Plocha pozemku"
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      // Bezrealitky: direct field
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.surfaceLand'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Plocha pozemku'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Plocha pozemku'] },
      'bazos-cz': null,
    },
  },
  stories: {
    label: 'Number of Stories',
    categories: ['house'],
    portals: {
      // Sreality: items[] "Počet podlaží" / "Počet pater" / "Pater v domě"
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.totalFloors'] },
      'reality-cz': null,
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Počet podlaží'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Počet podlaží'] },
      'bazos-cz': null,
    },
  },
  garden_area: {
    label: 'Garden Area (sqm)',
    categories: ['house'],
    portals: {
      // Sreality: items[] "Zahrada" or "Plocha zahrady"
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': null, // boolean frontGarden only, no area
      'reality-cz': null,
      'idnes-reality-cz': null,
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': null,
      'bazos-cz': null,
    },
  },
  house_type: {
    label: 'House Type/Subtype',
    categories: ['house'],
    portals: {
      // Sreality: seo.category_sub_cb numeric code maps to detached/semi-detached/villa/etc.
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.seo.category_sub_cb'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.estateType'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.type'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['listing_fields.propertyType', 'listing_fields.title'] },
      'realingo-cz': { mode: 'direct', paths: ['listing_fields.category'] },
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['listing_fields.title'] },
      'bazos-cz': null,
    },
  },

  // ---- Land-specific ----
  has_water: {
    label: 'Water Supply',
    categories: ['land'],
    portals: {
      // Sreality: items[] "Voda"
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.water'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Voda'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Voda'] },
      'bazos-cz': null,
    },
  },
  has_sewage: {
    label: 'Sewage',
    categories: ['land'],
    portals: {
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.sewage'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Odpad'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Odpad'] },
      'bazos-cz': null,
    },
  },
  has_electricity: {
    label: 'Electricity',
    categories: ['land'],
    portals: {
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': null, // not in types
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Elektřina'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Elektřina'] },
      'bazos-cz': null,
    },
  },
  has_gas: {
    label: 'Gas Connection',
    categories: ['land'],
    portals: {
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': null, // not in types
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Plyn'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Plyn'] },
      'bazos-cz': null,
    },
  },

  // ---- Commercial-specific ----
  sqm_office: {
    label: 'Office/Usable Area (sqm)',
    categories: ['commercial'],
    portals: {
      // Sreality: items[] "Užitná plocha" in commercial context
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.surface'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Užitná plocha'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Užitná plocha'] },
      'bazos-cz': null,
    },
  },
  ceiling_height: {
    label: 'Ceiling Height',
    categories: ['commercial'],
    portals: {
      // Sreality: items[] might have "Výška stropu" for warehouses
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      'bezrealitky-cz': null,
      'reality-cz': null,
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Výška stropu'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': null,
      'bazos-cz': null,
    },
  },

  // ---- Cross-category (rental) ----
  monthly_fees: {
    label: 'Monthly Fees/Charges',
    categories: ['apartment', 'house', 'commercial'],
    portals: {
      // Sreality: items[] "Měsíční náklady" or service charges in price info
      'sreality-cz': { mode: 'direct', paths: ['detail_fields.items[].name'] },
      // Bezrealitky: direct fields for charges
      'bezrealitky-cz': { mode: 'direct', paths: ['listing_fields.charges', 'listing_fields.serviceCharges'] },
      'reality-cz': { mode: 'direct', paths: ['detail_fields.information'] },
      'idnes-reality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Měsíční náklady', 'detail_fields.attributes.Poplatky'] },
      'realingo-cz': null,
      'ulovdomov-cz': null,
      'ceskereality-cz': { mode: 'direct', paths: ['detail_fields.attributes.Měsíční poplatky'] },
      'bazos-cz': null,
    },
  },
};
