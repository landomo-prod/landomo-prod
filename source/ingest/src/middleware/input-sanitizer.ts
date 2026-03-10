/**
 * Input Sanitization Middleware
 *
 * Strips dangerous HTML/script content from string fields in ingested property data.
 * Validates source_url format. Logs rejected requests with reason.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/** Max allowed length for individual string fields in property data */
const MAX_STRING_FIELD_LENGTH = 10_000;

/** Max allowed length for description fields */
const MAX_DESCRIPTION_LENGTH = 50_000;

/** Max allowed number of properties in a bulk ingest */
const MAX_BULK_PROPERTIES = 5_000;

/** Pattern that matches script tags, event handlers, and javascript: URIs */
const DANGEROUS_PATTERN = /<script[\s>]|javascript:|on\w+\s*=/i;

/** Allowed URL schemes for source_url */
const ALLOWED_URL_SCHEMES = /^https?:\/\//i;

/**
 * Strip HTML tags from a string value.
 * Preserves the text content but removes all markup.
 */
function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Recursively sanitize all string values in an object.
 * - Strips HTML tags from strings
 * - Truncates strings exceeding max length
 * Returns true if any dangerous patterns were found and removed.
 */
function sanitizeObject(obj: any, path: string = ''): boolean {
  if (obj === null || obj === undefined) return false;
  if (typeof obj !== 'object') return false;

  let foundDangerous = false;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const fieldPath = path ? `${path}.${key}` : key;

    if (typeof value === 'string') {
      let sanitized = value;

      // Check for dangerous content and strip HTML only if found
      if (DANGEROUS_PATTERN.test(value)) {
        foundDangerous = true;
        sanitized = stripHtmlTags(value); // Only strip HTML if dangerous
      }

      // Enforce length limits
      const maxLen = key === 'description' ? MAX_DESCRIPTION_LENGTH : MAX_STRING_FIELD_LENGTH;
      if (sanitized.length > maxLen) {
        sanitized = sanitized.substring(0, maxLen);
      }

      obj[key] = sanitized;
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string') {
          let sanitized = value[i];

          // Only strip HTML if dangerous content detected
          if (DANGEROUS_PATTERN.test(value[i])) {
            foundDangerous = true;
            sanitized = stripHtmlTags(value[i]);
          }

          if (sanitized.length > MAX_STRING_FIELD_LENGTH) {
            sanitized = sanitized.substring(0, MAX_STRING_FIELD_LENGTH);
          }
          value[i] = sanitized;
        } else if (typeof value[i] === 'object') {
          if (sanitizeObject(value[i], `${fieldPath}[${i}]`)) {
            foundDangerous = true;
          }
        }
      }
    } else if (typeof value === 'object') {
      if (sanitizeObject(value, fieldPath)) {
        foundDangerous = true;
      }
    }
  }

  return foundDangerous;
}

/**
 * Validate source_url field if present.
 * Must be an http or https URL.
 */
function isValidSourceUrl(url: string): boolean {
  if (!ALLOWED_URL_SCHEMES.test(url)) {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitization hook for ingest routes.
 * Applied to POST /api/v1/properties/ingest and /bulk-ingest.
 */
export async function inputSanitizerHook(request: FastifyRequest, reply: FastifyReply) {
  // Only process POST requests to ingest endpoints
  if (request.method !== 'POST') return;
  if (!request.url.includes('/properties/ingest') && !request.url.includes('/properties/bulk-ingest')) {
    return;
  }

  const body = request.body as any;
  if (!body || typeof body !== 'object') return;

  // Validate bulk ingest array size
  if (request.url.includes('/bulk-ingest') && Array.isArray(body.properties)) {
    if (body.properties.length > MAX_BULK_PROPERTIES) {
      request.log.warn({
        reason: 'bulk_properties_limit_exceeded',
        count: body.properties.length,
        max: MAX_BULK_PROPERTIES,
        ip: request.ip,
      }, 'Rejected: bulk properties array exceeds maximum size');
      return reply.status(400).send({
        error: 'ValidationError',
        message: `Properties array exceeds maximum size of ${MAX_BULK_PROPERTIES}`,
      });
    }
  }

  // Validate source_url if present
  if (body.data?.source_url && !isValidSourceUrl(body.data.source_url)) {
    request.log.warn({
      reason: 'invalid_source_url',
      source_url: body.data.source_url.substring(0, 200),
      ip: request.ip,
    }, 'Rejected: invalid source_url format');
    return reply.status(400).send({
      error: 'ValidationError',
      message: 'source_url must be a valid HTTP or HTTPS URL',
    });
  }

  // For bulk ingest, validate source_url on each property
  if (Array.isArray(body.properties)) {
    for (let i = 0; i < body.properties.length; i++) {
      const prop = body.properties[i];
      if (prop?.data?.source_url && !isValidSourceUrl(prop.data.source_url)) {
        request.log.warn({
          reason: 'invalid_source_url',
          index: i,
          source_url: prop.data.source_url.substring(0, 200),
          ip: request.ip,
        }, 'Rejected: invalid source_url in bulk property');
        return reply.status(400).send({
          error: 'ValidationError',
          message: `properties[${i}].data.source_url must be a valid HTTP or HTTPS URL`,
        });
      }
    }
  }

  // Sanitize all string fields in the body
  const hadDangerous = sanitizeObject(body);

  if (hadDangerous) {
    request.log.warn({
      reason: 'dangerous_content_stripped',
      portal: body.portal,
      ip: request.ip,
    }, 'Stripped dangerous HTML/script content from ingest payload');
  }
}
