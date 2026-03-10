/**
 * Duna House (dh.hu) Types
 * Based on dh.hu data structure and Hungarian real estate standards
 */

export interface DHListing {
  id: string;
  referenceNumber?: string;      // DH reference (e.g., "LK078159")
  title: string;
  price: number;
  priceNumeric?: number;
  currency: string;
  location: string;
  propertyType: string;           // Ingatlan típusa: Lakás, Ház, stb.
  propertyTypeName?: string;
  transactionType: string;        // Hirdetés típusa: eladó, kiadó
  url: string;

  // Location details
  city?: string;
  district?: string;              // Kerület/Járás
  address?: string;
  zipCode?: string;
  coordinates?: {
    lat: number;
    lon: number;
  };

  // Property details
  area?: number;                  // Terület (m²)
  rooms?: number;                 // Szobák száma
  halfRooms?: number;             // Félszobák száma
  floor?: number;                 // Emelet
  totalFloors?: number;           // Összes emelet
  disposition?: string;           // Elrendezés: 1-szobás, 2-szobás, stb.

  // Property characteristics
  condition?: string;             // Állapot: újépítésű, újszerű, jó, felújított, felújítandó
  ownership?: string;             // Tulajdonjog: tulajdon, társasházi, szövetkezeti
  furnished?: string;             // Bútorozott: igen/nem/részben
  heating?: string;               // Fűtés típusa
  constructionType?: string;      // Építés típusa: panel, tégla, vasbeton
  buildYear?: number;             // Építés éve
  energyRating?: string;          // Energetikai besorolás

  // Additional features
  balcony?: boolean;              // Erkély
  terrace?: boolean;              // Terasz
  garden?: boolean;               // Kert
  parking?: boolean;              // Parkoló
  elevator?: boolean;             // Lift
  airConditioning?: boolean;      // Légkondicionáló
  storage?: boolean;              // Tároló

  // Financial
  utilities?: number;             // Rezsiköltség (HUF/month)
  deposit?: number;               // Kaució (for rent)

  // Media
  images?: string[];
  description?: string;
  details?: string;               // Abbreviated details string

  // Agent/Seller info
  agent?: {
    name?: string;
    company?: string;
    phone?: string;
    email?: string;
  };

  // Metadata
  publishedDate?: string;
  modifiedDate?: string;
  viewCount?: number;
  isNew?: boolean;
  isComingSoon?: boolean;
  isExclusive?: boolean;
  enabledOtthonStart?: boolean;  // Government program eligibility

  // Raw API data
  rawData?: any;
}

export interface DHSearchParams {
  location?: string;              // Location ID or name
  propertyType?: string;          // lakas, haz, telek, etc.
  transactionType?: 'elado' | 'kiado';  // Sale or rent
  areaFrom?: number;
  areaTo?: number;
  priceFrom?: number;
  priceTo?: number;
  roomsFrom?: number;
  roomsTo?: number;
  page?: number;
  limit?: number;
}

export interface DHApiResponse {
  success: boolean;
  count: number;
  listings: DHListing[];
  page?: number;
  totalPages?: number;
}

// Property type mappings (Hungarian -> English)
export const PROPERTY_TYPE_MAP: Record<string, string> = {
  'lakás': 'apartment',
  'lakas': 'apartment',
  'ház': 'house',
  'haz': 'house',
  'családi ház': 'house',
  'csaladi haz': 'house',
  'telek': 'land',
  'építési telek': 'land',
  'epitesi telek': 'land',
  'garázs': 'garage',
  'garazs': 'garage',
  'iroda': 'office',
  'üzlet': 'commercial',
  'uzlet': 'commercial',
  'ipari ingatlan': 'industrial',
  'mezőgazdasági': 'agricultural',
  'mezogazdasagi': 'agricultural',
  'egyéb': 'other',
  'egyeb': 'other'
};

// Transaction type mappings
export const TRANSACTION_TYPE_MAP: Record<string, 'sale' | 'rent'> = {
  'eladó': 'sale',
  'elado': 'sale',
  'kiadó': 'rent',
  'kiado': 'rent',
  'sale': 'sale',
  'rent': 'rent'
};
