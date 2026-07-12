import { LEASE_SET, PENDING_QUEUE, PROCESSING_QUEUE } from "./constants.js";

// Finds leases past their expiration and puts those jobs back on the pending queue.
// ZREM returning 0 means another reaper tick (or another worker) already claimed this
// expired lease first means it's safer to run concurrently from multiple workers.
export async function reap(client) {
  const now = Date.now();
  const expired = await client.zRangeByScore(LEASE_SET, 0, now);

  let requeued = 0;
  for (const raw of expired) {
    const claimed = await client.zRem(LEASE_SET, raw);
    if (claimed === 0) continue;

    await client.lRem(PROCESSING_QUEUE, 1, raw);

    const job = JSON.parse(raw);
    job.attempt += 1;
    await client.lPush(PENDING_QUEUE, JSON.stringify(job));
    requeued++;
  }

  return requeued;
}
