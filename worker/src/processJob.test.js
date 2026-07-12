import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createPool } from "db";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { createS3Client, FILES_BUCKET, STAGING_BUCKET } from "storage";
import { processJob } from "./processJob.js";

const pool = createPool();
const s3 = createS3Client();
const createdFiles = [];

async function insertUploadedFile(fileId, filename, stagingKey) {
  await pool.query(
    "INSERT INTO files (id, status, original_filename, staging_key) VALUES ($1, 'uploaded', $2, $3)",
    [fileId, filename, stagingKey]
  );
  createdFiles.push({ fileId, stagingKey });
}

test("processJob moves a valid file to ready", async () => {
  const fileId = randomUUID();
  const stagingKey = `${fileId}/photo.jpg`;
  await insertUploadedFile(fileId, "photo.jpg", stagingKey);

  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
  await s3.send(
    new PutObjectCommand({ Bucket: STAGING_BUCKET, Key: stagingKey, Body: jpegBytes })
  );

  await processJob(pool, s3, { file_id: fileId });

  const { rows } = await pool.query(
    "SELECT status, storage_key FROM files WHERE id = $1",
    [fileId]
  );
  assert.equal(rows[0].status, "ready");
  assert.equal(rows[0].storage_key, stagingKey);

  const moved = await s3.send(new GetObjectCommand({ Bucket: FILES_BUCKET, Key: stagingKey }));
  assert.ok(moved);
});

test("processJob rejects a spoofed extension and marks the file failed", async () => {
  const fileId = randomUUID();
  const stagingKey = `${fileId}/fake.jpg`;
  await insertUploadedFile(fileId, "fake.jpg", stagingKey);

  const htmlBytes = Buffer.from("<!DOCTYPE html><html></html>");
  await s3.send(
    new PutObjectCommand({ Bucket: STAGING_BUCKET, Key: stagingKey, Body: htmlBytes })
  );

  await processJob(pool, s3, { file_id: fileId });

  const { rows } = await pool.query("SELECT status FROM files WHERE id = $1", [fileId]);
  assert.equal(rows[0].status, "failed");
});

after(async () => {
  for (const { fileId, stagingKey } of createdFiles) {
    // harmless if the key was already moved/never existed in one of the two buckets
    await s3.send(new DeleteObjectCommand({ Bucket: STAGING_BUCKET, Key: stagingKey }));
    await s3.send(new DeleteObjectCommand({ Bucket: FILES_BUCKET, Key: stagingKey }));
    await pool.query("DELETE FROM file_events WHERE file_id = $1", [fileId]);
    await pool.query("DELETE FROM files WHERE id = $1", [fileId]);
  }
  await pool.end();
});
