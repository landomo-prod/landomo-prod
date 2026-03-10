/**
 * API Versioning Middleware
 * Adds API-Version, Sunset, and Deprecation headers to all responses.
 * Supports Accept header version negotiation (application/vnd.landomo.v1+json).
 */

import { FastifyRequest, FastifyReply } from 'fastify';

/** Supported API version definitions */
export interface ApiVersionInfo {
  version: string;
  status: 'current' | 'deprecated' | 'sunset';
  basePath: string;
  sunsetDate?: string;      // ISO 8601 date when this version will be removed
  deprecationDate?: string;  // ISO 8601 date when this version was deprecated
}

const VERSIONS: ApiVersionInfo[] = [
  { version: 'v1', status: 'current', basePath: '/api/v1' },
];

const CURRENT_VERSION = 'v1';

/** Vendor media type pattern: application/vnd.landomo.v{N}+json */
const VENDOR_MEDIA_TYPE_RE = /^application\/vnd\.landomo\.v(\d+)\+json$/;

/**
 * Parse API version from Accept header.
 * Returns version string (e.g. "v1") or null if not a vendor media type.
 */
function parseAcceptVersion(accept: string | undefined): string | null {
  if (!accept) return null;
  const match = accept.match(VENDOR_MEDIA_TYPE_RE);
  if (match) {
    return `v${match[1]}`;
  }
  return null;
}

/**
 * Find version info by version string.
 */
function findVersion(version: string): ApiVersionInfo | undefined {
  return VERSIONS.find((v) => v.version === version);
}

/**
 * onResponse hook: adds versioning headers to every response.
 */
export async function apiVersionOnResponse(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Determine which version the client requested (via Accept header or URL)
  const acceptVersion = parseAcceptVersion(request.headers.accept);
  const resolvedVersion = acceptVersion || CURRENT_VERSION;
  const versionInfo = findVersion(resolvedVersion) || findVersion(CURRENT_VERSION)!;

  reply.header('API-Version', versionInfo.version.replace('v', ''));

  // If the version is deprecated, add Deprecation header (RFC 8594)
  if (versionInfo.status === 'deprecated' && versionInfo.deprecationDate) {
    reply.header('Deprecation', versionInfo.deprecationDate);
  }

  // If the version has a sunset date, add Sunset header (RFC 8594)
  if (versionInfo.sunsetDate) {
    reply.header('Sunset', versionInfo.sunsetDate);
  }
}

/**
 * Returns all known API versions for the /api/versions endpoint.
 */
export function getApiVersions(): { versions: Array<{ version: string; status: string; base_path: string; sunset_date?: string; deprecation_date?: string }> } {
  return {
    versions: VERSIONS.map((v) => ({
      version: v.version,
      status: v.status,
      base_path: v.basePath,
      ...(v.sunsetDate && { sunset_date: v.sunsetDate }),
      ...(v.deprecationDate && { deprecation_date: v.deprecationDate }),
    })),
  };
}
