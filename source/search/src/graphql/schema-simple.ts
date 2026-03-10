/**
 * Simplified GraphQL Schema
 *
 * Uses a simpler approach with GraphQL type definitions and resolvers
 * This bypasses Pothos complexity and gets the API functional faster
 */

export const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  enum TransactionType {
    SALE
    RENT
  }

  enum PropertyStatus {
    ACTIVE
    REMOVED
    SOLD
    RENTED
  }

  enum PropertyCategory {
    APARTMENT
    HOUSE
    LAND
    COMMERCIAL
  }

  type PropertyLocation {
    city: String
    street: String
    region: String
    postalCode: String
    country: String!
    latitude: Float
    longitude: Float
    geohash: String
  }

  type PropertyMedia {
    images: [String!]!
    videos: [String!]
    virtualTour: String
    floorPlan: String
  }

  type PropertyAgent {
    name: String
    phone: String
    email: String
    company: String
  }

  type ApartmentProperty {
    id: ID!
    title: String!
    price: Float!
    currency: String!
    transactionType: TransactionType!
    status: PropertyStatus!
    propertyCategory: PropertyCategory!

    bedrooms: Int!
    bathrooms: Int
    sqm: Float!
    floor: Int
    totalFloors: Int
    hasElevator: Boolean!
    hasBalcony: Boolean!
    hasParking: Boolean!
    hasBasement: Boolean!

    location: PropertyLocation!
    media: PropertyMedia
    agent: PropertyAgent
    description: String
    sourceUrl: String!
    sourcePlatform: String!
    createdAt: DateTime
    updatedAt: DateTime
  }

  type GeoPoint {
    lat: Float!
    lon: Float!
  }

  type BoundingBox {
    north: Float!
    south: Float!
    east: Float!
    west: Float!
  }

  type PropertyCluster {
    id: ID!
    count: Int!
    center: GeoPoint!
    avgPrice: Float!
    minPrice: Float!
    maxPrice: Float!
    categoryCounts: JSON
    bounds: BoundingBox
  }

  type PropertyPreview {
    id: ID!
    title: String!
    price: Float!
    currency: String!
    propertyCategory: String!
    location: GeoPoint!
    thumbnailUrl: String
    bedrooms: Int
    sqm: Float
  }

  type MapClusterResponse {
    clusters: [PropertyCluster!]
    properties: [PropertyPreview!]
    total: Int!
    strategy: String!
    zoom: Int!
    queryTimeMs: Int
  }

  input BoundingBoxInput {
    north: Float!
    south: Float!
    east: Float!
    west: Float!
  }

  input PropertyFiltersInput {
    propertyCategory: [String!]
    transactionType: String
    priceMin: Float
    priceMax: Float
    bedroomsMin: Int
    bedroomsMax: Int
    sqmMin: Float
    sqmMax: Float
    hasParking: Boolean
    hasElevator: Boolean
    hasGarden: Boolean
  }

  input GeoPointInput {
    lat: Float!
    lon: Float!
  }

  enum SortBy {
    PRICE_ASC
    PRICE_DESC
    DATE_DESC
    DISTANCE_ASC
    RELEVANCE
  }

  type Property {
    id: ID!
    portal: String!
    portalId: String!
    title: String!
    price: Float!
    currency: String!
    propertyCategory: PropertyCategory!
    transactionType: TransactionType!
    status: PropertyStatus!
    description: String
    sourceUrl: String!
    sourcePlatform: String!

    location: PropertyLocation!
    bedrooms: Int
    bathrooms: Int
    sqm: Float
    floor: Int
    totalFloors: Int
    sqmPlot: Float
    hasElevator: Boolean
    hasBalcony: Boolean
    hasParking: Boolean
    hasBasement: Boolean
    hasGarden: Boolean
    hasGarage: Boolean

    media: PropertyMedia
    agent: PropertyAgent
    countrySpecific: JSON
    portalMetadata: JSON
    createdAt: DateTime
    updatedAt: DateTime
  }

  type RadiusSearchResult {
    id: ID!
    title: String!
    price: Float!
    currency: String!
    propertyCategory: String!
    location: GeoPoint!
    distanceKm: Float!
    thumbnailUrl: String
    bedrooms: Int
    sqm: Float
  }

  type RadiusSearchResponse {
    results: [RadiusSearchResult!]!
    total: Int!
    queryTimeMs: Int
  }

  type CategoryCount {
    category: String!
    count: Int!
  }

  type TransactionCount {
    type: String!
    count: Int!
  }

  type PropertyStats {
    totalCount: Int!
    avgPrice: Float!
    minPrice: Float!
    maxPrice: Float!
    medianPrice: Float!
    categoryDistribution: [CategoryCount!]!
    transactionDistribution: [TransactionCount!]!
  }

  type SearchResult {
    properties: [PropertyPreview!]!
    total: Int!
    queryTimeMs: Int
  }

  type Query {
    health: String!

    mapClusters(
      bounds: BoundingBoxInput!
      zoom: Int!
      countries: [String!]!
      filters: PropertyFiltersInput
    ): MapClusterResponse!

    property(
      id: ID!
      country: String!
    ): Property

    radiusSearch(
      center: GeoPointInput!
      radiusKm: Float!
      countries: [String!]!
      filters: PropertyFiltersInput
      sortBy: SortBy
      limit: Int
      offset: Int
    ): RadiusSearchResponse!

    propertyStats(
      bounds: BoundingBoxInput!
      countries: [String!]!
      filters: PropertyFiltersInput
    ): PropertyStats!

    searchProperties(
      bounds: BoundingBoxInput!
      countries: [String!]!
      filters: PropertyFiltersInput
      sortBy: SortBy
      limit: Int
      offset: Int
    ): SearchResult!
  }
`;
