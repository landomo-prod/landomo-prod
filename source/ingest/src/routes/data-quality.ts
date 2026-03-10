/**
 * Data Quality Routes
 * GET /api/v1/data-quality - Latest quality snapshots
 * GET /api/v1/data-quality/alerts - Active alerts
 * GET /api/v1/data-quality/field-completion - Field completion rates
 * GET /api/v1/data-quality/price-outliers - Price outlier summary
 */

import { FastifyInstance } from 'fastify';
import { getCoreDatabase, getInstanceCountry } from '../database/manager';
import {
  getLatestSnapshots,
  getLatestAlerts,
  getFieldCompletionSummary,
  getPriceOutlierSummary,
} from '../workers/data-quality-checker';

export async function dataQualityRoute(fastify: FastifyInstance) {
  fastify.get('/api/v1/data-quality', async (request, reply) => {
    try {
      const country = getInstanceCountry();
      const pool = getCoreDatabase(country);
      const snapshots = await getLatestSnapshots(pool, country);

      if (snapshots.length === 0) {
        return reply.status(200).send({
          country,
          message: 'No data quality snapshots available yet',
          portals: [],
          overall_score: null,
        });
      }

      const avgScore = Math.round(
        snapshots.reduce((sum, s) => sum + parseFloat(String(s.quality_score)), 0) / snapshots.length * 100
      ) / 100;

      return reply.status(200).send({
        country,
        overall_score: avgScore,
        portals: snapshots,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve data quality snapshots',
      });
    }
  });

  fastify.get('/api/v1/data-quality/alerts', async (request, reply) => {
    try {
      const country = getInstanceCountry();
      const pool = getCoreDatabase(country);
      const alerts = await getLatestAlerts(pool);

      return reply.status(200).send({
        country,
        total: alerts.length,
        alerts,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve alerts',
      });
    }
  });

  fastify.get('/api/v1/data-quality/field-completion', async (request, reply) => {
    try {
      const country = getInstanceCountry();
      const pool = getCoreDatabase(country);
      const completion = await getFieldCompletionSummary(pool);

      // Group by portal -> category for readability
      const grouped: Record<string, Record<string, { field_name: string; completion_pct: number }[]>> = {};
      for (const r of completion) {
        if (!grouped[r.portal]) grouped[r.portal] = {};
        if (!grouped[r.portal][r.property_category]) grouped[r.portal][r.property_category] = [];
        grouped[r.portal][r.property_category].push({
          field_name: r.field_name,
          completion_pct: parseFloat(String(r.completion_pct)),
        });
      }

      return reply.status(200).send({
        country,
        portals: grouped,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve field completion data',
      });
    }
  });

  fastify.get('/api/v1/data-quality/price-outliers', async (request, reply) => {
    try {
      const country = getInstanceCountry();
      const pool = getCoreDatabase(country);
      const outliers = await getPriceOutlierSummary(pool);

      return reply.status(200).send({
        country,
        total_segments: outliers.length,
        outliers,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'InternalServerError',
        message: 'Failed to retrieve price outlier data',
      });
    }
  });
}
