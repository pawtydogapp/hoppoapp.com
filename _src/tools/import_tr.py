#!/usr/bin/env python3
"""Turn tr/<lang>.json into _src/lang/<lang>/ files, reusing the app's own translations.

   python3 _src/tools/import_tr.py de sl        (or no arguments for every language that has a file)

A translation file holds ONLY what the app does not already say:
  chrome    labels for the page shell
  shop_ui   labels for the shop scripts
  meta      title and description per page
  ld        description for the home page structured data
  units     the text pieces of each page, by their number from tools/seg.py

Everything the app already translates is taken from _src/app/<lang>.json when the site is built or
imported: guide text, guide titles, and any label whose English text is the same as an app string.
Edit those once, in the app, and run tools/sync_app.mjs.
"""
import json, os, re, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seg import units, apply

SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN = SRC + '/lang/en/'
TR = os.environ.get('HOPPO_TR', SRC + '/tr')
PAGES = ['index.html', 'guides.html', 'support.html', '404.html', 'shop.html', 'cart.html', 'product.html', 'order-complete.html', 'blog.html']
META_PAGES = ['404.html', 'index.html', 'guides.html', 'support.html', 'shop.html', 'cart.html', 'product.html', 'order-complete.html', 'blog.html']
PLACEHOLDER = re.compile(r'\{[a-z_]+\}|\{\{[a-z_]+\}\}')
BAD = re.compile('[–—!;]')           # en dash, em dash, exclamation mark, semicolon

def tags(s): return sorted(re.findall(r'<[^>]+>', s))
def ph(s): return sorted(PLACEHOLDER.findall(s))
def plain(s): return re.sub(r'&[a-z]+;|<[^>]+>', '', s)
def norm(x): return html.unescape(x)

def app_lookup(lang):
    """English text -> the app's translation: interface strings, guide titles and guide intros."""
    en = json.load(open(f'{SRC}/app/en.json', encoding='utf-8'))['content']['guides']
    d = json.load(open(f'{SRC}/app/{lang}.json', encoding='utf-8'))
    m = {k: v for k, v in d['ui'].items() if v}
    for gid, g in en.items():
        t = d['content']['guides'][gid]
        m.setdefault(g['title'], t['title']); m.setdefault(g['intro'], t['intro'])
    return m

def run(lang):
    errs = []
    tr = json.load(open(f'{TR}/{lang}.json', encoding='utf-8'))
    look = app_lookup(lang); ui = json.load(open(f'{SRC}/app/{lang}.json', encoding='utf-8'))['ui']
    out = f'{SRC}/lang/{lang}/'; os.makedirs(out + 'pages', exist_ok=True)

    def own_only(en_dict, name):
        keep = {}
        for k, v in en_dict.items():
            if not v or ui.get(v): continue                      # the app has it, or it is empty
            if k not in tr[name]: errs.append(f'{name} missing {k}'); continue
            t = tr[name][k]
            if ph(v) != ph(t): errs.append(f'{name} {k}: placeholders differ')
            if BAD.search(plain(t)): errs.append(f'{name} {k}: dash, exclamation mark or semicolon')
            keep[k] = t
        extra = set(tr[name]) - set(en_dict)
        if extra: errs.append(f'{name} unknown keys {sorted(extra)}')
        return keep
    chrome = own_only(json.load(open(EN + 'chrome.json', encoding='utf-8')), 'chrome')
    shop = own_only(json.load(open(EN + 'shop_ui.json', encoding='utf-8')), 'shop_ui')
    json.dump(chrome, open(out + 'chrome.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(shop, open(out + 'shop_ui.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    if not os.path.exists(out + 'guides.json'): open(out + 'guides.json', 'w').write('{}\n')

    enm = json.load(open(EN + 'pages.json', encoding='utf-8'))
    meta = json.load(open(out + 'pages.json', encoding='utf-8')) if os.path.exists(out + 'pages.json') else {}   # keeps legal and blog entries
    for p in META_PAGES:
        m = tr['meta'].get(p)
        if not m: errs.append(f'meta missing {p}'); continue
        for k in ('title', 'description'):
            if ph(enm[p][k]) != ph(m[k]): errs.append(f'meta {p} {k}: placeholders differ')
            if BAD.search(plain(m[k])): errs.append(f'meta {p} {k}: dash, exclamation mark or semicolon')
        meta[p] = dict(title=m['title'], description=m['description'])
    ld = json.loads(enm['index.html']['ld']); ld['description'] = tr['ld']; ld['url'] = f'https://hoppoapp.com/{lang}/'; ld['inLanguage'] = lang
    meta['index.html']['ld'] = json.dumps(ld, ensure_ascii=False, separators=(',', ':'))
    json.dump(meta, open(out + 'pages.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

    for p in PAGES:
        src = open(EN + 'pages/' + p, encoding='utf-8').read()
        sp = units(src); mine = tr['units'].get(p, {}); trans = []
        for i, (a, b) in enumerate(sp):
            en_text = src[a:b]; k = str(i)
            if k in mine: t = mine[k]
            elif norm(en_text) in look: t = html.escape(look[norm(en_text)], quote=False)
            else: errs.append(f'{p} unit {i} has no translation: {en_text[:50]}'); t = en_text
            if tags(en_text) != tags(t): errs.append(f'{p} unit {i} tags differ')
            if ph(en_text) != ph(t): errs.append(f'{p} unit {i} placeholders differ')
            if BAD.search(plain(t)): errs.append(f'{p} unit {i}: dash, exclamation mark or semicolon')
            if src[a - 1:a] == '"': t = t.replace('"', '&quot;')   # inside an attribute
            trans.append(t)
        extra = set(mine) - {str(i) for i in range(len(sp))}
        if extra: errs.append(f'{p} unknown unit numbers {sorted(extra)}')
        open(out + 'pages/' + p, 'w', encoding='utf-8', newline='\n').write(apply(src, sp, trans))
    print(lang, 'errors:', len(errs)); [print('  ', e) for e in errs]
    return not errs

if __name__ == '__main__':
    langs = sys.argv[1:] or sorted(f[:-5] for f in os.listdir(TR) if f.endswith('.json'))
    ok = all([run(l) for l in langs])
    sys.exit(0 if ok else 1)
