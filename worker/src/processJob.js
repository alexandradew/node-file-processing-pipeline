import { transition } from "db";
import { downloadObject, FILES_BUCKET, moveObject, STAGING_BUCKET } from "storage";
import { validateMagicBytes } from "./stages/magicBytes.js";

export async function processJob(pool, s3, job) {
  const fileId = job.file_id;

  const { rows } = await pool.query(
    "SELECT staging_key, original_filename FROM files WHERE id = $1",
    [fileId]
  );
  const file = rows[0];
  if (!file) {
    console.warn(`job for unknown file ${fileId}, skipping`);
    return;
  }

  await transition(pool, fileId, "uploaded", "scanning");

  const buffer = await downloadObject(s3, STAGING_BUCKET, file.staging_key);
  const result = await validateMagicBytes(buffer, file.original_filename);

  if (!result.valid) {
    await transition(pool, fileId, "scanning", "failed", { reason: result.reason });
    console.warn(`file ${fileId} failed magic-bytes validation: ${result.reason}`);
    return;
  }

  await transition(pool, fileId, "scanning", "processing");

  await moveObject(s3, STAGING_BUCKET, file.staging_key, FILES_BUCKET);
  await pool.query("UPDATE files SET storage_key = $1 WHERE id = $2", [file.staging_key, fileId]);

  await transition(pool, fileId, "processing", "ready");
  console.log(`file ${fileId} is ready`);
}
