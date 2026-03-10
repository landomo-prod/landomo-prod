import express from 'express';
import { runThreePhaseScrape, PhaseStats } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8222');

let isRunning = false;
let lastRunStats: PhaseStats | null = null;
let lastRunTime: string | null = null;

// Start BullMQ detail worker
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '20');
const worker = createDetailWorker(concurrency);
console.log(JSON.stringify({
  level: 'info', service: 'enalquiler-scraper',
  msg: 'Detail worker started', concurrency,
}));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'enalquiler-scraper', isRunning, lastRunTime });
});

app.post('/scrape', async (_req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: 'Scrape already in progress' });
  }

  isRunning = true;
  res.json({ status: 'started', message: 'Enalquiler three-phase scrape initiated' });

  try {
    lastRunStats = await runThreePhaseScrape();
    lastRunTime = new Date().toISOString();
    console.log(JSON.stringify({
      level: 'info', service: 'enalquiler-scraper',
      msg: 'Scrape completed', stats: lastRunStats,
    }));
  } catch (error: any) {
    console.error(JSON.stringify({
      level: 'error', service: 'enalquiler-scraper',
      msg: 'Scrape failed', err: error.message,
    }));
  } finally {
    isRunning = false;
  }
});

app.get('/stats', async (_req, res) => {
  const queueStats = await getQueueStats();
  res.json({ isRunning, lastRunTime, lastRunStats, queue: queueStats });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({
    level: 'info', service: 'enalquiler-scraper',
    msg: `Server listening on port ${PORT}`,
  }));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'enalquiler-scraper', msg: 'Shutting down...' }));
  await worker.close();
  process.exit(0);
});
