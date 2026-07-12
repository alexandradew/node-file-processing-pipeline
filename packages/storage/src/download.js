import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function downloadObject(client, bucket, key) {
  const output = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await output.Body.transformToByteArray();
  return Buffer.from(bytes);
}
