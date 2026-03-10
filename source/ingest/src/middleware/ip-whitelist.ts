/**
 * IP Whitelist Middleware
 *
 * Optional IP-based access control. When IP_WHITELIST env var is set,
 * only requests from listed IPs/CIDRs are allowed through.
 * If not set, all IPs are allowed (whitelist disabled).
 *
 * Env var format: IP_WHITELIST="10.0.0.1,192.168.1.0/24,172.16.0.0/12"
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../logger';

/** Parsed CIDR entry */
interface CidrEntry {
  ip: number;
  mask: number;
}

/** Parse an IPv4 address string to a 32-bit integer */
function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) return 0;
  return parts.reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

/** Parse a CIDR string like "192.168.1.0/24" into ip + mask */
function parseCidr(cidr: string): CidrEntry | null {
  const trimmed = cidr.trim();
  if (!trimmed) return null;

  const slashIdx = trimmed.indexOf('/');
  if (slashIdx === -1) {
    // Single IP, treat as /32
    const ip = ipToInt(trimmed);
    return { ip, mask: 0xffffffff };
  }

  const ipStr = trimmed.substring(0, slashIdx);
  const prefix = parseInt(trimmed.substring(slashIdx + 1), 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

  const ip = ipToInt(ipStr);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return { ip: ip & mask, mask };
}

/** Check if an IP matches any CIDR entry */
function isIpAllowed(clientIp: string, entries: CidrEntry[]): boolean {
  // Handle IPv6-mapped IPv4 (::ffff:x.x.x.x)
  let ip = clientIp;
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Allow localhost always
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  const ipInt = ipToInt(ip);
  for (const entry of entries) {
    if ((ipInt & entry.mask) === entry.ip) {
      return true;
    }
  }
  return false;
}

// Parse whitelist at module load time
const rawWhitelist = process.env.IP_WHITELIST || '';
const whitelistEntries: CidrEntry[] = rawWhitelist
  .split(',')
  .map(parseCidr)
  .filter((e): e is CidrEntry => e !== null);

const whitelistEnabled = whitelistEntries.length > 0;

if (whitelistEnabled) {
  logger.info({ count: whitelistEntries.length }, 'IP whitelist enabled');
} else {
  logger.info('IP whitelist disabled (no IP_WHITELIST env var)');
}

/**
 * IP whitelist onRequest hook.
 * Skips health and metrics endpoints. Fails open if whitelist is not configured.
 */
export async function ipWhitelistHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!whitelistEnabled) return;

  // Always allow health and metrics
  if (request.url === '/api/v1/health' || request.url === '/metrics') {
    return;
  }

  const clientIp = request.ip;
  if (!isIpAllowed(clientIp, whitelistEntries)) {
    request.log.warn({ ip: clientIp, url: request.url }, 'Blocked by IP whitelist');
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'IP address not allowed',
    });
  }
}
