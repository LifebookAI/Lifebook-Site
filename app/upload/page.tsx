/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useState, useRef } from 'react';
import type * as React from 'react';

type SignedUpload = {
  url: string;
  headers: Record<string, string>;
  publicUrl: string;
  key: string;
};
'use client';
import React, {} from "react";

type SignedUpload = {
  url: string;
  headers: Record<string, string>;
  publicUrl: string;
  key: string;
};
function slugify(name: string) {
  return String(name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._-]/g, '').replace(/-+/g, '-').replace(/^[-.]+|[-.]+$/g, '');
}

export default function UploadPage() {
  const [status, setStatus] = useState(''); const [link, setLink] = useState<string|null>(null); const [keyShown, setKeyShown] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement|null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault(); setStatus(''); setLink(null); setKeyShown(null);
    const file = fileRef.current?.files?.[0]; if (!file) return setStatus('Pick a file first.');
    if (file.size > 1024*1024*1024) return setStatus('File too large (max 1GB demo).');

    const ts = new Date().toISOString().replace(/[:.]/g,''); const key = `sources/${ts}-${slugify(file.name)||'upload.bin'}`;
    const body = { key, contentType: file.type || 'application/octet-stream', contentDisposition: 'inline' };

    setStatus('Requesting presigned PUT…');
    let presign: unknown;
    try {
      const r = await fetch('/api/presign', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`Presign failed: ${r.status} ${await r.text()}`);
      presign = await r.json();
    } catch (err: unknown) { setStatus(err instanceof Error ? err.message : 'Presign failed'); return; }

    const { url, headers: putHeadersMap, publicUrl, key: echoedKey } = presign || {};
    if (!url || !putHeadersMap) { setStatus('Presign response missing url/headers.'); return; }

    setStatus('Uploading to S3…');
    const putHeaders = new Headers(); Object.entries(putHeadersMap as Record<string,string>).forEach(([k,v])=>{ if(v!=null) putHeaders.set(k,String(v)); });

    try {
      const putRes = await fetch(url as string, { method:'PUT', headers: putHeaders, body: file });
      if (!putRes.ok) throw new Error(`PUT failed: ${putRes.status} ${await putRes.text()}`);
      setStatus('Upload complete.'); setKeyShown(echoedKey || key); setLink(publicUrl || null);
    } catch (err: unknown) { setStatus(err instanceof Error ? err.message : 'Presign failed'); }
  }

  return (
    <main style={{ padding:24, maxWidth:720 }}>
      <h1>Upload to S3 (presigned PUT)</h1>
      <form onSubmit={handleUpload} style={{ marginTop:16 }}>
        <input ref={fileRef} type="file" />
        <div style={{ marginTop:12 }}><button type="submit">Upload</button></div>
      </form>
      {status && <p style={{ marginTop:16 }}><b>Status:</b> {status}</p>}
      {keyShown && <p><b>Key:</b> <code>{keyShown}</code></p>}
      {link && <p><b>CloudFront URL:</b> <a href={link} target="_blank" rel="noreferrer">{link}</a></p>}
      <p style={{ marginTop:24, fontSize:12, opacity:.8 }}>Posts JSON to <code>/api/presign</code>, then PUTs the file with the exact headers provided.</p>
    </main>
  );
}










