/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { PutObjectCommand, PutObjectCommandInput, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

export interface PresignRequest {
  workspaceId: string;
  fileName: string;
  contentType: string;
  sha256: string; // 64 hex chars
}

export function hexToBase64(hex: string): string {
  if(!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("sha256 must be 64 hex chars");
  const bytes = Buffer.from(hex, "hex");
  return bytes.toString("base64");
}

export function buildPutInput(req: PresignRequest, bucket: string, kmsArn: string) : { key: string, guid: string, input: PutObjectCommandInput } {
  const guid = randomUUID();
  const key = `sources/${req.workspaceId}/${guid}/${req.fileName}`;
  const checksumB64 = hexToBase64(req.sha256);
  const input: PutObjectCommandInput = {
    Bucket: bucket,
    Key: key,
    ContentType: req.contentType,
    ChecksumSHA256: checksumB64,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: kmsArn
  };
  return { key, guid, input };
}

export async function presignPut(req: PresignRequest, ttlSeconds: number, s3: S3Client, bucket: string, kmsArn: string) {
  const { key, guid, input } = buildPutInput(req, bucket, kmsArn);
  const cmd = new PutObjectCommand(input);
  const url = await getSignedUrl(s3, cmd, { expiresIn: Math.min(ttlSeconds, 300) });
  const headers = {
    "content-type": input.ContentType!,
    "x-amz-checksum-sha256": input.ChecksumSHA256!,
    "x-amz-server-side-encryption": "aws:kms",
    "x-amz-server-side-encryption-aws-kms-key-id": kmsArn
  };
  return { url, method: "PUT", bucket, key, guid, headers };
}
