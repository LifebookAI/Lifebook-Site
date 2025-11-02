import http from "http";
import crypto from "crypto";
import { Buffer } from "buffer";

const API_ID   = process.env.API_ID   ?? "snn2y6frnf";
const REGION   = process.env.REGION   ?? "us-east-1";
const API_KEY  = process.env.PRESIGN_API_KEY;          // 64-char
const HMAC_HEX = process.env.PRESIGN_HMAC_SECRET_HEX;  // 64 hex

if (!API_KEY || !HMAC_HEX) {
  console.error("Missing PRESIGN_API_KEY or PRESIGN_HMAC_SECRET_HEX");
  process.exit(1);
}

const base = `https://${API_ID}.execute-api.${REGION}.amazonaws.com`;

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/presign") {
    res.writeHead(404).end("Not found");
    return;
  }
  let chunks = [];
  for await (const c of req) chunks.push(c);
  const bodyStr = Buffer.concat(chunks).toString("utf8");

  const ts  = Math.floor(Date.now()/1000).toString();
  const sig = crypto.createHmac("sha256", Buffer.from(HMAC_HEX, "hex"))
                    .update(`${ts}.${bodyStr}`, "utf8").digest("hex");

  const r = await fetch(`${base}/presign`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "x-timestamp": ts,
      "x-signature": sig
    },
    body: bodyStr
  });

  const text = await r.text();
  res.writeHead(r.status, { "content-type": "application/json" }).end(text);
});

server.listen(3001, () => console.log("presign proxy on http://localhost:3001"));
