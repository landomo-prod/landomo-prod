/**
 * GraphQL Context
 *
 * Creates request-scoped context for GraphQL resolvers
 */

export interface GraphQLContext {
  request: any;
  pools?: Map<string, any>;
  redis?: any;
  loaders?: any;
  user?: any;
}

/**
 * Create GraphQL context for each request
 */
export function createContext(request: any): GraphQLContext {
  return {
    request,
    // Database pools, Redis, and loaders will be added as needed
    pools: undefined,
    redis: undefined,
    loaders: undefined,
    user: undefined,
  };
}
