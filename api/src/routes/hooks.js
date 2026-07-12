import { IllegalTransitionError, transition } from "db";
import express, { Router } from "express";
import { createJob, enqueue, PENDING_QUEUE } from "queue";
import { pool } from "../db.js";
import { redisClient } from "../redis.js";

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

    await enqueue(redisClient, PENDING_QUEUE, createJob(fileId));
  }

  res.status(200).end();
});
