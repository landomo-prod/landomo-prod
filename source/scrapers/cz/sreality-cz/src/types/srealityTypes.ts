/**
 * SReality API Response Types
 * Based on the official SReality.cz public API structure
 */

export interface SRealityListingResponse {
  _embedded: {
    estates: SRealityListing[];
  };
  _links?: any;
  result_size?: number;
  per_page?: number;
  page?: number;
}

export interface SRealitySellerInfo {
  // user_name is the actual agent name field in the detail API
  user_name?: string;
  company?: string;
  phone?: string;
  phones?: Array<{ code: string; type: string; number: string }>;
  email?: string;
  specialization?: {
    sales?: number;
    rentals?: number;
    rentals_residential?: number;
  };
  rating?: number;
  reviews?: number;
  website?: string;
  logo?: {
    _links?: {
      self?: { href: string };
    };
  };
  _embedded?: {
    premise?: {
      name?: string;
      email?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface SRealityListing {
  _links?: {
    self?: { href: string };
    images?: Array<{ href: string }>;
    dynamicUp?: Array<{ href: string }>;    // 800x600 preview images
    dynamicDown?: Array<{ href: string }>;  // 400x300 thumbnail images
    iterator?: { href: string };
    [key: string]: any;
  };
  _embedded?: {
    matterport_url?: string;
    seller?: SRealitySellerInfo;
    images?: Array<{
      id?: number;
      _links?: {
        dynamicDown?: { href: string };  // Thumbnail (template: {width},{height})
        dynamicUp?: { href: string };    // Preview (template: {width},{height})
        gallery?: { href: string };      // Thumbnail fixed size
        view?: { href: string };         // Fixed 749x562
        self?: { href: string; title?: string }; // Full-res (1920x1080)
      };
      order?: number;
    }>;
    note?: {
      has_note?: boolean;
      note?: string | null;
      _links?: {
        self?: { href: string };
      };
    };
    video?: {
      url?: string;
      thumbnail?: string;
    };
    locality?: {
      value?: string;
      gps?: {
        lat?: number;
        lon?: number;
      };
    };
  };
  hash_id: number;
  name?: string | {           // Can be string (list) or object (detail)
    value: string;
    [key: string]: any;
  };
  locality?: string | {       // Can be string (list) or object (detail)
    value: string;
    [key: string]: any;
  };
  locality_id?: number;
  price?: number;
  price_czk?: {
    value_raw: number;
    name?: string;
    [key: string]: any;
  };
  seo?: {
    category_main_cb?: number;
    category_type_cb?: number;
    category_sub_cb?: string | number;  // string SEO slug (e.g., "byt-2-kk") or numeric ID (7, 11, etc.)
    locality?: string;
    [key: string]: any;
  };
  map?: {
    lon?: number;
    lat?: number;
  };
  gps?: {
    lon?: number;
    lat?: number;
  };
  items?: Array<{
    name: string;
    value: any;  // Changed from string to any (can be string, number, array, object)
    unit?: string;
    type?: string;
    [key: string]: any;
  }>;
  text?: {
    value: string;
    [key: string]: any;
  };

  // Image and media counts
  advert_images_count?: number;

  // Media flags (from reverse-engineered documentation)
  has_panorama?: number;    // 1 = true, 0 = false (360° tour available)
  has_floor_plan?: number;  // 1 = true, 0 = false (floor plan available)
  has_video?: number;       // 1 = true, 0 = false (video available)

  // Marketing flags
  new?: boolean;            // New listing flag
  region_tip?: number;      // Regional highlight flag
  labels?: string[];        // Marketing labels (e.g., ["Tip", "Novinka"])
  exclusively_at_rk?: number; // Exclusive listing flag (1 = true, 0 = false)

  // Auction fields
  is_auction?: boolean;     // Is this an auction listing
  auctionPrice?: number;    // Auction price (if is_auction = true)

  // Category
  category?: number;

  // labelsAll: array of label groups from list API (index 0 = feature tags)
  // e.g. [["new_building","personal","balcony","elevator","cellar"], [...]]
  labelsAll?: string[][];

  // codeItems: numeric code fields from detail API response
  codeItems?: {
    ownership?: number;           // 1=personal, 2=cooperative, 3=state
    building_type_search?: number; // 1=wood,2=brick,3=stone,4=prefab,5=panel,6=skeleton,7=mixed,8=modular
    [key: string]: any;
  };

  // Flexible additional fields
  [key: string]: any; // Allow additional fields
}

export interface SRealityDetailResponse {
  hash_id: number;
  name?: {
    value: string;
  };
  text?: {
    value: string;
  };
  items?: Array<{
    name: string;
    value: any;  // Can be string, number, array, or object
    unit?: string;
    type?: string;
  }>;
  price_czk?: {
    value?: string | number;
    unit?: string;
    name?: string;
  };
  seo?: {
    category_main_cb?: number;
    category_type_cb?: number;
    category_sub_cb?: string | number;
  };
  _links?: {
    self?: { href: string };
    frontend_url?: { href: string };
    dynamicUp?: Array<{ href: string }>;
    dynamicDown?: Array<{ href: string }>;
  };
  _embedded?: {
    images?: Array<{
      _links?: {
        self?: { href: string };
        gallery?: { href: string };
        view?: { href: string };
        dynamicDown?: { href: string };
        dynamicUp?: { href: string };
      };
      order?: number;
    }>;
    seller?: SRealitySellerInfo;
    matterport_url?: string;
    note?: {
      has_note?: boolean;
      note?: string | null;
    };
    video?: {
      url?: string;
      thumbnail?: string;
    };
    locality?: {
      value?: string;
      gps?: {
        lat?: number;
        lon?: number;
      };
    };
    description?: {
      value?: string;
    };
  };
  // Media flags
  has_panorama?: number;
  has_floor_plan?: number;
  has_video?: number;
  // Marketing
  labels?: string[];
  new?: boolean;
  is_auction?: boolean;
  auctionPrice?: number;
  [key: string]: any;
}
