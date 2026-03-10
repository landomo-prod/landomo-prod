import { PropertyLocation } from '@landomo/core';
import { OikotieLocation, OikotieMedia, OikotieCard } from '../types/oikotieTypes';

/**
 * Parse Oikotie price string to number.
 * Examples: "297 000 €" → 297000, "663 € / kk" → 663
 */
export function parseOikotiePrice(priceStr: string | null): number {
  if (!priceStr) return 0;

  // Remove non-numeric characters except decimal separators
  // Handle Finnish number format: "297 000" (space as thousands separator), "1 234,56"
  const cleaned = priceStr
    .replace(/[€\s]/g, '') // remove euro sign and spaces
    .replace('/kk', '')     // remove per month
    .replace(',', '.')      // normalize decimal separator
    .trim();

  // Remove trailing non-numeric
  const match = cleaned.match(/^[\d.]+/);
  if (!match) return 0;

  return parseFloat(match[0]) || 0;
}

/**
 * Parse Oikotie size string to number.
 * Examples: "57 m²" → 57, "83 m²" → 83, "56,5 m²" → 56.5, "100/156 m²" → 100 (living area)
 */
export function parseOikotieSqm(sizeStr: string | null): number {
  if (!sizeStr) return 0;

  // Handle "100/156 m²" format - take first number (living area / total area)
  const slashMatch = sizeStr.match(/^([\d,]+)\//);
  if (slashMatch) {
    return parseFloat(slashMatch[1].replace(',', '.')) || 0;
  }

  // Handle "57 m²" or "56,5 m²"
  const match = sizeStr.match(/^([\d,]+)/);
  if (!match) return 0;

  return parseFloat(match[1].replace(',', '.')) || 0;
}

/**
 * Parse rooms/bedrooms from Oikotie data.rooms field.
 * Finnish convention: rooms field = number of rooms (which = bedrooms in practice)
 */
export function parseRooms(rooms: number | null): number {
  if (!rooms) return 0;
  return rooms;
}

/**
 * Build PropertyLocation from Oikotie location data
 */
export function buildLocation(loc: OikotieLocation): PropertyLocation {
  return {
    address: loc.address,
    city: loc.city,
    region: loc.district ?? undefined,
    country: 'Finland',
    postal_code: loc.zipCode,
    coordinates:
      loc.latitude !== null && loc.longitude !== null
        ? { lat: loc.latitude, lon: loc.longitude }
        : undefined,
  };
}

/**
 * Build media object from Oikotie medias array
 */
export function buildMedia(medias: OikotieMedia[]): {
  images: string[];
  main_image?: string;
} {
  if (!medias || medias.length === 0) {
    return { images: [] };
  }

  const images = medias.map(m => m.imageLargeJPEG).filter(Boolean);
  const main_image = images[0];

  return { images, main_image };
}

/**
 * Build a stable portal ID from Oikotie card
 */
export function buildPortalId(card: OikotieCard): string {
  return `oikotie-${card.cardId}`;
}
