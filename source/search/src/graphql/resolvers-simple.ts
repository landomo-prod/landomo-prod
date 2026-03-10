/**
 * Simplified GraphQL Resolvers
 */

import { mapClustersResolver } from './resolvers/cluster.resolvers';
import {
  propertyResolver,
  radiusSearchResolver,
  propertyStatsResolver,
  searchPropertiesResolver,
} from './resolvers/advanced.resolvers';

export const resolvers = {
  Query: {
    health: () => 'OK',
    mapClusters: mapClustersResolver,
    property: propertyResolver,
    radiusSearch: radiusSearchResolver,
    propertyStats: propertyStatsResolver,
    searchProperties: searchPropertiesResolver,
  },

  Property: {
    location: (parent: any) => ({
      latitude: parent.latitude,
      longitude: parent.longitude,
      city: parent.city,
      region: parent.region,
      country: parent.country,
      geohash: parent.geohash,
      ...(parent.location && typeof parent.location === 'object'
        ? {
            street: parent.location.street,
            postalCode: parent.location.postal_code || parent.location.postalCode,
          }
        : {}),
    }),
    media: (parent: any) => {
      if (!parent.media) return null;
      return {
        images: parent.media.images || [],
        videos: parent.media.videos,
        virtualTour: parent.media.virtual_tour || parent.media.virtualTour,
        floorPlan: parent.media.floor_plan || parent.media.floorPlan,
      };
    },
    agent: (parent: any) => {
      if (!parent.agent) return null;
      return {
        name: parent.agent.name,
        phone: parent.agent.phone,
        email: parent.agent.email,
        company: parent.agent.company,
      };
    },
    propertyCategory: (parent: any) =>
      (parent.propertyCategory || parent.property_category || '').toUpperCase(),
    transactionType: (parent: any) =>
      (parent.transactionType || parent.transaction_type || '').toUpperCase(),
    status: (parent: any) =>
      (parent.status || '').toUpperCase(),
  },

  RadiusSearchResult: {
    location: (parent: any) => ({
      lat: parent.latitude,
      lon: parent.longitude,
    }),
  },

  PropertyPreview: {
    location: (parent: any) => ({
      lat: parent.latitude,
      lon: parent.longitude,
    }),
  },

  PropertyCluster: {
    id: (parent: any) => parent.cluster_id || parent.clusterId,
    center: (parent: any) => ({
      lat: parent.center_lat || parent.centerLat,
      lon: parent.center_lon || parent.centerLon,
    }),
  },
};
