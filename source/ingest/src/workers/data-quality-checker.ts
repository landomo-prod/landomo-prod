/**
 * Data Quality Checker Worker
 * Scheduled BullMQ job that runs data quality checks every 6 hours.
 * Computes per-portal quality metrics, detects duplicates, price outliers,
 * field completion rates, scraper staleness, and applies automated cleansing.
 */

import { Queue, Worker } from 'bullmq';
import { Pool } from 'pg';
import { config } from '../config';
import { getCoreDatabase } from '../database/manager';
import {
  dataQualityScore,
  missingPricePct,
  missingCoordinatesPct,
  missingImagesPct,
  suspiciousPricePct,
  scraperFreshnessHours,
  updatedLast7dPct,
  errorsTotal,
} from '../metrics';
import { dataQualityLog } from '../logger';

const QUEUE_NAME = `data-quality-check-${config.instance.country}`;

interface DataQualityJobData {
  country: string;
}

interface PortalQualityResult {
  portal: string;
  total_properties: number;
  active_properties: number;
  missing_price_pct: number;
  missing_coordinates_pct: number;
  missing_images_pct: number;
  suspicious_price_pct: number;
  updated_last_7d_pct: number;
  oldest_listing_days: number | null;
  newest_listing_age_hours: number | null;
  quality_score: number;
}

interface DuplicateReport {
  portal: string;
  duplicate_count: number;
  cross_portal_duplicate_count: number;
}

interface PriceOutlierReport {
  portal: string;
  property_category: string;
  transaction_type: string;
  mean_price: number;
  stddev_price: number;
  outlier_count: number;
  outlier_pct: number;
}

interface FieldCompletionReport {
  portal: string;
  property_category: string;
  field_name: string;
  total_count: number;
  filled_count: number;
  completion_pct: number;
}

interface ScraperAlert {
  portal: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metadata: Record<string, any>;
}

interface CleansingAction {
  property_id: string;
  portal: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  cleansing_rule: string;
}

// --- Core quality computation (unchanged) ---

async function computePortalQuality(pool: Pool): Promise<PortalQualityResult[]> {
  const result = await pool.query<{
    portal: string;
    total_properties: string;
    active_properties: string;
    missing_price: string;
    missing_coordinates: string;
    missing_images: string;
    suspicious_price: string;
    updated_last_7d: string;
    oldest_listing_days: string | null;
    newest_listing_age_hours: string | null;
  }>(`
    SELECT
      portal,
      COUNT(*)::integer AS total_properties,
      COUNT(*) FILTER (WHERE status = 'active')::integer AS active_properties,
      COUNT(*) FILTER (WHERE status = 'active' AND (price IS NULL OR price = 0))::integer AS missing_price,
      COUNT(*) FILTER (WHERE status = 'active' AND (latitude IS NULL OR longitude IS NULL))::integer AS missing_coordinates,
      COUNT(*) FILTER (WHERE status = 'active' AND (images IS NULL OR images = '[]'::jsonb OR images = '[]'))::integer AS missing_images,
      COUNT(*) FILTER (WHERE status = 'active' AND price IS NOT NULL AND (price <= 1 OR price > 100000000))::integer AS suspicious_price,
      COUNT(*) FILTER (WHERE status = 'active' AND updated_at >= NOW() - INTERVAL '7 days')::integer AS updated_last_7d,
      EXTRACT(day FROM NOW() - MIN(created_at) FILTER (WHERE status = 'active'))::integer AS oldest_listing_days,
      EXTRACT(epoch FROM NOW() - MAX(updated_at) FILTER (WHERE status = 'active'))::numeric / 3600 AS newest_listing_age_hours
    FROM properties
    GROUP BY portal
    HAVING COUNT(*) > 0
    ORDER BY portal
  `);

  return result.rows.map((row) => {
    const active = parseInt(row.active_properties, 10) || 0;
    const missingPricePctVal = active > 0 ? (parseInt(row.missing_price, 10) / active) * 100 : 0;
    const missingCoordPctVal = active > 0 ? (parseInt(row.missing_coordinates, 10) / active) * 100 : 0;
    const missingImgPctVal = active > 0 ? (parseInt(row.missing_images, 10) / active) * 100 : 0;
    const suspPricePctVal = active > 0 ? (parseInt(row.suspicious_price, 10) / active) * 100 : 0;
    const updatedPctVal = active > 0 ? (parseInt(row.updated_last_7d, 10) / active) * 100 : 0;

    const priceScore = 100 - missingPricePctVal;
    const coordScore = 100 - missingCoordPctVal;
    const imageScore = 100 - missingImgPctVal;
    const validityScore = 100 - suspPricePctVal;
    const freshnessScore = updatedPctVal;

    const qualityScore = Math.max(0, Math.min(100,
      priceScore * 0.30 +
      coordScore * 0.25 +
      imageScore * 0.15 +
      validityScore * 0.15 +
      freshnessScore * 0.15
    ));

    return {
      portal: row.portal,
      total_properties: parseInt(row.total_properties, 10),
      active_properties: active,
      missing_price_pct: Math.round(missingPricePctVal * 100) / 100,
      missing_coordinates_pct: Math.round(missingCoordPctVal * 100) / 100,
      missing_images_pct: Math.round(missingImgPctVal * 100) / 100,
      suspicious_price_pct: Math.round(suspPricePctVal * 100) / 100,
      updated_last_7d_pct: Math.round(updatedPctVal * 100) / 100,
      oldest_listing_days: row.oldest_listing_days ? parseInt(row.oldest_listing_days, 10) : null,
      newest_listing_age_hours: row.newest_listing_age_hours ? Math.round(parseFloat(row.newest_listing_age_hours) * 100) / 100 : null,
      quality_score: Math.round(qualityScore * 100) / 100,
    };
  });
}

// --- Duplicate detection report ---

async function computeDuplicateReport(pool: Pool): Promise<DuplicateReport[]> {
  try {
    const result = await pool.query(`
      SELECT
        p.portal,
        COUNT(*) FILTER (WHERE p.canonical_property_id IS NOT NULL)::integer AS duplicate_count,
        COUNT(*) FILTER (
          WHERE p.canonical_property_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM properties p2
            WHERE p2.id = p.canonical_property_id AND p2.portal <> p.portal
          )
        )::integer AS cross_portal_duplicate_count
      FROM properties p
      WHERE p.status = 'active'
      GROUP BY p.portal
      ORDER BY p.portal
    `);
    return result.rows.map(r => ({
      portal: r.portal,
      duplicate_count: parseInt(r.duplicate_count, 10),
      cross_portal_duplicate_count: parseInt(r.cross_portal_duplicate_count, 10),
    }));
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Duplicate report query failed (canonical_property_id column may not exist)');
    return [];
  }
}

// --- Price outlier detection (>3 stddev from mean) ---

async function computePriceOutliers(pool: Pool): Promise<PriceOutlierReport[]> {
  try {
    const result = await pool.query(`
      WITH stats AS (
        SELECT
          portal,
          property_category,
          transaction_type,
          AVG(price) AS mean_price,
          STDDEV_POP(price) AS stddev_price,
          COUNT(*) AS total
        FROM properties
        WHERE status = 'active'
          AND price IS NOT NULL AND price > 0
          AND property_category IS NOT NULL
        GROUP BY portal, property_category, transaction_type
        HAVING COUNT(*) >= 10 AND STDDEV_POP(price) > 0
      )
      SELECT
        s.portal,
        s.property_category,
        s.transaction_type,
        s.mean_price,
        s.stddev_price,
        COUNT(p.id)::integer AS outlier_count,
        s.total
      FROM stats s
      JOIN properties p ON p.portal = s.portal
        AND p.property_category = s.property_category
        AND p.transaction_type = s.transaction_type
        AND p.status = 'active'
        AND p.price IS NOT NULL
        AND ABS(p.price - s.mean_price) > 3 * s.stddev_price
      GROUP BY s.portal, s.property_category, s.transaction_type,
               s.mean_price, s.stddev_price, s.total
      ORDER BY s.portal, s.property_category
    `);
    return result.rows.map(r => ({
      portal: r.portal,
      property_category: r.property_category,
      transaction_type: r.transaction_type,
      mean_price: Math.round(parseFloat(r.mean_price) * 100) / 100,
      stddev_price: Math.round(parseFloat(r.stddev_price) * 100) / 100,
      outlier_count: parseInt(r.outlier_count, 10),
      outlier_pct: Math.round((parseInt(r.outlier_count, 10) / parseInt(r.total, 10)) * 10000) / 100,
    }));
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Price outlier query failed');
    return [];
  }
}

// --- Field completion rates ---

const TRACKED_FIELDS: Record<string, string[]> = {
  apartment: [
    'price', 'city', 'latitude', 'longitude', 'images', 'description',
    'apt_bedrooms', 'apt_sqm', 'apt_floor', 'apt_has_elevator',
    'apt_has_balcony', 'apt_has_parking', 'apt_has_basement',
    'condition', 'heating_type', 'furnished', 'construction_type',
  ],
  house: [
    'price', 'city', 'latitude', 'longitude', 'images', 'description',
    'house_bedrooms', 'house_sqm_living', 'house_sqm_plot',
    'house_has_garden', 'house_has_garage', 'house_has_parking', 'house_has_basement',
    'condition', 'heating_type', 'construction_type',
  ],
  land: [
    'price', 'city', 'latitude', 'longitude', 'images', 'description',
    'land_area_plot_sqm', 'land_zoning',
    'land_water_supply', 'land_sewage', 'land_electricity',
  ],
  commercial: [
    'price', 'city', 'latitude', 'longitude', 'images', 'description',
    'comm_sqm_total', 'comm_has_elevator', 'comm_has_parking',
    'comm_property_subtype', 'comm_monthly_rent',
  ],
};

async function computeFieldCompletion(pool: Pool): Promise<FieldCompletionReport[]> {
  const reports: FieldCompletionReport[] = [];

  for (const [category, fields] of Object.entries(TRACKED_FIELDS)) {
    const caseClauses = fields.map((f, i) => {
      if (f === 'images') {
        return `COUNT(*) FILTER (WHERE images IS NOT NULL AND images <> '[]'::jsonb AND images <> '[]') AS filled_${i}`;
      }
      if (f === 'description') {
        return `COUNT(*) FILTER (WHERE description IS NOT NULL AND description <> '') AS filled_${i}`;
      }
      return `COUNT(*) FILTER (WHERE ${f} IS NOT NULL) AS filled_${i}`;
    });

    try {
      const result = await pool.query(`
        SELECT
          portal,
          COUNT(*) AS total,
          ${caseClauses.join(',\n          ')}
        FROM properties
        WHERE status = 'active' AND property_category = $1
        GROUP BY portal
        HAVING COUNT(*) > 0
      `, [category]);

      for (const row of result.rows) {
        const total = parseInt(row.total, 10);
        fields.forEach((field, i) => {
          const filled = parseInt(row[`filled_${i}`], 10);
          reports.push({
            portal: row.portal,
            property_category: category,
            field_name: field,
            total_count: total,
            filled_count: filled,
            completion_pct: Math.round((filled / total) * 10000) / 100,
          });
        });
      }
    } catch (e) {
      dataQualityLog.warn({ err: e, category }, 'Field completion query failed');
    }
  }

  return reports;
}

// --- Scraper staleness alerts ---

async function computeScraperAlerts(
  pool: Pool,
  portalResults: PortalQualityResult[],
  priceOutliers: PriceOutlierReport[]
): Promise<ScraperAlert[]> {
  const alerts: ScraperAlert[] = [];

  // Check scrape_runs for portals that haven't run in 24h
  try {
    const result = await pool.query(`
      SELECT
        portal,
        MAX(completed_at) AS last_completed,
        EXTRACT(epoch FROM NOW() - MAX(completed_at)) / 3600 AS hours_since
      FROM scrape_runs
      WHERE status = 'completed'
      GROUP BY portal
      HAVING EXTRACT(epoch FROM NOW() - MAX(completed_at)) / 3600 > 24
      ORDER BY hours_since DESC
    `);

    for (const row of result.rows) {
      const hours = Math.round(parseFloat(row.hours_since) * 10) / 10;
      const severity = hours > 72 ? 'critical' : hours > 48 ? 'warning' : 'info';
      alerts.push({
        portal: row.portal,
        alert_type: 'scraper_stale',
        severity,
        message: `Scraper for ${row.portal} has not completed a run in ${hours} hours`,
        metadata: { hours_since_last_run: hours, last_completed: row.last_completed },
      });
    }
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Scraper staleness query failed');
  }

  // Quality drop alerts
  for (const r of portalResults) {
    if (r.quality_score < 50) {
      alerts.push({
        portal: r.portal,
        alert_type: 'quality_drop',
        severity: 'critical',
        message: `Quality score for ${r.portal} is critically low: ${r.quality_score}`,
        metadata: { quality_score: r.quality_score, active_properties: r.active_properties },
      });
    } else if (r.quality_score < 70) {
      alerts.push({
        portal: r.portal,
        alert_type: 'quality_drop',
        severity: 'warning',
        message: `Quality score for ${r.portal} is below threshold: ${r.quality_score}`,
        metadata: { quality_score: r.quality_score, active_properties: r.active_properties },
      });
    }
  }

  // High outlier alerts
  for (const o of priceOutliers) {
    if (o.outlier_pct > 10) {
      alerts.push({
        portal: o.portal,
        alert_type: 'high_outliers',
        severity: 'warning',
        message: `${o.portal} has ${o.outlier_pct}% price outliers in ${o.property_category}/${o.transaction_type}`,
        metadata: { outlier_pct: o.outlier_pct, outlier_count: o.outlier_count, category: o.property_category },
      });
    }
  }

  return alerts;
}

// --- Automated data cleansing ---

async function runDataCleansing(pool: Pool): Promise<CleansingAction[]> {
  const actions: CleansingAction[] = [];

  // 1. Trim whitespace from titles
  try {
    const trimResult = await pool.query(`
      UPDATE properties
      SET title = TRIM(BOTH FROM title), updated_at = NOW()
      WHERE status = 'active'
        AND (title <> TRIM(BOTH FROM title))
      RETURNING id, portal, title AS new_value
    `);
    for (const row of trimResult.rows) {
      actions.push({
        property_id: row.id,
        portal: row.portal,
        field_name: 'title',
        old_value: null,
        new_value: row.new_value,
        cleansing_rule: 'trim_whitespace',
      });
    }
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Title trim cleansing failed');
  }

  // 2. Normalize currency to uppercase
  try {
    const currResult = await pool.query(`
      UPDATE properties
      SET currency = UPPER(currency), updated_at = NOW()
      WHERE status = 'active'
        AND currency <> UPPER(currency)
      RETURNING id, portal, currency AS new_value
    `);
    for (const row of currResult.rows) {
      actions.push({
        property_id: row.id,
        portal: row.portal,
        field_name: 'currency',
        old_value: null,
        new_value: row.new_value,
        cleansing_rule: 'uppercase_currency',
      });
    }
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Currency normalization failed');
  }

  // 3. Fix negative prices (set to absolute value)
  try {
    const negResult = await pool.query(`
      UPDATE properties
      SET price = ABS(price), updated_at = NOW()
      WHERE status = 'active'
        AND price < 0
      RETURNING id, portal, price AS new_value
    `);
    for (const row of negResult.rows) {
      actions.push({
        property_id: row.id,
        portal: row.portal,
        field_name: 'price',
        old_value: null,
        new_value: String(row.new_value),
        cleansing_rule: 'fix_negative_price',
      });
    }
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Negative price fix failed');
  }

  // 4. Trim city names
  try {
    const cityResult = await pool.query(`
      UPDATE properties
      SET city = TRIM(BOTH FROM city), updated_at = NOW()
      WHERE status = 'active'
        AND city IS NOT NULL
        AND city <> TRIM(BOTH FROM city)
      RETURNING id, portal, city AS new_value
    `);
    for (const row of cityResult.rows) {
      actions.push({
        property_id: row.id,
        portal: row.portal,
        field_name: 'city',
        old_value: null,
        new_value: row.new_value,
        cleansing_rule: 'trim_whitespace',
      });
    }
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'City trim cleansing failed');
  }

  return actions;
}

// --- Storage functions ---

async function storeSnapshots(
  pool: Pool,
  country: string,
  snapshotGroupId: string,
  results: PortalQualityResult[]
): Promise<void> {
  if (results.length === 0) return;

  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const r of results) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(
      country, r.portal, r.total_properties, r.active_properties,
      r.missing_price_pct, r.missing_coordinates_pct, r.missing_images_pct,
      r.suspicious_price_pct, r.updated_last_7d_pct,
      r.oldest_listing_days, r.quality_score, snapshotGroupId
    );
  }

  await pool.query(`
    INSERT INTO data_quality_snapshots (
      country, portal, total_properties, active_properties,
      missing_price_pct, missing_coordinates_pct, missing_images_pct,
      suspicious_price_pct, updated_last_7d_pct,
      oldest_listing_days, quality_score, snapshot_group_id
    ) VALUES ${placeholders.join(', ')}
  `, values);
}

async function storeDuplicateReport(
  pool: Pool,
  snapshotGroupId: string,
  reports: DuplicateReport[]
): Promise<void> {
  if (reports.length === 0) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const r of reports) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(snapshotGroupId, r.portal, r.duplicate_count, r.cross_portal_duplicate_count);
  }

  try {
    await pool.query(`
      INSERT INTO data_quality_duplicates (snapshot_id, portal, duplicate_count, cross_portal_duplicate_count)
      VALUES ${placeholders.join(', ')}
    `, values);
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Failed to store duplicate report (table may not exist yet)');
  }
}

async function storePriceOutliers(
  pool: Pool,
  snapshotGroupId: string,
  outliers: PriceOutlierReport[]
): Promise<void> {
  if (outliers.length === 0) return;
  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const o of outliers) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(snapshotGroupId, o.portal, o.property_category, o.transaction_type,
      o.mean_price, o.stddev_price, o.outlier_count, o.outlier_pct);
  }

  try {
    await pool.query(`
      INSERT INTO data_quality_price_outliers (
        snapshot_id, portal, property_category, transaction_type,
        mean_price, stddev_price, outlier_count, outlier_pct
      ) VALUES ${placeholders.join(', ')}
    `, values);
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Failed to store price outliers (table may not exist yet)');
  }
}

async function storeFieldCompletion(
  pool: Pool,
  snapshotGroupId: string,
  reports: FieldCompletionReport[]
): Promise<void> {
  if (reports.length === 0) return;

  // Batch in chunks of 100 to avoid parameter limit
  const chunkSize = 100;
  for (let i = 0; i < reports.length; i += chunkSize) {
    const chunk = reports.slice(i, i + chunkSize);
    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const r of chunk) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(snapshotGroupId, r.portal, r.property_category, r.field_name,
        r.total_count, r.filled_count, r.completion_pct);
    }

    try {
      await pool.query(`
        INSERT INTO data_quality_field_completion (
          snapshot_id, portal, property_category, field_name,
          total_count, filled_count, completion_pct
        ) VALUES ${placeholders.join(', ')}
      `, values);
    } catch (e) {
      dataQualityLog.warn({ err: e }, 'Failed to store field completion (table may not exist yet)');
    }
  }
}

async function storeAlerts(pool: Pool, alerts: ScraperAlert[]): Promise<void> {
  if (alerts.length === 0) return;

  // Auto-resolve old alerts of same type/portal before inserting new ones
  const portalTypes = [...new Set(alerts.map(a => `${a.portal}::${a.alert_type}`))];
  for (const pt of portalTypes) {
    const [portal, alertType] = pt.split('::');
    try {
      await pool.query(`
        UPDATE data_quality_scraper_alerts
        SET resolved_at = NOW()
        WHERE portal = $1 AND alert_type = $2 AND resolved_at IS NULL
      `, [portal, alertType]);
    } catch {
      // table may not exist yet
    }
  }

  const values: any[] = [];
  const placeholders: string[] = [];
  let idx = 1;

  for (const a of alerts) {
    placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(a.portal, a.alert_type, a.severity, a.message, JSON.stringify(a.metadata));
  }

  try {
    await pool.query(`
      INSERT INTO data_quality_scraper_alerts (portal, alert_type, severity, message, metadata)
      VALUES ${placeholders.join(', ')}
    `, values);
  } catch (e) {
    dataQualityLog.warn({ err: e }, 'Failed to store alerts (table may not exist yet)');
  }
}

async function storeCleansingLog(pool: Pool, actions: CleansingAction[]): Promise<void> {
  if (actions.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < actions.length; i += chunkSize) {
    const chunk = actions.slice(i, i + chunkSize);
    const values: any[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const a of chunk) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(a.property_id, a.portal, a.field_name, a.old_value, a.new_value, a.cleansing_rule);
    }

    try {
      await pool.query(`
        INSERT INTO data_quality_cleansing_log (property_id, portal, field_name, old_value, new_value, cleansing_rule)
        VALUES ${placeholders.join(', ')}
      `, values);
    } catch (e) {
      dataQualityLog.warn({ err: e }, 'Failed to store cleansing log (table may not exist yet)');
    }
  }
}

// --- Metrics ---

function updateMetrics(country: string, results: PortalQualityResult[]): void {
  for (const r of results) {
    const labels = { country, portal: r.portal };
    dataQualityScore.set(labels, r.quality_score);
    missingPricePct.set(labels, r.missing_price_pct);
    missingCoordinatesPct.set(labels, r.missing_coordinates_pct);
    missingImagesPct.set(labels, r.missing_images_pct);
    suspiciousPricePct.set(labels, r.suspicious_price_pct);
    updatedLast7dPct.set(labels, r.updated_last_7d_pct);
    if (r.newest_listing_age_hours !== null) {
      scraperFreshnessHours.set(labels, r.newest_listing_age_hours);
    }
  }
}

// --- Public API ---

export async function getLatestSnapshots(pool: Pool, country: string): Promise<PortalQualityResult[]> {
  const result = await pool.query(`
    SELECT DISTINCT ON (portal)
      portal,
      total_properties,
      active_properties,
      missing_price_pct,
      missing_coordinates_pct,
      missing_images_pct,
      suspicious_price_pct,
      updated_last_7d_pct,
      oldest_listing_days,
      newest_listing_age_hours,
      quality_score,
      checked_at
    FROM data_quality_snapshots
    WHERE country = $1
    ORDER BY portal, checked_at DESC
  `, [country]);

  return result.rows;
}

export async function getLatestAlerts(pool: Pool): Promise<ScraperAlert[]> {
  try {
    const result = await pool.query(`
      SELECT portal, alert_type, severity, message, metadata, created_at
      FROM data_quality_scraper_alerts
      WHERE resolved_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return result.rows;
  } catch {
    return [];
  }
}

export async function getFieldCompletionSummary(pool: Pool, snapshotGroupId?: string): Promise<FieldCompletionReport[]> {
  try {
    let query: string;
    let params: any[];
    if (snapshotGroupId) {
      query = `SELECT portal, property_category, field_name, total_count, filled_count, completion_pct
               FROM data_quality_field_completion WHERE snapshot_id = $1 ORDER BY portal, property_category, field_name`;
      params = [snapshotGroupId];
    } else {
      // Latest snapshot group
      query = `SELECT fc.portal, fc.property_category, fc.field_name, fc.total_count, fc.filled_count, fc.completion_pct
               FROM data_quality_field_completion fc
               INNER JOIN (
                 SELECT snapshot_id FROM data_quality_field_completion ORDER BY checked_at DESC LIMIT 1
               ) latest ON fc.snapshot_id = latest.snapshot_id
               ORDER BY fc.portal, fc.property_category, fc.field_name`;
      params = [];
    }
    const result = await pool.query(query, params);
    return result.rows;
  } catch {
    return [];
  }
}

export async function getPriceOutlierSummary(pool: Pool): Promise<PriceOutlierReport[]> {
  try {
    const result = await pool.query(`
      SELECT po.portal, po.property_category, po.transaction_type,
             po.mean_price, po.stddev_price, po.outlier_count, po.outlier_pct
      FROM data_quality_price_outliers po
      INNER JOIN (
        SELECT snapshot_id FROM data_quality_price_outliers ORDER BY checked_at DESC LIMIT 1
      ) latest ON po.snapshot_id = latest.snapshot_id
      ORDER BY po.portal, po.property_category
    `);
    return result.rows;
  } catch {
    return [];
  }
}

// --- Worker ---

export function startDataQualityChecker(redisConnection: {
  host: string;
  port: number;
  password?: string;
}): { queue: Queue; worker: Worker } {
  const queue = new Queue(QUEUE_NAME, {
    connection: redisConnection,
  });

  queue.upsertJobScheduler(
    'data-quality-check-scheduled',
    { pattern: process.env.DATA_QUALITY_CRON || '0 */6 * * *' },
    {
      name: 'check-data-quality',
      data: { country: config.instance.country } as DataQualityJobData,
    }
  );

  const worker = new Worker<DataQualityJobData>(
    QUEUE_NAME,
    async (job) => {
      const { country } = job.data;
      dataQualityLog.info({ country }, 'Running enhanced data quality check');
      const start = Date.now();

      try {
        const pool = getCoreDatabase(country);
        const snapshotGroupId = crypto.randomUUID();

        // Run all checks in parallel where possible
        const [portalResults, duplicateReport, priceOutliers, fieldCompletion] = await Promise.all([
          computePortalQuality(pool),
          computeDuplicateReport(pool),
          computePriceOutliers(pool),
          computeFieldCompletion(pool),
        ]);

        if (portalResults.length === 0) {
          dataQualityLog.info({ country }, 'No properties found, skipping snapshot');
          return { country, portals: 0, duration: Date.now() - start };
        }

        // Compute alerts based on results
        const alerts = await computeScraperAlerts(pool, portalResults, priceOutliers);

        // Run automated cleansing
        const cleansingActions = await runDataCleansing(pool);

        // Store all results
        await Promise.all([
          storeSnapshots(pool, country, snapshotGroupId, portalResults),
          storeDuplicateReport(pool, snapshotGroupId, duplicateReport),
          storePriceOutliers(pool, snapshotGroupId, priceOutliers),
          storeFieldCompletion(pool, snapshotGroupId, fieldCompletion),
          storeAlerts(pool, alerts),
          storeCleansingLog(pool, cleansingActions),
        ]);

        updateMetrics(country, portalResults);

        const lowQuality = portalResults.filter((r) => r.quality_score < 70);
        const duration = Date.now() - start;

        dataQualityLog.info({
          country,
          portals: portalResults.length,
          avgScore: Math.round(portalResults.reduce((s, r) => s + r.quality_score, 0) / portalResults.length * 100) / 100,
          lowQualityPortals: lowQuality.map((r) => ({ portal: r.portal, score: r.quality_score })),
          duplicates: duplicateReport.reduce((s, r) => s + r.duplicate_count, 0),
          priceOutliers: priceOutliers.reduce((s, r) => s + r.outlier_count, 0),
          alerts: alerts.length,
          cleansingActions: cleansingActions.length,
          durationMs: duration,
        }, 'Enhanced data quality check complete');

        return {
          country,
          portals: portalResults.length,
          results: portalResults,
          duplicates: duplicateReport,
          priceOutliers,
          alerts,
          cleansingActions: cleansingActions.length,
          duration,
        };
      } catch (error) {
        errorsTotal.inc({ type: 'data_quality_check' });
        dataQualityLog.error({ err: error, country }, 'Data quality check failed');
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 1,
    }
  );

  worker.on('completed', (job) => {
    dataQualityLog.debug({ jobId: job.id, result: job.returnvalue }, 'Data quality job completed');
  });

  worker.on('failed', (job, err) => {
    dataQualityLog.error({ jobId: job?.id, err }, 'Data quality job failed');
  });

  return { queue, worker };
}
