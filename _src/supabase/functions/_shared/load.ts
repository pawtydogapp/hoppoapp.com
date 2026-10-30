// Reads what pricing needs from the database, with the service role key (never exposed to the browser).
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Item, Product, Promo, Rate } from './pricing.ts';

export function db() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
}

export async function shopOpen(sb: ReturnType<typeof db>): Promise<boolean> {
  const { data } = await sb.from('app_config').select('value').eq('key', 'shop_enabled').maybeSingle();
  return data?.value === '1';
}

export async function loadForPricing(sb: ReturnType<typeof db>, items: Item[], country: string, promoCode: string) {
  const [p, r, c] = await Promise.all([
    sb.from('products').select('*').in('id', items.map((i) => i.id)),
    sb.from('shipping_rates').select('*').eq('country', country).maybeSingle(),
    promoCode ? sb.from('promo_codes').select('*').eq('code', promoCode).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (p.error || r.error || c.error) throw new Error('database read failed');
  const products = new Map<string, Product>((p.data || []).map((x: Product) => [x.id, x]));
  return { products, rate: (r.data || undefined) as Rate | undefined, promo: (c.data || undefined) as Promo | undefined };
}

export const today = () => new Date().toISOString().slice(0, 10);
