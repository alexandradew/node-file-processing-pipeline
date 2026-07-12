import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function moveObject(client, sourceBucket, sourceKey, destBucket, destKey = sourceKey) {
  // CopySource needs each path segment percent-encoded, but "/" must stay literal
  // as the separator between bucket and key segments.
  const encodedKey = sourceKey.split("/").map(encodeURIComponent).join("/");

  await client.send(
    new CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      CopySource: `/${sourceBucket}/${encodedKey}`,
    })
  );

  await client.send(new DeleteObjectCommand({ Bucket: sourceBucket, Key: sourceKey }));
}
