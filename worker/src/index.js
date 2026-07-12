import { consume, createRedisClient, PENDING_QUEUE, PROCESSING_QUEUE } from "queue";

console.log("worker started");

const client = createRedisClient();
await client.connect();

let running = true;

async function loop() {
  while (running) {
    let job;
    try {
      job = await consume(client, PENDING_QUEUE, PROCESSING_QUEUE);
    } catch (err) {
      if (!running) break; // connection closed during shutdown
      throw err;
    }
    if (job) {
      console.log("received job", job);
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
