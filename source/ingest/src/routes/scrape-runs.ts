/**
 * Scrape Runs Route
 * POST /api/v1/scrape-runs/start - Start a scrape run
 * POST /api/v1/scrape-runs/:id/complete - Complete a scrape run with stats
 */

import { FastifyInstance } from 'fastify';
import { getCoreDatabase, getInstanceCountry } from '../database/manager';
import {
  startScrapeRun,
  completeScrapeRun,
  failScrapeRun,
} from '../database/staleness-operations';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StartBody {
  portal: string;
}

interface CompleteBody {
  listings_found: number;
  listings_new: number;
  listings_updated: number;
}

interface CompleteParams {
  id: string;
}

export async function scrapeRunsRoute(fastify: FastifyInstance) {
  /**
   * Start a scrape run - called by scraper at the beginning of a scrape session
   */
  fastify.post<{ Body: StartBody }>('/api/v1/scrape-runs/start', async (request, reply) => {
    const { portal } = request.body;

    if (!portal || typeof portal !== 'string' || portal.trim().length === 0) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: 'portal must be a non-empty string',
      });
    }

    try {
      const country = getInstanceCountry();
      const pool = getCoreDatabase(country);
      const runId = await startScrapeRun(pool, portal);

      if (runId === null) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'A scrape run for this portal is already in progress',
        });
      }

      return reply.status(201).send({
        status: 'created',
        run_id: runId,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to start scrape run',
      });
    }
  });

  /**
   * Complete a scrape run - called by scraper when scrape session finishes
   */
  fastify.post<{ Body: CompleteBody; Params: CompleteParams }>(
    '/api/v1/scrape-runs/:id/complete',
    async (request, reply) => {
      const { id } = request.params;
      const { listings_found, listings_new, listings_updated } = request.body;

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'id must be a valid UUID',
        });
      }

      if (listings_found === undefined || typeof listings_found !== 'number' || listings_found < 0) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'listings_found must be a non-negative number',
        });
      }

      try {
        const country = getInstanceCountry();
        const pool = getCoreDatabase(country);

        await completeScrapeRun(pool, id, {
          listings_found: listings_found || 0,
          listings_new: listings_new || 0,
          listings_updated: listings_updated || 0,
        });

        return reply.status(200).send({
          status: 'completed',
          run_id: id,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: 'Failed to complete scrape run',
        });
      }
    }
  );

  /**
   * Mark a scrape run as failed
   */
  fastify.post<{ Params: CompleteParams }>(
    '/api/v1/scrape-runs/:id/fail',
    async (request, reply) => {
      const { id } = request.params;

      if (!UUID_REGEX.test(id)) {
        return reply.status(400).send({
          error: 'ValidationError',
          message: 'id must be a valid UUID',
        });
      }

      try {
        const country = getInstanceCountry();
        const pool = getCoreDatabase(country);

        await failScrapeRun(pool, id);

        return reply.status(200).send({
          status: 'failed',
          run_id: id,
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({
          error: 'InternalServerError',
          message: 'Failed to mark scrape run as failed',
        });
      }
    }
  );
}
