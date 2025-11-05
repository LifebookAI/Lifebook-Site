import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

/** convert readable stream -> Uint8Array */
async function streamToBytes(stream) {
  if (typeof stream?.transformToByteArray === "function") {
    return await stream.transformToByteArray();
  }
  const chunks = [];
  for await (const chunk of stream) { chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); }
  return new Uint8Array(Buffer.concat(chunks));
}

/**
 * Transcribe via OpenAI audio transcriptions endpoint.
 * input: { bucket, key, region }
 * cfg  : { apiKey, model='whisper-1', baseUrl='https://api.openai.com' }
 */
export async function transcribeOpenAI(input, cfg) {
  const { bucket, key, region } = input;
  const { apiKey, model = "whisper-1", baseUrl = "https://api.openai.com" } = cfg;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const s3 = new S3Client({ region });
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bytes = await streamToBytes(obj.Body);

  // Use Node 20+ global fetch + FormData/Blob
  const file = new Blob([bytes], { type: "application/octet-stream" });
  const form = new FormData();
  form.append("model", model);
  form.append("file", file, key.split("/").pop() || "audio.bin");

  const resp = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`OpenAI STT failed: ${resp.status} ${t}`);
  }
  const data = await resp.json();
  const text = data?.text ?? (typeof data === "string" ? data : JSON.stringify(data));
  const tokens = data?.usage?.total_tokens ?? 0;
  return { text, tokens, durationSec: 0, provider: "openai" };
}
