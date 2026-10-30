// Minimal Stripe helpers using plain fetch, so no library is needed in the Edge Functions.

/** Turns nested objects and arrays into Stripe form fields: a[b][0][c]=value. */
export function flatten(obj: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) { obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out)); return out; }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) flatten(v, prefix ? `${prefix}[${k}]` : k, out);
    return out;
  }
  out[prefix] = String(obj);
  return out;
}

export async function stripePost(path: string, body: unknown, secretKey: string): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + secretKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(flatten(body)).toString(),
  });
  return { ok: res.ok, status: res.status, json: await res.json().catch(() => ({})) };
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks the Stripe-Signature header against the raw request body. nowSec is injectable for tests. */
export async function verifySignature(payload: string, header: string, secret: string, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find((p) => p[0] === 't')?.[1];
  const sigs = parts.filter((p) => p[0] === 'v1').map((p) => p[1]);
  if (!t || !sigs.length || Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return sigs.some((s) => safeEqual(s, expected));
}

export { hmacHex };
