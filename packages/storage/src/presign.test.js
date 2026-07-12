import assert from "node:assert/strict";
import { test } from "node:test";
import { createS3Client } from "./client.js";
import { createPresignedDownloadUrl } from "./presign.js";

const client = createS3Client();

test("createPresignedDownloadUrl forces attachment disposition with the given filename", async () => {
  const url = await createPresignedDownloadUrl(client, "files", "some-key", 60, "report.pdf");
  const disposition = new URL(url).searchParams.get("response-content-disposition");
  assert.equal(disposition, "attachment; filename=\"report.pdf\"; filename*=UTF-8''report.pdf");
});

test("createPresignedDownloadUrl strips quotes/control chars from a malicious filename", async () => {
  const malicious = 'evil".jpg\r\nX-Injected: true';
  const url = await createPresignedDownloadUrl(client, "files", "some-key", 60, malicious);
  const disposition = new URL(url).searchParams.get("response-content-disposition");

  assert.ok(!disposition.includes("\r"));
  assert.ok(!disposition.includes("\n"));
  assert.ok(disposition.startsWith('attachment; filename="evil.jpgX-Injected: true"'));
});
