// Stripe webhook. Deploy with --no-verify-jwt: Stripe does not send a Supabase key, it signs the body instead.
// Events to send to this function (Stripe Dashboard, Developers, Webhooks):
//   checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired
import { db } from '../_shared/load.ts';
import { verifySignature } from '../_shared/stripe.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ok = (msg = 'ok') => new Response(msg, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const payload = await req.text();
  const valid = await verifySignature(payload, req.headers.get('stripe-signature') || '', Deno.env.get('STRIPE_WEBHOOK_SECRET') || '');
  if (!valid) return new Response('bad signature', { status: 400 });

  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response('bad json', { status: 400 }); }
  const s = event?.data?.object;
  const orderId = s?.client_reference_id;
  if (!s || typeof orderId !== 'string' || !UUID.test(orderId)) return ok('ignored');   // not one of our orders
  const sb = db();

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    if (s.payment_status !== 'paid') return ok('waiting for payment');
    const ship = s.collected_information?.shipping_details ?? s.shipping_details ?? null;   // field moved between Stripe API versions
    const cust = s.customer_details ?? {};
    const { error } = await sb.rpc('mark_order_paid', {
      p_order: orderId, p_session: s.id, p_intent: typeof s.payment_intent === 'string' ? s.payment_intent : null,
      p_amount: s.amount_total ?? null, p_email: cust.email ?? null, p_name: ship?.name ?? cust.name ?? null,
      p_phone: cust.phone ?? null, p_address: ship?.address ?? cust.address ?? null,
    });
    if (error) return new Response('database error', { status: 500 });   // Stripe retries
    return ok();
  }
  if (event.type === 'checkout.session.expired') {
    await sb.from('orders').update({ status: 'cancelled' }).eq('id', orderId).eq('status', 'pending');
    return ok();
  }
  return ok('ignored');
});
