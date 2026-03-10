import { FastifyInstance } from 'fastify';
import { getActiveModel } from '../services/model-loader';
import { queryCountry } from '../database/multi-db-manager';
import { modelLog } from '../logger';

interface ModelInfoParams {
  country: string;
  category: string;
}

export async function modelRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: ModelInfoParams }>(
    '/api/v1/models/:country/:category/info',
    async (request, reply) => {
      const { country, category } = request.params;

      const model = await getActiveModel(country, category);

      // Get data coverage stats
      let coverageStats = { active_listings: 0, avg_price: 0, median_price: 0 };
      try {
        const statsResult = await queryCountry(country, `
          SELECT
            COUNT(*) as active_listings,
            ROUND(AVG(price)) as avg_price,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price)) as median_price
          FROM properties_new
          WHERE property_category = $1 AND status = 'active' AND price > 0
        `, [category]);

        if (statsResult.rows.length > 0) {
          coverageStats = {
            active_listings: parseInt(statsResult.rows[0].active_listings, 10),
            avg_price: parseFloat(statsResult.rows[0].avg_price) || 0,
            median_price: parseFloat(statsResult.rows[0].median_price) || 0,
          };
        }
      } catch (err) {
        modelLog.warn({ err, country, category }, 'Failed to fetch coverage stats');
      }

      return reply.send({
        country,
        property_category: category,
        model_version: `v${model.version}`,
        model_type: model.model_type,
        trained_at: model.trained_at,
        status: model.status,
        metrics: model.metrics,
        training_samples: model.training_samples,
        feature_count: model.feature_count,
        data_coverage: coverageStats,
      });
    }
  );
}
