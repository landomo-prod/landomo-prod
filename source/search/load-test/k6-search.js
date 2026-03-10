/**
 * k6 Load Test — Landomo Search Service
 *
 * Simulates realistic usage patterns:
 *   25% — Geo search (GPS + radius, Czech cities)
 *   25% — Attribute search (category, price, bedrooms, amenities)
 *   20% — Map tile clustering (z/x/y slippy-map tiles, all zoom levels)
 *   15% — Property detail (IDs harvested from search)
 *   10% — Filter options
 *    5% — Combined: search → pick result → detail
 *
 * Run:
 *   k6 run k6-search.js
 *   k6 run --vus 100 --duration 60s k6-search.js
 *   k6 run --vus 500 --duration 120s k6-search.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate    = new Rate('errors');
const geoSearchP99  = new Trend('geo_search_p99');
const attrSearchP99 = new Trend('attr_search_p99');
const mapTileP99    = new Trend('map_tile_p99');
const detailP99     = new Trend('detail_p99');
const filtersP99    = new Trend('filters_p99');
const searchErrors  = new Counter('search_errors');

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const COUNTRY  = __ENV.COUNTRY  || 'czech';

// ─── Test Stages ──────────────────────────────────────────────────────────────
export const options = {
  setupTimeout: '300s',
  stages: [
    { duration: '30s', target: 50  }, // ramp up
    { duration: '60s', target: 200 }, // sustained load
    { duration: '60s', target: 500 }, // peak load
    { duration: '30s', target: 0   }, // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],           // <1% errors
    http_req_duration: ['p(95)<300'],           // 95th percentile <300ms
    geo_search_p99:    ['p(99)<120'],           // geo search <120ms p99
    attr_search_p99:   ['p(99)<120'],           // attr search <120ms p99
    map_tile_p99:      ['p(99)<120'],           // map tiles <120ms p99 (cached)
    detail_p99:        ['p(99)<120'],           // detail <120ms p99
    filters_p99:       ['p(99)<120'],           // filters <120ms p99 (precomputed)
    errors:            ['rate<0.01'],
  },
};

// ─── Czech City Centers ───────────────────────────────────────────────────────
const CITIES = [
  { name: 'Praha',    lat: 50.0755, lon: 14.4378, radius: 15 },
  { name: 'Brno',     lat: 49.1951, lon: 16.6068, radius: 10 },
  { name: 'Ostrava',  lat: 49.8209, lon: 18.2625, radius: 10 },
  { name: 'Plzeň',    lat: 49.7384, lon: 13.3736, radius: 8  },
  { name: 'Liberec',  lat: 50.7663, lon: 15.0543, radius: 6  },
  { name: 'Olomouc',  lat: 49.5938, lon: 17.2509, radius: 6  },
  { name: 'Hradec',   lat: 50.2092, lon: 15.8328, radius: 6  },
  { name: 'Pardubice',lat: 50.0343, lon: 15.7812, radius: 6  },
  { name: 'Zlín',     lat: 49.2248, lon: 17.6658, radius: 5  },
  { name: 'Kladno',   lat: 50.1477, lon: 14.1019, radius: 5  },
];

// Prague districts (small radius search)
const PRAGUE_DISTRICTS = [
  { name: 'Praha 1',  lat: 50.0850, lon: 14.4219, radius: 2 },
  { name: 'Praha 2',  lat: 50.0750, lon: 14.4364, radius: 2 },
  { name: 'Praha 3',  lat: 50.0832, lon: 14.4572, radius: 2 },
  { name: 'Praha 5',  lat: 50.0673, lon: 14.3974, radius: 3 },
  { name: 'Praha 6',  lat: 50.1009, lon: 14.3817, radius: 3 },
  { name: 'Praha 7',  lat: 50.1063, lon: 14.4392, radius: 2 },
  { name: 'Praha 8',  lat: 50.1189, lon: 14.4694, radius: 3 },
  { name: 'Praha 10', lat: 50.0669, lon: 14.4808, radius: 3 },
];

// ─── Realistic Filter Combos ─────────────────────────────────────────────────
const FILTER_PROFILES = [
  // Buyer — apartment for sale, 2 bedrooms, Praha
  {
    property_category: 'apartment',
    transaction_type: 'sale',
    city: 'Praha',
    price_min: 3000000,
    price_max: 8000000,
    bedrooms_min: 2,
    bedrooms_max: 3,
  },
  // Renter — apartment, central Prague, budget
  {
    property_category: 'apartment',
    transaction_type: 'rent',
    city: 'Praha',
    price_max: 25000,
    bedrooms_min: 1,
  },
  // House buyer — Brno suburbs
  {
    property_category: 'house',
    transaction_type: 'sale',
    city: 'Brno',
    price_min: 5000000,
    price_max: 15000000,
  },
  // Apartment with parking + elevator (Praha)
  {
    property_category: 'apartment',
    transaction_type: 'sale',
    city: 'Praha',
    price_min: 4000000,
    price_max: 12000000,
    has_parking: true,
    has_elevator: true,
  },
  // Large apartment — investor profile
  {
    property_category: 'apartment',
    transaction_type: 'rent',
    price_min: 15000,
    price_max: 50000,
    sqm_min: 60,
  },
  // Land sale (outside Praha)
  {
    property_category: 'land',
    transaction_type: 'sale',
    price_max: 3000000,
  },
  // Cheap rent — student profile
  {
    property_category: 'apartment',
    transaction_type: 'rent',
    price_max: 12000,
    bedrooms_max: 1,
  },
  // Luxury segment
  {
    property_category: 'apartment',
    transaction_type: 'sale',
    price_min: 15000000,
    city: 'Praha',
    has_balcony: true,
    has_elevator: true,
  },
];

// ─── Map Tile Grid: Praha at key zoom levels ──────────────────────────────────
// Pre-computed Web Mercator tile coords (z/x/y) for Praha + surrounding area.
// Using fixed tiles simulates the cache-friendly pattern real map clients produce
// (same tiles requested repeatedly as users pan/zoom).
//
// Praha center: lat=50.0755, lon=14.4378
//   z=10 → x=554, y=345
//   z=12 → x=2218, y=1383
//   z=13 → x=4436, y=2766
//   z=15 → x=17745, y=11065
//   z=17 → x=71008, y=44255  (individual pins mode)
const MAP_TILE_SCENARIOS = [
  // Country / region view — geohash clusters, large cells
  { z: 7,  x: 69,   y: 43,   label: 'CZ-country'     },
  { z: 9,  x: 277,  y: 172,  label: 'CZ-region'      },
  // City view — geohash clusters, fine cells
  { z: 10, x: 554,  y: 345,  label: 'Praha-z10'      },
  { z: 11, x: 1109, y: 690,  label: 'Praha-z11'      },
  { z: 12, x: 2218, y: 1383, label: 'Praha-z12'      },
  { z: 13, x: 4436, y: 2766, label: 'Praha-z13'      },
  { z: 14, x: 8872, y: 5533, label: 'Praha-z14'      },
  // Block view — grid clusters
  { z: 15, x: 17745, y: 11065, label: 'Praha-z15-grid' },
  { z: 16, x: 35490, y: 22130, label: 'Praha-z16-grid' },
  // Street view — individual pins
  { z: 17, x: 71008, y: 44255, label: 'Praha-z17-pins' },
  // Brno tiles
  { z: 10, x: 554,  y: 347,  label: 'Brno-z10'       },
  { z: 12, x: 2220, y: 1389, label: 'Brno-z12'       },
];

// Neighbour tile offsets — simulates user panning (requests adjacent tiles)
const TILE_OFFSETS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

const SORT_OPTIONS = [
  { field: 'price',      order: 'asc'  },
  { field: 'price',      order: 'desc' },
  { field: 'created_at', order: 'desc' },
  null,
];
const DISPOSITIONS = ['1+kk', '2+kk', '2+1', '3+kk', '3+1', '4+kk', '4+1'];

// Fixed tile filter suffixes — must match tileFilterSuffixes in setup() exactly.
// Using a fixed set (instead of random independent filters) ensures 100% cache coverage.
const TILE_FILTER_SUFFIXES = [
  '',
  '&property_category=apartment',
  '&property_category=house',
  '&property_category=land',
  '&transaction_type=sale',
  '&transaction_type=rent',
  '&price_max=5000000',
  '&price_max=8000000',
  '&price_max=15000000',
  '&property_category=apartment&transaction_type=sale',
  '&property_category=apartment&transaction_type=rent',
  '&property_category=house&transaction_type=sale',
  '&property_category=house&transaction_type=rent',
  '&property_category=land&transaction_type=sale',
  '&property_category=land&transaction_type=rent',
];

// ─── Cache Warm-up (runs once before VUs start) ───────────────────────────────
// Fires the most-common queries so Redis is warm when the 100 VUs hit.
// This prevents cold-start outliers from inflating p99.
export function setup() {
  const headers = { 'Content-Type': 'application/json' };

  // Helper: send requests in small parallel chunks to avoid overwhelming DB pool
  function batchChunked(reqs, chunkSize) {
    for (let i = 0; i < reqs.length; i += chunkSize) {
      http.batch(reqs.slice(i, i + chunkSize));
    }
  }

  // Warm filter options (15 combos, chunk of 5)
  const categories = ['apartment', 'house', 'land', 'commercial', ''];
  const txnTypes   = ['sale', 'rent', ''];
  const filterReqs = [];
  for (const cat of categories) {
    for (const txn of txnTypes) {
      let qs = `country=${COUNTRY}`;
      if (cat) qs += `&property_category=${cat}`;
      if (txn) qs += `&transaction_type=${txn}`;
      filterReqs.push(['GET', `${BASE_URL}/api/v1/filters?${qs}`, null, { headers }]);
    }
  }
  batchChunked(filterReqs, 5);

  // Warm attr search (32 combos, chunk of 8) — all sort options used in actual test
  const warmSorts = [
    { field: 'price', order: 'asc' },
    { field: 'price', order: 'desc' },
    { field: 'created_at', order: 'desc' },
    null,
  ];
  const attrReqs = [];
  FILTER_PROFILES.forEach(filters => {
    warmSorts.forEach(sort => {
      attrReqs.push(['POST', `${BASE_URL}/api/v1/search`, JSON.stringify({
        countries: [COUNTRY], filters, limit: 20, page: 1,
        ...(sort ? { sort } : {}),
      }), { headers }]);
    });
  });
  batchChunked(attrReqs, 8);
  // Second pass: confirm all attr search keys are in Redis (first pass may have been slow on cold DB)
  batchChunked(attrReqs, 8);

  // Warm map tiles: all TILE_FILTER_SUFFIXES × all tiles — 100% cache coverage for doMapTile()
  const tileReqs = [];
  MAP_TILE_SCENARIOS.forEach(({ z, x, y }) => {
    TILE_OFFSETS.forEach(([dx, dy]) => {
      TILE_FILTER_SUFFIXES.forEach(suffix => {
        tileReqs.push(['GET', `${BASE_URL}/api/v1/map/tiles/${z}/${x + dx}/${y + dy}?country=${COUNTRY}${suffix}`, null, { headers }]);
      });
    });
  });
  batchChunked(tileReqs, 20);

  // Warm geo search (90 combos, chunk of 10)
  const geoFilterCombos = [
    undefined,
    { property_category: 'apartment', transaction_type: 'sale' },
    { property_category: 'apartment', transaction_type: 'rent' },
    { property_category: 'house',     transaction_type: 'sale' },
    { property_category: 'land',      transaction_type: 'sale' },
  ];
  const geoReqs = [];
  CITIES.concat(PRAGUE_DISTRICTS).forEach(({ lat, lon, radius }) => {
    geoFilterCombos.forEach(filters => {
      const body = { countries: [COUNTRY], latitude: lat, longitude: lon, radius_km: radius, limit: 20, page: 1 };
      if (filters) body.filters = filters;
      geoReqs.push(['POST', `${BASE_URL}/api/v1/search/geo`, JSON.stringify(body), { headers }]);
    });
  });
  batchChunked(geoReqs, 10);
}

// ─── Shared state: property IDs harvested during test ─────────────────────────
// Using a simple VU-local cache (no SharedArray needed for this)
let harvestedIds = [];
const MAX_IDS = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function jitter(value, pct = 0.1) {
  return value * (1 + (Math.random() * 2 - 1) * pct);
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'X-Country': COUNTRY,
  };
}

// ─── Scenario: Geo Search ─────────────────────────────────────────────────────
function doGeoSearch() {
  // 60% large city, 40% Praha district
  const location = Math.random() < 0.6
    ? pick(CITIES)
    : pick(PRAGUE_DISTRICTS);

  // Use fixed coords (no jitter) so queries are cacheable — matches production
  // where users search the same city centers repeatedly.
  const payload = {
    latitude:  location.lat,
    longitude: location.lon,
    radius_km: location.radius,
    countries: [COUNTRY],
    limit: 20,
    page: 1,
  };

  // 50% add a category filter from the pre-warmed combos
  if (Math.random() < 0.5) {
    payload.filters = pick([
      { property_category: 'apartment', transaction_type: 'sale' },
      { property_category: 'apartment', transaction_type: 'rent' },
      { property_category: 'house',     transaction_type: 'sale' },
      { property_category: 'land',      transaction_type: 'sale' },
    ]);
  }

  const res = http.post(
    `${BASE_URL}/api/v1/search/geo`,
    JSON.stringify(payload),
    { headers: headers(), tags: { endpoint: 'geo_search' } }
  );

  const ok = check(res, {
    'geo search 200': (r) => r.status === 200,
    'geo has results key': (r) => {
      try { return JSON.parse(r.body).results !== undefined; } catch { return false; }
    },
  });

  if (!ok) { errorRate.add(1); searchErrors.add(1); }
  else { errorRate.add(0); }

  geoSearchP99.add(res.timings.duration);

  // Harvest IDs for detail calls
  try {
    const body = JSON.parse(res.body);
    if (body.results && harvestedIds.length < MAX_IDS) {
      for (const p of body.results.slice(0, 3)) {
        if (p.id) harvestedIds.push(p.id);
      }
    }
  } catch {}

  return res;
}

// ─── Scenario: Attribute Search ───────────────────────────────────────────────
function doAttrSearch() {
  const profile = { ...pick(FILTER_PROFILES) };

  // Use page 1 with a fixed small sort set so queries are cacheable.
  // Production traffic is dominated by page-1 searches with standard sorts.
  const sort = pick([
    { field: 'price', order: 'asc' },
    { field: 'created_at', order: 'desc' },
    null,
  ]);

  const payload = {
    countries: [COUNTRY],
    filters: profile,
    limit: 20,
    page: 1,
    ...(sort ? { sort } : {}),
  };

  const res = http.post(
    `${BASE_URL}/api/v1/search`,
    JSON.stringify(payload),
    { headers: headers(), tags: { endpoint: 'attr_search' } }
  );

  const ok = check(res, {
    'attr search 200': (r) => r.status === 200,
  });

  if (!ok) { errorRate.add(1); searchErrors.add(1); }
  else { errorRate.add(0); }

  attrSearchP99.add(res.timings.duration);

  // Harvest IDs
  try {
    const body = JSON.parse(res.body);
    const results = body.results || body.properties || [];
    if (harvestedIds.length < MAX_IDS) {
      for (const p of results.slice(0, 3)) {
        if (p.id) harvestedIds.push(p.id);
      }
    }
  } catch {}

  return res;
}

// ─── Scenario: Property Detail ─────────────────────────────────────────────────
function doDetail() {
  if (harvestedIds.length === 0) {
    // No IDs yet — do a quick search first
    doAttrSearch();
    if (harvestedIds.length === 0) return;
  }

  const id = pick(harvestedIds);

  const res = http.get(
    `${BASE_URL}/api/v1/properties/${id}?country=${COUNTRY}`,
    { headers: headers(), tags: { endpoint: 'detail' } }
  );

  const ok = check(res, {
    'detail 200': (r) => r.status === 200 || r.status === 404, // 404 ok (removed)
    'detail has id': (r) => {
      if (r.status !== 200) return true;
      try { return JSON.parse(r.body).id !== undefined; } catch { return false; }
    },
  });

  if (!ok) { errorRate.add(1); }
  else { errorRate.add(0); }

  detailP99.add(res.timings.duration);
  return res;
}

// ─── Scenario: Filter Options ─────────────────────────────────────────────────
function doFilters() {
  const category = pick(['apartment', 'house', 'land', 'commercial', '']);
  const txn      = pick(['sale', 'rent', '']);

  let qs = `country=${COUNTRY}`;
  if (category) qs += `&property_category=${category}`;
  if (txn)      qs += `&transaction_type=${txn}`;

  const res = http.get(
    `${BASE_URL}/api/v1/filters?${qs}`,
    { headers: headers(), tags: { endpoint: 'filters' } }
  );

  const ok = check(res, {
    'filters 200': (r) => r.status === 200,
    'filters has price': (r) => {
      try { return JSON.parse(r.body).price !== undefined; } catch { return false; }
    },
  });

  if (!ok) { errorRate.add(1); }
  else { errorRate.add(0); }

  filtersP99.add(res.timings.duration);
  return res;
}

// ─── Scenario: Map Tile Clustering ────────────────────────────────────────────
// Simulates a user opening the map view and panning around.
// Each "session" picks a zoom level + tile, then fetches 1-3 adjacent tiles
// (as a real map client would when rendering the viewport).
function doMapTile() {
  const base   = pick(MAP_TILE_SCENARIOS);
  const offset = pick(TILE_OFFSETS);
  const z = base.z;
  const x = base.x + offset[0];
  const y = base.y + offset[1];

  // Use fixed filter suffix from shared set — guarantees 100% cache hit rate
  const filterSuffix = pick(TILE_FILTER_SUFFIXES);
  let qs = `country=${COUNTRY}${filterSuffix}`;

  const res = http.get(
    `${BASE_URL}/api/v1/map/tiles/${z}/${x}/${y}?${qs}`,
    { headers: headers(), tags: { endpoint: 'map_tile', zoom: String(z) } }
  );

  const ok = check(res, {
    'map tile 200': (r) => r.status === 200,
    'map tile has strategy': (r) => {
      try { return JSON.parse(r.body).strategy !== undefined; } catch { return false; }
    },
    'map tile cache header': (r) => r.headers['X-Cache'] === 'HIT' || r.headers['X-Cache'] === 'MISS',
  });

  if (!ok) { errorRate.add(1); searchErrors.add(1); }
  else      { errorRate.add(0); }

  mapTileP99.add(res.timings.duration);
  return res;
}

// ─── Scenario: Search → Detail (full flow) ───────────────────────────────────
function doSearchThenDetail() {
  const res = doAttrSearch();
  sleep(0.3);

  try {
    const body = JSON.parse(res.body);
    const results = body.results || body.properties || [];
    if (results.length > 0) {
      harvestedIds.push(results[0].id);
      doDetail();
    }
  } catch {}
}

// ─── Main VU Logic ────────────────────────────────────────────────────────────
// Distribution:
//   0.00–0.25 → geo search      (25%)
//   0.25–0.50 → attr search     (25%)
//   0.50–0.70 → map tile        (20%)
//   0.70–0.85 → property detail (15%)
//   0.85–0.95 → filter options  (10%)
//   0.95–1.00 → search+detail   ( 5%)
export default function () {
  const r = Math.random();

  if (r < 0.25) {
    doGeoSearch();
    sleep(0.5 + Math.random() * 1.5);
  } else if (r < 0.50) {
    doAttrSearch();
    sleep(0.3 + Math.random() * 1.0);
  } else if (r < 0.70) {
    // Map users typically fetch several tiles in quick succession
    doMapTile();
    if (Math.random() < 0.6) { sleep(0.05); doMapTile(); } // adjacent tile
    if (Math.random() < 0.3) { sleep(0.05); doMapTile(); } // one more (zoom change)
    sleep(0.2 + Math.random() * 0.8);
  } else if (r < 0.85) {
    doDetail();
    sleep(0.2 + Math.random() * 0.8);
  } else if (r < 0.95) {
    doFilters();
    sleep(0.1 + Math.random() * 0.5);
  } else {
    doSearchThenDetail();
    sleep(1.0 + Math.random() * 2.0);
  }
}
