/**
 * Search Input Validation Middleware
 *
 * Enforces query parameter length limits and validates input
 * to prevent oversized queries and injection attempts.
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/** Maximum length for any single query string parameter value */
const MAX_QUERY_PARAM_LENGTH = 500;

/** Maximum length for the full query string */
const MAX_QUERY_STRING_LENGTH = 2000;

/** Maximum length for any single string value in the request body */
const MAX_BODY_STRING_LENGTH = 1000;

/** Maximum depth for nested filter objects */
const MAX_FILTER_DEPTH = 5;

/** Maximum number of countries in a single request */
const MAX_COUNTRIES = 50;

/** Pattern for valid country codes (lowercase alpha, 2-20 chars) */
const COUNTRY_CODE_PATTERN = /^[a-z_]{2,20}$/;

/** Pattern for valid sort field names (alphanumeric + underscore) */
const SORT_FIELD_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,50}$/;

/**
 * Check the depth of a nested object (to prevent deeply nested filter abuse).
 */
function objectDepth(obj: any, current: number = 0): number {
  if (current > MAX_FILTER_DEPTH) return current;
  if (obj === null || obj === undefined || typeof obj !== 'object') return current;

  let maxDepth = current;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const d = objectDepth(obj[key], current + 1);
      if (d > maxDepth) maxDepth = d;
    }
  }
  return maxDepth;
}

/**
 * Validate and enforce limits on string values within filters.
 * Truncates overly long strings.
 */
function sanitizeFilterStrings(obj: any): void {
  if (obj === null || obj === undefined || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string' && value.length > MAX_BODY_STRING_LENGTH) {
      obj[key] = value.substring(0, MAX_BODY_STRING_LENGTH);
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'string' && value[i].length > MAX_BODY_STRING_LENGTH) {
          value[i] = value[i].substring(0, MAX_BODY_STRING_LENGTH);
        } else if (typeof value[i] === 'object') {
          sanitizeFilterStrings(value[i]);
        }
      }
    } else if (typeof value === 'object') {
      sanitizeFilterStrings(value);
    }
  }
}

/**
 * Validation hook for search service requests.
 * Applied as a preHandler to enforce input limits.
 */
export async function searchValidatorHook(request: FastifyRequest, reply: FastifyReply) {
  // --- Query string validation (GET requests like /aggregations, /properties/:id) ---
  const rawQuery = request.url.split('?')[1] || '';
  if (rawQuery.length > MAX_QUERY_STRING_LENGTH) {
    request.log.warn({
      reason: 'query_string_too_long',
      length: rawQuery.length,
      max: MAX_QUERY_STRING_LENGTH,
      ip: request.ip,
    }, 'Rejected: query string exceeds maximum length');
    return reply.status(400).send({
      error: 'Query string exceeds maximum length',
      max_length: MAX_QUERY_STRING_LENGTH,
    });
  }

  // Check individual query parameter values
  const query = request.query as Record<string, string>;
  if (query && typeof query === 'object') {
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === 'string' && value.length > MAX_QUERY_PARAM_LENGTH) {
        request.log.warn({
          reason: 'query_param_too_long',
          param: key,
          length: value.length,
          max: MAX_QUERY_PARAM_LENGTH,
          ip: request.ip,
        }, 'Rejected: query parameter exceeds maximum length');
        return reply.status(400).send({
          error: `Query parameter '${key}' exceeds maximum length of ${MAX_QUERY_PARAM_LENGTH}`,
        });
      }
    }
  }

  // --- Body validation (POST requests like /search, /search/geo) ---
  if (request.method === 'POST' && request.body && typeof request.body === 'object') {
    const body = request.body as any;

    // Validate countries array
    if (Array.isArray(body.countries)) {
      if (body.countries.length > MAX_COUNTRIES) {
        return reply.status(400).send({
          error: `countries array exceeds maximum of ${MAX_COUNTRIES}`,
        });
      }

      for (const country of body.countries) {
        if (typeof country !== 'string' || (!COUNTRY_CODE_PATTERN.test(country) && country !== '*')) {
          return reply.status(400).send({
            error: 'Invalid country code format',
            message: 'Country codes must be 2-20 lowercase letters or underscores',
          });
        }
      }
    }

    // Validate sort field (prevent injection through sort field names)
    if (body.sort?.field && typeof body.sort.field === 'string') {
      if (!SORT_FIELD_PATTERN.test(body.sort.field)) {
        return reply.status(400).send({
          error: 'Invalid sort field',
          message: 'Sort field must be alphanumeric with underscores, max 50 chars',
        });
      }
    }

    // Validate filter depth
    if (body.filters) {
      const depth = objectDepth(body.filters);
      if (depth > MAX_FILTER_DEPTH) {
        return reply.status(400).send({
          error: 'Filter object exceeds maximum nesting depth',
          max_depth: MAX_FILTER_DEPTH,
        });
      }

      // Sanitize overly long string values in filters
      sanitizeFilterStrings(body.filters);
    }

    // Validate top-level page param
    if (body.page !== undefined) {
      const page = Number(body.page);
      if (isNaN(page) || !Number.isInteger(page) || page < 1 || page > 10_000) {
        return reply.status(400).send({
          error: 'page must be a positive integer (max 10000)',
        });
      }
    }

    // Validate top-level limit param
    if (body.limit !== undefined) {
      const limit = Number(body.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return reply.status(400).send({
          error: 'limit must be between 1 and 100',
        });
      }
    }

    // Validate sort_by preset
    if (body.sort_by !== undefined) {
      const validPresets = ['price_asc', 'price_desc', 'date_newest', 'date_oldest'];
      if (!validPresets.includes(body.sort_by)) {
        return reply.status(400).send({
          error: `sort_by must be one of: ${validPresets.join(', ')}`,
        });
      }
    }

    // Validate pagination limits (legacy)
    if (body.pagination) {
      if (body.pagination.limit !== undefined) {
        const limit = Number(body.pagination.limit);
        if (isNaN(limit) || limit < 1 || limit > 200) {
          return reply.status(400).send({
            error: 'pagination.limit must be between 1 and 200',
          });
        }
      }
      if (body.pagination.offset !== undefined) {
        const offset = Number(body.pagination.offset);
        if (isNaN(offset) || offset < 0 || offset > 100_000) {
          return reply.status(400).send({
            error: 'pagination.offset must be between 0 and 100000',
          });
        }
      }
    }
  }
}
