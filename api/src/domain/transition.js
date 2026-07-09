const STATE_MACHINE = {
  pending: ["uploaded"],
  uploaded: ["scanning"],
  scanning: ["processing", "quarantined", "failed"],
  processing: ["ready", "failed"],
  ready: [],
  quarantined: [],
  failed: [],
};

export class IllegalTransitionError extends Error {
  constructor(fileId, from, to) {
    super(`illegal transition for file ${fileId}: ${from} -> ${to}`);
    this.name = "IllegalTransitionError";
    this.fileId = fileId;
    this.from = from;
    this.to = to;
  }
}

export async function transition(pool, fileId, from, to) {
  const allowedTargets = STATE_MACHINE[from];
  if (!allowedTargets || !allowedTargets.includes(to)) {
    throw new IllegalTransitionError(fileId, from, to);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "UPDATE files SET status = $1, updated_at = now() WHERE id = $2 AND status = $3 RETURNING *",
      [to, fileId, from]
    );

    if (rows.length === 0) {
      throw new IllegalTransitionError(fileId, from, to);
    }

    await client.query(
      "INSERT INTO file_events (file_id, from_status, to_status) VALUES ($1, $2, $3)",
      [fileId, from, to]
    );

    await client.query("COMMIT");
    return rows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
