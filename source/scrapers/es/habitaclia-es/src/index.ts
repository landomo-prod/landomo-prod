import express from 'express';
import { runThreePhaseScrape, PhaseStats } from './scraper/threePhaseOrchestrator';
import { createDetailWorker, getQueueStats } from './queue/detailQueue';

const app = express();
const PORT = parseInt(process.env.PORT || '8080');

let isRunning = false;
let lastRunStats: PhaseStats | null = null;
let lastRunTime: string | null = null;

// Start BullMQ detail worker
const concurrency = parseInt(process.env.DETAIL_CONCURRENCY || '40');
const worker = createDetailWorker(concurrency);
console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Detail worker started', concurrency }));

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'habitaclia-scraper', isRunning, lastRunTime });
});

app.post('/scrape', async (_req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: 'Scrape already in progress' });
  }

  isRunning = true;
  res.json({ status: 'started', message: 'Habitaclia three-phase scrape initiated' });

  try {
    lastRunStats = await runThreePhaseScrape();
    lastRunTime = new Date().toISOString();
    console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Scrape completed', stats: lastRunStats }));
  } catch (error: any) {
    console.error(JSON.stringify({ level: 'error', service: 'habitaclia-scraper', msg: 'Scrape failed', err: error.message }));
  } finally {
    isRunning = false;
  }
});

app.get('/stats', async (_req, res) => {
  const queueStats = await getQueueStats();
  res.json({ isRunning, lastRunTime, lastRunStats, queue: queueStats });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: `Server listening on port ${PORT}` }));
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log(JSON.stringify({ level: 'info', service: 'habitaclia-scraper', msg: 'Shutting down...' }));
  await worker.close();
  process.exit(0);
});
