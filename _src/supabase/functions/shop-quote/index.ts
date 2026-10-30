// POST { items: [{id, q}], country: "SI", promo: "CODE" }  ->  the price breakdown for the cart page.
// Read only. Never creates anything.
import { cors, json } from '../_shared/http.ts';
import { db, loadForPricing, shopOpen, today } from '../_shared/load.ts';
import { normaliseItems, normalisePromo, price } from '../_shared/pricing.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { ok: false, errors: [{ code: 'generic' }] }, 405);
  try {
    const body = await req.json();
    const items = normaliseItems(body.items);
    const country = typeof body.country === 'string' ? body.country.toUpperCase() : '';
    if (!items) return json(req, { ok: false, errors: [{ code: 'generic' }] }, 400);
    const sb = db();
    if (!(await shopOpen(sb))) return json(req, { ok: false, errors: [{ code: 'closed' }] });
    const promoCode = normalisePromo(body.promo);
    const { products, rate, promo } = await loadForPricing(sb, items, country, promoCode);
    return json(req, price(items, products, rate, promo, promoCode, country, today()));
  } catch (_e) {
    return json(req, { ok: false, errors: [{ code: 'generic' }] }, 500);
  }
});
