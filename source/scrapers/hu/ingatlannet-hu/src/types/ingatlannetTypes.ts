/**
 * Ingatlannet.hu Types
 * Based on ingatlannet.hu website structure and embedded JSON-LD data
 */

export interface IngatlannetListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  location: string;
  propertyType: string;        // Ingatlan típusa: lakás, ház, telek
  transactionType: string;     // eladó, kiadó
  url: string;

  // Location details
  city?: string;
  district?: string;           // Kerület/Járás
  address?: string;
  zipCode?: string;
  coordinates?: {
    lat: number;
    lon: number;
  };

  // Property details
  area?: number;               // Terület (m²)
  rooms?: number;              // Szobák száma
  halfRooms?: number;          // Félszobák száma
  floor?: number;              // Emelet
  totalFloors?: number;        // Összes emelet
  disposition?: string;        // Elrendezés: 1-szobás, 2-szobás, stb.

  // Property characteristics
  condition?: string;          // Állapot: újépítésű, újszerű, jó, felújított, felújítandó
  conditionRating?: number;    // 1-10 scale
  ownership?: string;          // Tulajdonjog
  furnished?: string;          // Bútorozott
  heating?: string;            // Fűtés típusa
  constructionType?: string;   // Építés típusa: panel, tégla, vasbeton
  buildYear?: number;          // Építés éve
  energyRating?: string;       // Energetikai besorolás

  // Additional features
  balcony?: boolean;
  terrace?: boolean;
  garden?: boolean;
  parking?: boolean;
  elevator?: boolean;
  airConditioning?: boolean;
  storage?: boolean;

  // Financial
  utilities?: number;          // Rezsiköltség (HUF/month)
  deposit?: number;            // Kaució

  // Media
  images?: string[];
  imageCount?: number;
  description?: string;

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

  // Raw data
  rawData?: any;
}

export interface IngatlannetSearchParams {
  location?: string;
  propertyType?: string;
  transactionType?: 'elado' | 'kiado';
  areaFrom?: number;
  areaTo?: number;
  priceFrom?: number;
  priceTo?: number;
  roomsFrom?: number;
  roomsTo?: number;
  page?: number;
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
