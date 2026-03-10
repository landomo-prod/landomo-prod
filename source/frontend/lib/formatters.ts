/**
 * Format a price value to a localized currency string
 *
 * @param price The price value to format
 * @param locale The locale to use for formatting (defaults to "en-US")
 * @returns Formatted price string with € symbol (e.g., "€250,000")
 *
 * @example
 * formatPrice(250000) // "€250,000"
 * formatPrice(1500000) // "€1,500,000"
 */
export function formatPrice(price: number, locale: string = "cs-CZ"): string {
  return `${price.toLocaleString(locale)} Kč`;
}

/**
 * Format a price to a compact "k" notation for map markers
 *
 * @param price The price value to format
 * @returns Compact price string with € symbol and "k" suffix (e.g., "€250k")
 *
 * @example
 * formatPriceCompact(250000) // "€250k"
 * formatPriceCompact(1500000) // "€1500k"
 */
export function formatPriceCompact(price: number): string {
  if (price >= 1000000) {
    return `${(price / 1000000).toFixed(1)}M Kč`;
  }
  return `${Math.round(price / 1000)}k Kč`;
}

/**
 * Format price per square meter with proper localization and unit
 *
 * @param pricePerSqm The price per square meter value
 * @param locale The locale to use for formatting (defaults to "en-US")
 * @returns Formatted price per sqm string (e.g., "€5,000/m²")
 *
 * @example
 * formatPricePerSqm(5000) // "€5,000/m²"
 * formatPricePerSqm(12500) // "€12,500/m²"
 */
export function formatPricePerSqm(pricePerSqm: number, locale: string = "cs-CZ"): string {
  return `${pricePerSqm.toLocaleString(locale)} Kč/m²`;
}

/**
 * Format area value with proper unit
 *
 * @param area The area value in square meters
 * @returns Formatted area string (e.g., "85 m²")
 *
 * @example
 * formatArea(85) // "85 m²"
 * formatArea(120) // "120 m²"
 */
export function formatArea(area: number): string {
  return `${area} m²`;
}
