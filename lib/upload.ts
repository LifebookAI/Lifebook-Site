export type PresignHeaders = Record<string, string>;
export type PresignResponse = { url: string; headers: PresignHeaders; publicUrl?: string };

function isPresignResponse(x: unknown): x is PresignResponse {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  const okUrl = typeof o.url === "string";
  const okHeaders =
    typeof o.headers === "object" &&
    o.headers !== null &&
    Object.values(o.headers as Record<string, unknown>).every(v => typeof v === "string");
  const okPublic = o.publicUrl === undefined || typeof o.publicUrl === "string";
  return okUrl && okHeaders && okPublic;
}

export async function uploadFile(file: File): Promise<{ key: string; etag: string | null; publicUrl?: string }> {
  const ts = Math.floor(Date.now() / 1000);
  const key = `sources/uploads/${ts}-${encodeURIComponent(file.name)}`;

  const presignRes = await fetch("/api/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key,
      contentType: file.type || "application/octet-stream",
      contentDisposition: `inline; filename="${file.name}"`,
    }),
  });

  if (!presignRes.ok) {
    const text = await presignRes.text().catch(() => "");
    throw new Error(`Presign failed: ${presignRes.status} ${text}`);
  }

  const jsonUnknown: unknown = await presignRes.json();
  if (!isPresignResponse(jsonUnknown)) throw new Error("Bad presign response shape");
  const { url, headers, publicUrl } = jsonUnknown;

  const put = await fetch(url, { method: "PUT", headers, body: file });
  if (!put.ok) {
    const text = await put.text().catch(() => "");
    throw new Error(`PUT failed: ${put.status} ${text}`);
  }

  return { key, etag: put.headers.get("etag"), publicUrl };
}
