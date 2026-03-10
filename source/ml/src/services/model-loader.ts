import { existsSync } from 'fs';
import { config } from '../config';
import { queryCountry } from '../database/multi-db-manager';
import { cacheGet, cacheSet } from '../cache/redis-manager';
import { modelLog } from '../logger';
import { ModelNotFoundError } from '../middleware/error-handler';

export interface ModelMetadata {
  id: string;
  country: string;
  property_category: string;
  version: number;
  trained_at: string;
  file_path: string;
  model_type: string;
  metrics: {
    mae: number;
    rmse: number;
    r2: number;
    mape: number;
  };
  status: string;
  training_samples: number;
  feature_count: number;
}

function modelCacheKey(country: string, category: string): string {
  return `ml:model:${country}:${category}:active`;
}

export async function getActiveModel(country: string, category: string): Promise<ModelMetadata> {
  const cacheKey = modelCacheKey(country, category);

  // Check Redis cache first
  const cached = await cacheGet<ModelMetadata>(cacheKey);
  if (cached) {
    return cached;
  }

  // Query model registry
  const result = await queryCountry(country, `
    SELECT id, country, property_category, version, trained_at, file_path,
           model_type, metrics, status, training_samples, feature_count
    FROM ml_model_registry
    WHERE country = $1 AND property_category = $2 AND status = 'active'
    ORDER BY version DESC
    LIMIT 1
  `, [country, category]);

  if (result.rows.length === 0) {
    throw new ModelNotFoundError(country, category);
  }

  const model = result.rows[0] as ModelMetadata;

  // Verify model file exists
  if (!existsSync(model.file_path)) {
    modelLog.error({ country, category, path: model.file_path }, 'Model file not found on disk');
    throw new ModelNotFoundError(country, category);
  }

  // Cache for 24h
  await cacheSet(cacheKey, model, config.cache.ttlModel);

  return model;
}

export async function invalidateModelCache(country: string, category: string): Promise<void> {
  const { cacheDelete } = await import('../cache/redis-manager');
  const cacheKey = modelCacheKey(country, category);
  await cacheDelete(cacheKey);
  modelLog.info({ country, category }, 'Model cache invalidated');
}
