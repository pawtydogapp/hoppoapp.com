-- Hoppo migration 006: handmade baby socks (24 November 2026)
-- Run ONCE after migration_005_shop.sql. Safe to run again.
-- Adds colour variants to products and loads the 10 sock colours, shipping and the SOCKS3 code.
-- Products stay inactive (active = false) until go-live day.

alter table public.products add column if not exists family text;     -- products with the same family share one card and one page
alter table public.products add column if not exists colour jsonb;    -- {"en":"Sunny yellow"}
alter table public.products add column if not exists swatch text;     -- hex colour for the dot
alter table public.products add column if not exists details jsonb not null default '{}';  -- {"en":"line 1\nline 2"} composition, size, care
alter table public.products add column if not exists family_name jsonb;  -- {"en":"Handmade baby socks"}

insert into public.products
  (slug, active, sort, family, family_name, colour, swatch, name, description, details, category, price_cents, images, stock, max_per_order, weight_g, countries)
select
  'socks-' || c.slug, false, c.sort, 'socks',
  jsonb_build_object('en', 'Handmade baby socks'),
  jsonb_build_object('en', c.en),
  c.hex,
  jsonb_build_object('en', 'Handmade baby socks, ' || c.en),
  jsonb_build_object('en', E'Knitted by hand in Slovenia by a grandmother of the Hoppo family.\nOne size for babies from 0 to 12 months.'),
  jsonb_build_object('en', E'Composition: 65% acrylic, 25% wool, 10% viscose.\nLength 9 cm, stretches to 11 cm. Foot height 3 cm. Ankle to top 7 cm.\nPlease measure your baby''s foot before you order.\nCare: hand wash at 30 degrees, dry flat.\nSold by Darija Mesko s.p., Vrhnika, Slovenia.'),
  'equipment', 999,
  array['https://gffvfjworknrcgrlycok.supabase.co/storage/v1/object/public/shop/socks-' || c.slug || '.jpg'],
  c.stock, 10, 40, '{}'
from (values
  (1,'sunny-yellow','Sunny yellow','#F5C842',7),
  (2,'cream-white','Cream white','#F3EBDD',6),
  (3,'sky-blue','Sky blue','#8EC5E8',8),
  (4,'rose-pink','Rose pink','#C2407A',7),
  (5,'green-and-white','Green and white','#8CCB8A',5),
  (6,'mint-speckle','Mint speckle','#A8DCC8',1),
  (7,'lilac-and-white','Lilac and white','#C9B8E6',1),
  (8,'lilac','Lilac','#B9A0DC',1),
  (9,'apricot-speckle','Apricot speckle','#F6B38E',1),
  (10,'baby-pink','Baby pink','#F4B6C8',2)
) as c(sort, slug, en, hex, stock)
on conflict (slug) do update set
  family = excluded.family, family_name = excluded.family_name, colour = excluded.colour, swatch = excluded.swatch,
  name = excluded.name, description = excluded.description, details = excluded.details,
  images = excluded.images, price_cents = excluded.price_cents, sort = excluded.sort;
-- stock is NOT overwritten on re-run, so sales are never reset. Set it by hand if needed.

-- Flat shipping to every EU country: 4.99 EUR.
insert into public.shipping_rates (country, active, price_cents, free_over_cents, days_min, days_max)
select c, true, 499, null, case when c = 'SI' then 2 else 5 end, case when c = 'SI' then 5 else 12 end
from unnest(array['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']) as c
on conflict (country) do update set price_cents = excluded.price_cents, active = true;

-- 3 pairs for 20.98 EUR: 30 percent off from a subtotal of 29.97 EUR. The customer types SOCKS3 in the cart.
insert into public.promo_codes (code, active, kind, value, min_subtotal_cents, note)
values ('SOCKS3', true, 'percent', 30, 2997, '3 or more pairs of socks')
on conflict (code) do nothing;
