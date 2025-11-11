import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const reqJson = (await req.json().catch(() => ({}))) as {
      contentType?: string;
      ext?: string;
      prefix?: string;
    };
    const bucket   = process.env.LIFEBOOK_BUCKET;
    const kmsKey   = process.env.LIFEBOOK_KMS_KEY_ARN || undefined;
    const region   = process.env.AWS_REGION || "us-east-1";
    if (!bucket) {
      return NextResponse.json({ error: "Missing LIFEBOOK_BUCKET" }, { status: 500 });
    }

    const contentType = reqJson.contentType || "application/octet-stream";
    const ext         = (reqJson.ext || "bin").replace(/[^a-z0-9]/gi, "");
    const prefix      = (reqJson.prefix ?? "sources/").startsWith("sources/") ? reqJson.prefix! : "sources/";

    const key = `${prefix}${randomUUID()}.${ext}`.replace(/\/\//g, "/");

    const s3 = new S3Client({ region });

    const put = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "aws:kms",
      ...(kmsKey ? { SSEKMSKeyId: kmsKey } : {})
    });

    const url = await getSignedUrl(s3, put, { expiresIn: 900 });

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "x-amz-server-side-encryption": "aws:kms",
    };
    if (kmsKey) headers["x-amz-server-side-encryption-aws-kms-key-id"] = kmsKey;

    return NextResponse.json({ url, key, headers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "presign failed" }, { status: 500 });
  }
}
