export const runtime = 'nodejs';
import crypto from 'crypto';

function signHmacHex(secretHex, msg) {
  if (!/^[a-f0-9]{64}$/i.test(secretHex || '')) throw new Error('PRESIGN_HMAC_SECRET must be 64 hex chars.');
  return crypto.createHmac('sha256', Buffer.from(secretHex, 'hex')).update(msg, 'utf8').digest('hex');
}
function joinUrl(base, path) {
  const b = (base || '').replace(/\/+$/, '');
  const p = (path || '').startsWith('/') ? path : `/${path || ''}`;
  return `${b}${p}`;
}

export async function POST(req) {
  try {
    const bodyStr = await req.text();
    if (!bodyStr || bodyStr.trim() === '') {
      return new Response(JSON.stringify({ error: 'Empty JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
    }

    let parsed;
    try { parsed = JSON.parse(bodyStr); }
    catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'content-type': 'application/json' } }); }

    const key = typeof parsed?.key === 'string' ? parsed.key : undefined;

    const base = process.env.PRESIGN_API_BASE || 'https://api.uselifebook.ai';
    const endpoint = process.env.PRESIGN_ENDPOINT || '/presign';
    const apiUrl = joinUrl(base, endpoint);
    const secretHex = process.env.PRESIGN_HMAC_SECRET || '';
    const apiKey = process.env.PRESIGN_API_KEY || '';
    const cfDomain = process.env.CLOUDFRONT_DOMAIN || 'files.uselifebook.ai';

    // === HMAC style toggle: dot (legacy) or newline ===
    const style = (process.env.PRESIGN_HMAC_STYLE || 'dot').toLowerCase(); // 'dot' | 'newline'
    const ts = Math.floor(Date.now() / 1000);
    const msg = style === 'newline' ? `${ts}\n${bodyStr}` : `${ts}.${bodyStr}`;
    const sig = signHmacHex(secretHex, msg);

    const headers = {
      'content-type': 'application/json',
      'x-timestamp': String(ts),
      'x-signature': sig,
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    const upstream = await fetch(apiUrl, { method: 'POST', headers, body: bodyStr });
    const text = await upstream.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: 'Upstream error', status: upstream.status, detail: json }), {
        status: 502, headers: { 'content-type': 'application/json' },
      });
    }

    const effectiveKey = json?.key || key;
    const publicUrl = json?.publicUrl || (effectiveKey ? `https://${cfDomain}/${effectiveKey}` : null);

    return new Response(JSON.stringify({ ...json, publicUrl, key: effectiveKey }), {
      status: 200, headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || 'Internal error' }), {
      status: 500, headers: { 'content-type': 'application/json' },
    });
  }
}
