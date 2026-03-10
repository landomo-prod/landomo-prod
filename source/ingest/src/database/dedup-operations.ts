/**
 * Cross-Portal Property Deduplication Operations
 *
 * Detects and links duplicate property listings across different portals
 * using coordinate proximity + exact price matching.
 */

import { Pool, PoolClient } from 'pg';
import { dbLog } from '../logger';

// Valid partition table names (whitelist for SQL injection prevention)
const VALID_TABLES = new Set([
  'properties_apartment',
  'properties_house',
  'properties_land',
  'properties_commercial',
]);

export type PartitionTable =
  | 'properties_apartment'
  | 'properties_house'
  | 'properties_land'
  | 'properties_commercial';

export const PORTAL_PRIORITY: Record<string, number> = {
  'sreality': 1,
  'bezrealitky': 2,
  'idnes-reality': 3,
  'reality': 4,
  'ceskereality': 5,
  'ulovdomov': 6,
  'bazos': 7,
  'realingo': 8,
};

export interface DuplicateMatch {
  propertyId: string;
  portal: string;
  confidence: number;
  method: string;
}

export interface DuplicateLinkResult {
  canonicalId: string;
  duplicateId: string;
  confidence: number;
  method: string;
}

export interface PropertyForDedup {
  id: string;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  portal: string;
  portal_id: string;
  transaction_type: string | null;
}

function validateTable(table: string): asserts table is PartitionTable {
  if (!VALID_TABLES.has(table)) {
    throw new Error(`Invalid partition table: ${table}`);
  }
}

/**
 * Find potential duplicate properties using coordinate proximity + exact price.
 * Only matches against canonical properties (canonical_property_id IS NULL)
 * from different portals. Results sorted by portal priority.
 */
export async function findPotentialDuplicates(
  property: PropertyForDedup,
  table: PartitionTable,
  client: Pool | PoolClient
): Promise<DuplicateMatch[]> {
  validateTable(table);

  if (property.latitude == null || property.longitude == null || property.price == null) {
    return [];
  }

  try {
    const result = await client.query(
      `SELECT id, portal FROM ${table}
       WHERE id <> $1
         AND portal <> $2
         AND status = 'active'
         AND canonical_property_id IS NULL
         AND price = $3
         AND ($4::varchar IS NULL OR transaction_type = $4)
         AND ABS(latitude - $5) < 0.00045
         AND ABS(longitude - $6) < 0.00065
       ORDER BY
         CASE portal
           WHEN 'sreality' THEN 1
           WHEN 'bezrealitky' THEN 2
           WHEN 'idnes-reality' THEN 3
           WHEN 'reality' THEN 4
           WHEN 'ceskereality' THEN 5
           WHEN 'ulovdomov' THEN 6
           WHEN 'bazos' THEN 7
           WHEN 'realingo' THEN 8
           ELSE 9
         END
       LIMIT 10`,
      [
        property.id,
        property.portal,
        property.price,
        property.transaction_type,
        property.latitude,
        property.longitude,
      ]
    );

    return result.rows.map((row) => ({
      propertyId: row.id,
      portal: row.portal,
      confidence: 95,
      method: 'exact_coordinates_price',
    }));
  } catch (e) {
    dbLog.warn({ err: e, propertyId: property.id }, 'Dedup: coordinate match query failed');
    return [];
  }
}

/**
 * Link a duplicate property to its canonical version.
 * Sets canonical_property_id on the duplicate and inserts a record
 * into property_duplicates.
 */
export async function linkDuplicate(
  canonicalId: string,
  duplicateId: string,
  confidence: number,
  method: string,
  client: Pool | PoolClient
): Promise<DuplicateLinkResult> {
  // Set the canonical reference on the duplicate property
  await client.query(
    `UPDATE properties SET canonical_property_id = $1 WHERE id = $2`,
    [canonicalId, duplicateId]
  );

  // Insert the duplicate relationship record
  await client.query(
    `INSERT INTO property_duplicates (canonical_id, duplicate_id, confidence_score, match_method)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (canonical_id, duplicate_id) DO UPDATE SET
       confidence_score = GREATEST(property_duplicates.confidence_score, EXCLUDED.confidence_score),
       match_method = CASE
         WHEN EXCLUDED.confidence_score > property_duplicates.confidence_score
         THEN EXCLUDED.match_method
         ELSE property_duplicates.match_method
       END`,
    [canonicalId, duplicateId, confidence, method]
  );

  dbLog.info({
    canonicalId,
    duplicateId,
    confidence,
    method,
  }, 'Linked duplicate property');

  return { canonicalId, duplicateId, confidence, method };
}

/**
 * When a canonical property is removed, promote the next-best active
 * duplicate to become the new canonical for the cluster.
 */
export async function promoteNextCanonical(
  removedCanonicalId: string,
  table: PartitionTable,
  client: Pool | PoolClient
): Promise<string | null> {
  validateTable(table);

  // Find all duplicates linked to this canonical
  const dupsResult = await client.query(
    `SELECT duplicate_id, confidence_score FROM property_duplicates WHERE canonical_id = $1`,
    [removedCanonicalId]
  );

  if (dupsResult.rows.length === 0) {
    return null;
  }

  const duplicateIds = dupsResult.rows.map((r) => r.duplicate_id);

  // Find the best active duplicate by portal priority
  const bestResult = await client.query(
    `SELECT id, portal FROM ${table}
     WHERE id = ANY($1)
       AND status = 'active'
     ORDER BY
       CASE portal
         WHEN 'sreality' THEN 1
         WHEN 'bezrealitky' THEN 2
         WHEN 'idnes-reality' THEN 3
         WHEN 'reality' THEN 4
         WHEN 'ceskereality' THEN 5
         WHEN 'ulovdomov' THEN 6
         WHEN 'bazos' THEN 7
         WHEN 'realingo' THEN 8
         ELSE 9
       END
     LIMIT 1`,
    [duplicateIds]
  );

  if (bestResult.rows.length === 0) {
    // No active members left — cluster fully gone
    return null;
  }

  const newCanonicalId = bestResult.rows[0].id;

  // Promote: clear canonical_property_id on the new canonical
  await client.query(
    `UPDATE ${table} SET canonical_property_id = NULL WHERE id = $1`,
    [newCanonicalId]
  );

  // Re-point remaining duplicates to the new canonical
  await client.query(
    `UPDATE ${table} SET canonical_property_id = $1 WHERE canonical_property_id = $2 AND id <> $1`,
    [newCanonicalId, removedCanonicalId]
  );

  // Update property_duplicates table
  await client.query(
    `UPDATE property_duplicates SET canonical_id = $1 WHERE canonical_id = $2`,
    [newCanonicalId, removedCanonicalId]
  );

  // Remove the self-referencing record (new canonical pointing to itself)
  await client.query(
    `DELETE FROM property_duplicates WHERE canonical_id = $1 AND duplicate_id = $1`,
    [newCanonicalId]
  );

  // Add record linking the old canonical as a duplicate of the new one
  const avgConfidence = dupsResult.rows.reduce((sum, r) => sum + Number(r.confidence_score), 0) / dupsResult.rows.length;
  await client.query(
    `INSERT INTO property_duplicates (canonical_id, duplicate_id, confidence_score, match_method)
     VALUES ($1, $2, $3, 'cascade_promotion')
     ON CONFLICT (canonical_id, duplicate_id) DO NOTHING`,
    [newCanonicalId, removedCanonicalId, avgConfidence]
  );

  dbLog.info({
    removedCanonicalId,
    newCanonicalId,
    portal: bestResult.rows[0].portal,
    remainingMembers: duplicateIds.length,
  }, 'Promoted next canonical after removal');

  return newCanonicalId;
}

/**
 * Get the canonical property ID for a given property.
 * Returns the canonical ID if this property is a duplicate,
 * or the property's own ID if it is itself canonical.
 */
export async function getCanonicalProperty(
  propertyId: string,
  client: Pool | PoolClient
): Promise<string> {
  const result = await client.query(
    `SELECT canonical_property_id FROM properties WHERE id = $1`,
    [propertyId]
  );

  if (result.rows.length === 0) {
    return propertyId;
  }

  return result.rows[0].canonical_property_id || propertyId;
}
