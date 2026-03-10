/**
 * home.dk raw types extracted from SSR Nuxt payload
 *
 * home.dk embeds listing data as a flat array in <script type="application/json">
 * using Nuxt 3's payload format where each element is either a value or a dict
 * whose values are integer indices pointing to other elements in the array.
 *
 * The scraper resolves these references to produce HomeListingSummary (from listing
 * pages) and HomeListingDetail (from individual property pages).
 */

export interface HomeAddress {
  full: string;
  postalCode: string;
  city: string;
  locationName: string | null;
  road: string;
  municipalityNumber: number | null;
  municipality: string | null;
  regionNumber: number | null;
  longitude: number;
  latitude: number;
  houseNumber: string | null;
  floor: string | null;
  doorLocation: string | null;
  door: string | null;
}

export interface HomePrice {
  amount: number;
  displayValue: string;
}

export interface HomeOffer {
  // Sale fields
  cashPrice: HomePrice | null;
  technicalPrice: HomePrice | null;
  squareMeterPrice: number | null;
  ownerCostsTotalMonthlyAmount: HomePrice | null;
  priceChangedAt: string | null;
  downPayment: HomePrice | null;
  mortgageGrossMonthly: HomePrice | null;
  mortgageNetMonthly: HomePrice | null;
  cashPriceChangePercentage: number | null;
  // Rental fields
  rentalPricePerMonth: HomePrice | null;
  rentalPricePerYear: HomePrice | null;
  rentalPricePrePaid: HomePrice | null;
  rentalUtilitiesPerMonth: HomePrice | null;
  rentalSecurityDeposit: HomePrice | null;
  yearlyRent: number | null;
  yearlyRentalRevenue: number | null;
  rateOfReturn: number | null;
}

/** Listing-page stats (minimal, no rooms/bathrooms) */
export interface HomeStatsSummary {
  floorArea: number | null;
  plotArea: number | null;
  floorAreaTotal: number | null;
  totalSquareMeters: number | null;
}

/** Detail-page stats (full) */
export interface HomeStatsDetail {
  energyLabel: string | null;
  isEnergyLabelRequired: boolean;
  plotArea: number | null;
  floorArea: number | null;
  floorAreaTotal: number | null;
  basementArea: number | null;
  rooms: number | null;
  bathrooms: number | null;
  yearBuilt: string | null;
  yearRenovated: string | null;
  floors: number | null;
  hasBalcony: boolean | null;
  isStudentAppropriate: boolean | null;
  hasElevator: boolean | null;
  distanceToWater: number | null;
  distanceToSchool: number | null;
  distanceToPublicTransport: number | null;
  distanceToShopping: number | null;
  distanceToForest: number | null;
  distanceToCity: number | null;
  distanceToBeach: number | null;
  hasCourtYard: boolean | null;
  isWaterInstalled: boolean | null;
  isSewered: boolean | null;
  isElectricityInstalled: boolean | null;
  totalCommercialArea: number | null;
  totalBuiltUpArea: number | null;
  beds: number | null;
  hasGarage: boolean | null;
  garageArea: number | null;
  carportArea: number | null;
  hasBuildingExtension: boolean | null;
  hasAnnex: boolean | null;
  hasNewRoof: boolean | null;
}

export interface HomeMedia {
  url: string;
  type: string;
  priority: string;
  altText: string | null;
}

/** Summary listing from listing/search pages */
export interface HomeListingSummary {
  id: string;
  url: string;
  type: string;           // "Villa", "Ejerlejlighed", "Andelsbolig", etc.
  isBusinessCase: boolean;
  isRentalCase: boolean;
  isLuxurious: boolean;
  isPlot: boolean;
  isComingSoon: boolean;
  address: HomeAddress;
  stats: HomeStatsSummary;
  offer: {
    price: HomePrice | null;
    rentPerMonth: HomePrice | null;
    rentPerYear: HomePrice | null;
  };
  headline: string | null;
  presentationMedia: HomeMedia[];
}

/** Full listing from detail pages */
export interface HomeListingDetail {
  id: string;
  url: string;
  propertyCategory: string;  // "Villa", "Ejerlejlighed", "Andelsbolig", etc.
  alternativePropertyCategory: string | null;
  type: string;              // "salesCase" | "rentalCase"
  isBusinessCase: boolean;
  isRentalCase: boolean;
  isForSale: boolean;
  isUnderSale: boolean;
  isSold: boolean;
  isRented: boolean;
  isLuxurious: boolean;
  isPlot: boolean;
  isComingSoon: boolean;
  isHighlighted: boolean;
  headline: string | null;
  subHeadline: string | null;
  salesPresentationDescription: string | null;
  listingDate: string | null;
  shopNumber: string | null;
  brokerEmail: string | null;
  address: HomeAddress;
  stats: HomeStatsDetail;
  offer: HomeOffer;
  presentationMedia: HomeMedia[];
}

/** Result from parsing a listing index page */
export interface HomePageResult {
  total: number;
  hasNextPage: boolean;
  listings: HomeListingSummary[];
}
