/**
 * Overpass Sync Service
 * Migrated from MongoDB to PostgreSQL/PostGIS
 * Downloads OSM administrative boundaries and saves to PostgreSQL
 */

import axios from 'axios';
import { polygon } from '@turf/helpers';
import booleanWithin from '@turf/boolean-within';
import { getDatabase } from '../database/manager';
import { config } from '../config';
import pino from 'pino';

const logger = pino({
  level: config.logging.level,
  base: { service: 'polygon-service', module: 'overpass-sync' },
});

// User agents for Overpass API requests
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

// OSM interfaces
interface OSMNode {
  type: string;
  id: number;
  lat: number;
  lon: number;
}

interface OSMWay {
  type: string;
  id: number;
  nodes: number[];
}

interface OSMRelation {
  type: string;
  id: number;
  members: Array<{
    type: string;
    ref: number;
    role: string;
  }>;
  tags: Record<string, string>;
}

interface OSMResponse {
  elements: (OSMNode | OSMWay | OSMRelation)[];
}

// GeoJSON types
type Point = [number, number];
type Ring = Point[];

export interface SyncAreasOptions {
  requestId?: string;
  country?: string; // ISO3166-1 code (default: CZ)
  adminLevels?: number[]; // Admin levels to fetch (default: [2,3,4,5,6,7,8,9,10,11,12])
  skipRecentlyUpdated?: boolean; // Skip areas updated within last month
}

export interface SyncAreasResult {
  success: boolean;
  savedCount: number;
  failedCount: number;
  skippedCount: number;
  errors: any[];
  duration: number;
}

interface RelationHierarchyData {
  relation: OSMRelation;
  adminLevel: number;
  childRelationIds: number[];
  parentRelationIds: number[];
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: any };
}

export class OverpassSyncService {
  private currentCountryCode: string = 'XX';

  private getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  private removeDuplicatePoints(coords: Point[]): Point[] {
    if (coords.length <= 1) return coords;
    const result = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const curr = coords[i];
      if (prev[0] !== curr[0] || prev[1] !== curr[1]) {
        result.push(curr);
      }
    }
    return result;
  }

  private isRingCCW(ring: Ring): boolean {
    if (ring.length < 3) return false;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      sum += (x2 - x1) * (y2 + y1);
    }
    return sum < 0;
  }

  private cleanRing(coords: Point[], isOuter: boolean): Ring {
    if (coords.length < 3) return [];

    let cleanedCoords = this.removeDuplicatePoints(coords);

    if (cleanedCoords.length < 3) return [];

    // Ensure ring is closed
    const first = cleanedCoords[0];
    const last = cleanedCoords[cleanedCoords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      cleanedCoords.push([first[0], first[1]]);
    }

    if (cleanedCoords.length < 4) return [];

    // Check and fix winding order
    const isCCW = this.isRingCCW(cleanedCoords);
    if ((isOuter && !isCCW) || (!isOuter && isCCW)) {
      cleanedCoords.reverse();
    }

    return cleanedCoords;
  }

  private assembleRings(
    allWays: OSMWay[],
    nodesMap: Record<number, OSMNode>,
    requestId?: string
  ): Ring[] {
    if (allWays.length === 0) return [];

    const assembledRings: Ring[] = [];
    const globallyUsedWays = new Set<number>();

    for (const startWay of allWays) {
      if (globallyUsedWays.has(startWay.id)) {
        continue;
      }

      let currentPathNodeIds = [...startWay.nodes];
      const waysInCurrentAttempt = new Set<number>();
      waysInCurrentAttempt.add(startWay.id);

      let pathExtendedInIteration = true;
      while (pathExtendedInIteration) {
        pathExtendedInIteration = false;

        if (currentPathNodeIds.length > 0 && currentPathNodeIds[0] === currentPathNodeIds[currentPathNodeIds.length - 1]) {
          break;
        }

        const firstNodeId = currentPathNodeIds[0];
        const lastNodeId = currentPathNodeIds[currentPathNodeIds.length - 1];

        for (const candidateWay of allWays) {
          if (waysInCurrentAttempt.has(candidateWay.id)) {
            continue;
          }

          const candidateWayNodes = candidateWay.nodes;
          if (candidateWayNodes.length === 0) continue;

          let connected = false;
          if (candidateWayNodes.length > 0 && candidateWayNodes[candidateWayNodes.length - 1] === firstNodeId) {
            currentPathNodeIds = [...candidateWayNodes.slice(0, -1), ...currentPathNodeIds];
            connected = true;
          } else if (candidateWayNodes.length > 0 && candidateWayNodes[0] === firstNodeId) {
            currentPathNodeIds = [...candidateWayNodes.slice(1).reverse(), ...currentPathNodeIds];
            connected = true;
          } else if (candidateWayNodes.length > 0 && candidateWayNodes[0] === lastNodeId) {
            currentPathNodeIds = [...currentPathNodeIds, ...candidateWayNodes.slice(1)];
            connected = true;
          } else if (candidateWayNodes.length > 0 && candidateWayNodes[candidateWayNodes.length - 1] === lastNodeId) {
            currentPathNodeIds = [...currentPathNodeIds, ...candidateWayNodes.slice(0, -1).reverse()];
            connected = true;
          }

          if (connected) {
            waysInCurrentAttempt.add(candidateWay.id);
            pathExtendedInIteration = true;
            break;
          }
        }
      }

      if (currentPathNodeIds.length > 1 && currentPathNodeIds[0] === currentPathNodeIds[currentPathNodeIds.length - 1]) {
        const coords: Point[] = [];
        let pathIsValid = true;
        for (const nodeId of currentPathNodeIds) {
          const node = nodesMap[nodeId];
          if (node) {
            coords.push([node.lon, node.lat]);
          } else {
            logger.error({ requestId, nodeId }, 'Node not found for a way');
            pathIsValid = false;
            break;
          }
        }

        if (pathIsValid && coords.length >= 4) {
          assembledRings.push(coords);
          waysInCurrentAttempt.forEach(id => globallyUsedWays.add(id));
        }
      }
    }

    return assembledRings;
  }

  private async saveAreaToDb(
    relationId: number,
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any },
    tags: Record<string, string>,
    requestId?: string,
    parentRelationId?: number | null,
    subRelationIds?: number[]
  ): Promise<void> {
    const db = getDatabase();

    try {
      const names: Record<string, string> = {};
      Object.keys(tags).forEach(key => {
        if (key.startsWith('name') || key.endsWith('name') || key === 'short_name' || key === 'official_name') {
          names[key] = tags[key];
        }
      });

      const name = tags.name || tags['name:en'] || tags['name:cs'] || `Area ${relationId}`;
      const adminLevel = tags.admin_level ? parseInt(tags.admin_level, 10) : null;

      // Convert GeoJSON to PostGIS geometry
      const geomGeoJSON = JSON.stringify(geometry);

      // Extract country code from options (passed down from sync call)
      const countryCode = this.currentCountryCode || 'XX';
      const boundaryType = tags.boundary || 'administrative';

      await db.query(`
        INSERT INTO boundaries (
          osm_relation_id, osm_type, name, admin_level, country_code,
          geometry_full, osm_tags, names, boundary_type
        ) VALUES ($1, $2, $3, $4, $5, ST_GeomFromGeoJSON($6), $7, $8, $9)
        ON CONFLICT (osm_relation_id)
        DO UPDATE SET
          geometry_full = EXCLUDED.geometry_full,
          name = EXCLUDED.name,
          admin_level = EXCLUDED.admin_level,
          osm_tags = EXCLUDED.osm_tags,
          names = EXCLUDED.names,
          boundary_type = EXCLUDED.boundary_type,
          last_updated_osm = NOW()
      `, [relationId, 'relation', name, adminLevel, countryCode, geomGeoJSON, JSON.stringify(tags), JSON.stringify(names), boundaryType]);

      logger.info({ requestId, relationId, name, adminLevel }, 'Saved area');
    } catch (error) {
      logger.error({ requestId, relationId, error }, 'Failed to save area');
      throw error;
    }
  }

  private extractHierarchyFromMembers(rel: OSMRelation): { childRelationIds: number[]; parentRelationIds: number[] } {
    const childRelationIds: number[] = [];
    const parentRelationIds: number[] = [];

    for (const member of rel.members) {
      if (member.type === 'relation') {
        if (member.role === 'subarea' || member.role === 'inner' || member.role === '' || member.role === 'admin_centre') {
          childRelationIds.push(member.ref);
        } else if (member.role === 'outer' || member.role === 'parent') {
          parentRelationIds.push(member.ref);
        }
      }
    }

    return { childRelationIds, parentRelationIds };
  }

  private determineParentByAdminLevel(
    relationId: number,
    adminLevel: number,
    allRelationsData: Map<number, RelationHierarchyData>
  ): number | null {
    // Look for relations with lower admin_level that contain this relation as a child
    for (const [potentialParentId, potentialParentData] of allRelationsData) {
      if (potentialParentData.adminLevel < adminLevel &&
        potentialParentData.childRelationIds.includes(relationId)) {
        return potentialParentId;
      }
    }

    // Look for containment by admin level hierarchy
    const expectedParentLevel = adminLevel - 1;
    if (expectedParentLevel >= 2) {
      for (const [potentialParentId, potentialParentData] of allRelationsData) {
        if (potentialParentData.adminLevel === expectedParentLevel) {
          return potentialParentId;
        }
      }
    }

    return null;
  }

  async sync(options: SyncAreasOptions = {}): Promise<SyncAreasResult> {
    const { requestId, country = 'CZ', adminLevels = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], skipRecentlyUpdated = true } = options;
    const startTime = Date.now();

    // Set country code for use in saveArea
    this.currentCountryCode = country;

    logger.info({ requestId, country, adminLevels }, 'Starting area synchronization');

    try {
      const db = getDatabase();

      // Load relation IDs to skip (updated within last month)
      const skipRelationIds = new Set<number>();

      if (skipRecentlyUpdated) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

        logger.info({ requestId, oneMonthAgo }, 'Loading recently updated areas to skip');

        const recentAreas = await db.query(`
          SELECT osm_relation_id, updated_at
          FROM boundaries
          WHERE updated_at > $1
        `, [oneMonthAgo]);

        recentAreas.rows.forEach(row => skipRelationIds.add(row.osm_relation_id));
        logger.info({ requestId, count: skipRelationIds.size }, 'Found areas to skip');
      }

      let totalSavedCount = 0;
      let totalFailedCount = 0;
      const allErrorDetails: any[] = [];

      const allRelationsData = new Map<number, RelationHierarchyData>();
      const nodesMap: Record<number, OSMNode> = {};
      const waysMap: Record<number, OSMWay> = {};

      logger.info({ requestId }, 'Phase 1: Collecting relation data');

      // First pass: Collect all relation data
      for (const adminLevel of adminLevels) {
        logger.info({ requestId, adminLevel }, 'Fetching admin relations');

        const overpassQuery = `
          [out:json][timeout:${config.overpass.timeout}];
          area["ISO3166-1"="${country}"][admin_level=2]->.country;
          relation(area.country)[admin_level=${adminLevel}];
          out body;
          >;
          out skel qt;
        `;

        try {
          // Retry with exponential backoff for 429 (rate-limit) and 5xx responses
          const MAX_RETRIES = 3;
          let osmData: OSMResponse | undefined;
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const userAgent = this.getRandomUserAgent();
              const response = await axios.post<OSMResponse>(
                config.overpass.apiUrl,
                overpassQuery,
                {
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': userAgent
                  },
                  timeout: config.overpass.timeout * 1000,
                }
              );
              osmData = response.data;
              break;
            } catch (retryErr: any) {
              const status = retryErr?.response?.status;
              const isRetryable = status === 429 || (status >= 500 && status < 600) || !status;
              if (isRetryable && attempt < MAX_RETRIES) {
                const delayMs = Math.min(60000, 5000 * Math.pow(2, attempt - 1));
                logger.warn({ requestId, adminLevel, attempt, status, delayMs }, 'Overpass request failed, retrying');
                await new Promise(resolve => setTimeout(resolve, delayMs));
              } else {
                throw retryErr;
              }
            }
          }
          if (!osmData) throw new Error('No data returned from Overpass after retries');

          logger.info({ requestId, adminLevel, elements: osmData.elements.length }, 'Fetched elements');

          const relationsList: OSMRelation[] = [];

          for (const el of osmData.elements) {
            if (el.type === 'node') nodesMap[el.id] = el as OSMNode;
            else if (el.type === 'way') waysMap[el.id] = el as OSMWay;
            else if (el.type === 'relation') relationsList.push(el as OSMRelation);
          }

          for (const rel of relationsList) {
            const relationId = rel.id;
            const currentRelAdminLevel = rel.tags.admin_level ? parseInt(rel.tags.admin_level, 10) : undefined;

            if (currentRelAdminLevel !== adminLevel) {
              continue;
            }

            if (skipRelationIds.has(relationId)) {
              continue;
            }

            const { childRelationIds, parentRelationIds } = this.extractHierarchyFromMembers(rel);

            allRelationsData.set(relationId, {
              relation: rel,
              adminLevel: currentRelAdminLevel,
              childRelationIds,
              parentRelationIds
            });
          }

          logger.info({ requestId, adminLevel, relations: relationsList.length }, 'Processed admin level');

        } catch (apiError) {
          logger.error({ requestId, adminLevel, error: apiError }, 'Failed to fetch data');
          allErrorDetails.push({ adminLevel, error: String(apiError) });
          totalFailedCount++;
        }
      }

      logger.info({ requestId, totalRelations: allRelationsData.size }, 'Phase 2: Processing geometries');

      let processedCount = 0;
      const skippedCount = skipRelationIds.size;

      for (const [relationId, relationData] of allRelationsData) {
        processedCount++;
        if (processedCount % 10 === 0) {
          const elapsedTime = Date.now() - startTime;
          logger.info({ requestId, processedCount, total: allRelationsData.size, elapsedMs: elapsedTime }, 'Progress');
        }

        try {
          const { relation: rel, adminLevel, childRelationIds } = relationData;

          const parentRelationId = this.determineParentByAdminLevel(relationId, adminLevel, allRelationsData);

          const outerWays: OSMWay[] = [];
          const innerWays: OSMWay[] = [];

          for (const member of rel.members) {
            if (member.type === 'way') {
              const way = waysMap[member.ref];
              if (way) {
                if (member.role === 'outer') outerWays.push(way);
                else if (member.role === 'inner') innerWays.push(way);
              }
            }
          }

          if (outerWays.length === 0) {
            logger.error({ requestId, relationId }, 'No outer ways');
            totalFailedCount++;
            allErrorDetails.push({ relationId, adminLevel, error: 'No outer ways' });
            continue;
          }

          const rawOuterRings = this.assembleRings(outerWays, nodesMap, requestId);
          const outerGeoRings = rawOuterRings.map(ring => this.cleanRing(ring, true)).filter(r => r.length > 0);

          const rawInnerRings = this.assembleRings(innerWays, nodesMap, requestId);
          const innerGeoRings = rawInnerRings.map(ring => this.cleanRing(ring, false)).filter(r => r.length > 0);

          if (outerGeoRings.length === 0) {
            logger.error({ requestId, relationId }, 'No valid outer rings');
            totalFailedCount++;
            allErrorDetails.push({ relationId, adminLevel, error: 'No valid outer rings' });
            continue;
          }

          let geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any };

          const assignInnerRings = (outerRings: Ring[], innerRings: Ring[]): any[] => {
            const result: any[] = outerRings.map(outer => [outer]);

            for (const inner of innerRings) {
              let assigned = false;
              for (let i = 0; i < outerRings.length; i++) {
                const outerPolygon = polygon([outerRings[i]]);
                const innerPolygon = polygon([inner]);

                if (booleanWithin(innerPolygon, outerPolygon)) {
                  result[i].push(inner);
                  assigned = true;
                  break;
                }
              }

              if (!assigned) {
                logger.warn({ requestId }, 'Inner ring not assigned');
              }
            }

            return result;
          };

          if (outerGeoRings.length === 1) {
            geometry = {
              type: 'Polygon',
              coordinates: [outerGeoRings[0], ...innerGeoRings]
            };
          } else {
            const multiPolygonCoordinates = assignInnerRings(outerGeoRings, innerGeoRings);
            geometry = {
              type: 'MultiPolygon',
              coordinates: multiPolygonCoordinates
            };
          }

          await this.saveAreaToDb(relationId, geometry, rel.tags, requestId, parentRelationId, childRelationIds);
          totalSavedCount++;

        } catch (error) {
          totalFailedCount++;
          logger.error({ requestId, relationId, error }, 'Error processing relation');
          allErrorDetails.push({ relationId, error: String(error) });
        }
      }

      const duration = Date.now() - startTime;

      logger.info({
        requestId,
        saved: totalSavedCount,
        failed: totalFailedCount,
        skipped: skippedCount,
        durationMs: duration
      }, 'Area synchronization complete');

      return {
        success: true,
        savedCount: totalSavedCount,
        failedCount: totalFailedCount,
        skippedCount,
        errors: allErrorDetails,
        duration
      };

    } catch (error) {
      logger.error({ requestId, error }, 'Fatal error during sync');

      return {
        success: false,
        savedCount: 0,
        failedCount: 1,
        skippedCount: 0,
        errors: [{ error: String(error) }],
        duration: Date.now() - startTime
      };
    }
  }
}
