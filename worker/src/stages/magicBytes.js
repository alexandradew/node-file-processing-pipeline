import { fileTypeFromBuffer } from "file-type";

const EXPECTED_MIME_BY_EXTENSION = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  zip: "application/zip",
};

export async function validateMagicBytes(buffer, filename) {
  const ext = filename.split(".").pop()?.toLowerCase();
  const expectedMime = EXPECTED_MIME_BY_EXTENSION[ext];

  if (!expectedMime) {
    return { valid: true };
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected || detected.mime !== expectedMime) {
    return {
      valid: false,
      reason: `.${ext} should be ${expectedMime}, detected ${detected?.mime ?? "no recognizable signature"}`,
    };
  }

  return { valid: true, detectedMime: detected.mime };
}
