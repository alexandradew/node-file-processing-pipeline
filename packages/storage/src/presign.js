import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function createPresignedUploadUrl(client, bucket, key, expiresInSeconds) {
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function createPresignedDownloadUrl(
  client,
  bucket,
  key,
  expiresInSeconds,
  downloadFilename
) {
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      // forces the browser to download instead of rendering the response inline
      // otherwise a stored HTML/SVG upload could execute as a same-origin XSS.
      ResponseContentDisposition: buildContentDisposition(downloadFilename),
    }),
    { expiresIn: expiresInSeconds }
  );
}

function buildContentDisposition(filename) {
  // strip control chars and quotes so a crafted filename can't break out of the
  // header value (response header injection via a malicious original_filename).
  const asciiSafe = filename.replace(/[\x00-\x1f\x7f"]/g, "");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encoded}`;
}
