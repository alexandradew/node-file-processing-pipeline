import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "../db.js";
import { s3, STAGING_BUCKET } from "../storage.js";

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

    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: STAGING_BUCKET, Key: stagingKey }),
      { expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS }
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
