import { randomUUID } from "node:crypto";

export function createJob(fileId, attempt = 0) {
  return {
    job_id: randomUUID(),
    file_id: fileId,
    attempt,
    enqueued_at: new Date().toISOString(),
  };
}
