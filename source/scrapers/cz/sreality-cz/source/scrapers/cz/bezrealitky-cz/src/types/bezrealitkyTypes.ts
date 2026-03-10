/**
 * BezRealitky GraphQL API response types
 */

export interface BezRealitkyListResponse {
  data?: {
    listAdverts: {
      totalCount: number;
      list: BezRealitkyListingItem[];
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    extensions?: any;
  }>;
}

export interface BezRealitkyListingItem {
  // Basic identification
  id: string;
  externalId?: string;
  hash?: string;
  uri: string;
  code?: string;

  // Status & metadata
  active?: boolean;
  isPausedBySystem?: boolean;
  isPausedByUser?: boolean;
  activationPending?: boolean;
  archived?: boolean;
  reserved?: boolean;
  highlighted?: boolean;
  isNew?: boolean;
  isEditable?: boolean;

  // Timestamps
  timeActivated?: string;
  timeDeactivated?: string;
  timeExpiration?: string;
  timeOrder?: string;
  daysActive?: number;

  // Content
  title: string;
  titleEnglish?: string;
  description?: string;
  descriptionEnglish?: string;
  descriptionSk?: string;
  imageAltText?: string;

  // Property classification
  estateType: string;
  offerType: string;
  disposition?: string;
  landType?: string;
  houseType?: string;

  // Dimensions
  surface?: number;
  surfaceLand?: number;
  balconySurface?: number;
  loggiaSurface?: number;
  terraceSurface?: number;
  cellarSurface?: number;

  // Financial
  price?: number;
  priceFormatted?: string;
  deposit?: number;
  charges?: number;
  serviceCharges?: number;
  utilityCharges?: number;
  fee?: number;
  currency?: string;
  originalPrice?: number;
  isDiscounted?: boolean;
  serviceChargesNote?: string;
  utilityChargesNote?: string;

  // Location - basic
  gps?: {
    lat: number;
    lng: number;
  };
  address?: string;
  addressInput?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  cityDistrict?: string;
  zip?: string;
  region?: {
    id?: string;
    name?: string;
    uri?: string;
  };

  // Location - detailed
  ruianId?: string;
  addressPointId?: string;
  isPrague?: boolean;
  isBrno?: boolean;
  isPragueWest?: boolean;
  isPragueEast?: boolean;
  isCityWithDistricts?: boolean;
  isTSRegion?: boolean;

  // Building characteristics
  condition?: string;
  ownership?: string;
  equipped?: string;
  construction?: string;
  position?: string;
  situation?: string;
  floor?: string;
  totalFloors?: number;
  age?: number;
  execution?: string;
  reconstruction?: string;

  // Energy & utilities
  penb?: string;
  lowEnergy?: boolean;
  heating?: string;
  water?: string;
  sewage?: string;

  // Amenities & features
  parking?: boolean;
  garage?: boolean;
  lift?: boolean;
  balcony?: boolean;
  terrace?: boolean;
  cellar?: boolean;
  loggia?: boolean;
  frontGarden?: number;
  newBuilding?: boolean;
  petFriendly?: boolean;
  barrierFree?: boolean;
  roommate?: boolean;

  // Short term rental
  shortTerm?: boolean;
  minRentDays?: number;
  maxRentDays?: number;

  // Availability
  availableFrom?: string;

  // Media
  publicImages?: Array<{
    id: string;
    url: string;
    order: number;
    main: boolean;
    filename?: string;
  }>;
  tour360?: string;

  // Analytics
  visitCount?: number;
  conversationCount?: number;

  // Additional metadata
  locale?: string;
  charity?: boolean;
  showOwnest?: boolean;
  showPriceSuggestionButton?: boolean;
  threesome?: boolean;
  fivesome?: boolean;
  brizCount?: number;
  realmanExportEnabled?: boolean;

  // Contract/Rent platform
  hasContractRent?: boolean;
  rentPlatformStatus?: string;
  rentPlatformOrder?: number;

  // Tags
  tags?: string[];
}
