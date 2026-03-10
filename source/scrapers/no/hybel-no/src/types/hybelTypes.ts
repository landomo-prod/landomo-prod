/**
 * Raw listing summary as parsed from the hybel.no HTML listing pages.
 * The listing page provides minimal data; detail pages provide complete information.
 */
export interface HybelListingSummary {
  id: string;
  url: string;
  title: string;
  address: string;
  priceRaw: string;
  imageUrl: string | null;
  housingTypeRaw: string;
  isPremium: boolean;
}

/**
 * Full listing detail as parsed from the hybel.no individual listing page.
 */
export interface HybelListingDetail {
  id: string;
  url: string;

  // Property type info
  housingTypeRaw: string; // e.g. "Leilighet", "Rom i bofellesskap", "Hybel", "Enebolig", "Rekkehus"
  boligtype: string | null; // from "Boligtype" field in detail

  // Size & rooms
  sqm: number | null;
  rooms: number | null;       // Antall rom (total rooms including living room)
  bedrooms: number | null;    // Antall soverom

  // Location
  address: string;
  postalCode: string | null;
  city: string;
  lat: number | null;
  lng: number | null;

  // Pricing
  monthlyRent: number | null;
  deposit: number | null;
  utilitiesIncluded: string[]; // e.g. ["Internett", "Strøm"]

  // Rental terms
  leaseType: string | null;   // "Langtidsleie" / "Korttidsleie"
  availableFrom: string | null; // "01.03.2026"
  floor: number | null;

  // Amenities parsed from the <ul class="amenities"> section
  hasBroadband: boolean;
  hasWashingMachine: boolean;
  hasDishwasher: boolean;
  hasParking: boolean;
  hasFurnished: boolean;
  hasElevator: boolean;
  hasBalcony: boolean;
  hasTerrace: boolean;
  hasFireplace: boolean;
  hasGarden: boolean;
  hasGarage: boolean;
  hasBasement: boolean;
  hasBathroom: boolean;
  hasWhiteGoods: boolean; // hvitevarer

  // Content
  title: string;
  description: string | null;

  // Images
  images: string[];

  // Meta
  isPremium: boolean;
  publishedDate: string | null;
}

/**
 * Map endpoint response
 */
export interface HybelMapResponse {
  homes: Array<{
    id: number;
    lat: string;
    lng: string;
    housing_id: number;
  }>;
}

/**
 * housing_id mapping from hybel.no
 * 2 = apartment (leilighet)
 * 3 = bedsit/hybel
 * 4 = room in shared housing (rom i bofellesskap)
 * 5 = other/house
 */
export const HOUSING_ID_MAP: Record<number, string> = {
  2: 'apartment',
  3: 'apartment', // hybel (bedsit) → apartment
  4: 'apartment', // rom i bofellesskap (room in shared flat) → apartment
  5: 'apartment', // other → default apartment
};
