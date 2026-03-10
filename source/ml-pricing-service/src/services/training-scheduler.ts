import { spawn } from 'child_process';
import { Pool } from 'pg';
import { config } from '../config';
import { modelLog } from '../logger';

const CATEGORIES = ['apartment', 'house', 'land', 'commercial'] as const;
const TRAINING_CRON_HOUR = parseInt(process.env.TRAINING_HOUR || '2', 10);
const TRAINING_CRON_DAY = parseInt(process.env.TRAINING_DAY || '0', 10); // 0 = Sunday
const MIN_TRAINING_SAMPLES = parseInt(process.env.MIN_TRAINING_SAMPLES || '100', 10);

const log = modelLog.child({ module: 'training-scheduler' });

let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

function msUntilNextRun(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(TRAINING_CRON_HOUR, 0, 0, 0);

  // Find next occurrence of the target day
  const daysUntil = (TRAINING_CRON_DAY - now.getDay() + 7) % 7;
  if (daysUntil === 0 && now >= next) {
    // Already past the time today, schedule for next week
    next.setDate(next.getDate() + 7);
  } else {
    next.setDate(next.getDate() + daysUntil);
  }

  return next.getTime() - now.getTime();
}

async function refreshMaterializedViews(country: string): Promise<void> {
  // Use a privileged connection (DB_ADMIN_USER or DB_USER with write access)
  const adminUser = process.env.DB_ADMIN_USER || process.env.DB_USER || 'landomo';
  const adminPassword = process.env.DB_ADMIN_PASSWORD || process.env.DB_PASSWORD || '';
  const countryConfig = config.countries.find(c => c.code === country);
  if (!countryConfig) {
    throw new Error(`Unknown country: ${country}`);
  }

  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: adminUser,
    password: adminPassword,
    database: countryConfig.database,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    for (const category of CATEGORIES) {
      const viewName = `ml_training_features_${category}`;
      log.info({ country, view: viewName }, 'Refreshing materialized view');
      await pool.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
      log.info({ country, view: viewName }, 'Materialized view refreshed');
    }
  } finally {
    await pool.end();
  }
}

async function getViewRowCount(country: string, category: string): Promise<number> {
  const countryConfig = config.countries.find(c => c.code === country);
  if (!countryConfig) return 0;

  const pool = new Pool({
    host: config.database.host,
    port: config.database.port,
    user: config.database.readUser,
    password: config.database.readPassword,
    database: countryConfig.database,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query(
      `SELECT COUNT(*) FROM ml_training_features_${category} WHERE price > 100000`
    );
    return parseInt(result.rows[0].count, 10);
  } catch {
    return 0;
  } finally {
    await pool.end();
  }
}

function trainCategory(country: string, category: string): Promise<{ status: string; metrics?: Record<string, number> }> {
  const scriptPath = `${process.cwd()}/ml/train_model.py`;

  return new Promise((resolve, reject) => {
    const proc = spawn(config.python.path, [
      scriptPath,
      '--country', country,
      '--category', category,
      '--transaction-type', 'both',
    ], {
      cwd: process.cwd(),
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        log.error({ code, stderr: stderr.slice(-500), country, category }, 'Training failed');
        reject(new Error(`Training ${country}/${category} failed with code ${code}`));
        return;
      }

      try {
        const lines = stdout.trim().split('\n');
        for (const line of lines) {
          if (line.startsWith('__RESULT_JSON__:')) {
            const result = JSON.parse(line.substring('__RESULT_JSON__:'.length));
            resolve(result);
            return;
          }
        }
        resolve({ status: 'success' });
      } catch {
        log.error({ stdout: stdout.slice(-500) }, 'Failed to parse training output');
        resolve({ status: 'success' });
      }
    });

    proc.on('error', (err) => {
      log.error({ err, country, category }, 'Failed to spawn training process');
      reject(err);
    });
  });
}

async function runTrainingCycle(): Promise<void> {
  log.info('Starting scheduled training cycle');

  for (const countryConfig of config.countries) {
    const country = countryConfig.code;

    // Step 1: Refresh materialized views (best-effort — continue with stale data if it fails)
    try {
      await refreshMaterializedViews(country);
    } catch (err) {
      log.warn({ err, country }, 'Failed to refresh materialized views, continuing with existing data');
    }

    // Step 2: Train each category if enough data
    for (const category of CATEGORIES) {
      try {
        const count = await getViewRowCount(country, category);
        if (count < MIN_TRAINING_SAMPLES) {
          log.info({ country, category, count, required: MIN_TRAINING_SAMPLES },
            'Skipping training: insufficient samples');
          continue;
        }

        log.info({ country, category, samples: count }, 'Starting training');
        const result = await trainCategory(country, category);
        log.info({ country, category, result }, 'Training completed');
      } catch (err) {
        log.error({ err, country, category }, 'Training failed for category');
      }
    }
  }

  log.info('Training cycle complete');
}

function scheduleNext(): void {
  const ms = msUntilNextRun();
  const hours = Math.round(ms / 3600000 * 10) / 10;
  log.info({ nextRunInHours: hours, day: TRAINING_CRON_DAY, hour: TRAINING_CRON_HOUR },
    'Next training scheduled');

  schedulerTimer = setTimeout(async () => {
    try {
      await runTrainingCycle();
    } catch (err) {
      log.error({ err }, 'Training cycle failed');
    }
    scheduleNext();
  }, ms);
}

export function startTrainingScheduler(): void {
  log.info({
    day: TRAINING_CRON_DAY,
    hour: TRAINING_CRON_HOUR,
    minSamples: MIN_TRAINING_SAMPLES,
  }, 'Training scheduler started');
  scheduleNext();
}

export function stopTrainingScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
    log.info('Training scheduler stopped');
  }
}

/** Trigger an immediate training run (for manual/API use). */
export async function triggerTrainingNow(): Promise<void> {
  return runTrainingCycle();
}
