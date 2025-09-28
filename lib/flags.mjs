import { SSMClient, GetParametersByPathCommand } from "@aws-sdk/client-ssm";

const ssm = new SSMClient({});
const PREFIX = "/lifebook/prod/flags";
let cache = { t: 0, data: {} };

export async function getFlags(ttlMs = 30000) {
  const now = Date.now();
  if (now - cache.t < ttlMs && Object.keys(cache.data).length) return cache.data;

  const out = {};
  let token;
  do {
    const res = await ssm.send(new GetParametersByPathCommand({
      Path: PREFIX, Recursive: false, WithDecryption: true, NextToken: token
    }));
    for (const p of res.Parameters ?? []) {
      const k = p.Name.replace(PREFIX + "/", "");
      out[k] = parseValue(p.Value);
    }
    token = res.NextToken;
  } while (token);

  cache = { t: now, data: out };
  return out;
}

function parseValue(v) {
  if (v === "true") return true;
  if (v === "false") return false;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}
