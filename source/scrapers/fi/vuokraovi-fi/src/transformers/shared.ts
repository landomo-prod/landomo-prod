import { VuokrauviRentalAvailability } from '../types/vuokrauviTypes';

/**
 * Build a full image URL from a Vuokraovi CloudFront image URI template.
 *
 * The API returns URIs with a {imageParameters} placeholder, e.g.:
 *   //d3ls91xgksobn.cloudfront.net/{imageParameters}/etuovimedia/images/rental/.../ORIGINAL.jpeg
 *
 * We use a standard 1024x768 crop for scraper purposes.
 * For thumbnails use: w_400,h_300,c_fill
 * For full size: w_1024,h_768,c_limit
 */
export function buildImageUrl(imageUri: string, params = 'w_1024,h_768,c_limit'): string {
  if (!imageUri) return '';
  const withParams = imageUri.replace('{imageParameters}', params);
  // Add https: if protocol-relative
  return withParams.startsWith('//') ? `https:${withParams}` : withParams;
}

/**
 * Parse common amenity signals from a Finnish room structure string.
 *
 * Example inputs:
 *   "3H + K + S + p"          → sauna=true, balcony=true (p=parveke)
 *   "2h, kk, khh, ph"         → sauna=false
 *   "1h + kk + S + kalusteet" → sauna=true, furnished=true
 *   "2H + K + S + Parveke"    → sauna=true, balcony=true
 *
 * Finnish abbreviations:
 *   h  = huone (room)
 *   k  = keittiö (kitchen)
 *   kk = keittokomero (kitchenette)
 *   s  = sauna
 *   p  = parveke (balcony)
 *   t  = terassi (terrace)
 *   ph = pesuhuone (bathroom)
 *   khh = kylpyhuone (bathroom)
 *   kalusteet / kalustettu = furnished
 */
export function parseRoomStructure(roomStructure: string | null): {
  hasSauna: boolean;
  hasFurnished: boolean;
  hasBalcony: boolean;
  hasElevator: boolean;
  hasParking: boolean;
} {
  if (!roomStructure) {
    return { hasSauna: false, hasFurnished: false, hasBalcony: false, hasElevator: false, hasParking: false };
  }

  const s = roomStructure.toLowerCase();

  // Sauna: look for standalone 's' separator or 'sauna'
  const hasSauna = /\bs\b/.test(s) || s.includes('sauna');

  // Furnished: kalusteet or kalustettu
  const hasFurnished = s.includes('kalusteet') || s.includes('kalustettu');

  // Balcony
  const hasBalcony = s.includes('parveke') || /\bp\b/.test(s) || s.includes('terassi');

  // Elevator - rarely in room structure string but handle it
  const hasElevator = s.includes('hissi');

  // Parking
  const hasParking = s.includes('autotalli') || s.includes('autopaikka') || s.includes('autokatos');

  return { hasSauna, hasFurnished, hasBalcony, hasElevator, hasParking };
}

/**
 * Map VuokrauviRentalAvailability to ISO date string for available_from field.
 * Returns undefined for IMMEDIATELY availability.
 */
export function mapAvailableFrom(availability: VuokrauviRentalAvailability): string | undefined {
  if (availability.type === 'VACANCY' && availability.vacancyDate) {
    return availability.vacancyDate;
  }
  if (availability.type === 'IMMEDIATELY') {
    return new Date().toISOString().split('T')[0]; // today's date
  }
  return undefined; // BY_AGREEMENT - unknown date
}
