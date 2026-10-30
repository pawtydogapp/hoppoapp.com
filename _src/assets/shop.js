/* Hoppo shop: partner offers, own products, cart and checkout.
   Loaded only on the shop pages. Everything it shows comes from the Hoppo Supabase project,
   so offers, products, shipping rates and promo codes change without a website release.
   Prices are never trusted from this script: the shop-quote and shop-checkout functions
   read prices, shipping and promo codes from the database again. */
(function () {
  'use strict';
  var H = window.HOPPO || {}, UI = H.ui || {};
  var CART_KEY = 'hoppo_cart_v1', COUNTRY_KEY = 'hoppo_country';
  var LANG_COUNTRY = { sl: 'SI', hr: 'HR', de: 'DE', es: 'ES', fr: 'FR', it: 'IT', nl: 'NL', pl: 'PL', pt: 'PT', ro: 'RO' };

  function T(k, vars) {
    var s = UI[k] != null ? UI[k] : k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split('{' + v + '}').join(vars[v]); });
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }

  function rest(path) {
    return fetch(H.sb + '/rest/v1/' + path, { headers: { apikey: H.key, Authorization: 'Bearer ' + H.key } })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }
  function restSoft(path) { return rest(path).catch(function () { return []; }); }
  function fn(name, body) {
    return fetch(H.sb + '/functions/v1/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: H.key, Authorization: 'Bearer ' + H.key },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, data: j }; }); });
  }

  var fmt;
  try { fmt = new Intl.NumberFormat(H.locale || 'en', { style: 'currency', currency: 'EUR' }); } catch (e) { fmt = null; }
  function money(c) { var v = c / 100; return fmt ? fmt.format(v) : v.toFixed(2) + ' EUR'; }
  var names;
  try { names = new Intl.DisplayNames([H.locale || 'en'], { type: 'region' }); } catch (e) { names = null; }
  function cname(cc) { try { return names ? (names.of(cc === 'UK' ? 'GB' : cc) || cc) : cc; } catch (e) { return cc; } }
  function loc(o) {
    if (!o) return '';
    if (typeof o === 'string') return o;
    return o[H.lang] || o.en || o[Object.keys(o)[0]] || '';
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function cfgMap(rows) { var m = {}; (rows || []).forEach(function (r) { if (r.value) m[r.key] = r.value; }); return m; }
  function imgOf(p) { return p.images && p.images.length ? p.images[0] : ''; }
  function safeUrl(u) { return /^https:\/\//.test(u || '') ? u : ''; }

  /* ---------- cart storage ---------- */
  function cartGet() {
    try { var c = JSON.parse(lsGet(CART_KEY) || '[]'); return Array.isArray(c) ? c.filter(function (x) { return x && x.id && x.q > 0; }) : []; } catch (e) { return []; }
  }
  function cartSet(c) {
    lsSet(CART_KEY, JSON.stringify(c));
    var n = c.reduce(function (a, x) { return a + x.q; }, 0), link = $('cartlink'), cnt = $('cartcount');
    if (link && cnt) { cnt.textContent = n ? String(n) : ''; if (!n) link.hidden = true; }
  }
  function cartAdd(id, q, max) {
    var c = cartGet(), f = c.filter(function (x) { return x.id === id; })[0];
    if (f) f.q = Math.min(f.q + q, max || 10); else c.push({ id: id, q: Math.min(q, max || 10) });
    cartSet(c);
    var link = $('cartlink'); if (link) link.hidden = false;
  }

  /* ---------- shop rows, same rules as the app ---------- */
  function aliases(cc) { return cc === 'UK' ? ['UK', 'GB'] : cc === 'GB' ? ['GB', 'UK'] : [cc]; }
  function rowsFor(list, country, cat) {
    var mine = aliases(country), t = today();
    return (list || []).filter(function (p) {
      if (!p || !p.active) return false;
      if (p.starts_at && p.starts_at > t) return false;
      if (p.ends_at && p.ends_at < t) return false;
      if (cat && cat !== 'all' && p.category !== cat) return false;
      if (country === 'ALL') return true;
      var cs = p.countries || [];
      return cs.indexOf('GLOBAL') > -1 || mine.some(function (c) { return cs.indexOf(c) > -1; });
    }).sort(function (a, b) { return (b.own ? 1 : 0) - (a.own ? 1 : 0) || (a.sort || 100) - (b.sort || 100); });
  }
  function countriesOf(partners, shipping) {
    var set = {}, t = today();
    (partners || []).forEach(function (p) {
      if (!p.active) return;
      if (p.starts_at && p.starts_at > t) return;
      if (p.ends_at && p.ends_at < t) return;
      (p.countries || []).forEach(function (c) { if (c !== 'GLOBAL') set[c === 'GB' ? 'UK' : c] = 1; });
    });
    (shipping || []).forEach(function (s) { set[s.country] = 1; });
    return Object.keys(set).sort(function (a, b) { return cname(a).localeCompare(cname(b), H.locale || 'en'); });
  }
  function startCountry(countries) {
    var saved = lsGet(COUNTRY_KEY);
    if (saved === 'ALL' || (saved && countries.indexOf(saved) > -1)) return saved;
    var guess = LANG_COUNTRY[H.lang];
    return guess && countries.indexOf(guess) > -1 ? guess : 'ALL';
  }

  /* ---------- shop page ---------- */
  function partnerCard(p) {
    var u = safeUrl(p.affiliate_url), logo = safeUrl(p.logo_url);
    var h = '<div class="pcard' + (p.own ? ' own' : '') + '">';
    h += '<div class="phead"><div>' + (p.own ? '<span class="tag">' + esc(T('own_badge')) + '</span>' : '') +
      '<h3>' + esc(p.name) + '</h3><div class="pcat">' + esc((H.cats || {})[p.category] || '') + '</div></div>' +
      (logo ? '<img class="plogo" src="' + esc(logo) + '" alt="" width="48" height="48" loading="lazy">' : '') + '</div>';
    if (p.description) h += '<p class="pdesc">' + esc(p.description) + '</p>';
    if (p.offer) h += '<p class="poffer">' + esc(p.offer) + '</p>';
    h += '<div class="pactions">';
    if (p.promo_code) h += '<span class="pcode">' + esc(p.promo_code) + '</span><button type="button" class="btn sm ghost" data-copy="' + esc(p.promo_code) + '">' + esc(T('copy_code')) + '</button>';
    if (u) h += '<a class="btn sm" href="' + esc(u) + '" target="_blank" rel="' + (p.own ? 'noopener' : 'sponsored nofollow noopener') + '">' + esc(T('visit')) + '</a>';
    return h + '</div></div>';
  }
  function productCard(p) {
    var im = imgOf(p), href = H.base + '/product.html?p=' + encodeURIComponent(p.slug), out = p.stock != null && p.stock <= 0;
    var h = '<div class="pcard prod"><a class="pimg" href="' + esc(href) + '">' +
      (im ? '<img src="' + esc(im) + '" alt="" width="400" height="400" loading="lazy">' : '<span class="pimg-ph" aria-hidden="true"></span>') + '</a>';
    h += '<span class="tag">' + esc(T('own_badge')) + '</span><h3><a href="' + esc(href) + '">' + esc(loc(p.name)) + '</a></h3>';
    h += '<div class="pprice">' + (p.compare_at_cents ? '<s>' + esc(money(p.compare_at_cents)) + '</s> ' : '') + '<b>' + esc(money(p.price_cents)) + '</b></div>';
    h += '<div class="pactions">' + (out ? '<span class="pcat">' + esc(T('out_of_stock')) + '</span>' :
      '<button type="button" class="btn sm" data-add="' + esc(p.id) + '" data-max="' + (p.max_per_order || 10) + '">' + esc(T('add_to_cart')) + '</button>') + '</div></div>';
    return h;
  }

  function shopPage(root) {
    root.innerHTML = '<p class="shopmsg">' + esc(T('loading')) + '</p>';
    Promise.all([rest('partners?select=*&order=sort'), restSoft('app_config?select=key,value'), restSoft('products?select=*&order=sort'), restSoft('shipping_rates?select=country')])
      .then(function (r) {
        var partners = r[0], cfg = cfgMap(r[1]), open = cfg.shop_enabled === '1', products = open ? r[2] : [], shipping = open ? r[3] : [];
        var countries = countriesOf(partners, shipping), country = startCountry(countries), cat = 'all';
        function draw() {
          var h = '';
          var ownProducts = products.filter(function (p) {
            if (!p.active) return false;
            if (cat !== 'all' && p.category !== cat) return false;
            if (country === 'ALL' || !(p.countries && p.countries.length)) return true;
            return aliases(country).some(function (c) { return p.countries.indexOf(c) > -1; });
          });
          var rows = rowsFor(partners, country, cat);
          h += '<div class="shopbar"><label for="shop-cc">' + esc(T('country')) + '</label><select id="shop-cc" class="inp"><option value="ALL"' + (country === 'ALL' ? ' selected' : '') + '>' + esc(T('all_countries')) + '</option>' +
            countries.map(function (c) { return '<option value="' + esc(c) + '"' + (c === country ? ' selected' : '') + '>' + esc(cname(c)) + '</option>'; }).join('') + '</select></div>';
          h += '<div class="chips" role="group">' + Object.keys(H.cats || {}).map(function (id) {
            return '<button type="button" class="chip' + (cat === id ? ' on' : '') + '" data-cat="' + esc(id) + '" aria-pressed="' + (cat === id) + '">' + esc(H.cats[id]) + '</button>';
          }).join('') + '</div>';
          h += '<div class="pgrid">';
          if (ownProducts.length) h += ownProducts.map(productCard).join('');
          h += rows.map(partnerCard).join('');
          h += '</div>';
          if (!rows.length && !ownProducts.length) h += '<p class="shopmsg">' + esc(T(partners.length || products.length ? 'shop_intro_empty' : 'offers_soon')) + '</p>';
          h += '<p class="shopnote">' + esc(T('affiliate_note')) + '</p>';
          root.innerHTML = h;
        }
        draw();
        root.addEventListener('change', function (e) { if (e.target && e.target.id === 'shop-cc') { country = e.target.value; lsSet(COUNTRY_KEY, country); draw(); $('shop-cc').focus(); } });
        root.addEventListener('click', function (e) {
          var b = e.target.closest ? e.target.closest('button') : null; if (!b) return;
          if (b.hasAttribute('data-cat')) { var id = b.getAttribute('data-cat'); cat = cat === id ? 'all' : id; draw(); return; }
          if (b.hasAttribute('data-copy')) { var code = b.getAttribute('data-copy'); try { navigator.clipboard.writeText(code); } catch (x) { /* ignore */ } b.textContent = T('copied'); return; }
          if (b.hasAttribute('data-add')) { cartAdd(b.getAttribute('data-add'), 1, parseInt(b.getAttribute('data-max'), 10)); b.textContent = T('added'); }
        });
      })
      .catch(function () { root.innerHTML = '<p class="shopmsg">' + esc(T('err_generic')) + '</p>'; });
  }

  /* ---------- product page ---------- */
  function productPage(root) {
    var slug = new URLSearchParams(location.search).get('p') || '';
    var back = '<p><a href="' + H.base + '/shop.html">' + esc(T('back_to_shop')) + '</a></p>';
    if (!/^[a-z0-9-]+$/.test(slug)) { root.innerHTML = back + '<p class="shopmsg">' + esc(T('product_missing')) + '</p>'; return; }
    Promise.all([restSoft('products?slug=eq.' + slug + '&select=*'), restSoft('app_config?select=key,value')]).then(function (r) {
      var p = r[0][0], open = cfgMap(r[1]).shop_enabled === '1';
      if (!p || !open) { root.innerHTML = back + '<p class="shopmsg">' + esc(open ? T('product_missing') : T('shop_closed')) + '</p>'; return; }
      var name = loc(p.name); document.title = name + ' | Hoppo';
      var imgs = (p.images || []).filter(safeUrl), out = p.stock != null && p.stock <= 0, max = Math.min(p.max_per_order || 10, p.stock != null ? Math.max(p.stock, 1) : 10);
      var h = back + '<div class="prodpage"><div class="gal">' + (imgs.length ? '<img id="pmain" src="' + esc(imgs[0]) + '" alt="' + esc(name) + '" width="640" height="640">' : '<span class="pimg-ph big" aria-hidden="true"></span>');
      if (imgs.length > 1) h += '<div class="thumbs">' + imgs.map(function (u, i) { return '<button type="button" class="thumb" data-img="' + esc(u) + '" aria-label="' + (i + 1) + '"><img src="' + esc(u) + '" alt="" width="64" height="64" loading="lazy"></button>'; }).join('') + '</div>';
      h += '</div><div class="info"><span class="tag">' + esc(T('own_badge')) + '</span><h1>' + esc(name) + '</h1>';
      h += '<div class="pprice big">' + (p.compare_at_cents ? '<s>' + esc(money(p.compare_at_cents)) + '</s> ' : '') + '<b>' + esc(money(p.price_cents)) + '</b></div><p class="pcat">' + esc(T('price_vat')) + '</p>';
      var stockMsg = out ? T('out_of_stock') : (p.stock != null && p.stock <= 5 ? T('low_stock', { n: p.stock }) : T('in_stock'));
      h += '<p class="stock' + (out ? ' out' : '') + '">' + esc(stockMsg) + '</p>';
      loc(p.description).split(/\n+/).forEach(function (para) { if (para.trim()) h += '<p>' + esc(para.trim()) + '</p>'; });
      if (!out) h += '<div class="buyrow"><label for="pqty">' + esc(T('quantity')) + '</label><input id="pqty" class="inp qty" type="number" min="1" max="' + max + '" value="1" inputmode="numeric"><button type="button" class="btn" id="padd">' + esc(T('add_to_cart')) + '</button></div><p id="pmsg" class="pcat" aria-live="polite"></p>';
      h += '<p class="pcat">' + esc(T('ship_eu')) + '</p></div></div>';
      root.innerHTML = h;
      root.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('button') : null; if (!t) return;
        if (t.hasAttribute('data-img')) { var m = $('pmain'); if (m) m.src = t.getAttribute('data-img'); return; }
        if (t.id === 'padd') {
          var q = Math.max(1, Math.min(max, parseInt($('pqty').value, 10) || 1)); cartAdd(p.id, q, p.max_per_order || 10);
          $('pmsg').innerHTML = esc(T('added')) + '. <a href="' + H.base + '/cart.html">' + esc(T('view_cart')) + '</a>';
        }
      });
    }).catch(function () { root.innerHTML = back + '<p class="shopmsg">' + esc(T('err_generic')) + '</p>'; });
  }

  /* ---------- cart page ---------- */
  function errText(e, names) {
    var nm = (e.id && names[e.id]) || e.name || '';
    switch (e.code) {
      case 'stock': return T('err_stock', { name: nm });
      case 'inactive': case 'unknown_product': return T('err_inactive', { name: nm });
      case 'max_qty': return T('err_max', { n: e.max, name: nm });
      case 'country': return T('err_country');
      case 'closed': return T('shop_closed');
      case 'min_total': return T('err_promo_min');
      case 'promo_expired': return T('err_promo_expired');
      case 'promo_min': return T('err_promo_min');
      case 'promo': return T('err_promo');
      default: return T('err_generic');
    }
  }
  function cartPage(root) {
    var back = '<p><a href="' + H.base + '/shop.html">' + esc(T('continue_shopping')) + '</a></p>';
    root.innerHTML = '<p class="shopmsg">' + esc(T('loading')) + '</p>';
    var items = cartGet();
    Promise.all([restSoft('app_config?select=key,value'), restSoft('shipping_rates?select=*&order=country'), items.length ? restSoft('products?select=*&id=in.(' + items.map(function (x) { return x.id; }).join(',') + ')') : Promise.resolve([])])
      .then(function (r) {
        if (cfgMap(r[0]).shop_enabled !== '1') { root.innerHTML = back + '<p class="shopmsg">' + esc(T('shop_closed')) + '</p>'; return; }
        var rates = r[1], prods = {}, names = {}; r[2].forEach(function (p) { prods[p.id] = p; names[p.id] = loc(p.name); });
        items = items.filter(function (x) { return prods[x.id]; }); cartSet(items);
        if (!items.length) { root.innerHTML = '<h2 class="sec" style="text-align:left">' + esc(T('cart_empty')) + '</h2>' + back; return; }
        var countries = rates.map(function (x) { return x.country; }).sort(function (a, b) { return cname(a).localeCompare(cname(b), H.locale || 'en'); });
        var country = lsGet(COUNTRY_KEY); if (countries.indexOf(country) < 0) country = LANG_COUNTRY[H.lang] && countries.indexOf(LANG_COUNTRY[H.lang]) > -1 ? LANG_COUNTRY[H.lang] : (countries[0] || '');
        var promo = '', quote = null, busy = false;
        function lines() {
          return items.map(function (x) {
            var p = prods[x.id], im = imgOf(p), max = p.max_per_order || 10;
            return '<div class="cline"><div class="cimg">' + (im ? '<img src="' + esc(im) + '" alt="" width="72" height="72">' : '') + '</div><div class="cmain"><b>' + esc(names[x.id]) + '</b><div class="pcat">' + esc(money(p.price_cents)) + '</div>' +
              '<div class="cqty"><label class="sr" for="q-' + esc(x.id) + '">' + esc(T('quantity')) + '</label><input id="q-' + esc(x.id) + '" class="inp qty" type="number" min="1" max="' + max + '" value="' + x.q + '" data-q="' + esc(x.id) + '" inputmode="numeric">' +
              '<button type="button" class="linkbtn" data-rm="' + esc(x.id) + '">' + esc(T('remove')) + '</button></div></div><div class="cprice">' + esc(money(p.price_cents * x.q)) + '</div></div>';
          }).join('');
        }
        function totals() {
          if (!quote) return '';
          if (!quote.ok) return '<ul class="errs">' + quote.errors.map(function (e) { return '<li>' + esc(errText(e, names)) + '</li>'; }).join('') + '</ul>';
          var h = '<dl class="tot"><dt>' + esc(T('subtotal')) + '</dt><dd>' + esc(money(quote.subtotal_cents)) + '</dd>';
          if (quote.discount_cents) h += '<dt>' + esc(T('discount')) + (quote.promo ? ' (' + esc(quote.promo) + ')' : '') + '</dt><dd>-' + esc(money(quote.discount_cents)) + '</dd>';
          h += '<dt>' + esc(T('shipping')) + '</dt><dd>' + (quote.shipping_cents ? esc(money(quote.shipping_cents)) : esc(T('free'))) + '</dd>';
          h += '<dt class="grand">' + esc(T('total')) + '</dt><dd class="grand">' + esc(money(quote.total_cents)) + '</dd></dl>';
          if (quote.days_min && quote.days_max) h += '<p class="pcat">' + esc(T('delivery_days', { min: quote.days_min, max: quote.days_max })) + '</p>';
          return h;
        }
        function draw(msg) {
          var h = '<div class="cartgrid"><div>' + lines() + '</div><aside class="cbox">';
          h += '<label for="c-cc">' + esc(T('ship_to')) + '</label><select id="c-cc" class="inp">' + countries.map(function (c) { return '<option value="' + esc(c) + '"' + (c === country ? ' selected' : '') + '>' + esc(cname(c)) + '</option>'; }).join('') + '</select><p class="pcat">' + esc(T('ship_eu')) + '</p>';
          h += '<label for="c-promo">' + esc(T('promo_label')) + '</label><div class="promorow"><input id="c-promo" class="inp" type="text" autocomplete="off" autocapitalize="characters" value="' + esc(promo) + '"><button type="button" class="btn sm ghost" id="c-apply">' + esc(T('promo_apply')) + '</button></div>';
          if (quote && quote.ok && quote.promo) h += '<p class="okmsg">' + esc(T('promo_applied', { code: quote.promo })) + '</p>';
          h += '<div id="c-tot" aria-live="polite">' + totals() + '</div>';
          if (H.terms) h += '<label class="agree"><input type="checkbox" id="c-terms"> ' + esc(T('terms_agree')).replace('{link}', '<a href="' + H.base + H.terms + '" target="_blank" rel="noopener">' + esc(T('terms_link')) + '</a>') + '</label>';
          h += '<p id="c-msg" class="errs" aria-live="polite">' + (msg ? esc(msg) : '') + '</p>';
          h += '<button type="button" class="btn" id="c-pay"' + (quote && quote.ok && !busy ? '' : ' disabled') + '>' + esc(busy ? T('paying') : T('checkout')) + '</button><p class="pcat">' + esc(T('checkout_note')) + '</p></aside></div>' + back;
          root.innerHTML = h;
        }
        function refresh(msg) {
          draw(msg);
          fn('shop-quote', { items: items, country: country, promo: promo }).then(function (res) {
            quote = res.data && typeof res.data.ok === 'boolean' ? res.data : { ok: false, errors: [{ code: 'generic' }] };
            if (quote.ok === false && promo && quote.errors.some(function (e) { return e.code.indexOf('promo') === 0; })) { /* keep the code visible, show the error */ }
            draw(msg);
          }).catch(function () { quote = { ok: false, errors: [{ code: 'generic' }] }; draw(msg); });
        }
        root.addEventListener('change', function (e) {
          var t = e.target;
          if (t.id === 'c-cc') { country = t.value; lsSet(COUNTRY_KEY, country); refresh(); }
          else if (t.hasAttribute && t.hasAttribute('data-q')) {
            var it = items.filter(function (x) { return x.id === t.getAttribute('data-q'); })[0], max = prods[it.id].max_per_order || 10;
            it.q = Math.max(1, Math.min(max, parseInt(t.value, 10) || 1)); cartSet(items); refresh();
          }
        });
        root.addEventListener('click', function (e) {
          var t = e.target.closest ? e.target.closest('button') : null; if (!t) return;
          if (t.hasAttribute('data-rm')) { items = items.filter(function (x) { return x.id !== t.getAttribute('data-rm'); }); cartSet(items); if (!items.length) { cartPage(root); return; } refresh(); }
          else if (t.id === 'c-apply') { promo = ($('c-promo').value || '').trim().toUpperCase(); refresh(); }
          else if (t.id === 'c-pay') {
            if (H.terms && !($('c-terms') && $('c-terms').checked)) { $('c-msg').textContent = T('err_terms'); return; }
            busy = true; draw();
            fn('shop-checkout', { items: items, country: country, promo: promo, lang: H.lang, terms: !!H.terms }).then(function (res) {
              if (res.data && res.data.url) { location.href = res.data.url; return; }
              busy = false; quote = res.data && res.data.errors ? { ok: false, errors: res.data.errors } : quote; draw(T('err_generic'));
            }).catch(function () { busy = false; draw(T('err_generic')); });
          }
        });
        refresh();
      })
      .catch(function () { root.innerHTML = back + '<p class="shopmsg">' + esc(T('err_generic')) + '</p>'; });
  }

  /* ---------- order complete ---------- */
  function orderPage(root) {
    if (new URLSearchParams(location.search).get('session_id')) cartSet([]);
    root.innerHTML = '<h1>' + esc(T('thanks_title')) + '</h1><p>' + esc(T('thanks_text')) + '</p><p>' + esc(T('thanks_help')) + ' <a href="mailto:' + esc(H.email) + '">' + esc(H.email) + '</a></p><p><a class="btn" href="' + H.base + '/shop.html">' + esc(T('back_to_shop')) + '</a></p>';
  }

  var root;
  if ((root = $('shop-root'))) shopPage(root);
  else if ((root = $('product-root'))) productPage(root);
  else if ((root = $('cart-root'))) cartPage(root);
  else if ((root = $('order-root'))) orderPage(root);
})();
