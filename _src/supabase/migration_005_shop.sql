-- Hoppo migration 005: own shop with cart (30 October 2026)
-- Run ONCE in the Hoppo Supabase project: SQL Editor, New query, paste, Run.
-- Run it after schema.sql and migrations 002, 003 and 004. Safe to run again.
--
-- What it adds
--   products        Hoppo family products. Name and description per language. Edit in Table Editor.
--   shipping_rates  1 row per EU country: price, optional free shipping threshold, delivery days.
--   promo_codes     discount codes: percent or fixed amount, optional free shipping.
--   orders          1 row per order, written only by the shop functions, never by the browser.
--   order_items     what was in each order, with the price at the time.
--   app_config      new key shop_enabled. Empty = the shop shows "coming soon". 1 = products and cart are live.
--
-- Prices are in euro cents and INCLUDE VAT (1290 = 12.90 EUR).
-- The website and the app read products and shipping_rates with the public key. Orders and
-- promo codes are never readable with the public key. Only the Edge Functions (service role) touch them.

-- ============ products ============
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique check (slug ~ '^[a-z0-9-]+$'),
  active           boolean not null default false,
  sort             int not null default 100,
  name             jsonb not null,                       -- {"en": "Hippo colouring book", "sl": "Pobarvanka"}
  description      jsonb not null default '{}',          -- same shape. New lines become paragraphs.
  category         text not null default 'toys'
                   check (category in ('equipment','toys','food','services','insurance')),
  price_cents      int  not null check (price_cents >= 50),
  compare_at_cents int  check (compare_at_cents is null or compare_at_cents > price_cents),  -- crossed out price
  images           text[] not null default '{}',         -- https URLs, first one is the main picture
  stock            int,                                  -- null = not tracked
  max_per_order    int  not null default 10 check (max_per_order between 1 and 99),
  weight_g         int,
  vat_rate         numeric(4,2),                         -- information only, prices already include VAT
  countries        text[] not null default '{}',         -- empty = every country in shipping_rates
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint products_name_has_en check (name ? 'en')
);
alter table public.products enable row level security;
drop policy if exists "read active products" on public.products;
create policy "read active products" on public.products for select using (active);

-- ============ shipping_rates ============
create table if not exists public.shipping_rates (
  country         text primary key
                  check (country in ('AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE')),
  active          boolean not null default true,
  price_cents     int not null check (price_cents >= 0),
  free_over_cents int check (free_over_cents is null or free_over_cents > 0),  -- free shipping from this order value
  days_min        int,
  days_max        int
);
alter table public.shipping_rates enable row level security;
drop policy if exists "read active shipping" on public.shipping_rates;
create policy "read active shipping" on public.shipping_rates for select using (active);

-- ============ promo_codes ============
create table if not exists public.promo_codes (
  code               text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,32}$'),
  active             boolean not null default true,
  kind               text not null check (kind in ('percent','fixed')),
  value              int  not null check (value > 0),     -- percent (1 to 100) or euro cents
  free_shipping      boolean not null default false,
  min_subtotal_cents int  not null default 0,
  starts_at          date,
  ends_at            date,
  max_uses           int,
  used_count         int  not null default 0,
  note               text,
  constraint promo_percent_range check (kind <> 'percent' or value <= 100)
);
alter table public.promo_codes enable row level security;     -- no policy: the browser can never read codes

-- ============ orders ============
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  number            bigint generated always as identity (start with 1001),
  status            text not null default 'pending'
                    check (status in ('pending','paid','packed','shipped','delivered','refunded','cancelled')),
  stripe_session_id text unique,
  stripe_payment_intent text,
  lang              text not null default 'en',
  country           text not null,
  promo_code        text,
  subtotal_cents    int not null,
  discount_cents    int not null default 0,
  shipping_cents    int not null default 0,
  total_cents       int not null,
  email             text,
  name              text,
  phone             text,
  address           jsonb,
  tracking          text,
  note              text,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  shipped_at        timestamptz
);
alter table public.orders enable row level security;          -- no policy: server only

create table if not exists public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  unit_cents  int not null,
  qty         int not null check (qty > 0)
);
alter table public.order_items enable row level security;     -- no policy: server only
create index if not exists order_items_order on public.order_items(order_id);
create index if not exists orders_status on public.orders(status, created_at desc);

-- A readable list for packing, visible in the dashboard Table Editor.
create or replace view public.orders_to_ship with (security_invoker = true) as
  select o.number, o.status, o.created_at, o.name, o.email, o.phone, o.address, o.country,
         (select string_agg(i.qty || ' x ' || i.name, ', ' order by i.name) from public.order_items i where i.order_id = o.id) as items,
         o.total_cents, o.promo_code, o.tracking, o.note
  from public.orders o
  where o.status in ('paid','packed')
  order by o.created_at;

-- ============ mark an order paid (called by the Stripe webhook function only) ============
-- Does everything in one transaction: status, customer details, stock and promo usage.
-- Safe to call twice for the same order: the second call changes nothing.
create or replace function public.mark_order_paid(
  p_order uuid, p_session text, p_intent text, p_amount int,
  p_email text, p_name text, p_phone text, p_address jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  update public.orders
     set status = 'paid', paid_at = now(), stripe_session_id = coalesce(p_session, stripe_session_id),
         stripe_payment_intent = p_intent, email = p_email, name = p_name, phone = p_phone, address = p_address,
         note = case when p_amount is distinct from total_cents
                     then trim(both ' ' from coalesce(note, '') || ' CHECK: Stripe amount ' || coalesce(p_amount::text, '?') || ' differs from order total ' || total_cents::text)
                     else note end
   where id = p_order and status in ('pending','cancelled')
   returning * into o;
  if not found then
    return case when exists (select 1 from public.orders where id = p_order) then 'already' else 'missing' end;
  end if;
  update public.products p
     set stock = greatest(p.stock - i.qty, 0), updated_at = now()
    from public.order_items i
   where i.order_id = o.id and i.product_id = p.id and p.stock is not null;
  if o.promo_code is not null then
    update public.promo_codes set used_count = used_count + 1 where code = o.promo_code;
  end if;
  return 'ok';
end $$;

-- ============ remote switch ============
insert into public.app_config (key, value) values ('shop_enabled', '')   -- set to 1 when products and Stripe are ready
  on conflict (key) do nothing;

-- ============ pictures ============
-- Public bucket "shop" for product pictures and partner logos. Upload in Storage, copy the public URL.
insert into storage.buckets (id, name, public) values ('shop', 'shop', true) on conflict (id) do nothing;

-- ============ grants (explicit, see migration 004) ============
grant select on public.products, public.shipping_rates to anon, authenticated;
revoke insert, update, delete on public.products, public.shipping_rates from anon, authenticated;
revoke all on public.promo_codes, public.orders, public.order_items from anon, authenticated;
revoke all on public.orders_to_ship from anon, authenticated;
grant all on public.products, public.shipping_rates, public.promo_codes, public.orders, public.order_items to service_role;
grant select on public.orders_to_ship to service_role;
revoke all on function public.mark_order_paid(uuid, text, text, int, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.mark_order_paid(uuid, text, text, int, text, text, text, jsonb) to service_role;

-- ============ starter rows (inactive, edit then switch on) ============
-- Shipping: change the prices to your real ones. Add a row for every EU country you want to serve.
insert into public.shipping_rates (country, price_cents, free_over_cents, days_min, days_max) values
  ('SI', 390, 4000, 2, 4), ('HR', 590, 5000, 3, 6), ('AT', 690, 6000, 3, 6), ('DE', 790, 6000, 4, 7)
on conflict (country) do nothing;
insert into public.promo_codes (code, kind, value, note) values ('HOPPO10', 'percent', 10, 'Shown in the app Shop for Hoppo family products')
on conflict (code) do nothing;
