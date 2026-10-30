// POST { items, country, promo, lang }  ->  { url } of a Stripe Checkout page.
// Prices, shipping and discounts are read from the database again here. Nothing the browser says about money is trusted.
// Creates a "pending" order first. The Stripe webhook turns it into "paid".
import { cors, json } from '../_shared/http.ts';
import { db, loadForPricing, shopOpen, today } from '../_shared/load.ts';
import { normaliseItems, normalisePromo, price } from '../_shared/pricing.ts';
import { stripePost } from '../_shared/stripe.ts';

const SITE = Deno.env.get('SITE_URL') || 'https://hoppoapp.com';
const LANGS = ['en', 'de', 'es', 'fr', 'hr', 'it', 'nl', 'pl', 'pt', 'ro', 'sl'];
const SHIP: Record<string, string> = { en: 'Shipping', de: 'Versand', es: 'Envío', fr: 'Livraison', hr: 'Dostava', it: 'Spedizione', nl: 'Verzending', pl: 'Wysyłka', pt: 'Envio', ro: 'Livrare', sl: 'Dostava' };
const FREE: Record<string, string> = { en: 'Free shipping', de: 'Kostenloser Versand', es: 'Envío gratis', fr: 'Livraison gratuite', hr: 'Besplatna dostava', it: 'Spedizione gratuita', nl: 'Gratis verzending', pl: 'Darmowa wysyłka', pt: 'Envio gratuito', ro: 'Livrare gratuită', sl: 'Brezplačna dostava' };
const fail = (req: Request, code = 'generic', status = 200) => json(req, { ok: false, errors: [{ code }] }, status);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return fail(req, 'generic', 405);
  const secret = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret) return fail(req, 'generic', 500);
  const sb = db();
  let orderId: string | null = null;
  try {
    const body = await req.json();
    const items = normaliseItems(body.items);
    const country = typeof body.country === 'string' ? body.country.toUpperCase() : '';
    const lang = LANGS.includes(body.lang) ? body.lang : 'en';
    if (!items) return fail(req, 'generic', 400);
    if (!(await shopOpen(sb))) return fail(req, 'closed');

    const promoCode = normalisePromo(body.promo);
    const { products, rate, promo } = await loadForPricing(sb, items, country, promoCode);
    const q = price(items, products, rate, promo, promoCode, country, today());
    if (!q.ok) return json(req, q);

    // 1. pending order and its lines
    const { data: order, error: oe } = await sb.from('orders').insert({
      status: 'pending', lang, country, promo_code: q.promo, subtotal_cents: q.subtotal_cents,
      discount_cents: q.discount_cents, shipping_cents: q.shipping_cents, total_cents: q.total_cents,
    }).select('id, number').single();
    if (oe || !order) throw new Error('order insert failed');
    orderId = order.id;
    const { error: le } = await sb.from('order_items').insert(q.lines.map((l) => ({
      order_id: order.id, product_id: l.id, name: products.get(l.id)!.name.en, unit_cents: l.unit_cents, qty: l.qty,
    })));
    if (le) throw new Error('items insert failed');

    // 2. discount as a one use Stripe coupon
    let couponId: string | null = null;
    if (q.discount_cents > 0) {
      const c = await stripePost('coupons', { amount_off: q.discount_cents, currency: 'eur', duration: 'once', max_redemptions: 1, name: q.promo }, secret);
      if (!c.ok) throw new Error('coupon failed');
      couponId = c.json.id;
    }

    // 3. Stripe Checkout session
    const prefix = lang === 'en' ? '' : '/' + lang;
    const session = await stripePost('checkout/sessions', {
      mode: 'payment', locale: lang, client_reference_id: order.id,
      success_url: `${SITE}${prefix}/order-complete.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}${prefix}/cart.html`,
      line_items: q.lines.map((l) => {
        const p = products.get(l.id)!;
        const img = (p.images || []).find((u) => /^https:\/\//.test(u));
        return { quantity: l.qty, price_data: { currency: 'eur', unit_amount: l.unit_cents, product_data: { name: p.name[lang] || p.name.en, ...(img ? { images: [img] } : {}) } } };
      }),
      phone_number_collection: { enabled: true },
      shipping_address_collection: { allowed_countries: [country] },
      shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: q.shipping_cents ? SHIP[lang] : FREE[lang], fixed_amount: { amount: q.shipping_cents, currency: 'eur' } } }],
      metadata: { order_id: order.id, order_number: String(order.number) },
      payment_intent_data: { metadata: { order_id: order.id, order_number: String(order.number) } },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
    }, secret);
    if (!session.ok || !session.json.url) throw new Error('stripe session failed ' + session.status);

    await sb.from('orders').update({ stripe_session_id: session.json.id }).eq('id', order.id);
    return json(req, { ok: true, url: session.json.url, order: order.number });
  } catch (e) {
    if (orderId) await sb.from('orders').update({ status: 'cancelled', note: 'checkout error: ' + String((e as Error).message).slice(0, 200) }).eq('id', orderId);
    return fail(req, 'generic', 500);
  }
});
