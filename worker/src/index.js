import {
  acquireLease,
  consume,
  createRedisClient,
  PENDING_QUEUE,
  PROCESSING_QUEUE,
  releaseLease,
} from "queue";

console.log("worker started");

const client = createRedisClient();
await client.connect();

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
      console.log("received job", job);
      await releaseLease(client, raw);
    }
  }
}

const loopPromise = loop();

async function shutdown() {
  console.log("worker shutting down");
  running = false;
  await client.quit();
  await loopPromise;
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
