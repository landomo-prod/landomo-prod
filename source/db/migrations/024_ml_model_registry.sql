-- ============================================================
-- Migration 024: ML Model Registry
--
-- Tracks trained model versions, metrics, and deployment status
-- for the ML pricing service.
--
-- Date: 2026-02-14
-- ============================================================

BEGIN;

-- ============================================================
-- Model registry table
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_model_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country VARCHAR(100) NOT NULL,
  property_category VARCHAR(20) NOT NULL CHECK (property_category IN ('apartment', 'house', 'land', 'commercial')),
  version INTEGER NOT NULL,
  model_type VARCHAR(50) NOT NULL DEFAULT 'lightgbm',
  file_path TEXT NOT NULL,
  trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  training_duration_seconds INTEGER,
  training_samples INTEGER,
  feature_count INTEGER,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- metrics schema: {mae, rmse, r2, mape, within_10_pct, within_20_pct}
  hyperparameters JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'testing' CHECK (status IN ('active', 'archived', 'testing', 'failed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_model_version UNIQUE (country, property_category, version)
);

-- Indexes
CREATE INDEX idx_ml_registry_country_category ON ml_model_registry (country, property_category);
CREATE INDEX idx_ml_registry_status ON ml_model_registry (status);
CREATE INDEX idx_ml_registry_active ON ml_model_registry (country, property_category, version DESC) WHERE status = 'active';
CREATE INDEX idx_ml_registry_trained_at ON ml_model_registry (trained_at DESC);

COMMIT;
