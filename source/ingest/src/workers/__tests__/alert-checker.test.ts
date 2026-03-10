/**
 * Unit tests for alert-checker.ts
 *
 * Tests the alert evaluation logic: success paths, failure handling,
 * and specific alert rules like stale portal detection.
 */

// Mock dependencies before imports
const mockGetCoreDatabase = jest.fn();
const mockGetInternalQueue = jest.fn();
const mockWorkerLogError = jest.fn();
const mockWorkerLogWarn = jest.fn();
const mockWorkerLogInfo = jest.fn();
const mockWorkerLogDebug = jest.fn();

jest.mock('../../config', () => ({
  config: {
    instance: { country: 'czech' },
  },
}));

jest.mock('../../database/manager', () => ({
  getCoreDatabase: (...args: unknown[]) => mockGetCoreDatabase(...args),
}));

jest.mock('../../queue/internal-queue', () => ({
  getInternalQueue: () => mockGetInternalQueue(),
}));

jest.mock('../../logger', () => ({
  workerLog: {
    error: (...args: unknown[]) => mockWorkerLogError(...args),
    warn: (...args: unknown[]) => mockWorkerLogWarn(...args),
    info: (...args: unknown[]) => mockWorkerLogInfo(...args),
    debug: (...args: unknown[]) => mockWorkerLogDebug(...args),
  },
}));

jest.mock('prom-client', () => ({
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
  })),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    upsertJobScheduler: jest.fn(),
  })),
  Worker: jest.fn().mockImplementation((_name: string, processor: Function) => {
    // Store the processor so tests can invoke it
    (Worker as any).__processor = processor;
    return {
      on: jest.fn(),
    };
  }),
}));

import { Worker } from 'bullmq';
import { startAlertChecker } from '../alert-checker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockQueue() {
  return {
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    isPaused: jest.fn().mockResolvedValue(false),
  };
}

function createMockDb() {
  return {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };
}

/** Start the alert checker and return the processor function */
function getAlertProcessor() {
  startAlertChecker({ host: 'localhost', port: 6379 });
  return (Worker as any).__processor as (job: { data: { country: string } }) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('alert-checker: runAlertCheck', () => {
  it('evaluates all alert rules and logs completion', async () => {
    const mockDb = createMockDb();
    const mockQueue = createMockQueue();

    mockGetCoreDatabase.mockReturnValue(mockDb);
    mockGetInternalQueue.mockReturnValue(mockQueue);

    // DB queries: no_ingestion_1h returns some properties, db_size is fine, stale_portals returns none
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ cnt: '10' }] })  // no_ingestion_1h
      .mockResolvedValueOnce({ rows: [{ size_gb: '2.5' }] }) // db_size_high
      .mockResolvedValueOnce({ rows: [] }); // stale_portals (no stale)

    const processor = getAlertProcessor();
    await processor({ data: { country: 'czech' } });

    // Should log completion with totalRules and triggeredCount
    expect(mockWorkerLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        country: 'czech',
        totalRules: expect.any(Number),
        triggeredCount: 0,
      }),
      'Alert check completed'
    );
  });

  it('catches individual rule evaluation errors without crashing the job', async () => {
    const mockDb = createMockDb();
    const mockQueue = createMockQueue();

    mockGetCoreDatabase.mockReturnValue(mockDb);
    mockGetInternalQueue.mockReturnValue(mockQueue);

    // Make one queue call throw
    mockQueue.getWaitingCount.mockRejectedValueOnce(new Error('Redis connection lost'));

    // Other DB queries succeed
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ cnt: '5' }] })
      .mockResolvedValueOnce({ rows: [{ size_gb: '1.0' }] })
      .mockResolvedValueOnce({ rows: [] });

    const processor = getAlertProcessor();

    // Should NOT throw
    await expect(
      processor({ data: { country: 'czech' } })
    ).resolves.toBeUndefined();

    // Should log the error for the failed rule
    expect(mockWorkerLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        err: expect.any(Error),
        alert: 'queue_backlog',
        country: 'czech',
      }),
      'Alert rule evaluation failed'
    );

    // Should still complete and log summary
    expect(mockWorkerLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'czech' }),
      'Alert check completed'
    );
  });

  it('fires stale_portals alert when a portal has no data in 72h', async () => {
    const mockDb = createMockDb();
    const mockQueue = createMockQueue();

    mockGetCoreDatabase.mockReturnValue(mockDb);
    mockGetInternalQueue.mockReturnValue(mockQueue);

    // no_ingestion_1h: some recent data
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ cnt: '100' }] })
      // db_size: fine
      .mockResolvedValueOnce({ rows: [{ size_gb: '3.0' }] })
      // stale_portals: 2 stale portals found
      .mockResolvedValueOnce({
        rows: [
          { cnt: '1' }, // portal 1
          { cnt: '1' }, // portal 2
        ],
      });

    const processor = getAlertProcessor();
    await processor({ data: { country: 'czech' } });

    // stale_portals is severity=critical, so it should log via workerLog.error
    expect(mockWorkerLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        alert: 'stale_portals',
        severity: 'critical',
        value: 2,
        country: 'czech',
      }),
      expect.stringContaining('2 portal(s) have not sent data in 72+ hours')
    );

    // triggeredCount should include stale_portals
    expect(mockWorkerLogInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        triggeredCount: expect.any(Number),
        triggered: expect.arrayContaining(['stale_portals']),
      }),
      'Alert check completed'
    );
  });
});
