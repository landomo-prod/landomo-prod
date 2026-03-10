/** Raw Funda listing from search API */
export interface FundaSearchResult {
  Id: string;
  GlobalId: number;
  PublicatieDatum: string;
  Adres: string;
  Postcode: string;
  Woonplaats: string;
  Provincie: string;
  KoopPrijs?: number;
  HuurPrijs?: number;
  Koopprijs?: string;
  Huurprijs?: string;
  WoonOppervlakte?: number;
  PercOppervlakte?: number;
  AantalKamers?: number;
  AantalSlaapkamers?: number;
  AantalBadkamers?: number;
  Foto?: string;
  FotoLarge?: string;
  FotoLargest?: string;
  URL: string;
  SoortAanbod: string; // 'koop' | 'huur'
  Type?: string; // 'appartement' | 'woonhuis' | 'bouwgrond' | 'bedrijfspand'
  Verdieping?: number;
  AantalVerdiepingen?: number;
  Tuin?: string;
  Garage?: string;
  Berging?: string;
  Balkon?: string;
  Lift?: string;
  Parkeren?: string;
  Energielabel?: string;
  BouwJaar?: number;
  Omschrijving?: string;
  MakelaarNaam?: string;
  MakelaarId?: number;
  WGS84_X?: number; // longitude
  WGS84_Y?: number; // latitude
}

/** Raw Funda detail page data */
export interface FundaDetailData {
  id: string;
  globalId: number;
  address: string;
  postcode: string;
  city: string;
  province: string;
  price: number;
  currency: string;
  transactionType: 'sale' | 'rent';
  propertyType: string;
  livingArea?: number;
  plotArea?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  totalFloors?: number;
  hasGarden: boolean;
  hasGarage: boolean;
  hasBasement: boolean;
  hasBalcony: boolean;
  hasElevator: boolean;
  hasParking: boolean;
  energyLabel?: string;
  yearBuilt?: number;
  description?: string;
  images: string[];
  agentName?: string;
  agentId?: number;
  latitude?: number;
  longitude?: number;
  url: string;
  features: string[];
}
