import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  acquireLease,
  consume,
  createJob,
  createRedisClient,
  enqueue,
  LEASE_SET,
  PENDING_QUEUE,
  PROCESSING_QUEUE,
  reap,
} from "./index.js";

let client;

before(async () => {
  client = createRedisClient();
  await client.connect();
});

after(async () => {
  await client.del(PENDING_QUEUE);
  await client.del(PROCESSING_QUEUE);
  await client.del(LEASE_SET);
  await client.quit();
});

test("consume moves a job from pending to processing", async () => {
  const job = createJob("11111111-1111-1111-1111-111111111111");
  await enqueue(client, PENDING_QUEUE, job);

  const result = await consume(client, PENDING_QUEUE, PROCESSING_QUEUE, 2);

  assert.ok(result);
  assert.deepEqual(result.job, job);
  assert.deepEqual(await client.lRange(PENDING_QUEUE, 0, -1), []);
  assert.deepEqual(await client.lRange(PROCESSING_QUEUE, 0, -1), [result.raw]);

  await client.lRem(PROCESSING_QUEUE, 1, result.raw);
});

test("consume returns null when nothing arrives within the timeout", async () => {
  const result = await consume(client, PENDING_QUEUE, PROCESSING_QUEUE, 1);
  assert.equal(result, null);
});

test("reaper requeues a job whose lease expired, incrementing attempt", async () => {
  const job = createJob("22222222-2222-2222-2222-222222222222");
  await enqueue(client, PENDING_QUEUE, job);
  const { raw } = await consume(client, PENDING_QUEUE, PROCESSING_QUEUE, 2);

  await acquireLease(client, raw, 1); // short TTL just for this test
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const requeued = await reap(client);
  assert.equal(requeued, 1);

  const pending = await client.lRange(PENDING_QUEUE, 0, -1);
  assert.equal(pending.length, 1);
  const requeuedJob = JSON.parse(pending[0]);
  assert.equal(requeuedJob.job_id, job.job_id);
  assert.equal(requeuedJob.attempt, 1);

  assert.deepEqual(await client.lRange(PROCESSING_QUEUE, 0, -1), []);
  assert.equal(await client.zCard(LEASE_SET), 0);

  await client.del(PENDING_QUEUE);
});
