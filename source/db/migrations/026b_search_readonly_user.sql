-- ============================================================
-- Migration 026: Search Service Read-Only User
--
-- Creates a read-only PostgreSQL role for the search service.
-- Run this as a superuser on each country database.
--
-- Usage:
--   psql -U postgres -d landomo_czech -f 026_search_readonly_user.sql
--
-- Date: 2026-02-15
-- ============================================================

-- Create the role (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'search_readonly') THEN
    CREATE ROLE search_readonly WITH LOGIN PASSWORD 'search_readonly_dev';
  END IF;
END
$$;

-- Grant connect
GRANT CONNECT ON DATABASE CURRENT_DATABASE TO search_readonly;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO search_readonly;

-- Grant SELECT on property partitions
GRANT SELECT ON properties_new TO search_readonly;
GRANT SELECT ON properties_apartment TO search_readonly;
GRANT SELECT ON properties_house TO search_readonly;
GRANT SELECT ON properties_land TO search_readonly;
GRANT SELECT ON properties_commercial TO search_readonly;

-- Grant SELECT on supporting tables used by search
GRANT SELECT ON price_history TO search_readonly;
GRANT SELECT ON listing_status_history TO search_readonly;
GRANT SELECT ON scrape_runs TO search_readonly;

-- Grant SELECT on boundary tables (for geo search)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'boundaries') THEN
    EXECUTE 'GRANT SELECT ON boundaries TO search_readonly';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'property_boundary_cache') THEN
    EXECUTE 'GRANT SELECT ON property_boundary_cache TO search_readonly';
  END IF;
END
$$;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO search_readonly;
