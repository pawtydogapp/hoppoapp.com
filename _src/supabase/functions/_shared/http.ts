// CORS and JSON helpers shared by the shop functions.
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') || 'https://hoppoapp.com,https://www.hoppoapp.com').split(',').map((s) => s.trim());

export function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}
