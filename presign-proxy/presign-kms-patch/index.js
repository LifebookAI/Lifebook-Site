"use strict";
const crypto = require("crypto");

function json(status, obj){
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(obj) };
}

exports.handler = async (event) => {
  // require aws-sdk *inside* the handler so a missing SDK doesn’t crash at init
  let AWS, S3;
  try {
    AWS = require("aws-sdk");
    S3  = new AWS.S3({ signatureVersion: "v4" });
  } catch (e) {
    console.error("aws-sdk require failed:", e);
    return json(500, { message: "aws-sdk not available in runtime" });
  }

  const BUCKET   = process.env.BUCKET_NAME;
  const KMS_ARN  = process.env.SSE_KMS_KEY_ARN;      // must be a *key ARN*
  const HMAC_HEX = process.env.PRESIGN_HMAC_SECRET || "";

  if (!BUCKET)   return json(500, { message: "Server missing BUCKET_NAME" });
  if (!KMS_ARN)  return json(500, { message: "Server missing SSE_KMS_KEY_ARN" });
  if (!/^[0-9a-fA-F]{64}$/.test(HMAC_HEX)) return json(500, { message: "Server HMAC misconfigured" });

  try {
    // headers (lowercase)
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([k,v]) => [String(k).toLowerCase(), v]));
    const tsStr = headers["x-timestamp"];
    const sig   = String(headers["x-signature"] || "").toLowerCase();
    if (!tsStr || !sig) return json(401, { message: "Missing HMAC headers" });

    const ts  = parseInt(tsStr, 10);
    const now = Math.floor(Date.now()/1000);
    if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return json(401, { message: "Stale timestamp" });

    // body (handle base64)
    const rawBody = event && event.body ? (event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body) : "{}";

    // verify HMAC over "<ts>.<rawBody>"
    const mac = crypto.createHmac("sha256", Buffer.from(HMAC_HEX, "hex"));
    mac.update(`${ts}.${rawBody}`);
    const expected = mac.digest("hex");
    if (expected !== sig) return json(401, { message: "Invalid signature" });

    // parse JSON
    let parsed;
    try { parsed = JSON.parse(rawBody); } catch (e) {
      console.error("JSON parse error:", e);
      return json(400, { message: "Invalid JSON body" });
    }

    const { key, contentType, contentDisposition } = parsed;
    if (!key) return json(400, { message: "Missing key" });

    const params = {
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType || "application/octet-stream",
      ContentDisposition: contentDisposition,
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: KMS_ARN,
      Expires: 900
    };

    // callback flavor to support all v2 builds
    const url = await new Promise((resolve, reject) =>
      S3.getSignedUrl("putObject", params, (err, u) => err ? reject(err) : resolve(u))
    );

    return json(200, {
      url,
      headers: {
        "Content-Type": params.ContentType,
        "Content-Disposition": params.ContentDisposition,
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
