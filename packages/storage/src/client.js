import { S3Client } from "@aws-sdk/client-s3";

export function createS3Client() {
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT || "http://localhost:9000",
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.MINIO_ROOT_USER,
      secretAccessKey: process.env.MINIO_ROOT_PASSWORD,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}
