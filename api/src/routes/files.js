import { Router } from "express";
import { randomUUID } from "node:crypto";
import { createPresignedUploadUrl, STAGING_BUCKET } from "storage";
import { pool } from "../db.js";
import { s3 } from "../storage.js";

const UPLOAD_URL_EXPIRES_IN_SECONDS = 15 * 60;

export const filesRouter = Router();

filesRouter.post("/files", async (req, res) => {
  const { filename, mimeType, sizeBytes } = req.body ?? {};

  if (!filename || typeof filename !== "string") {
    return res.status(400).json({ error: "filename is required" });
  }

  const fileId = randomUUID();
  const stagingKey = `${fileId}/${filename}`;

  try {
    const { rows } = await pool.query(
      `INSERT INTO files (id, status, original_filename, declared_mime_type, size_bytes, staging_key)
       VALUES ($1, 'pending', $2, $3, $4, $5)
       RETURNING id, status, staging_key, created_at`,
      [fileId, filename, mimeType ?? null, sizeBytes ?? null, stagingKey]
    );

    const uploadUrl = await createPresignedUploadUrl(
      s3,
      STAGING_BUCKET,
      stagingKey,
      UPLOAD_URL_EXPIRES_IN_SECONDS
    );

    res.status(201).json({
      file: rows[0],
      uploadUrl,
      expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    });
  } catch (err) {
    console.error("failed to create file record", err);
    res.status(500).json({ error: "internal error" });
  }
});
