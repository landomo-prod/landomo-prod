/**
 * Willhaben API Response Types
 * Based on willhaben.at API structure from network capture
 */

export interface WillhabenSearchResponse {
  advertSummary: WillhabenListing[];
  _links?: any;
  rowCount?: number;
  page?: number;
}

export interface WillhabenListing {
  id: string;
  verticalId?: number;
  adTypeId?: number;
  productId?: number;
  advertStatus?: {
    id: string;
    description: string;
    statusId: number;
  };
  description: string;
  attributes: {
    attribute: WillhabenAttribute[];
  };
  advertImageList?: {
    advertImage: WillhabenImage[];
    floorPlans?: any[];
  };
  selfLink?: string;
  contextLinkList?: {
    contextLink: any[];
  };
  [key: string]: any; // Allow additional fields
}

export interface WillhabenAttribute {
  name: string;
  values: string[];
}

export interface WillhabenImage {
  id: number;
  name: string;
  selfLink?: string;
  description?: string;
  mainImageUrl?: string;
  thumbnailImageUrl?: string;
  referenceImageUrl?: string;
  similarImageSearchUrl?: string | null;
  reference?: string;
}

export interface WillhabenDetailResponse {
  id: string;
  description: string;
  attributes?: {
    attribute: WillhabenAttribute[];
  };
  advertImageList?: {
    advertImage: WillhabenImage[];
    floorPlans?: any[];
  };
  [key: string]: any;
}

/**
 * Helper to get attribute value by name
 */
export function getAttribute(listing: WillhabenListing, name: string): string | undefined {
  const attr = listing.attributes?.attribute?.find(a => a.name === name);
  return attr?.values?.[0];
}

/**
 * Helper to get all attribute values by name
 */
export function getAttributes(listing: WillhabenListing, name: string): string[] {
  const attr = listing.attributes?.attribute?.find(a => a.name === name);
  return attr?.values || [];
}

/**
 * Helper to check if attribute exists and has value
 */
export function hasAttribute(listing: WillhabenListing, name: string): boolean {
  const attr = listing.attributes?.attribute?.find(a => a.name === name);
  return !!(attr?.values && attr.values.length > 0);
}
