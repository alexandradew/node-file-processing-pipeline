import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createS3Client } from "./client.js";
import { FILES_BUCKET, STAGING_BUCKET } from "./constants.js";
import { moveObject } from "./move.js";

const client = createS3Client();

test("moveObject copies to the destination bucket and removes the source", async () => {
  const key = `${randomUUID()}/move-test.txt`;

  await client.send(
    new PutObjectCommand({ Bucket: STAGING_BUCKET, Key: key, Body: "move me" })
  );

  await moveObject(client, STAGING_BUCKET, key, FILES_BUCKET);

  const moved = await client.send(new GetObjectCommand({ Bucket: FILES_BUCKET, Key: key }));
  const body = await moved.Body.transformToString();
  assert.equal(body, "move me");

  await assert.rejects(
    () => client.send(new GetObjectCommand({ Bucket: STAGING_BUCKET, Key: key })),
    (err) => err.name === "NoSuchKey"
  );

  await client.send(new DeleteObjectCommand({ Bucket: FILES_BUCKET, Key: key }));
});
