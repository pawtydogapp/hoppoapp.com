// Hoppo shop pricing. One place decides every price, discount and shipping cost.
// Used by shop-quote (cart preview) and shop-checkout (the real order), so they can never disagree.
// Pure functions: no network, no database. Tested in pricing.test.ts.

export const EU = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE'];
export const MAX_LINES = 10;
export const MIN_TOTAL_CENTS = 50;   // Stripe cannot charge less than 0.50 EUR

export interface Product { id: string; active: boolean; name: Record<string, string>; price_cents: number; stock: number | null; max_per_order: number; countries: string[]; images?: string[] }
export interface Rate { country: string; active: boolean; price_cents: number; free_over_cents: number | null; days_min: number | null; days_max: number | null }
export interface Promo { code: string; active: boolean; kind: 'percent' | 'fixed'; value: number; free_shipping: boolean; min_subtotal_cents: number; starts_at: string | null; ends_at: string | null; max_uses: number | null; used_count: number }
export interface Item { id: string; q: number }
export interface Err { code: string; id?: string; max?: number }
export interface Line { id: string; qty: number; unit_cents: number; line_cents: number }
export type Quote =
  | { ok: true; lines: Line[]; subtotal_cents: number; discount_cents: number; shipping_cents: number; total_cents: number;
      promo: string | null; free_shipping: boolean; days_min: number | null; days_max: number | null }
  | { ok: false; errors: Err[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Checks the shape of the cart sent by the browser. Returns null when it is not valid. Merges duplicate lines. */
export function normaliseItems(raw: unknown): Item[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LINES) return null;
  const merged = new Map<string, number>();
  for (const r of raw) {
    const id = r && typeof (r as Item).id === 'string' ? (r as Item).id.toLowerCase() : '';
    const q = r ? Number((r as Item).q) : NaN;
    if (!UUID.test(id) || !Number.isInteger(q) || q < 1 || q > 99) return null;
    merged.set(id, (merged.get(id) || 0) + q);
  }
  return [...merged].map(([id, q]) => ({ id, q }));
}

export function normalisePromo(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase().slice(0, 32) : '';
}

/** today is an ISO date such as 2026-10-30. */
export function price(items: Item[], products: Map<string, Product>, rate: Rate | undefined, promo: Promo | undefined,
                      promoCode: string, country: string, today: string): Quote {
  const errors: Err[] = [];
  if (!EU.includes(country) || !rate || !rate.active) errors.push({ code: 'country' });

  const lines: Line[] = [];
  let subtotal = 0;
  for (const it of items) {
    const p = products.get(it.id);
    if (!p) { errors.push({ code: 'unknown_product', id: it.id }); continue; }
    if (!p.active) { errors.push({ code: 'inactive', id: it.id }); continue; }
    if (p.countries && p.countries.length && !p.countries.includes(country)) { errors.push({ code: 'inactive', id: it.id }); continue; }
    if (it.q > p.max_per_order) { errors.push({ code: 'max_qty', id: it.id, max: p.max_per_order }); continue; }
    if (p.stock !== null && p.stock !== undefined && it.q > p.stock) { errors.push({ code: 'stock', id: it.id }); continue; }
    const line = p.price_cents * it.q;
    lines.push({ id: it.id, qty: it.q, unit_cents: p.price_cents, line_cents: line });
    subtotal += line;
  }

  let discount = 0, freeShipping = false, appliedPromo: string | null = null;
  if (promoCode) {
    if (!promo || !promo.active) errors.push({ code: 'promo' });
    else if ((promo.starts_at && promo.starts_at > today) || (promo.ends_at && promo.ends_at < today)
             || (promo.max_uses !== null && promo.max_uses !== undefined && promo.used_count >= promo.max_uses)) errors.push({ code: 'promo_expired' });
    else if (subtotal < promo.min_subtotal_cents) errors.push({ code: 'promo_min' });
    else {
      appliedPromo = promo.code;
      discount = promo.kind === 'percent' ? Math.floor(subtotal * promo.value / 100) : Math.min(promo.value, subtotal);
      freeShipping = promo.free_shipping;
    }
  }
  if (errors.length) return { ok: false, errors };

  const afterDiscount = subtotal - discount;
  const r = rate as Rate;
  const free = freeShipping || (r.free_over_cents !== null && r.free_over_cents !== undefined && afterDiscount >= r.free_over_cents);
  const shipping = free ? 0 : r.price_cents;
  const total = afterDiscount + shipping;
  if (total < MIN_TOTAL_CENTS) return { ok: false, errors: [{ code: 'min_total' }] };
  return { ok: true, lines, subtotal_cents: subtotal, discount_cents: discount, shipping_cents: shipping, total_cents: total,
           promo: appliedPromo, free_shipping: free, days_min: r.days_min, days_max: r.days_max };
}
