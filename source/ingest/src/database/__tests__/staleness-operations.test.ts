import { Pool } from 'pg';
import {
  markStalePropertiesRemoved,
  reactivateProperty,
  openInitialStatusPeriod,
  reapOrphanedRuns,
  startScrapeRun,
  completeScrapeRun,
  failScrapeRun,
} from '../staleness-operations';

// Mock the logger module
const mockError = jest.fn();
const mockWarn = jest.fn();
const mockInfo = jest.fn();
jest.mock('../../logger', () => ({
  stalenessLog: {
    error: (...args: unknown[]) => mockError(...args),
    warn: (...args: unknown[]) => mockWarn(...args),
    info: (...args: unknown[]) => mockInfo(...args),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Build a mock pg Client returned by pool.connect() */
function createMockClient() {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  return client;
}

/** Build a mock pg Pool with a query() stub and connect() returning a client */
function createMockPool(mockClient?: ReturnType<typeof createMockClient>) {
  const client = mockClient ?? createMockClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query = jest.fn() as jest.Mock<any, any>;
  const pool = {
    query,
    connect: jest.fn().mockResolvedValue(client),
  } as unknown as Pool & { query: typeof query; connect: jest.Mock };
  return { pool, client };
}

beforeEach(() => {
  mockError.mockClear();
  mockWarn.mockClear();
  mockInfo.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// markStalePropertiesRemoved
// ---------------------------------------------------------------------------

describe('markStalePropertiesRemoved', () => {
  it('returns immediately when no portals have stale listings', async () => {
    const { pool } = createMockPool();

    // First query (portal stats): HAVING > 0 means no stale portals → empty rows
    pool.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.markedRemoved).toBe(0);
    expect(result.skippedPortals).toEqual([]);
    // Only 1 query fired (portal stats), no scrape_runs check needed
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('triggers circuit breaker when portal has no recent completed scrape run', async () => {
    const { pool } = createMockPool();

    // Portal stats: bezrealitky has stale listings
    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'bezrealitky', stale_count: '40' }],
      } as never)
      // scrape_runs check: no completed run within window → empty
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.markedRemoved).toBe(0);
    expect(result.skippedPortals).toEqual(['bezrealitky']);
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ portal: 'bezrealitky' }),
      expect.stringContaining('Circuit breaker')
    );
    // Should not attempt to mark any properties
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('allows portals with a recent completed scrape run regardless of stale count', async () => {
    const { pool } = createMockPool();

    // Portal stats: high stale count but scraper ran successfully
    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'reality', stale_count: '30' }],
      } as never)
      // scrape_runs check: portal has a recent completed run → allowed
      .mockResolvedValueOnce({
        rows: [{ portal: 'reality', status: 'completed', finished_at: new Date() }],
      } as never)
      // Batch fetch: nothing stale right now
      .mockResolvedValueOnce({ rows: [] } as never);

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.skippedPortals).toEqual([]);
    // Pool.query called: 1 portal stats + 1 scrape_runs + 1 batch query
    expect(pool.query).toHaveBeenCalledTimes(3);
  });

  it('skips some portals while processing others', async () => {
    const client = createMockClient();
    const { pool } = createMockPool(client);

    // Two portals with stale listings
    pool.query
      .mockResolvedValueOnce({
        rows: [
          { portal: 'bad-portal', stale_count: '50' },
          { portal: 'good-portal', stale_count: '5' },
        ],
      } as never)
      // scrape_runs check: only good-portal has a recent run
      .mockResolvedValueOnce({
        rows: [{ portal: 'good-portal', status: 'completed', finished_at: new Date() }],
      } as never)
      // Batch select returns one stale property from good-portal
      .mockResolvedValueOnce({
        rows: [{ id: 'prop-1', portal: 'good-portal', portal_id: 'gp-001' }],
      } as never)
      // Second batch returns empty (done)
      .mockResolvedValueOnce({ rows: [] } as never);

    // Client transaction queries: BEGIN, UPDATE RETURNING, status_history UPDATE, COMMIT
    client.query
      .mockResolvedValueOnce({} as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'prop-1' }] } as never) // UPDATE RETURNING
      .mockResolvedValueOnce({} as never) // status_history JSONB update
      .mockResolvedValueOnce({} as never); // COMMIT

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.markedRemoved).toBe(1);
    expect(result.skippedPortals).toEqual(['bad-portal']);
  });

  it('processes multiple batches until exhausted', async () => {
    const client = createMockClient();
    const { pool } = createMockPool(client);
    const batchSize = 2;

    pool.query
      // Portal stats
      .mockResolvedValueOnce({
        rows: [{ portal: 'sreality', stale_count: '3' }],
      } as never)
      // scrape_runs check: recent completed run exists
      .mockResolvedValueOnce({
        rows: [{ portal: 'sreality', status: 'completed', finished_at: new Date() }],
      } as never)
      // First batch: full (2 = batchSize, so there might be more)
      .mockResolvedValueOnce({
        rows: [
          { id: 'p1', portal: 'sreality', portal_id: 's1' },
          { id: 'p2', portal: 'sreality', portal_id: 's2' },
        ],
      } as never)
      // Second batch: partial (1 < batchSize, done)
      .mockResolvedValueOnce({
        rows: [{ id: 'p3', portal: 'sreality', portal_id: 's3' }],
      } as never);

    // Each property needs: BEGIN, UPDATE RETURNING, status_history JSONB update, COMMIT
    const successTransaction = () => {
      client.query
        .mockResolvedValueOnce({} as never) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 'x' }] } as never) // UPDATE RETURNING
        .mockResolvedValueOnce({} as never) // status_history JSONB update
        .mockResolvedValueOnce({} as never); // COMMIT
    };
    successTransaction();
    successTransaction();
    successTransaction();

    const result = await markStalePropertiesRemoved(pool, 72, batchSize);

    expect(result.markedRemoved).toBe(3);
    // Pool queried: 1 portal stats + 1 scrape_runs check + 2 batch fetches
    expect(pool.query).toHaveBeenCalledTimes(4);
  });

  it('handles race condition: skips property already updated by ingestion', async () => {
    const client = createMockClient();
    const { pool } = createMockPool(client);

    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'portal-a', stale_count: '1' }],
      } as never)
      // scrape_runs: portal has recent completed run
      .mockResolvedValueOnce({
        rows: [{ portal: 'portal-a', status: 'completed', finished_at: new Date() }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'raced-prop', portal: 'portal-a', portal_id: 'pa-1' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never); // no more

    // Race condition: UPDATE returns 0 rows (property was re-ingested)
    client.query
      .mockResolvedValueOnce({} as never) // BEGIN
      .mockResolvedValueOnce({ rows: [] } as never) // UPDATE RETURNING => empty
      .mockResolvedValueOnce({} as never); // ROLLBACK

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.markedRemoved).toBe(0);
    // Should ROLLBACK, not COMMIT
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });

  it('race condition guard: WHERE clause recheck prevents stale-marking a freshly ingested property', async () => {
    // This tests that when a property's last_seen_at is updated between the batch SELECT
    // and the per-property UPDATE, the UPDATE returns 0 rows and no status change occurs.
    const client = createMockClient();
    const { pool } = createMockPool(client);

    pool.query
      // Portal stats: one portal with stale listings
      .mockResolvedValueOnce({
        rows: [{ portal: 'portal-race', stale_count: '1' }],
      } as never)
      // Recent scrape runs check: portal has a recent completed run
      .mockResolvedValueOnce({
        rows: [{ portal: 'portal-race', status: 'completed', finished_at: new Date() }],
      } as never)
      // Batch fetch: returns the property (it was stale at SELECT time)
      .mockResolvedValueOnce({
        rows: [{ id: 'freshened-prop', portal: 'portal-race', portal_id: 'pr-1' }],
      } as never)
      // Second batch: empty (done)
      .mockResolvedValueOnce({ rows: [] } as never);

    // During the UPDATE, the WHERE clause re-checks last_seen_at via GREATEST().
    // Because ingestion updated last_seen_at between SELECT and UPDATE, 0 rows match.
    client.query
      .mockResolvedValueOnce({} as never) // BEGIN
      .mockResolvedValueOnce({ rows: [] } as never) // UPDATE RETURNING => 0 rows (freshened)
      .mockResolvedValueOnce({} as never); // ROLLBACK

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.markedRemoved).toBe(0);
    // Should ROLLBACK since no rows were updated
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    // Client must be released
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back and continues on per-property error', async () => {
    const client = createMockClient();
    const { pool } = createMockPool(client);

    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'portal-x', stale_count: '2' }],
      } as never)
      // scrape_runs: recent completed run
      .mockResolvedValueOnce({
        rows: [{ portal: 'portal-x', status: 'completed', finished_at: new Date() }],
      } as never)
      .mockResolvedValueOnce({
        rows: [
          { id: 'err-prop', portal: 'portal-x', portal_id: 'px-1' },
          { id: 'ok-prop', portal: 'portal-x', portal_id: 'px-2' },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    // First property: error during UPDATE
    client.query
      .mockResolvedValueOnce({} as never) // BEGIN
      .mockRejectedValueOnce(new Error('deadlock detected')) // UPDATE fails
      .mockResolvedValueOnce({} as never) // ROLLBACK
      // Second property: succeeds — BEGIN, UPDATE, status_history update, COMMIT
      .mockResolvedValueOnce({} as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'ok-prop' }] } as never) // UPDATE RETURNING
      .mockResolvedValueOnce({} as never) // status_history JSONB update
      .mockResolvedValueOnce({} as never); // COMMIT

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(result.markedRemoved).toBe(1);
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'err-prop' }),
      expect.stringContaining('Failed to mark property as removed')
    );
    // Client was released for both rows
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('uses per-portal threshold overrides from staleness_thresholds table', async () => {
    const { pool } = createMockPool();

    // Portal stats query references staleness_thresholds via COALESCE
    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'custom-portal', stale_count: '2' }],
      } as never)
      // scrape_runs check: recent run exists
      .mockResolvedValueOnce({
        rows: [{ portal: 'custom-portal', status: 'completed', finished_at: new Date() }],
      } as never)
      // Batch fetch: nothing
      .mockResolvedValueOnce({ rows: [] } as never);

    await markStalePropertiesRemoved(pool, 72, 500);

    // Verify the portal stats SQL references staleness_thresholds with COALESCE
    const portalStatsCall = pool.query.mock.calls[0];
    expect(portalStatsCall[0]).toContain('staleness_thresholds');
    expect(portalStatsCall[0]).toContain('COALESCE');
    expect(portalStatsCall[1]).toEqual([72]);
  });

  it('passes default threshold and batchSize as query params', async () => {
    const { pool } = createMockPool();

    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'test', stale_count: '1' }],
      } as never)
      // scrape_runs check
      .mockResolvedValueOnce({
        rows: [{ portal: 'test', status: 'completed', finished_at: new Date() }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await markStalePropertiesRemoved(pool, 48, 250);

    // Batch query (3rd call) should use threshold=48 and limit=250
    const batchCall = pool.query.mock.calls[2];
    expect(batchCall[1]).toEqual([48, 250, ['test']]);
  });

  it('releases client even on error', async () => {
    const client = createMockClient();
    const { pool } = createMockPool(client);

    pool.query
      .mockResolvedValueOnce({
        rows: [{ portal: 'p', stale_count: '1' }],
      } as never)
      // scrape_runs: recent run
      .mockResolvedValueOnce({
        rows: [{ portal: 'p', status: 'completed', finished_at: new Date() }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: 'x', portal: 'p', portal_id: 'y' }],
      } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    client.query
      .mockResolvedValueOnce({} as never) // BEGIN
      .mockRejectedValueOnce(new Error('connection lost')) // UPDATE fails
      .mockResolvedValueOnce({} as never); // ROLLBACK

    await markStalePropertiesRemoved(pool, 72, 500);

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('excludes terminal statuses (only processes active properties)', async () => {
    const { pool } = createMockPool();

    pool.query.mockResolvedValueOnce({ rows: [] } as never);

    await markStalePropertiesRemoved(pool, 72, 500);

    // Verify the portal stats query filters on status = 'active'
    const sql = pool.query.mock.calls[0][0] as string;
    expect(sql).toContain("status = 'active'");
  });

  it('returns duration in result', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await markStalePropertiesRemoved(pool, 72, 500);

    expect(typeof result.duration).toBe('number');
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// reactivateProperty
// ---------------------------------------------------------------------------

describe('reactivateProperty', () => {
  it('appends active status period to status_history JSONB', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValue({} as never);

    await reactivateProperty(pool, 'prop-abc', 'sreality', 'sr-123');

    // Implementation calls appendStatusHistory which does a single UPDATE on properties
    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('UPDATE properties');
    expect(sql).toContain('status_history');
    expect(params[0]).toBe('prop-abc');
    expect(params[1]).toBe('active');
  });

  it('propagates database errors', async () => {
    const { pool } = createMockPool();
    pool.query.mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      reactivateProperty(pool, 'prop-x', 'portal', 'pid')
    ).rejects.toThrow('connection refused');
  });
});

// ---------------------------------------------------------------------------
// openInitialStatusPeriod
// ---------------------------------------------------------------------------

describe('openInitialStatusPeriod', () => {
  it('updates status_history JSONB for new property', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({} as never);

    await openInitialStatusPeriod(pool, 'new-prop-id');

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    // New implementation sets status_history JSONB column on properties table
    expect(sql).toContain('UPDATE properties');
    expect(sql).toContain('status_history');
    expect(params[0]).toBe('new-prop-id');
    // Default status is 'active'
    expect(params[1]).toBe('active');
  });

  it('accepts explicit status override', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({} as never);

    await openInitialStatusPeriod(pool, 'prop-id', 'removed');

    const [, params] = pool.query.mock.calls[0];
    expect(params[1]).toBe('removed');
  });

  it('propagates database errors', async () => {
    const { pool } = createMockPool();
    pool.query.mockRejectedValueOnce(new Error('unique violation'));

    await expect(openInitialStatusPeriod(pool, 'dup-id')).rejects.toThrow(
      'unique violation'
    );
  });
});

// ---------------------------------------------------------------------------
// reapOrphanedRuns
// ---------------------------------------------------------------------------

describe('reapOrphanedRuns', () => {
  it('marks stuck running scrape runs as failed', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [
        { id: 'run-1', portal: 'sreality' },
        { id: 'run-2', portal: 'bezrealitky' },
      ],
    } as never);

    const count = await reapOrphanedRuns(pool);

    expect(count).toBe(2);
    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain("SET status = 'failed'");
    expect(sql).toContain("status = 'running'");
    expect(sql).toContain("INTERVAL '4 hours'");
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2 }),
      expect.stringContaining('Reaped orphaned scrape runs')
    );
  });

  it('returns 0 when no orphaned runs exist', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({ rows: [] } as never);

    const count = await reapOrphanedRuns(pool);

    expect(count).toBe(0);
    expect(mockWarn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// startScrapeRun
// ---------------------------------------------------------------------------

describe('startScrapeRun', () => {
  it('returns run ID when no overlap exists', async () => {
    const { pool } = createMockPool();

    // Overlap check: no existing running
    pool.query
      .mockResolvedValueOnce({ rows: [] } as never)
      // Insert run
      .mockResolvedValueOnce({ rows: [{ id: 'new-run-id' }] } as never);

    const id = await startScrapeRun(pool, 'sreality');

    expect(id).toBe('new-run-id');

    // Verify overlap guard query
    const overlapSql = pool.query.mock.calls[0][0] as string;
    expect(overlapSql).toContain("status = 'running'");
    expect(pool.query.mock.calls[0][1]).toEqual(['sreality']);

    // Verify insert query
    const insertSql = pool.query.mock.calls[1][0] as string;
    expect(insertSql).toContain('INSERT INTO scrape_runs');
    expect(pool.query.mock.calls[1][1]).toEqual(['sreality']);
  });

  it('returns null when a run is already in progress (overlap guard)', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 'existing-run' }],
    } as never);

    const id = await startScrapeRun(pool, 'bezrealitky');

    expect(id).toBeNull();
    // Should NOT attempt to insert
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// completeScrapeRun
// ---------------------------------------------------------------------------

describe('completeScrapeRun', () => {
  it('updates run with stats and completed status', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({} as never);

    const stats = {
      listings_found: 150,
      listings_new: 20,
      listings_updated: 130,
    };

    await completeScrapeRun(pool, 'run-42', stats);

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("status = 'completed'");
    expect(sql).toContain('listings_found');
    expect(sql).toContain('listings_new');
    expect(sql).toContain('listings_updated');
    expect(params).toEqual(['run-42', 150, 20, 130]);
  });
});

// ---------------------------------------------------------------------------
// failScrapeRun
// ---------------------------------------------------------------------------

describe('failScrapeRun', () => {
  it('marks run as failed with finished_at timestamp', async () => {
    const { pool } = createMockPool();
    pool.query.mockResolvedValueOnce({} as never);

    await failScrapeRun(pool, 'run-99');

    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain("status = 'failed'");
    expect(sql).toContain('finished_at = NOW()');
    expect(params).toEqual(['run-99']);
  });
});
