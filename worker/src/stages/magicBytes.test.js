import assert from "node:assert/strict";
import { test } from "node:test";
import { validateMagicBytes } from "./magicBytes.js";

const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
const FAKE_JPEG_THATS_REALLY_HTML = Buffer.from("<!DOCTYPE html><html><body>gotcha</body></html>");

test("real JPEG with matching .jpg extension passes", async () => {
  const result = await validateMagicBytes(JPEG_BYTES, "photo.jpg");
  assert.equal(result.valid, true);
  assert.equal(result.detectedMime, "image/jpeg");
});

test("HTML content disguised as .jpg is rejected", async () => {
  const result = await validateMagicBytes(FAKE_JPEG_THATS_REALLY_HTML, "photo.jpg");
  assert.equal(result.valid, false);
  assert.match(result.reason, /image\/jpeg/);
});

test("extension with no known binary signature (e.g. .txt) passes through unchecked", async () => {
  const result = await validateMagicBytes(Buffer.from("just plain text"), "notes.txt");
  assert.equal(result.valid, true);
});
