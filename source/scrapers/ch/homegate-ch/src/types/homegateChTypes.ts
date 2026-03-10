/**
 * Homegate.ch Types
 * Based on reverse engineering __INITIAL_STATE__ JSON from page source
 */

export interface HomegateSearchResponse {
  resultList: {
    search: {
      fullSearch: {
        result: {
          listings: HomegateSearchListing[];
          pageCount: number;
          totalCount: number;
        };
      };
    };
  };
}

export interface HomegateSearchListing {
  id: string;
  listingType: {
    type: string; // 'RENT' | 'BUY'
  };
  listing: {
    address: HomegateAddress;
    categories: string[];
    characteristics: HomegateCharacteristics;
    localization: {
      de?: HomegateLocalization;
      fr?: HomegateLocalization;
      it?: HomegateLocalization;
      en?: HomegateLocalization;
    };
    prices: HomegatePrices;
    offerType: string; // 'RENT' | 'BUY'
    meta?: {
      createdAt?: string;
      updatedAt?: string;
    };
  };
  lpiListing?: any;
}

export interface HomegateAddress {
  country?: string;
  geoCoordinates?: {
    accuracy?: string;
    latitude?: number;
    longitude?: number;
    manual?: boolean;
  };
  locality?: string;
  postalCode?: string;
  postOfficeBoxNumber?: string;
  region?: string;
  street?: string;
}

export interface HomegateCharacteristics {
  floor?: number;
  hasBalcony?: boolean;
  hasElevator?: boolean;
  hasGarage?: boolean;
  hasParking?: boolean;
  isCornerUnit?: boolean;
  isFirstOccupancy?: boolean;
  isMinergieCertified?: boolean;
  isNewBuilding?: boolean;
  isQuiet?: boolean;
  livingSpace?: number;
  lotSize?: number;
  numberOfBathrooms?: number;
  numberOfRooms?: number;
  totalFloorSpace?: number;
  yearBuilt?: number;
  yearLastRenovated?: number;
  [key: string]: any;
}

export interface HomegateLocalization {
  attachments?: HomegateAttachment[];
  text?: {
    description?: string;
    title?: string;
  };
  urls?: {
    type?: string;
    url?: string;
  }[];
}

export interface HomegateAttachment {
  file?: string;
  type?: string; // 'IMAGE' | 'DOCUMENT'
  url?: string;
}

export interface HomegatePrices {
  buy?: {
    price?: number;
    interval?: string;
  };
  rent?: {
    gross?: number;
    net?: number;
    interval?: string;
    charges?: number;
  };
  currency?: string;
}

export interface HomegateDetailResponse extends HomegateSearchListing {
  // Detail pages have the same structure but with more complete data
}
