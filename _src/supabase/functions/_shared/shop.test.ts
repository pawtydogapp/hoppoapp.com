// Run:  node --test _src/supabase/functions/_shared/shop.test.ts   (Node 22.18 or newer)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { price, normaliseItems, normalisePromo } from './pricing.ts';
import { flatten, verifySignature } from './stripe.ts';

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222';
const P = (o = {}) => ({ id: A, active: true, name: { en: 'Book' }, price_cents: 1290, stock: 10, max_per_order: 5, countries: [], ...o });
const products = (...ps: any[]) => new Map(ps.map((p) => [p.id, p]));
const rate = (o = {}) => ({ country: 'SI', active: true, price_cents: 390, free_over_cents: 4000, days_min: 2, days_max: 4, ...o });
const promo = (o = {}) => ({ code: 'HOPPO10', active: true, kind: 'percent', value: 10, free_shipping: false, min_subtotal_cents: 0, starts_at: null, ends_at: null, max_uses: null, used_count: 0, ...o });
const T = '2026-10-30';

test('basic order with shipping', () => {
  const q: any = price([{ id: A, q: 2 }], products(P()), rate(), undefined, '', 'SI', T);
  assert.equal(q.ok, true); assert.equal(q.subtotal_cents, 2580); assert.equal(q.shipping_cents, 390); assert.equal(q.total_cents, 2970);
});
test('free shipping over the threshold, measured after discount', () => {
  let q: any = price([{ id: A, q: 4 }], products(P()), rate(), undefined, '', 'SI', T);      // 5160 >= 4000
  assert.equal(q.shipping_cents, 0); assert.equal(q.total_cents, 5160);
  q = price([{ id: A, q: 4 }], products(P({ price_cents: 1050 })), rate(), promo({ value: 10 }), 'HOPPO10', 'SI', T); // 4200 - 420 = 3780 < 4000
  assert.equal(q.discount_cents, 420); assert.equal(q.shipping_cents, 390); assert.equal(q.total_cents, 3780 + 390);
});
test('percent discount rounds down, fixed discount cannot exceed subtotal', () => {
  let q: any = price([{ id: A, q: 1 }], products(P({ price_cents: 999 })), rate(), promo({ value: 15 }), 'HOPPO10', 'SI', T);
  assert.equal(q.discount_cents, 149);                                                       // floor(149.85)
  q = price([{ id: A, q: 1 }], products(P({ price_cents: 1000 })), rate(), promo({ kind: 'fixed', value: 5000 }), 'HOPPO10', 'SI', T);
  assert.equal(q.ok, true); assert.equal(q.discount_cents, 1000);                            // capped at the subtotal
});
test('full discount still pays shipping unless the code gives free shipping', () => {
  let q: any = price([{ id: A, q: 1 }], products(P({ price_cents: 1000 })), rate(), promo({ kind: 'fixed', value: 5000 }), 'HOPPO10', 'SI', T);
  assert.equal(q.ok, true); assert.equal(q.discount_cents, 1000); assert.equal(q.total_cents, 390);
  q = price([{ id: A, q: 1 }], products(P({ price_cents: 1000 })), rate(), promo({ kind: 'fixed', value: 5000, free_shipping: true }), 'HOPPO10', 'SI', T);
  assert.equal(q.ok, false); assert.equal(q.errors[0].code, 'min_total');                    // total 0 cannot be charged
});
test('promo errors', () => {
  const run = (pr: any, code = 'HOPPO10') => (price([{ id: A, q: 1 }], products(P()), rate(), pr, code, 'SI', T) as any).errors?.[0]?.code;
  assert.equal(run(undefined, 'NOPE'), 'promo'); assert.equal(run(promo({ active: false })), 'promo');
  assert.equal(run(promo({ ends_at: '2026-10-29' })), 'promo_expired'); assert.equal(run(promo({ starts_at: '2026-10-31' })), 'promo_expired');
  assert.equal(run(promo({ max_uses: 5, used_count: 5 })), 'promo_expired'); assert.equal(run(promo({ min_subtotal_cents: 5000 })), 'promo_min');
  assert.equal(run(promo({ ends_at: T })), undefined);                                       // last day still valid
});
test('product and country rules', () => {
  const code = (items: any, pm: any, r: any, c = 'SI') => (price(items, pm, r, undefined, '', c, T) as any).errors?.map((e: any) => e.code);
  assert.deepEqual(code([{ id: B, q: 1 }], products(P()), rate()), ['unknown_product']);
  assert.deepEqual(code([{ id: A, q: 1 }], products(P({ active: false })), rate()), ['inactive']);
  assert.deepEqual(code([{ id: A, q: 6 }], products(P()), rate()), ['max_qty']);
  assert.deepEqual(code([{ id: A, q: 3 }], products(P({ stock: 2 })), rate()), ['stock']);
  assert.deepEqual(code([{ id: A, q: 1 }], products(P()), undefined, 'US'), ['country']);
  assert.deepEqual(code([{ id: A, q: 1 }], products(P()), rate({ country: 'AT' }), 'AT'), undefined);
  assert.deepEqual(code([{ id: A, q: 1 }], products(P({ countries: ['SI'] })), rate({ country: 'DE' }), 'DE'), ['inactive']);
  assert.deepEqual(code([{ id: A, q: 1 }], products(P()), rate({ active: false })), ['country']);
  assert.deepEqual(code([{ id: A, q: 1 }], products(P()), rate({ country: 'CH' }), 'CH'), ['country']);   // not in the EU
});
test('the browser cannot set a price', () => {
  const items = normaliseItems([{ id: A, q: 1, price_cents: 1 }])!;
  const q: any = price(items, products(P()), rate(), undefined, '', 'SI', T);
  assert.equal(q.lines[0].unit_cents, 1290);
});
test('cart shape validation', () => {
  assert.equal(normaliseItems([]), null); assert.equal(normaliseItems('x'), null); assert.equal(normaliseItems([{ id: 'nope', q: 1 }]), null);
  assert.equal(normaliseItems([{ id: A, q: 0 }]), null); assert.equal(normaliseItems([{ id: A, q: 1.5 }]), null); assert.equal(normaliseItems([{ id: A, q: 100 }]), null);
  assert.equal(normaliseItems(Array.from({ length: 11 }, () => ({ id: A, q: 1 }))), null);
  assert.deepEqual(normaliseItems([{ id: A.toUpperCase(), q: 1 }, { id: A, q: 2 }]), [{ id: A, q: 3 }]);
  assert.equal(normalisePromo('  hoppo10 '), 'HOPPO10'); assert.equal(normalisePromo(5), '');
});
test('stripe form encoding', () => {
  const f = flatten({ mode: 'payment', line_items: [{ quantity: 2, price_data: { currency: 'eur', unit_amount: 1290 } }], metadata: { a: 'b' }, skip: undefined });
  assert.equal(f['line_items[0][price_data][unit_amount]'], '1290'); assert.equal(f['metadata[a]'], 'b'); assert.equal(f.mode, 'payment'); assert.equal('skip' in f, false);
});
test('stripe signature', async () => {
  const secret = 'whsec_test', body = '{"id":"evt_1"}', t = 1793000000;
  const sig = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  assert.equal(await verifySignature(body, `t=${t},v1=${sig}`, secret, 300, t + 10), true);
  assert.equal(await verifySignature(body, `t=${t},v1=${sig}`, secret, 300, t + 1000), false);      // too old
  assert.equal(await verifySignature(body + ' ', `t=${t},v1=${sig}`, secret, 300, t), false);       // body changed
  assert.equal(await verifySignature(body, `t=${t},v1=${sig}`, 'other', 300, t), false);            // wrong secret
  assert.equal(await verifySignature(body, `t=${t},v1=bad,v1=${sig}`, secret, 300, t), true);       // second v1 is fine
  assert.equal(await verifySignature(body, '', secret, 300, t), false);
});
