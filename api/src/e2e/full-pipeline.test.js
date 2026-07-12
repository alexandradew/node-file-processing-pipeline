import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  acquireLease,
  consume,
  createRedisClient,
  PENDING_QUEUE,
  PROCESSING_QUEUE,
  releaseLease,
} from "queue";
import { FILES_BUCKET, STAGING_BUCKET } from "storage";
// test-only: production api code never imports the worker's internals, but the e2e test
// needs to actually drive a job through the pipeline without spawning a real worker
// process
import { processJob } from "worker/src/processJob.js";
import { createApp } from "../app.js";
import { pool } from "../db.js";
import { redisClient } from "../redis.js";
import { s3 } from "../storage.js";

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

let server;
let workerRedisClient;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });
  await redisClient.del(PENDING_QUEUE);

  workerRedisClient = createRedisClient();
  await workerRedisClient.connect();
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  await redisClient.quit();
  await workerRedisClient.quit();
});

// Runs exactly one iteration of what worker/src/index.js's loop does, in-process —
// same functions, same order, just without a separate OS process.
async function processOnePendingJob() {
  const result = await consume(workerRedisClient, PENDING_QUEUE, PROCESSING_QUEUE, 10);
  if (!result) return null;

  await acquireLease(workerRedisClient, result.raw);
  await processJob(pool, s3, result.job);
  await releaseLease(workerRedisClient, result.raw);
  return result.job;
}

async function cleanupFile(file) {
  await s3.send(new DeleteObjectCommand({ Bucket: STAGING_BUCKET, Key: file.staging_key }));
  await s3.send(new DeleteObjectCommand({ Bucket: FILES_BUCKET, Key: file.staging_key }));
  await pool.query("DELETE FROM file_events WHERE file_id = $1", [file.id]);
  await pool.query("DELETE FROM files WHERE id = $1", [file.id]);
}

test("full pipeline: upload -> queue -> validate -> ready -> download", async () => {
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0x66, 0x75, 0x6c, 0x6c]);

  const createRes = await fetch(`${BASE_URL}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "full-flow.jpg",
      mimeType: "image/jpeg",
      sizeBytes: jpegBytes.length,
    }),
  });
  assert.equal(createRes.status, 201);
  const { file, uploadUrl } = await createRes.json();

  const putRes = await fetch(uploadUrl, { method: "PUT", body: jpegBytes });
  assert.equal(putRes.status, 200);

  const job = await processOnePendingJob();
  assert.ok(job, "expected a job to be waiting in the pending queue");
  assert.equal(job.file_id, file.id);

  const downloadRes = await fetch(`${BASE_URL}/files/${file.id}/download`);
  assert.equal(downloadRes.status, 200);
  const { downloadUrl } = await downloadRes.json();

  const contentRes = await fetch(downloadUrl);
  assert.equal(contentRes.status, 200);
  const downloadedBytes = Buffer.from(await contentRes.arrayBuffer());
  assert.deepEqual(downloadedBytes, jpegBytes);

  await cleanupFile(file);
});

test("full pipeline: spoofed extension is rejected and never becomes downloadable", async () => {
  const htmlBytes = Buffer.from("<!DOCTYPE html><html><body>gotcha</body></html>");

  const createRes = await fetch(`${BASE_URL}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "fake.jpg",
      mimeType: "image/jpeg",
      sizeBytes: htmlBytes.length,
    }),
  });
  const { file, uploadUrl } = await createRes.json();

  const putRes = await fetch(uploadUrl, { method: "PUT", body: htmlBytes });
  assert.equal(putRes.status, 200);

  await processOnePendingJob();

  const { rows } = await pool.query("SELECT status FROM files WHERE id = $1", [file.id]);
  assert.equal(rows[0].status, "failed");

  const downloadRes = await fetch(`${BASE_URL}/files/${file.id}/download`);
  assert.equal(downloadRes.status, 404);

  await cleanupFile(file);
});
