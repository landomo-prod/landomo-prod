/**
 * Security Logging Utilities
 *
 * Provides functions to log security events (API access, system errors, secret metadata)
 * to PostgreSQL tables for monitoring dashboards and alerts.
 *
 * @module utils/security-logger
 */

import { Pool } from 'pg';
import { createHash } from 'crypto';
import { getCoreDatabase } from '../database/manager';
import { logger } from '../logger';

/**
 * API Access Log Entry
 */
export interface ApiAccessLog {
  clientIp: string;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  apiKeyVersion?: string;
  requestId?: string;
  country?: string;
  endpoint: string;
  method: string;
  queryParams?: Record<string, any>;
  statusCode: number;
  errorMessage?: string;
  responseTimeMs?: number;
  responseSizeBytes?: number;
  userAgent?: string;
  referer?: string;
  metadata?: Record<string, any>;
}

/**
 * System Error Log Entry
 */
export interface SystemErrorLog {
  component: string;
  errorType: string;
  errorMessage: string;
  stackTrace?: string;
  severity?: 'critical' | 'error' | 'warning' | 'info';
  service?: string;
  country?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

/**
 * Secret Metadata Entry
 */
export interface SecretMetadata {
  secretName: string;
  secretType: string;
  createdAt?: Date;
  lastRotatedAt?: Date;
  expiresAt?: Date;
  nextRotationDue?: Date;
  status?: 'active' | 'expired' | 'revoked' | 'rotated';
  owner?: string;
  scope?: string;
  country?: string;
  rotationCount?: number;
  lastRotationReason?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Hash an API key using SHA-256
 * @param apiKey The API key to hash
 * @returns SHA-256 hash of the API key
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Extract the prefix (first 8-10 characters) from an API key
 * @param apiKey The API key
 * @returns First 8 characters of the API key
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 8);
}

/**
 * Extract API key version from the key format
 * @param apiKey The API key
 * @returns API key version (e.g., "v1", "v2") or "unknown"
 */
export function getApiKeyVersion(apiKey: string): string {
  // Assuming format: dev_key_czech_1 or prod_key_v2_czech_1
  if (apiKey.includes('_v2_')) return 'v2';
  if (apiKey.includes('_v1_')) return 'v1';
  if (apiKey.startsWith('dev_')) return 'dev';
  if (apiKey.startsWith('prod_')) return 'prod';
  return 'unknown';
}

/**
 * Log an API access event to the database
 * @param country Country code (for database routing)
 * @param entry API access log entry
 */
export async function logApiAccess(
  country: string,
  entry: ApiAccessLog
): Promise<void> {
  try {
    const db = getCoreDatabase(country);

    await db.query(
      `INSERT INTO api_access_log (
        timestamp,
        client_ip,
        api_key_hash,
        api_key_prefix,
        api_key_version,
        request_id,
        country,
        endpoint,
        method,
        query_params,
        status_code,
        error_message,
        response_time_ms,
        response_size_bytes,
        user_agent,
        referer,
        metadata
      ) VALUES (
        NOW(),
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )`,
      [
        entry.clientIp,
        entry.apiKeyHash,
        entry.apiKeyPrefix,
        entry.apiKeyVersion,
        entry.requestId,
        entry.country,
        entry.endpoint,
        entry.method,
        entry.queryParams ? JSON.stringify(entry.queryParams) : null,
        entry.statusCode,
        entry.errorMessage,
        entry.responseTimeMs,
        entry.responseSizeBytes,
        entry.userAgent,
        entry.referer,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (error) {
    // Never throw - logging failures should not break the API
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      country,
      endpoint: entry.endpoint,
    }, 'Failed to log API access');
  }
}

/**
 * Log a system error to the database
 * @param country Country code (for database routing, optional)
 * @param entry System error log entry
 */
export async function logSystemError(
  country: string | null,
  entry: SystemErrorLog
): Promise<void> {
  try {
    // Default to first available country if no country specified
    const targetCountry = country || 'czech_republic';
    const db = getCoreDatabase(targetCountry);

    await db.query(
      `INSERT INTO system_errors (
        timestamp,
        component,
        error_type,
        error_message,
        stack_trace,
        severity,
        service,
        country,
        request_id,
        metadata
      ) VALUES (
        NOW(),
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      )`,
      [
        entry.component,
        entry.errorType,
        entry.errorMessage,
        entry.stackTrace,
        entry.severity || 'error',
        entry.service || 'ingest-service',
        entry.country,
        entry.requestId,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  } catch (error) {
    // Never throw - logging failures should not break the application
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      component: entry.component,
      errorType: entry.errorType,
    }, 'Failed to log system error');
  }
}

/**
 * Upsert secret metadata to the database
 * @param country Country code (for database routing, or null for global secrets)
 * @param entry Secret metadata entry
 */
export async function upsertSecretMetadata(
  country: string | null,
  entry: SecretMetadata
): Promise<void> {
  try {
    // Default to first available country if no country specified
    const targetCountry = country || entry.country || 'czech_republic';
    const db = getCoreDatabase(targetCountry);

    await db.query(
      `INSERT INTO secrets_metadata (
        secret_name,
        secret_type,
        created_at,
        last_rotated_at,
        expires_at,
        next_rotation_due,
        status,
        owner,
        scope,
        country,
        rotation_count,
        last_rotation_reason,
        metadata,
        created_by,
        updated_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      ON CONFLICT (secret_name) DO UPDATE SET
        last_rotated_at = EXCLUDED.last_rotated_at,
        expires_at = EXCLUDED.expires_at,
        next_rotation_due = EXCLUDED.next_rotation_due,
        status = EXCLUDED.status,
        rotation_count = EXCLUDED.rotation_count,
        last_rotation_reason = EXCLUDED.last_rotation_reason,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by`,
      [
        entry.secretName,
        entry.secretType,
        entry.createdAt || new Date(),
        entry.lastRotatedAt,
        entry.expiresAt,
        entry.nextRotationDue,
        entry.status || 'active',
        entry.owner,
        entry.scope,
        entry.country,
        entry.rotationCount || 0,
        entry.lastRotationReason,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.createdBy,
        entry.updatedBy,
      ]
    );
  } catch (error) {
    // Never throw - logging failures should not break the application
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      secretName: entry.secretName,
    }, 'Failed to upsert secret metadata');
  }
}

/**
 * Log a secret rotation event to the audit trail
 * @param country Country code (for database routing)
 * @param secretName Name of the rotated secret
 * @param rotatedBy Who performed the rotation
 * @param rotationReason Why it was rotated
 * @param oldSecretHash Hash of old secret (optional)
 * @param newSecretHash Hash of new secret (optional)
 * @param rotationMethod How it was rotated (manual, automatic, scheduled)
 */
export async function logSecretRotation(
  country: string | null,
  secretName: string,
  rotatedBy: string,
  rotationReason: string,
  oldSecretHash?: string,
  newSecretHash?: string,
  rotationMethod?: string,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const targetCountry = country || 'czech_republic';
    const db = getCoreDatabase(targetCountry);

    await db.query(
      `INSERT INTO secret_rotation_history (
        secret_name,
        rotated_at,
        rotated_by,
        rotation_reason,
        old_secret_hash,
        new_secret_hash,
        rotation_method,
        metadata
      ) VALUES (
        $1, NOW(), $2, $3, $4, $5, $6, $7
      )`,
      [
        secretName,
        rotatedBy,
        rotationReason,
        oldSecretHash,
        newSecretHash,
        rotationMethod || 'manual',
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    // Update secrets_metadata rotation count
    await db.query(
      `UPDATE secrets_metadata
       SET rotation_count = rotation_count + 1,
           last_rotated_at = NOW(),
           last_rotation_reason = $2,
           updated_at = NOW()
       WHERE secret_name = $1`,
      [secretName, rotationReason]
    );
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      secretName,
    }, 'Failed to log secret rotation');
  }
}

/**
 * Mark a system error as resolved
 * @param country Country code
 * @param errorId Error ID
 * @param resolvedBy Who resolved it
 */
export async function markErrorResolved(
  country: string,
  errorId: number,
  resolvedBy: string
): Promise<void> {
  try {
    const db = getCoreDatabase(country);

    await db.query(
      `UPDATE system_errors
       SET resolved = true,
           resolved_at = NOW(),
           resolved_by = $2
       WHERE id = $1`,
      [errorId, resolvedBy]
    );
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      errorId,
    }, 'Failed to mark error as resolved');
  }
}

/**
 * Get recent failed authentication attempts for a client IP
 * @param country Country code
 * @param clientIp Client IP address
 * @param minutesAgo Look back this many minutes
 * @returns Count of failed auth attempts
 */
export async function getRecentFailedAuthCount(
  country: string,
  clientIp: string,
  minutesAgo: number = 5
): Promise<number> {
  try {
    const db = getCoreDatabase(country);

    const result = await db.query(
      `SELECT COUNT(*) as count
       FROM api_access_log
       WHERE client_ip = $1
         AND status_code IN (401, 403)
         AND timestamp > NOW() - INTERVAL '${minutesAgo} minutes'`,
      [clientIp]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  } catch (error) {
    logger.warn({
      error: error instanceof Error ? error.message : String(error),
      clientIp,
    }, 'Failed to get failed auth count');
    return 0;
  }
}
