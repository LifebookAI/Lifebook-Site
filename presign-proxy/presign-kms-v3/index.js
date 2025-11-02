"use strict";
const crypto = require("crypto");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

function json(status, obj){
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  const BUCKET   = process.env.BUCKET_NAME;
  const KMS_ARN  = process.env.SSE_KMS_KEY_ARN;           // must be a *key ARN*
  const HMAC_HEX = process.env.PRESIGN_HMAC_SECRET || "";

  if (!BUCKET)   return json(500, { message: "Server missing BUCKET_NAME" });
  if (!KMS_ARN)  return json(500, { message: "Server missing SSE_KMS_KEY_ARN" });
  if (!/^[0-9a-fA-F]{64}$/.test(HMAC_HEX)) return json(500, { message: "Server HMAC misconfigured" });

  try {
    // lowercased headers
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [String(k).toLowerCase(), v]));
    const tsStr = headers["x-timestamp"];
    const sig   = String(headers["x-signature"] || "").toLowerCase();
    if (!tsStr || !sig) return json(401, { message: "Missing HMAC headers" });

    const ts  = parseInt(tsStr, 10);
    const now = Math.floor(Date.now()/1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return json(401, { message: "Stale timestamp" });

    // handle API GW base64
    const rawBody = event && event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : "{}";

    // verify "<ts>.<rawBody>"
    const mac = crypto.createHmac("sha256", Buffer.from(HMAC_HEX, "hex"));
    mac.update(`${ts}.${rawBody}`);
    const expected = mac.digest("hex");
    if (expected !== sig) return json(401, { message: "Invalid signature" });

    let parsed;
    try { parsed = JSON.parse(rawBody); }
    catch (e) { console.error("JSON parse error:", e); return json(400, { message: "Invalid JSON body" }); }

    const { key, contentType, contentDisposition } = parsed;
    if (!key) return json(400, { message: "Missing key" });

    // v3 presign — include SSE + key id so S3 sees them as *signed* headers
    const client = new S3Client(); // region picked up from env
    const cmd = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "application/octet-stream",
      ContentDisposition: contentDisposition,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: KMS_ARN
    });
    const url = await getSignedUrl(client, cmd, { expiresIn: 900 });

    return json(200, {
      url,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": contentDisposition,
        "x-amz-server-side-encryption": "aws:kms",
        "x-amz-server-side-encryption-aws-kms-key-id": KMS_ARN
      },
      publicUrl: process.env.PUBLIC_URL_BASE ? `${process.env.PUBLIC_URL_BASE}/${key}` : undefined
    });
  } catch (e) {
    console.error("Unhandled error:", e && e.stack || e);
    return json(500, { message: "Internal error" });
  }
};
