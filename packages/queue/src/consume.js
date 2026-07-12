export async function consume(client, sourceQueue, processingQueue, timeoutSeconds = 5) {
  const raw = await client.blMove(sourceQueue, processingQueue, "RIGHT", "LEFT", timeoutSeconds);
  if (raw === null) return null;
  // keep the exact raw string around cuz it's what identifies this job's entry in the
  // processing list, needed later to remove it by value (lease release, reaper requeue)
  return { raw, job: JSON.parse(raw) };
}
