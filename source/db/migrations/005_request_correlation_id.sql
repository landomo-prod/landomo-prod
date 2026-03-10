-- Migration 005: Add request_id column to ingestion_log for request correlation
-- Enables end-to-end tracing from scheduler -> scraper -> ingest API -> queue -> worker -> DB

ALTER TABLE ingestion_log ADD COLUMN IF NOT EXISTS request_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_ingestion_log_request_id ON ingestion_log(request_id) WHERE request_id IS NOT NULL;
