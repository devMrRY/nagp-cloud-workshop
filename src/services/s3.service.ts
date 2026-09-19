import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "eu-north-1",
});

const bucket = process.env.S3_BUCKET!;

export async function createPresignedPartUrl(
  key: string,
  uploadId: string,
  partNumber: number,
) {
  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 900, // 15 minutes
  });
}

export async function createPresignedGetUrl(
  key: string
) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3, command, {
    expiresIn: 3600, // 1 hour
  });
}

export async function createMultipartUpload(key: string, contentType: string, metadata: Record<string, string> = {}) {
  const result = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );

  if (!result.UploadId) {
    throw new Error("S3 did not return UploadId");
  }

  return result.UploadId;
}

export async function uploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  buffer: Buffer,
) {
  const result = await s3.send(
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: buffer,
    }),
  );

  if (!result.ETag) {
    throw new Error(`S3 did not return ETag for part ${partNumber}`);
  }

  return result.ETag;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: { PartNumber: number; ETag: string }[],
) {
  return s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts,
      },
    }),
  );
}

export async function abortMultipartUpload(key: string, uploadId: string) {
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    }),
  );
}
