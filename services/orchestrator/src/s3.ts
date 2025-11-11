import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { readableStreamToText } from "./util.js";
const s3 = new S3Client({});

export async function s3Put(bucket: string, key: string, body: string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
  return { bucket, key };
}
export async function s3Get(bucket: string, key: string) {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return readableStreamToText(out.Body as any);
}