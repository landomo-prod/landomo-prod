/**
 * Security Logging Middleware
 *
 * Automatically logs all API requests to api_access_log table
 * for security monitoring, rate limiting detection, and audit trails.
 *
 * @module middleware/security-logger
 */

import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import {
  logApiAccess,
  hashApiKey,
  getApiKeyPrefix,
  getApiKeyVersion,
  ApiAccessLog,
} from '../utils/security-logger';
import { logger } from '../logger';
import { getInstanceCountry } from '../database/manager';

/**
 * Extract country from request
 * Tries multiple sources: params, query, headers, or falls back to instance country
 */
function extractCountry(req: FastifyRequest): string {
  const params = req.params as any;
  const query = req.query as any;

  return (
    params?.country ||
    query?.country ||
    req.headers['x-country'] ||
    getInstanceCountry()
  );
}

/**
 * Extract API key from request headers
 */
function extractApiKey(req: FastifyRequest): string | undefined {
  return req.headers['x-api-key'] as string | undefined;
}

/**
 * Get client IP from request
 * Checks X-Forwarded-For, X-Real-IP, and falls back to socket IP
 */
function getClientIp(req: FastifyRequest): string {
  const forwardedFor = req.headers['x-forwarded-for'] as string | undefined;
  if (forwardedFor) {
    // Take first IP if multiple proxies
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers['x-real-ip'] as string | undefined;
  if (realIp) {
    return realIp;
  }

  return req.socket.remoteAddress || 'unknown';
}

/**
 * Sanitize query parameters for logging
 * Removes sensitive data like API keys, passwords, tokens
 */
function sanitizeQueryParams(params: Record<string, any>): Record<string, any> {
  const sanitized = { ...params };
  const sensitiveKeys = ['api_key', 'apiKey', 'password', 'token', 'secret'];

  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      sanitized[key] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Security logging middleware - onRequest hook
 * Tracks request start time and metadata
 *
 * Usage in Fastify:
 * ```typescript
 * import { securityLoggerOnRequest, securityLoggerOnResponse } from './middleware/security-logger';
 * app.addHook('onRequest', securityLoggerOnRequest);
 * app.addHook('onResponse', securityLoggerOnResponse);
 * ```
 */
export async function securityLoggerOnRequest(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Skip logging for health checks to reduce noise
  if (req.url === '/health' || req.url === '/api/v1/health') {
    return;
  }

  // Store start time and metadata on request for later use
  (req as any).securityLogData = {
    startTime: Date.now(),
    country: extractCountry(req),
    clientIp: getClientIp(req),
    apiKey: extractApiKey(req),
    requestId: (req.headers['x-request-id'] as string) || undefined,
  };
}

/**
 * Security logging middleware - onResponse hook
 * Logs all API requests to api_access_log table after response is sent
 */
export async function securityLoggerOnResponse(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const logData = (req as any).securityLogData;

  // Skip if no log data (health checks, etc.)
  if (!logData) {
    return;
  }

  const responseTimeMs = Date.now() - logData.startTime;
  const statusCode = reply.statusCode;

  // Build log entry
  const logEntry: ApiAccessLog = {
    clientIp: logData.clientIp,
    endpoint: req.url,
    method: req.method,
    statusCode,
    responseTimeMs,
    country: logData.country,
    requestId: logData.requestId,
    userAgent: req.headers['user-agent'],
    referer: req.headers['referer'] as string | undefined,
  };

  // Add API key info if present
  if (logData.apiKey) {
    logEntry.apiKeyHash = hashApiKey(logData.apiKey);
    logEntry.apiKeyPrefix = getApiKeyPrefix(logData.apiKey);
    logEntry.apiKeyVersion = getApiKeyVersion(logData.apiKey);
  }

  // Add query params if present (sanitized)
  if (Object.keys(req.query as object).length > 0) {
    logEntry.queryParams = sanitizeQueryParams(req.query as Record<string, any>);
  }

  // Add error message for failed requests
  if (statusCode >= 400) {
    logEntry.errorMessage = `HTTP ${statusCode}`;
  }

  // Log to database (async, non-blocking)
  // Use setImmediate to avoid blocking response
  setImmediate(() => {
    logApiAccess(logData.country, logEntry).catch((error) => {
      logger.warn({
        error: error instanceof Error ? error.message : String(error),
        endpoint: req.url,
      }, 'Security logging failed');
    });
  });
}

/**
 * Enhanced security logger with additional features
 * Includes geographic anomaly detection, request pattern analysis, etc.
 *
 * This is an OPTIONAL enhanced version - use securityLoggerOnRequest/OnResponse for basic logging
 */
export async function enhancedSecurityLoggerOnResponse(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First, run the basic security logger
  await securityLoggerOnResponse(req, reply);

  // TODO: Add enhanced features
  // - Geographic anomaly detection (unusual country for API key)
  // - Request pattern analysis (detect automated attacks)
  // - Latency anomaly detection (slowloris attacks)
  // - Concurrent request limiting (connection pool exhaustion)
}

/**
 * Export compatibility wrapper (deprecated, use hooks directly)
 */
export const securityLoggerMiddleware = securityLoggerOnRequest;
export default securityLoggerOnRequest;
