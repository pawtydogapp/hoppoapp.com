-- Hoppo go-live for the handmade baby socks. Run ONLY when all of this is done:
--   1. Stripe live secret key is set as the Supabase secret STRIPE_SECRET_KEY
--   2. The Stripe webhook for shop-webhook exists and its signing secret is set as STRIPE_WEBHOOK_SECRET
--   3. A test order was paid and the order shows as paid with stock reduced
update public.products set active = true where family = 'socks';
update public.app_config set value = '1' where key = 'shop_enabled';
insert into public.partners (active, sort, own, name, description, offer, promo_code, affiliate_url, category, countries)
select true, 1, true, 'Hoppo family shop', 'Handmade baby socks, knitted in Slovenia.', '3 pairs for 20.98 EUR with code SOCKS3',
       'SOCKS3', 'https://hoppoapp.com/shop.html', 'equipment', '{AT,BE,BG,HR,CY,CZ,DK,EE,FI,FR,DE,GR,HU,IE,IT,LV,LT,LU,MT,NL,PL,PT,RO,SK,SI,ES,SE}'
where not exists (select 1 from public.partners where own and name = 'Hoppo family shop');
