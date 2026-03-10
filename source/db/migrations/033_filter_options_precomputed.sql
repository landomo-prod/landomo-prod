-- Migration 033: Pre-computed filter options table
--
-- Stores pre-aggregated filter options per (property_category, transaction_type).
-- Empty string = "all" (no filter applied on that dimension).
-- The search service writes here after each scrape run and on startup.
-- API reads are instant (<2ms) vs the 120ms live CTE query.

CREATE TABLE IF NOT EXISTS filter_options_precomputed (
  property_category VARCHAR(20) NOT NULL DEFAULT '',
  transaction_type  VARCHAR(10) NOT NULL DEFAULT '',
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data              JSONB       NOT NULL,
  PRIMARY KEY (property_category, transaction_type)
);

GRANT SELECT ON filter_options_precomputed TO search_readonly;
GRANT INSERT, UPDATE ON filter_options_precomputed TO landomo;
