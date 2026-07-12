import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { createPool } from "./client.js";
import { IllegalTransitionError, transition } from "./transition.js";

const pool = createPool();

async function insertTestFile(status = "pending") {
  const { rows } = await pool.query(
    "INSERT INTO files (status, original_filename, staging_key) VALUES ($1, $2, $3) RETURNING id",
    [status, "test.txt", `staging/${randomUUID()}`]
  );
  return rows[0].id;
}

test("valid transition updates status and records event", async () => {
  const fileId = await insertTestFile("pending");

  const updated = await transition(pool, fileId, "pending", "uploaded");
  assert.equal(updated.status, "uploaded");

  const { rows } = await pool.query(
    "SELECT from_status, to_status FROM file_events WHERE file_id = $1",
    [fileId]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from_status, "pending");
  assert.equal(rows[0].to_status, "uploaded");
});

test("transition stores metadata on the event when provided", async () => {
  const fileId = await insertTestFile("pending");

  await transition(pool, fileId, "pending", "uploaded", { reason: "test" });

  const { rows } = await pool.query(
    "SELECT metadata FROM file_events WHERE file_id = $1",
    [fileId]
  );
  assert.deepEqual(rows[0].metadata, { reason: "test" });
});

test("illegal transition (skipping states) is rejected", async () => {
  const fileId = await insertTestFile("pending");

  await assert.rejects(
    () => transition(pool, fileId, "pending", "ready"),
    IllegalTransitionError
  );
});

test("transition rejected when current status no longer matches 'from'", async () => {
  const fileId = await insertTestFile("uploaded");

  await assert.rejects(
    () => transition(pool, fileId, "pending", "uploaded"),
    IllegalTransitionError
  );
});

after(async () => {
  await pool.end();
});
