import {
  acquireLease,
  consume,
  createRedisClient,
  PENDING_QUEUE,
  PROCESSING_QUEUE,
  reap,
  REAP_INTERVAL_MS,
  releaseLease,
} from "queue";
import { pool } from "./db.js";
import { processJob } from "./processJob.js";
import { s3 } from "./storage.js";

console.log("worker started");

const client = createRedisClient();
await client.connect();

// BLMOVE holds its connection blocked until a job shows up (or times out) — the reaper
// needs its own connection so its periodic scan isn't stuck waiting behind that block.
const reaperClient = createRedisClient();
await reaperClient.connect();

let running = true;

async function loop() {
  while (running) {
    let result;
    try {
      result = await consume(client, PENDING_QUEUE, PROCESSING_QUEUE);
    } catch (err) {
      if (!running) break; // connection closed during shutdown
      throw err;
    }
    if (result) {
      const { raw, job } = result;
      await acquireLease(client, raw);
      try {
        await processJob(pool, s3, job);
        await releaseLease(client, raw);
      } catch (err) {
        // don't release: leave the lease to expire so the reaper requeues this job
        console.error(`job ${job.job_id} failed unexpectedly`, err);
      }
    }
  }
}

const loopPromise = loop();

const reaperInterval = setInterval(async () => {
  try {
    const requeued = await reap(reaperClient);
    if (requeued > 0) {
      console.log(`reaper requeued ${requeued} expired job(s)`);
    }
  } catch (err) {
    if (running) console.error("reaper tick failed", err);
  }
}, REAP_INTERVAL_MS);

async function shutdown() {
  console.log("worker shutting down");
  running = false;
  clearInterval(reaperInterval);
  await client.quit();
  await loopPromise;
  await reaperClient.quit();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
