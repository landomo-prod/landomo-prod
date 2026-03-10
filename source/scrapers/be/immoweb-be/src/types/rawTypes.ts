export interface ImmowebSearchResult {
  results: ImmowebListing[];
  totalItems: number;
  itemsPerPage: number;
  page: number;
}

export interface ImmowebListing {
  id: number;
  cluster?: {
    id: number;
    count: number;
  };
  customerid?: number;
  property: {
    type: string;
    subtype?: string;
    title?: string;
    bedroomCount?: number;
    bathroomCount?: number;
    netHabitableSurface?: number;
    landSurface?: number;
    building?: {
      constructionYear?: number;
      condition?: string;
      facadeCount?: number;
      floorCount?: number;
    };
    location: {
      country?: string;
      region?: string;
      province?: string;
      district?: string;
      locality?: string;
      postalCode?: string;
      street?: string;
      number?: string;
      latitude?: number;
      longitude?: number;
    };
    hasGarden?: boolean;
    gardenSurface?: number;
    hasTermassure?: boolean;
    terraceSurface?: number;
    hasParkingSpace?: boolean;
    parkingCountIndoor?: number;
    parkingCountOutdoor?: number;
    hasLift?: boolean;
    hasBasement?: boolean;
    hasBalcony?: boolean;
    fireplaceExists?: boolean;
    hasSwimmingPool?: boolean;
    kitchen?: { type?: string };
    energy?: {
      heatingType?: string;
      totalEnergyConsumption?: number;
      primaryEnergyConsumption?: number;
    };
    certificates?: {
      primaryEnergyConsumptionPerSqm?: number;
      epcScore?: string;
    };
  };
  transaction: {
    type: string;
    subtype?: string;
    sale?: {
      price?: number;
      publicSale?: { price?: number };
    };
    rental?: {
      monthlyRentalPrice?: number;
      monthlyRentalCosts?: number;
    };
  };
  media?: {
    pictures?: Array<{ id: number; url: string; }>;
  };
  publication?: {
    creationDate?: string;
    lastModificationDate?: string;
    expirationDate?: string;
  };
  flags?: {
    isNewlyBuilt?: boolean;
    isPublicSale?: boolean;
    isNewClassified?: boolean;
  };
}

export interface ImmowebDetailResult {
  id: number;
  property: ImmowebListing['property'] & {
    description?: string;
    roomCount?: number;
    surface?: number;
    garageCount?: number;
    loggia?: { surface?: number };
  };
  transaction: ImmowebListing['transaction'];
  media?: ImmowebListing['media'];
  publication?: ImmowebListing['publication'];
  flags?: ImmowebListing['flags'];
  customers?: Array<{
    id: number;
    name?: string;
    phoneNumber?: string;
    email?: string;
    logoUrl?: string;
    type?: string;
  }>;
}
