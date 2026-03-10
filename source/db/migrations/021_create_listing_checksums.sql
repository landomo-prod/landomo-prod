-- Migration: Create listing_checksums table for change detection
-- Purpose: Store checksums to detect property changes and enable incremental scraping
-- Date: 2026-02-13

-- Create listing_checksums table
CREATE TABLE IF NOT EXISTS listing_checksums (
    id BIGSERIAL PRIMARY KEY,
    portal VARCHAR(50) NOT NULL,
    portal_id VARCHAR(100) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Ensure one checksum per portal+property combination
    CONSTRAINT uq_portal_property UNIQUE (portal, portal_id)
);

-- Index for fast lookups by portal
CREATE INDEX idx_listing_checksums_portal ON listing_checksums(portal);

-- Index for bulk queries
CREATE INDEX idx_listing_checksums_portal_id ON listing_checksums(portal, portal_id);

-- Index for cleanup queries (find old checksums)
CREATE INDEX idx_listing_checksums_last_seen ON listing_checksums(last_seen_at);

-- Add comment
COMMENT ON TABLE listing_checksums IS 'Stores checksums for change detection to enable incremental scraping and skip unchanged listings';
COMMENT ON COLUMN listing_checksums.portal IS 'Source portal (e.g., sreality, bezrealitky)';
COMMENT ON COLUMN listing_checksums.portal_id IS 'Portal-specific listing ID (e.g., sreality-123456)';
COMMENT ON COLUMN listing_checksums.checksum IS 'MD5 hash of price + locality + title for change detection';
COMMENT ON COLUMN listing_checksums.last_seen_at IS 'Last time this listing was seen in a scrape';

-- Function to clean up old checksums (manually triggered or via cron)
CREATE OR REPLACE FUNCTION cleanup_old_checksums(
    p_portal VARCHAR,
    p_days_old INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM listing_checksums
    WHERE portal = p_portal
    AND last_seen_at < NOW() - (p_days_old || ' days')::INTERVAL;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_checksums IS 'Delete checksums older than N days for a specific portal. Usage: SELECT cleanup_old_checksums(''sreality'', 30);';
