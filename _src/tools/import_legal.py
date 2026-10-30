#!/usr/bin/env python3
"""Turn tr/legal/<lang>.json into the translated legal pages, as the Pawty site does.

   python3 _src/tools/import_legal.py de

English worksheet: tr/legal_en/<page>.json (python3 _src/tools/import_legal.py --worksheet).
Translation file tr/legal/<lang>.json:
  binding   one line with a single <a>...</a>, linked to the English page of the same name, put after the date line
  strings   vat_line (holds {vat}) and shop_terms_sentence, used by the build in place of the English text
  pages     {page: {"title","description","units": {"0": "..."}}} for privacy.html, terms.html, shop-terms.html, partners.html
The English page is the legally binding one. The binding line is added to privacy, terms and shop-terms only.
"""
import json, os, re, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seg import units, apply
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN = SRC + '/lang/en/'; TR = os.environ.get('HOPPO_TR', SRC + '/tr')
PAGES = ['privacy.html', 'terms.html', 'shop-terms.html', 'partners.html']
BINDING = ['privacy.html', 'terms.html', 'shop-terms.html']
BAD = re.compile('[–—!;]'); NUM = re.compile(r'\d+(?:[.,  ]\d+)*'); PH = re.compile(r'\{\{[a-z_]+\}\}|\{[a-z_]+\}')
def plain(s): return html.unescape(re.sub(r'<[^>]+>', '', s))
def tags(s): return sorted(re.findall(r'<[^>]+>', s))
def nums(s): return sorted(re.sub(r'\D', '', m) for m in NUM.findall(plain(s)))
SITE = 'https://hoppoapp.com/'

def worksheet():
    os.makedirs(TR + '/legal_en', exist_ok=True)
    enm = json.load(open(EN + 'pages.json', encoding='utf-8')); out = {}
    for p in PAGES:
        src = open(EN + 'pages/' + p, encoding='utf-8').read()
        out[p] = {'title': enm[p]['title'], 'description': enm[p]['description'], 'units': {str(i): src[a:b] for i, (a, b) in enumerate(units(src))}}
    json.dump({'binding': 'This translation is for information. The <a>English version</a> is legally binding.',
               'strings': {'vat_line': 'VAT number: {vat}. ', 'shop_terms_sentence': '<p>Products from the Hoppo family are bought on hoppoapp.com, never inside the app. They are sold under our <a href="/shop-terms.html">terms of sale</a>.</p>'},
               'pages': out}, open(TR + '/legal_en/legal.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('worksheet written')

def check(label, en, t, errs, nm=True):
    if tags(en) != tags(t): errs.append(f'{label}: tags differ')
    if PH.findall(en) != PH.findall(t) and sorted(PH.findall(en)) != sorted(PH.findall(t)): errs.append(f'{label}: placeholders differ')
    if BAD.search(plain(t)): errs.append(f'{label}: dash, exclamation mark or semicolon')
    if nm and nums(en) != nums(t): errs.append(f'{label}: numbers differ, English {nums(en)} translation {nums(t)}')
    if len(plain(en)) > 25 and len(plain(t)) < 0.4 * len(plain(en)): errs.append(f'{label}: much shorter than English, text missing?')

def run(lang):
    errs = []; tr = json.load(open(f'{TR}/legal/{lang}.json', encoding='utf-8')); en = json.load(open(f'{TR}/legal_en/legal.json', encoding='utf-8'))
    out = f'{SRC}/lang/{lang}/'; meta = json.load(open(out + 'pages.json', encoding='utf-8')); bodies = {}
    bl = tr.get('binding', '')
    if bl.count('<a>') != 1 or bl.count('</a>') != 1 or len(re.findall(r'<[^>]+>', bl)) != 2: errs.append('binding needs exactly one <a>...</a>')
    if BAD.search(plain(bl)): errs.append('binding: dash, exclamation mark or semicolon')
    st = tr.get('strings', {})
    for k, v in en['strings'].items():
        if k not in st: errs.append('strings missing ' + k)
        else: check('strings ' + k, v, st[k], errs, nm=False)
    for p in PAGES:
        t = tr['pages'].get(p)
        if not t: errs.append(p + ' missing'); continue
        src = open(EN + 'pages/' + p, encoding='utf-8').read(); sp = units(src); tu = t.get('units', {})
        for k in ('title', 'description'):
            if not t.get(k): errs.append(f'{p} {k} missing')
            else: check(f'{p} {k}', en['pages'][p][k], t[k], errs)
        if set(tu) != {str(i) for i in range(len(sp))}: errs.append(f'{p}: unit numbers differ from English ({len(tu)} vs {len(sp)})'); continue
        trans = []
        for i, (a, b) in enumerate(sp):
            check(f'{p} unit {i}', src[a:b], tu[str(i)], errs); x = tu[str(i)]
            trans.append(x.replace('"', '&quot;') if src[a - 1:a] == '"' else x)
        body = apply(src, sp, trans)
        if p in BINDING:
            note = '\n<p class="meta legal-binding">' + bl.replace('<a>', f'<a href="{SITE}{p}" hreflang="en">') + '</p>'
            i = body.find('</p>', body.find('<p class="meta">'))
            if i < 0: errs.append(p + ': date line not found'); continue
            body = body[:i + 4] + note + body[i + 4:]
        bodies[p] = (body, dict(title=t['title'], description=t['description']))
    print(lang, 'legal errors:', len(errs)); [print('  ', e) for e in errs]
    if errs: return False
    for p, (b, m) in bodies.items():
        open(out + 'pages/' + p, 'w', encoding='utf-8', newline='\n').write(b); meta[p] = m
    json.dump(meta, open(out + 'pages.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(st, open(out + 'legal_strings.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    return True

if __name__ == '__main__':
    if sys.argv[1:] == ['--worksheet']: worksheet(); sys.exit(0)
    sys.exit(0 if all([run(l) for l in sys.argv[1:]]) else 1)
