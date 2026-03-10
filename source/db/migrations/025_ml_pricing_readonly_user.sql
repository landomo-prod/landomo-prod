-- ============================================================
-- Migration 025: ML Pricing Read-Only User
--
-- Creates a read-only PostgreSQL role for the ML pricing service.
-- Run this as a superuser on each country database.
--
-- Usage:
--   psql -U postgres -d landomo_czech_republic -f 025_ml_pricing_readonly_user.sql
--
-- Date: 2026-02-14
-- ============================================================

-- Create the role (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'ml_pricing_readonly') THEN
    CREATE ROLE ml_pricing_readonly WITH LOGIN PASSWORD 'ml_pricing_readonly_dev';
  END IF;
END
$$;

-- Grant connect
GRANT CONNECT ON DATABASE CURRENT_DATABASE TO ml_pricing_readonly;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO ml_pricing_readonly;

-- Grant SELECT on property partitions
GRANT SELECT ON properties_new TO ml_pricing_readonly;
GRANT SELECT ON properties_apartment TO ml_pricing_readonly;
GRANT SELECT ON properties_house TO ml_pricing_readonly;
GRANT SELECT ON properties_land TO ml_pricing_readonly;
GRANT SELECT ON properties_commercial TO ml_pricing_readonly;

-- Grant SELECT on ML materialized views
GRANT SELECT ON ml_training_features_apartment TO ml_pricing_readonly;
GRANT SELECT ON ml_training_features_house TO ml_pricing_readonly;
GRANT SELECT ON ml_training_features_land TO ml_pricing_readonly;
GRANT SELECT ON ml_training_features_commercial TO ml_pricing_readonly;

-- Grant SELECT on supporting tables
GRANT SELECT ON price_history TO ml_pricing_readonly;
GRANT SELECT ON listing_status_history TO ml_pricing_readonly;
GRANT SELECT ON ml_model_registry TO ml_pricing_readonly;

-- Grant INSERT/UPDATE on model registry (service needs to write model metadata)
GRANT INSERT, UPDATE ON ml_model_registry TO ml_pricing_readonly;

-- Default privileges for future tables (so new materialized views are accessible)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO ml_pricing_readonly;
