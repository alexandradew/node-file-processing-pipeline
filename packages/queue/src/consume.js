export async function consume(client, sourceQueue, processingQueue, timeoutSeconds = 5) {
  const raw = await client.blMove(sourceQueue, processingQueue, "RIGHT", "LEFT", timeoutSeconds);
  if (raw === null) return null;
  return JSON.parse(raw);
}
