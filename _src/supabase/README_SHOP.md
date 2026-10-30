# Hoppo shop: setup (Supabase and Stripe)

The website cart, the Stripe payment and the order list all run from the Hoppo Supabase project.
Products, shipping rates and promo codes are table rows. Changing them needs no app release and no website release.

How an order flows:
1. A parent adds products to the cart on hoppoapp.com. The cart is kept in the browser.
2. The cart page calls `shop-quote`. It reads prices, shipping and the promo code from the database and returns the totals.
3. "Go to secure payment" calls `shop-checkout`. It prices the cart again, saves a `pending` order and opens a Stripe Checkout page.
4. On the Stripe page the parent enters name, delivery address and card. Hoppo never sees card details.
5. Stripe calls `shop-webhook`. It marks the order `paid`, saves name and address, lowers stock and counts the promo code use.
6. You see the order in the Table Editor, in the view `orders_to_ship`.

The app never sells anything. A tap on a Hoppo family row in the Shop opens hoppoapp.com in the phone browser.

## 1. Database (once)

SQL Editor, New query, paste `migration_005_shop.sql`, Run. It is safe to run again.
It adds `products`, `shipping_rates`, `promo_codes`, `orders`, `order_items`, the view `orders_to_ship`, and the key `shop_enabled` in `app_config`.
Copy the file to `hoppo-app/supabase/` as well, next to the other migrations.

## 2. Stripe (test mode first)

1. Open or finish your Stripe account. Stay in Test mode.
2. Developers, API keys: copy the Secret key that starts with `sk_test_`.
3. Settings, Customer emails: turn on "Successful payments" so parents get a receipt.
4. Settings, Business, Public details: add the business name, support email and website.
5. Settings, Payments, Payment methods: keep cards on. Add wallets and local methods later if you want.

## 3. Deploy the 3 functions

Install the Supabase CLI once (https://supabase.com/docs/guides/cli). In PowerShell:

```
cd C:\hoppo\hoppo-app
supabase login
supabase link --project-ref gffvfjworknrcgrlycok
```

Copy the folder `_src/supabase/functions` from the website into `hoppo-app/supabase/functions`. Then:

```
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase functions deploy shop-quote
supabase functions deploy shop-checkout
supabase functions deploy shop-webhook --no-verify-jwt
```

`--no-verify-jwt` is only for the webhook. Stripe signs its calls instead, and the function checks the signature.

## 4. Stripe webhook

1. Stripe Dashboard, Developers, Webhooks, Add endpoint.
2. URL: `https://gffvfjworknrcgrlycok.supabase.co/functions/v1/shop-webhook`
3. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`.
4. Copy the Signing secret (`whsec_...`) and run: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx`

## 5. Add a product

Table Editor, `products`, Insert row. Example in SQL:

```sql
insert into public.products (slug, active, name, description, price_cents, images, stock, countries)
values ('colouring-book', true,
  '{"en":"Hippo colouring book","sl":"Pobarvanka z nilskim konjem"}',
  '{"en":"Hand drawn pages on thick paper.\nA5, 24 pages.","sl":"Ročno risane strani na debelem papirju."}',
  1290, array['https://gffvfjworknrcgrlycok.supabase.co/storage/v1/object/public/shop/colouring-book-1.jpg'], 20, '{}');
```

- Prices are in cents and include VAT. 1290 means 12.90 EUR.
- `name` and `description` need an `en` entry. Add other languages when you have them. A missing language shows English.
- Pictures: Storage, bucket `shop`, upload, copy the public URL into `images`. Square pictures at least 800 px wide look best.
- `stock` empty means not tracked. `countries` empty means every country in `shipping_rates`.
- Shipping: edit `shipping_rates`. Add a row for every EU country you want to serve.
- Promo codes: add rows to `promo_codes`. `kind` is `percent` or `fixed` (cents). Capital letters only.

## 6. Open the shop

1. Set `app_config` key `shop_enabled` to `1`. Until then the Shop page shows only partner offers, or "Shops are coming soon" when there are none. There is no placeholder card.
2. Test with the Stripe test card `4242 4242 4242 4242`, any future date, any CVC.
3. Check: the order appears in `orders_to_ship` as `paid`, stock went down, the promo `used_count` went up, and you got a Stripe receipt.
4. Seller details for the terms of sale: fill `seller` in `_src/config.json` (name, address, country, VAT number) and run the build. The page `shop-terms.html` is only published when name, address and country are filled in. Have a lawyer read it.
5. Go live: switch Stripe to Live mode, create the live webhook endpoint, and run `supabase secrets set` again with the live `sk_live_` key and the new live `whsec_`.

## 7. Show Hoppo family products inside the app

The app Shop reads the `partners` table. Add 1 row that sends parents to the website:

```sql
insert into public.partners (active, sort, own, name, description, offer, promo_code, affiliate_url, category, countries)
values (true, 1, true, 'Hoppo family shop', 'Home made products for babies and parents.', '10% off with the Hoppo code',
        'HOPPO10', 'https://hoppoapp.com/shop.html', 'toys', '{SI,HR,AT,DE}');
```

The promo code `HOPPO10` works in the website cart because it also exists in `promo_codes`.

## Notes

- Orders that are never paid stay `pending`. To tidy them: `update orders set status = 'cancelled' where status = 'pending' and created_at < now() - interval '2 days';`
- Stock is reduced when payment succeeds, not when the cart is filled. If 2 parents pay for the last item at the same moment, the second order shows a stock note and you refund it in Stripe.
- The functions read the database with the service role key that Supabase provides to them. That key is never in the website.
- Tests for the pricing rules: `node --test _src/supabase/functions/_shared/shop.test.ts` (Node 22.18 or newer).
