import express from "express";
import { filesRouter } from "./routes/files.js";
import { hooksRouter } from "./routes/hooks.js";

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(filesRouter);
  app.use(hooksRouter);

  return app;
}
