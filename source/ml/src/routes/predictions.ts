import { FastifyInstance } from 'fastify';
import { PredictionRequest, PredictionResponse } from '@landomo/core';
import { getActiveModel } from '../services/model-loader';
import { callPythonPredict } from '../services/python-bridge';
import { generateCacheKey, cacheGet, cacheSet } from '../cache/redis-manager';
import { config } from '../config';
import { predictionLog } from '../logger';
import { InvalidFeaturesError } from '../middleware/error-handler';

const VALID_CATEGORIES = ['apartment', 'house', 'land', 'commercial'];

const REQUIRED_FEATURES: Record<string, string[]> = {
  apartment: ['sqm', 'city'],
  house: ['sqm_living', 'city'],
  land: ['area_plot_sqm', 'city'],
  commercial: ['sqm_total', 'city'],
};

function validatePredictionRequest(body: PredictionRequest): void {
  if (!body.country) {
    throw new InvalidFeaturesError('Missing required field: country');
  }
  if (!body.property_category || !VALID_CATEGORIES.includes(body.property_category)) {
    throw new InvalidFeaturesError(`Invalid property_category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }
  if (!body.features || typeof body.features !== 'object') {
    throw new InvalidFeaturesError('Missing required field: features');
  }

  const required = REQUIRED_FEATURES[body.property_category];
  const missing = required.filter(f => !(f in body.features));
  if (missing.length > 0) {
    throw new InvalidFeaturesError(`Missing required features for ${body.property_category}: ${missing.join(', ')}`);
  }
}

export async function predictionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: PredictionRequest }>('/api/v1/predictions', async (request, reply) => {
    const startTime = Date.now();
    const body = request.body;

    validatePredictionRequest(body);

    const { country, property_category, features, options } = body;

    // Check prediction cache
    const cacheKey = generateCacheKey(`ml:pred:${country}:${property_category}`, features);
    const cached = await cacheGet<PredictionResponse>(cacheKey);

    if (cached) {
      predictionLog.info({ country, property_category, cacheHit: true }, 'Returning cached prediction');
      cached.prediction_metadata.cache_hit = true;
      return reply.send(cached);
    }

    // Load active model
    const model = await getActiveModel(country, property_category);

    // Call Python for prediction
    const result = await callPythonPredict(model.file_path, features as unknown as Record<string, unknown>);

    const durationMs = Date.now() - startTime;

    const response: PredictionResponse = {
      predicted_price: result.predicted_price,
      currency: getCurrencyForCountry(country),
      confidence_interval: options?.include_confidence !== false ? {
        lower: result.confidence_lower,
        upper: result.confidence_upper,
        confidence_level: 0.95,
      } : undefined,
      prediction_metadata: {
        model_version: `${country}_${property_category}_v${model.version}`,
        trained_at: model.trained_at,
        feature_count: model.feature_count,
        prediction_time_ms: durationMs,
        cache_hit: false,
      },
    };

    // Cache the prediction
    await cacheSet(cacheKey, response, config.cache.ttlPrediction);

    predictionLog.info({
      country,
      property_category,
      predicted_price: result.predicted_price,
      duration_ms: durationMs,
    }, 'Prediction completed');

    return reply.send(response);
  });
}

function getCurrencyForCountry(country: string): string {
  const currencies: Record<string, string> = {
    czech: 'CZK',
    slovakia: 'EUR',
    hungary: 'HUF',
    austria: 'EUR',
    germany: 'EUR',
    uk: 'GBP',
    usa: 'USD',
    australia: 'AUD',
    france: 'EUR',
    spain: 'EUR',
    italy: 'EUR',
  };
  return currencies[country] || 'EUR';
}
