import express from "express";
import { filesRouter } from "./routes/files.js";
import { hooksRouter } from "./routes/hooks.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(filesRouter);
app.use(hooksRouter);

app.listen(port, () => {
  console.log(`api listening on port ${port}`);
});
