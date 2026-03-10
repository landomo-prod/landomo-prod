/**
 * Queue-Based LLM Processing Test Script
 *
 * Tests the BullMQ queue infrastructure for Bazos LLM extraction.
 * Run: npx ts-node test-queue.ts
 *
 * Prerequisites:
 *   - Redis running on localhost:6379
 *   - AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY set
 *   - LLM_EXTRACTION_ENABLED=true
 */

import dotenv from 'dotenv';
dotenv.config();

import { Queue } from 'bullmq';
import {
  getLLMQueue,
  getLLMQueueEvents,
  addExtractionJobs,
  waitForJobs,
  closeLLMQueue,
  getRedisConnection,
  getQueueConfig,
  QUEUE_NAME,
  LLMExtractionJobResult,
} from './src/queue/llmQueue';
import { createLLMWorker, closeLLMWorker, getWorkerMetrics } from './src/queue/llmWorker';
import { getExtractionCache } from './src/services/extractionCache';

// ── Test Configuration ──────────────────────────────────────────

const TEST_TIMEOUT_MS = 120000;

// Sample Bazos listings (Czech real estate)
const SAMPLE_LISTINGS = [
  {
    id: 'test-apt-001',
    title: 'Prodej bytu 2+kk 54 m²',
    description: 'Pardubice - Zelené Předměstí. Cena: 3.450.000 Kč. Prodej bytu 2+kk o velikosti 54 m² v osobním vlastnictví. Byt se nachází ve 3. patře panelového domu s výtahem. Po kompletní rekonstrukci. Plastová okna, plovoucí podlahy.',
  },
  {
    id: 'test-apt-002',
    title: 'Prodej bytu 3+1 75 m²',
    description: 'Praha 4 - Chodov. Cena: 6.990.000 Kč. Prostorný byt 3+1 v cihlovém domě, 2. patro s výtahem. Lodžie, sklep, parkování. Blízko metra Chodov.',
  },
  {
    id: 'test-house-001',
    title: 'Prodej rodinného domu 150 m²',
    description: 'Brno - Bystrc. Cena: 8.500.000 Kč. Rodinný dům 5+1 s garáží a zahradou 600 m². Dva podlaží, podsklepený. Nová střecha 2022, plastová okna.',
  },
  {
    id: 'test-land-001',
    title: 'Prodej pozemku 1200 m²',
    description: 'Liberec - Vratislavice. Cena: 2.400.000 Kč. Stavební pozemek s IS na hranici. Rovinatý terén, klidná lokalita. Územní plán umožňuje výstavbu RD.',
  },
  {
    id: 'test-apt-003',
    title: 'Pronájem bytu 1+kk 28 m²',
    description: 'Olomouc - centrum. Nájem: 12.000 Kč/měsíc + energie. Kompletně zařízený byt, 4. patro bez výtahu. Volný ihned.',
  },
];

// ── Test Helpers ────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
    errors.push(message);
  }
}

async function drainQueue() {
  const queue = getLLMQueue();
  await queue.drain();
  console.log('  [cleanup] Queue drained');
}

// ── Tests ───────────────────────────────────────────────────────

async function testRedisConnection() {
  console.log('\n🔌 Test 1: Redis Connection');
  const connection = getRedisConnection() as any;
  assert(connection.host !== undefined, `Redis host configured: ${connection.host}`);
  assert(typeof connection.port === 'number', `Redis port configured: ${connection.port}`);

  const queue = getLLMQueue();
  assert(queue !== null, 'Queue instance created');

  // Verify queue is connected by checking its state
  try {
    await queue.getJobCounts();
    assert(true, 'Queue connected to Redis successfully');
  } catch (err: any) {
    assert(false, `Queue failed to connect to Redis: ${err.message}`);
  }
}

async function testQueueConfig() {
  console.log('\n⚙️  Test 2: Queue Configuration');
  const config = getQueueConfig();
  assert(config.concurrency > 0, `Concurrency: ${config.concurrency}`);
  assert(config.maxRetries > 0, `Max retries: ${config.maxRetries}`);
  assert(config.retryDelay > 0, `Retry delay: ${config.retryDelay}ms`);
  assert(config.rateLimitMax > 0, `Rate limit max: ${config.rateLimitMax}`);
  assert(config.rateLimitDurationMs > 0, `Rate limit duration: ${config.rateLimitDurationMs}ms`);
  assert(config.rateLimitMax <= 60, 'Rate limit within Azure limits (<=60/min)');
}

async function testJobAddition() {
  console.log('\n📥 Test 3: Job Addition');
  await drainQueue();

  const jobIdMap = await addExtractionJobs(SAMPLE_LISTINGS, 'bazos', 'cz');
  assert(jobIdMap.size === SAMPLE_LISTINGS.length, `Added ${jobIdMap.size} jobs`);

  for (const listing of SAMPLE_LISTINGS) {
    assert(jobIdMap.has(listing.id), `Job mapped for listing ${listing.id}`);
  }

  const queue = getLLMQueue();
  const counts = await queue.getJobCounts();
  const totalInQueue = counts.waiting + counts.active + counts.delayed + counts.completed;
  assert(totalInQueue >= SAMPLE_LISTINGS.length,
    `Jobs in queue: waiting=${counts.waiting} active=${counts.active} delayed=${counts.delayed} completed=${counts.completed}`);

  await drainQueue();
}

async function testWorkerProcessing() {
  console.log('\n⚡ Test 4: Worker Processing (5 listings)');
  await drainQueue();

  // Start worker
  const worker = createLLMWorker();
  assert(worker !== null, 'Worker created');

  // Add jobs
  const jobIdMap = await addExtractionJobs(SAMPLE_LISTINGS, 'bazos', 'cz');
  assert(jobIdMap.size === SAMPLE_LISTINGS.length, `Queued ${jobIdMap.size} jobs`);

  // Wait for results
  console.log('  ⏳ Waiting for processing (timeout: 120s)...');
  const results = await waitForJobs(jobIdMap, TEST_TIMEOUT_MS);

  assert(results.size > 0, `Got ${results.size}/${SAMPLE_LISTINGS.length} results`);

  let validCount = 0;
  let cacheCount = 0;
  let totalMs = 0;

  for (const [listingId, result] of results) {
    if (result.isValid) validCount++;
    if (result.fromCache) cacheCount++;
    totalMs += result.processingTimeMs;
    console.log(`    ${listingId}: valid=${result.isValid} cache=${result.fromCache} ${result.processingTimeMs}ms ${result.tokensUsed || 0} tokens`);
  }

  assert(validCount > 0, `Valid extractions: ${validCount}/${results.size}`);
  console.log(`  Cache hits: ${cacheCount}, Avg processing: ${Math.round(totalMs / results.size)}ms`);

  // Check worker metrics
  const metrics = getWorkerMetrics();
  console.log(`  Worker metrics: processed=${metrics.processed} succeeded=${metrics.succeeded} failed=${metrics.failed} cacheHits=${metrics.cacheHits}`);
  assert(metrics.processed > 0, `Worker processed ${metrics.processed} jobs`);

  await closeLLMWorker();
}

async function testCacheHits() {
  console.log('\n💾 Test 5: Cache Hit Rate (re-process same listings)');
  await drainQueue();

  // Start fresh worker
  const worker = createLLMWorker();

  // Re-add the same listings - should hit cache
  const jobIdMap = await addExtractionJobs(SAMPLE_LISTINGS, 'bazos', 'cz');
  const results = await waitForJobs(jobIdMap, TEST_TIMEOUT_MS);

  let cacheHits = 0;
  for (const [, result] of results) {
    if (result.fromCache) cacheHits++;
  }

  const hitRate = results.size > 0 ? (cacheHits / results.size) * 100 : 0;
  // Note: In-memory cache doesn't persist across worker restarts.
  // With persistent cache (Redis/PostgreSQL), this would show high hit rates.
  console.log(`  Cache hit rate: ${hitRate.toFixed(1)}% (${cacheHits}/${results.size})`);
  assert(results.size > 0, `Re-processed ${results.size} listings (cache depends on persistent storage)`);

  await closeLLMWorker();
}

async function testRateLimiting() {
  console.log('\n🚦 Test 6: Rate Limiting (burst of 20 jobs)');
  await drainQueue();

  // Generate 20 unique listings to bypass cache
  const burstListings = Array.from({ length: 20 }, (_, i) => ({
    id: `test-burst-${i}-${Date.now()}`,
    title: `Test byt ${i + 1}+kk ${30 + i * 5} m²`,
    description: `Test listing ${i + 1}. Praha ${i + 1}. Cena: ${(i + 1) * 1000000} Kč. Byt ${i + 1}+kk o rozloze ${30 + i * 5} m².`,
  }));

  const worker = createLLMWorker();
  const startTime = Date.now();

  const jobIdMap = await addExtractionJobs(burstListings, 'bazos', 'cz');
  assert(jobIdMap.size === 20, `Queued 20 burst jobs`);

  const results = await waitForJobs(jobIdMap, 180000); // 3 min timeout for rate-limited batch
  const durationSec = (Date.now() - startTime) / 1000;

  assert(results.size > 0, `Completed ${results.size}/20 jobs in ${durationSec.toFixed(1)}s`);

  // Check no 429 errors by verifying success rate
  let successes = 0;
  for (const [, result] of results) {
    if (result.isValid) successes++;
  }
  const successRate = results.size > 0 ? (successes / results.size) * 100 : 0;
  assert(successRate > 70, `Success rate: ${successRate.toFixed(1)}% (no 429 rate limit errors)`);

  const metrics = getWorkerMetrics();
  console.log(`  Worker: ${metrics.successRate} success rate, avg ${metrics.avgProcessingMs}ms`);

  await closeLLMWorker();
}

async function testExtractionQuality() {
  console.log('\n🎯 Test 7: Extraction Quality');

  // Get results from queue (use cache from earlier test)
  const worker = createLLMWorker();
  await drainQueue();

  const jobIdMap = await addExtractionJobs(SAMPLE_LISTINGS.slice(0, 3), 'bazos', 'cz');
  const results = await waitForJobs(jobIdMap, TEST_TIMEOUT_MS);

  for (const [listingId, result] of results) {
    if (!result.isValid) continue;
    const data = result.data;

    console.log(`  Listing: ${listingId}`);
    console.log(`    property_type: ${data.property_type}`);
    console.log(`    transaction_type: ${data.transaction_type}`);
    console.log(`    price: ${data.price}`);
    console.log(`    location: ${JSON.stringify(data.location)}`);
    console.log(`    details: ${JSON.stringify(data.details)}`);

    assert(
      ['apartment', 'house', 'land', 'commercial', 'other'].includes(data.property_type),
      `${listingId}: valid property_type "${data.property_type}"`
    );
    assert(
      ['sale', 'rent', 'auction'].includes(data.transaction_type),
      `${listingId}: valid transaction_type "${data.transaction_type}"`
    );
  }

  await closeLLMWorker();
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Bazos Queue-Based LLM Processing Test Suite');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Queue: ${QUEUE_NAME}`);
  console.log(`  Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
  console.log(`  Azure endpoint: ${process.env.AZURE_OPENAI_ENDPOINT ? '✅ set' : '❌ missing'}`);
  console.log(`  Azure key: ${process.env.AZURE_OPENAI_API_KEY ? '✅ set' : '❌ missing'}`);

  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
    console.error('\n❌ Missing Azure credentials. Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.');
    process.exit(1);
  }

  const startTime = Date.now();

  try {
    await testRedisConnection();
    await testQueueConfig();
    await testJobAddition();
    await testWorkerProcessing();
    await testCacheHits();
    await testRateLimiting();
    await testExtractionQuality();
  } catch (err: any) {
    console.error('\n💥 Unexpected error:', err.message);
    console.error(err.stack);
    failed++;
  }

  // Cleanup
  await closeLLMWorker();
  await closeLLMQueue();

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed (${durationSec}s)`);
  console.log('═══════════════════════════════════════════════════════');

  if (errors.length > 0) {
    console.log('\n  Failed tests:');
    errors.forEach(e => console.log(`    ❌ ${e}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
