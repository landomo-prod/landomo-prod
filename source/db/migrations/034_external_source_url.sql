-- Migration 034: Add external_source_url column for aggregator deduplication
--
-- Realingo (and similar aggregators) scrape listings from other portals and
-- expose the original portal URL in their API (offer.detail.externalUrl).
-- Storing this allows cross-portal deduplication: if sreality and realingo
-- both have the same listing, they will share the same external_source_url.
--
-- Applied to: landomo_cz (and any country using aggregator portals)

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS external_source_url TEXT;

-- Index for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_properties_external_source_url
  ON properties(external_source_url)
  WHERE external_source_url IS NOT NULL;

-- Backfill from portal_metadata JSONB for realingo listings
UPDATE properties
SET external_source_url = portal_metadata->'realingo'->>'external_url'
WHERE source_platform = 'realingo'
  AND portal_metadata->'realingo'->>'external_url' IS NOT NULL
  AND external_source_url IS NULL;
