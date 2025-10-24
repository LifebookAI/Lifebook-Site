import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

type PresignRequest = {
  key: string;
  contentType?: string;
  contentDisposition?: string;
};

function isPresignRequest(x: unknown): x is PresignRequest {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.key === "string"
    && (o.contentType === undefined || typeof o.contentType === "string")
    && (o.contentDisposition === undefined || typeof o.contentDisposition === "string");
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const env = process.env as Record<string, string | undefined>;
  const PRESIGN_ENDPOINT = env.PRESIGN_ENDPOINT;
  const AUTH_API_KEY = env.AUTH_API_KEY;
  const PRESIGN_HMAC_HEX = (env.PRESIGN_HMAC_SECRET ?? "").trim();

  if (!PRESIGN_ENDPOINT || !AUTH_API_KEY || !PRESIGN_HMAC_HEX) {
    return NextResponse.json({ message: "Missing server configuration" }, { status: 500 });
  }
  if (!/^[0-9a-fA-F]{64}$/.test(PRESIGN_HMAC_HEX)) {
    return NextResponse.json({ message: "Server HMAC misconfigured" }, { status: 500 });
  }

  let unknownBody: unknown;
  try {
    unknownBody = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!isPresignRequest(unknownBody)) {
    return NextResponse.json({ message: "Invalid body" }, { status: 400 });
  }

  const { key, contentType, contentDisposition } = unknownBody;
  const ts = Math.floor(Date.now() / 1000);
  const bodyStr = JSON.stringify({ key, contentType, contentDisposition });

  const sig = crypto
    .createHmac("sha256", Buffer.from(PRESIGN_HMAC_HEX, "hex"))
    .update(`${ts}.${bodyStr}`)
    .digest("hex");

  const upstream = await fetch(PRESIGN_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": AUTH_API_KEY,
      "x-timestamp": String(ts),
      "x-signature": sig,
    },
    body: bodyStr,
  });

  let payload: unknown = null;
  try { payload = await upstream.json(); } catch { /* ignore */ }

  if (!upstream.ok) {
    const err = (payload && typeof payload === "object") ? payload : { message: "Upstream error" };
    return NextResponse.json(err, { status: upstream.status });
  }

  // Pass through upstream JSON (shape: { url, headers, publicUrl? })
  return NextResponse.json(payload);
}
export function GET() {
  return NextResponse.json({ alive: true });
}



