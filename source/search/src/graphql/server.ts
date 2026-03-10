/**
 * GraphQL Server Setup
 *
 * Integrates GraphQL Yoga with Fastify
 */

import fastifyPlugin from 'fastify-plugin';
import { createYoga } from 'graphql-yoga';
import depthLimit from 'graphql-depth-limit';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from './schema-simple';
import { resolvers } from './resolvers-simple';
import { createContext } from './context';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

export interface GraphQLServerOptions {
  prefix?: string;
  graphiql?: boolean;
}

/**
 * GraphQL Server Plugin
 * Registers GraphQL endpoint with Fastify
 */
export const graphqlServer = fastifyPlugin<GraphQLServerOptions>(
  async (fastify: FastifyInstance, opts: GraphQLServerOptions) => {
    const { prefix = '/graphql', graphiql = false } = opts;

    // Create Yoga server
    const yoga = createYoga({
      schema,
      context: ({ request }) => createContext(request),
      graphiql,
      landingPage: graphiql,
      // Security: Limit query depth to prevent abuse
      plugins: [
        {
          onValidate({ addValidationRule }: any) {
            addValidationRule(depthLimit(7));
          },
        },
      ],
      logging: {
        debug: (...args) => fastify.log.debug(args),
        info: (...args) => fastify.log.info(args),
        warn: (...args) => fastify.log.warn(args),
        error: (...args) => fastify.log.error(args),
      },
    });

    // Register GraphQL route
    fastify.route({
      url: prefix,
      method: ['GET', 'POST', 'OPTIONS'],
      handler: async (req: FastifyRequest, reply: FastifyReply) => {
        const response = await yoga.handleNodeRequestAndResponse(req, reply);

        // Copy headers from Yoga response to Fastify reply
        response.headers.forEach((value, key) => {
          reply.header(key, value);
        });

        reply.status(response.status);

        // Handle body
        if (response.body) {
          const body = await response.text();
          reply.send(body);
        } else {
          reply.send();
        }

        return reply;
      },
    });

    fastify.log.info({ prefix }, 'GraphQL server registered');
  }
);
