import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

const client = new pg.Client({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
});

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows: applied } = await client.query("SELECT filename FROM schema_migrations");
  const appliedNames = new Set(applied.map((row) => row.filename));

  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith(".sql")).sort();

  const pending = files.filter((name) => !appliedNames.has(name));

  if (pending.length === 0) {
    console.log("no pending migrations");
  }

  for (const filename of pending) {
    const sql = await readFile(join(migrationsDir, filename), "utf8");
    console.log(`applying ${filename}`);

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  }
} finally {
  await client.end();
}
