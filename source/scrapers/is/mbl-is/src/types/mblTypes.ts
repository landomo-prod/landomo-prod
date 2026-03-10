/**
 * Raw GraphQL types from mbl.is Hasura API
 */

export interface MblImage {
  big: string | null;
  small: string | null;
  regular: string | null;
  regular_h?: string | null;
}

export interface MblPostalCode {
  city: string | null;
}

/** fs_fasteign - sales listings */
export interface MblSaleListing {
  eign_id: number;
  heimilisfang: string | null;
  gata: string | null;
  postfang: number | null;
  hverfi: string | null;
  verd: number | null;
  fermetrar: number | null;
  fjoldi_herb: number | null;
  fjoldi_svefnhb: number | null;
  fjoldi_badherb: number | null;
  teg_eign: string | null;
  bygg_ar: number | null;
  lyfta: boolean | null;
  bilskur: boolean | null;
  gardur: boolean | null;
  svalir: boolean | null;
  parking: boolean | null;
  latitude: number | null;
  longitude: number | null;
  lysing: string | null;
  created: string | null;
  syna: boolean | null;
  images: MblImage[];
  postal_code: MblPostalCode | null;
}

/** rentals_property - rental listings */
export interface MblRentalListing {
  id: number;
  address: string | null;
  zipcode: number | null;
  price: number | null;
  size: number | null;
  rooms: number | null;
  description: string | null;
  lift: boolean | null;
  pet_allowed: boolean | null;
  available_from: string | null;
  type_id: number | null;
  created: string | null;
  images: MblImage[];
  postal_code: MblPostalCode | null;
}

export type PropertyCategory = 'apartment' | 'house' | 'land' | 'commercial';

/** Determine property category from teg_eign field */
export function getCategoryFromTegEign(tegEign: string | null): PropertyCategory {
  if (!tegEign) return 'apartment';

  const normalized = tegEign.toLowerCase().trim();

  if (
    normalized.includes('fjölbýlishús') ||
    normalized.includes('íbúð') ||
    normalized.includes('fjölbýli') ||
    normalized === 'ibud' ||
    normalized === 'fjolbyli'
  ) {
    return 'apartment';
  }

  if (
    normalized.includes('einbýlishús') ||
    normalized.includes('raðhús') ||
    normalized.includes('parhús') ||
    normalized.includes('sumarbústaður') ||
    normalized.includes('einbýli') ||
    normalized === 'einbyli'
  ) {
    return 'house';
  }

  if (normalized.includes('lóð') || normalized.includes('lóðarland')) {
    return 'land';
  }

  if (
    normalized.includes('atvinnuhúsnæði') ||
    normalized.includes('verslun') ||
    normalized.includes('skrifstofur') ||
    normalized.includes('geymslur')
  ) {
    return 'commercial';
  }

  // Default: map unrecognised types to apartment
  return 'apartment';
}
