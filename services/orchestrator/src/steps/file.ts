import { s3Put, s3Get } from "../s3.js";
export async function filePut(bucket: string, key: string, body: string) {
  return s3Put(bucket, key, body);
}
export async function fileGet(bucket: string, key: string) {
  return s3Get(bucket, key);
}