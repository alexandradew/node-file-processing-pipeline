import express, { Router } from "express";
import { pool } from "../db.js";
import { IllegalTransitionError, transition } from "../domain/transition.js";

export const hooksRouter = Router();

const parseAnyBodyAsJson = express.json({ type: () => true });

hooksRouter.post("/internal/hooks/minio", parseAnyBodyAsJson, async (req, res) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token !== process.env.MINIO_WEBHOOK_TOKEN) {
    return res.status(401).end();
  }

  const records = req.body?.Records ?? [];

  for (const record of records) {
    if (!record.eventName?.startsWith("s3:ObjectCreated:")) continue;

    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, "%20"));
    const fileId = key.split("/")[0];

    try {
      await transition(pool, fileId, "pending", "uploaded");
    } catch (err) {
      if (err instanceof IllegalTransitionError) {
        console.warn(err.message);
        continue;
      }
      console.error("failed to mark file as uploaded", err);
      return res.status(500).end();
    }
  }

  res.status(200).end();
});
