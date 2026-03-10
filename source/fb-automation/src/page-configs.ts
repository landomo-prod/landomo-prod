/**
 * Facebook page configurations with publishing filters.
 *
 * Each page targets a specific city + transaction type (sale/rent) + category,
 * optionally with a price range. When a property change event comes in,
 * the rule evaluator matches it against these filters to decide which
 * page(s) to publish to.
 *
 * Tokens can be overridden per-page via env: FB_PAGE_TOKEN_<pageId>=...
 */

export interface PageFilter {
  /** Property category: apartment, house, land, commercial */
  categories: ('apartment' | 'house' | 'land' | 'commercial')[];
  /** Transaction type: sale or rent */
  transactionType: 'sale' | 'rent';
  /** City name (matched case-insensitively against event city) */
  cities: string[];
  /** Event types to publish */
  eventTypes: ('new_listing' | 'price_drop')[];
  /** Min price in CZK (inclusive). Omit for no lower bound. */
  priceMin?: number;
  /** Max price in CZK (inclusive). Omit for no upper bound. */
  priceMax?: number;
}

export interface PageConfig {
  pageId: string;
  pageName: string;
  accessToken: string;
  filter: PageFilter;
  isActive: boolean;
}

const PAGE_CONFIGS: PageConfig[] = [
  // ──── Sale pages ────
  {
    pageId: '705551749305640',
    pageName: 'Levné byty v Praze',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'sale',
      cities: ['Praha'],
      eventTypes: ['new_listing', 'price_drop'],
      priceMin: 1_000_000,
      priceMax: 8_000_000,
    },
  },
  {
    pageId: '663014033568195',
    pageName: 'Levné byty v Brně',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'sale',
      cities: ['Brno'],
      eventTypes: ['new_listing', 'price_drop'],
      priceMin: 1_000_000,
      priceMax: 7_000_000,
    },
  },
  {
    pageId: '729372516919703',
    pageName: 'Levné byty v Pardubicích',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'sale',
      cities: ['Pardubice'],
      eventTypes: ['new_listing', 'price_drop'],
      priceMin: 1_500_000,
      priceMax: 5_000_000,
    },
  },
  {
    pageId: '651184041418944',
    pageName: 'Levné byty v Hradci Králové',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'sale',
      cities: ['Hradec Králové'],
      eventTypes: ['new_listing', 'price_drop'],
      priceMin: 1_000_000,
      priceMax: 5_000_000,
    },
  },
  // ──── Rental pages ────
  {
    pageId: '493155947225502',
    pageName: 'Byty k pronájmu v Praze',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'rent',
      cities: ['Praha'],
      eventTypes: ['new_listing'],
    },
  },
  {
    pageId: '668379186362604',
    pageName: 'Pronájem Praha Vinohrady',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'rent',
      cities: ['Praha'],
      eventTypes: ['new_listing'],
    },
  },
  {
    pageId: '729777110211159',
    pageName: 'Byty k pronájmu v Brně',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'rent',
      cities: ['Brno'],
      eventTypes: ['new_listing'],
    },
  },
  {
    pageId: '685411321324563',
    pageName: 'Byty k pronájmu v Pardubicích',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'rent',
      cities: ['Pardubice'],
      eventTypes: ['new_listing'],
      priceMin: 12_000,
      priceMax: 30_000,
    },
  },
  {
    pageId: '675633478971149',
    pageName: 'Byty k pronájmu v Liberci',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'rent',
      cities: ['Liberec'],
      eventTypes: ['new_listing'],
    },
  },
  {
    pageId: '755914654263370',
    pageName: 'Byty k pronájmu v Hradci Králové',
    accessToken: '',
    isActive: true,
    filter: {
      categories: ['apartment'],
      transactionType: 'rent',
      cities: ['Hradec Králové'],
      eventTypes: ['new_listing'],
    },
  },
];

/** Index by pageId for O(1) lookup */
const configMap = new Map<string, PageConfig>();

for (const cfg of PAGE_CONFIGS) {
  const envToken = process.env[`FB_PAGE_TOKEN_${cfg.pageId}`];
  if (envToken) {
    cfg.accessToken = envToken;
  }
  configMap.set(cfg.pageId, cfg);
}

// Startup validation: every active page must have an access token
const missingTokenPages = PAGE_CONFIGS.filter(
  (cfg) => cfg.isActive && !cfg.accessToken,
);
if (missingTokenPages.length > 0) {
  const details = missingTokenPages
    .map((cfg) => `  - ${cfg.pageName} (${cfg.pageId}): set FB_PAGE_TOKEN_${cfg.pageId}`)
    .join('\n');
  throw new Error(
    `Missing Facebook access tokens for ${missingTokenPages.length} active page(s):\n${details}`,
  );
}

/** Get page config by pageId. Returns undefined if not found. */
export function getPageConfig(pageId: string): PageConfig | undefined {
  return configMap.get(pageId);
}

/** Get all configured page IDs. */
export function getAllPageIds(): string[] {
  return Array.from(configMap.keys());
}

/** Get all page configs. */
export function getAllPageConfigs(): PageConfig[] {
  return PAGE_CONFIGS;
}

/**
 * Find all active pages whose filter matches a property event.
 * A property can match multiple pages (e.g. a Praha rental could match
 * both "Byty k pronájmu v Praze" and "Pronájem Praha Vinohrady").
 */
export function matchPages(event: {
  category: string;
  transactionType?: string;
  city: string;
  price: number;
  eventType: string;
}): PageConfig[] {
  return PAGE_CONFIGS.filter((page) => {
    if (!page.isActive) return false;
    const f = page.filter;

    // Category match
    if (!f.categories.includes(event.category as any)) return false;

    // Transaction type match
    if (!event.transactionType || f.transactionType !== event.transactionType) return false;

    // City match (case-insensitive, startsWith to handle "Praha 5" matching "Praha")
    const eventCity = event.city.toLowerCase();
    const cityMatch = f.cities.some((c) => {
      const fc = c.toLowerCase();
      return eventCity === fc || eventCity.startsWith(fc + ' ') || eventCity.startsWith(fc + ',');
    });
    if (!cityMatch) return false;

    // Event type match
    if (!f.eventTypes.includes(event.eventType as any)) return false;

    // Price range match
    if (f.priceMin !== undefined && event.price < f.priceMin) return false;
    if (f.priceMax !== undefined && event.price > f.priceMax) return false;

    return true;
  });
}
