-- ============================================================
-- Security Monitoring Tables
-- Migration: 011_security_monitoring_tables.sql
-- Purpose: Create tables for security monitoring dashboards and alerts
-- Author: security-engineer
-- Date: 2026-02-08
-- ============================================================

-- API Access Log
-- Tracks all API requests for authentication and rate limiting monitoring
CREATE TABLE IF NOT EXISTS api_access_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Request identification
  client_ip VARCHAR(45) NOT NULL,                -- IPv4 or IPv6
  api_key_hash VARCHAR(64),                      -- SHA-256 hash of API key (for security)
  api_key_prefix VARCHAR(10),                    -- First 8-10 chars for display
  api_key_version VARCHAR(20),                   -- API key version (v1, v2, etc.)
  request_id VARCHAR(100),                       -- Correlation ID from request headers

  -- Geographic info
  country VARCHAR(2),                            -- ISO 3166-1 alpha-2 country code

  -- Request details
  endpoint VARCHAR(255) NOT NULL,                -- API endpoint called
  method VARCHAR(10) NOT NULL,                   -- HTTP method (GET, POST, etc.)
  query_params JSONB,                            -- Query parameters (sanitized)

  -- Response details
  status_code INT NOT NULL,                      -- HTTP status code
  error_message TEXT,                            -- Error message if failed
  response_time_ms INT,                          -- Response time in milliseconds
  response_size_bytes INT,                       -- Response size

  -- Additional metadata
  user_agent TEXT,                               -- Client user agent
  referer TEXT,                                  -- HTTP referer header
  metadata JSONB                                 -- Additional tracking data
);

-- Indexes for security monitoring queries
CREATE INDEX IF NOT EXISTS idx_api_access_timestamp ON api_access_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_status ON api_access_log(status_code, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_key_prefix ON api_access_log(api_key_prefix, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_client_ip ON api_access_log(client_ip, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_country ON api_access_log(country, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_access_endpoint ON api_access_log(endpoint, timestamp DESC);

-- Index for failed auth detection
CREATE INDEX IF NOT EXISTS idx_api_access_failed_auth ON api_access_log(timestamp DESC, status_code)
  WHERE status_code IN (401, 403);

-- Index for rate limit violations
CREATE INDEX IF NOT EXISTS idx_api_access_rate_limit ON api_access_log(timestamp DESC, client_ip, api_key_prefix)
  WHERE status_code = 429;

-- Index for expired key detection
CREATE INDEX IF NOT EXISTS idx_api_access_expired_key ON api_access_log(timestamp DESC, api_key_prefix)
  WHERE error_message LIKE '%expired%';

-- Partition by month for performance (optional, can be enabled later)
-- COMMENT ON TABLE api_access_log IS 'Partition by month using timestamp column for high-volume production';


-- System Error Log
-- Tracks system-level errors (Redis, PostgreSQL, etc.)
CREATE TABLE IF NOT EXISTS system_errors (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Error classification
  component VARCHAR(50) NOT NULL,                -- redis, postgres, bullmq, etc.
  error_type VARCHAR(100) NOT NULL,              -- connection_failure, timeout, auth_error, etc.
  error_message TEXT NOT NULL,                   -- Full error message
  stack_trace TEXT,                              -- Stack trace if available

  -- Severity
  severity VARCHAR(20) NOT NULL DEFAULT 'error', -- critical, error, warning, info

  -- Context
  service VARCHAR(50),                           -- ingest-service, worker, search-service, etc.
  country VARCHAR(2),                            -- Country affected (if applicable)
  request_id VARCHAR(100),                       -- Correlation ID if from API request

  -- Additional data
  metadata JSONB,                                -- Error context (config, retries, etc.)

  -- Resolution tracking
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(100)
);

-- Indexes for error tracking
CREATE INDEX IF NOT EXISTS idx_system_errors_timestamp ON system_errors(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_component ON system_errors(component, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_severity ON system_errors(severity, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_errors_resolved ON system_errors(resolved, timestamp DESC);

-- Index for connection error detection
CREATE INDEX IF NOT EXISTS idx_system_errors_connection ON system_errors(timestamp DESC, component)
  WHERE error_type LIKE '%connection%' OR error_type LIKE '%timeout%';


-- Secrets Metadata
-- Tracks API keys, passwords, and other secrets for rotation monitoring
CREATE TABLE IF NOT EXISTS secrets_metadata (
  id SERIAL PRIMARY KEY,

  -- Secret identification
  secret_name VARCHAR(255) UNIQUE NOT NULL,      -- Unique identifier (e.g., api_key_czech_1)
  secret_type VARCHAR(50) NOT NULL,              -- api_key, database_password, redis_password, etc.

  -- Lifecycle tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_rotated_at TIMESTAMPTZ,                   -- Last rotation date
  expires_at TIMESTAMPTZ,                        -- Expiration date (if set)
  next_rotation_due TIMESTAMPTZ,                 -- When rotation is recommended

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, expired, revoked, rotated

  -- Owner and scope
  owner VARCHAR(100),                            -- Team or service owning this secret
  scope VARCHAR(50),                             -- production, staging, development
  country VARCHAR(2),                            -- Country-specific secret (if applicable)

  -- Rotation history
  rotation_count INT DEFAULT 0,                  -- Number of times rotated
  last_rotation_reason TEXT,                     -- Why it was rotated

  -- Additional metadata
  metadata JSONB,                                -- Additional tracking data

  -- Audit
  created_by VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(100)
);

-- Indexes for secret monitoring
CREATE INDEX IF NOT EXISTS idx_secrets_status ON secrets_metadata(status, created_at);
CREATE INDEX IF NOT EXISTS idx_secrets_type ON secrets_metadata(secret_type, status);
CREATE INDEX IF NOT EXISTS idx_secrets_rotation_due ON secrets_metadata(next_rotation_due)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_secrets_country ON secrets_metadata(country, status);

-- Index for age calculation (90+ days)
CREATE INDEX IF NOT EXISTS idx_secrets_age ON secrets_metadata(created_at DESC)
  WHERE status = 'active';


-- Secret Rotation History
-- Audit trail of all secret rotations
CREATE TABLE IF NOT EXISTS secret_rotation_history (
  id BIGSERIAL PRIMARY KEY,
  secret_name VARCHAR(255) NOT NULL,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_by VARCHAR(100) NOT NULL,              -- Who performed the rotation
  rotation_reason TEXT,                          -- Why it was rotated
  old_secret_hash VARCHAR(64),                   -- SHA-256 hash of old secret
  new_secret_hash VARCHAR(64),                   -- SHA-256 hash of new secret
  rotation_method VARCHAR(50),                   -- manual, automatic, scheduled
  metadata JSONB,                                -- Additional context

  FOREIGN KEY (secret_name) REFERENCES secrets_metadata(secret_name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_secret_rotation_name ON secret_rotation_history(secret_name, rotated_at DESC);
CREATE INDEX IF NOT EXISTS idx_secret_rotation_date ON secret_rotation_history(rotated_at DESC);


-- Data retention policy (optional, enable in production)
-- Automatically delete old log entries to manage database size

-- Function to clean up old logs (call from cron or pg_cron)
CREATE OR REPLACE FUNCTION cleanup_security_logs(retention_days INTEGER DEFAULT 90)
RETURNS TABLE(
  api_access_deleted BIGINT,
  system_errors_deleted BIGINT
) AS $$
DECLARE
  api_deleted BIGINT;
  errors_deleted BIGINT;
BEGIN
  -- Delete old API access logs (keep only retention_days)
  WITH deleted AS (
    DELETE FROM api_access_log
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days
    RETURNING *
  )
  SELECT COUNT(*) INTO api_deleted FROM deleted;

  -- Delete old resolved system errors (keep unresolved forever)
  WITH deleted AS (
    DELETE FROM system_errors
    WHERE resolved = true
      AND timestamp < NOW() - INTERVAL '1 day' * retention_days
    RETURNING *
  )
  SELECT COUNT(*) INTO errors_deleted FROM deleted;

  RETURN QUERY SELECT api_deleted, errors_deleted;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions (adjust based on your role setup)
-- GRANT SELECT, INSERT ON api_access_log TO landomo_app;
-- GRANT SELECT, INSERT ON system_errors TO landomo_app;
-- GRANT SELECT, INSERT, UPDATE ON secrets_metadata TO landomo_app;
-- GRANT SELECT, INSERT ON secret_rotation_history TO landomo_app;

-- Comments for documentation
COMMENT ON TABLE api_access_log IS 'Tracks all API requests for security monitoring and rate limiting detection';
COMMENT ON TABLE system_errors IS 'Tracks system-level errors (Redis, PostgreSQL, etc.) for infrastructure monitoring';
COMMENT ON TABLE secrets_metadata IS 'Tracks API keys and secrets for rotation monitoring and compliance';
COMMENT ON TABLE secret_rotation_history IS 'Audit trail of all secret rotations';

COMMENT ON COLUMN api_access_log.api_key_hash IS 'SHA-256 hash of API key for security (never store plaintext)';
COMMENT ON COLUMN api_access_log.api_key_prefix IS 'First 8-10 characters of API key for display purposes only';
COMMENT ON COLUMN system_errors.metadata IS 'JSON object with error context (config values, retry counts, etc.)';
COMMENT ON COLUMN secrets_metadata.next_rotation_due IS 'Recommended rotation date based on policy (e.g., 90 days)';

COMMENT ON FUNCTION cleanup_security_logs IS 'Deletes old security logs based on retention policy (default: 90 days)';

-- ============================================================
-- Migration complete
-- Next steps:
-- 1. Apply this migration to all country databases
-- 2. Implement logging in ingest service
-- 3. Verify Grafana dashboards load data correctly
-- ============================================================
