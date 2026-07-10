import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../app.js";
import { pool } from "../db.js";

/* Must listen on the same port MINIO_WEBHOOK_ENDPOINT points to (host.docker.internal:3000)
to actually receive the callback. Requires Docker Desktop (Windows/Mac), on Linux this
needs 'extra_hosts' in docker-compose pointing to the host */

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

let server;

before(async () => {
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(PORT, resolve);
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

async function waitForStatus(fileId, expectedStatus, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { rows } = await pool.query("SELECT status FROM files WHERE id = $1", [fileId]);
    if (rows[0]?.status === expectedStatus) return rows[0].status;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  const { rows } = await pool.query("SELECT status FROM files WHERE id = $1", [fileId]);
  return rows[0]?.status;
}

test("presigned URL flow: create pending file, upload direct to MinIO, webhook marks it uploaded", async () => {
  const createRes = await fetch(`${BASE_URL}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "e2e-test.txt",
      mimeType: "text/plain",
      sizeBytes: 11,
    }),
  });
  assert.equal(createRes.status, 201);

  const { file, uploadUrl } = await createRes.json();
  assert.equal(file.status, "pending");
  assert.ok(uploadUrl.startsWith("http"));

  const putRes = await fetch(uploadUrl, { method: "PUT", body: "hello world" });
  assert.equal(putRes.status, 200);

  const finalStatus = await waitForStatus(file.id, "uploaded");
  assert.equal(finalStatus, "uploaded");
});
