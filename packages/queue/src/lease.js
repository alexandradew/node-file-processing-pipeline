import { LEASE_SET, LEASE_TTL_SECONDS, PROCESSING_QUEUE } from "./constants.js";

export async function acquireLease(client, raw, ttlSeconds = LEASE_TTL_SECONDS) {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  await client.zAdd(LEASE_SET, { score: expiresAt, value: raw });
}

// Releasing a lease means the job is fully done: drop it from both the lease set
// and the processing list, otherwise processing would grow forever on every success
export async function releaseLease(client, raw) {
  await client.zRem(LEASE_SET, raw);
  await client.lRem(PROCESSING_QUEUE, 1, raw);
}
