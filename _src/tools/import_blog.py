#!/usr/bin/env python3
"""Turn tr/blog/<lang>/<slug>.json into lang/<lang>/pages/blog/<slug>.html and lang/<lang>/blog.json.

   python3 _src/tools/import_blog.py de            (all posts that have a file)
   python3 _src/tools/import_blog.py de slug-a     (one post)

English worksheet: tr/blog_en/<slug>.json, made by  python3 _src/tools/import_blog.py --worksheet
Translation file, same shape: {"headline", "description", "card", "units": {"0": "...", ...}}.
Every unit number is required. Checks per unit: same tags, same numbers, no dashes, exclamation marks or semicolons.
A post is written only when all its checks pass.
Optional "number_ok": ["39", "description"] in a translation file lets those units write numbers in another form (1.2 billion as 1.200 millones). The safety review checks each one.
"""
import json, os, re, sys, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from seg import units, apply
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EN = SRC + '/lang/en/'; TR = os.environ.get('HOPPO_TR', SRC + '/tr')
BAD = re.compile('[–—!;]')
NUM = re.compile(r'\d+(?:[.,  ]\d+)*')
def plain(s): return html.unescape(re.sub(r'<[^>]+>', '', s))
def tags(s): return sorted(re.findall(r'<[^>]+>', s))
def nums(s): return sorted(re.sub(r'\D', '', m) for m in NUM.findall(plain(s)))
def slugs(): return [b['slug'] for b in json.load(open(EN + 'blog.json', encoding='utf-8'))]

def worksheet():
    os.makedirs(TR + '/blog_en', exist_ok=True)
    for b in json.load(open(EN + 'blog.json', encoding='utf-8')):
        src = open(f"{EN}pages/blog/{b['slug']}.html", encoding='utf-8').read(); sp = units(src)
        json.dump({'headline': b['headline'], 'description': b['description'], 'card': b['card'],
                   'units': {str(i): src[a:c] for i, (a, c) in enumerate(sp)}},
                  open(f"{TR}/blog_en/{b['slug']}.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('worksheet written')

def check(label, en, t, errs, strict_nums=True):
    if tags(en) != tags(t): errs.append(f'{label}: tags differ')
    if BAD.search(plain(t)): errs.append(f'{label}: dash, exclamation mark or semicolon')
    if strict_nums and nums(en) != nums(t): errs.append(f'{label}: numbers differ, English {nums(en)} translation {nums(t)}')
    if len(plain(en)) > 25 and len(plain(t)) < 0.4 * len(plain(en)): errs.append(f'{label}: much shorter than English, text missing?')
    if not plain(t).strip(): errs.append(f'{label}: empty')

def run(lang, only=None):
    errs_all = []; done = []
    d = f'{TR}/blog/{lang}'; out = f'{SRC}/lang/{lang}/'
    os.makedirs(out + 'pages/blog', exist_ok=True)
    bj = json.load(open(out + 'blog.json', encoding='utf-8')) if os.path.exists(out + 'blog.json') else {}
    for slug in (only or slugs()):
        f = f'{d}/{slug}.json'
        if not os.path.exists(f): errs_all.append(f'{slug}: no translation file'); continue
        errs = []; t = json.load(open(f, encoding='utf-8'))
        src = open(f'{EN}pages/blog/{slug}.html', encoding='utf-8').read(); sp = units(src)
        en = json.load(open(f'{TR}/blog_en/{slug}.json', encoding='utf-8'))
        for k in ('headline', 'description', 'card'):
            if not t.get(k): errs.append(f'{slug} {k} missing')
            else: check(f'{slug} {k}', en[k], t[k], errs, strict_nums=(k != 'card' and k not in t.get('number_ok', [])))
        tu = t.get('units', {})
        if set(tu) != {str(i) for i in range(len(sp))}: errs.append(f'{slug}: unit numbers differ from English ({len(tu)} vs {len(sp)})')
        else:
            trans = []
            for i, (a, c) in enumerate(sp):
                check(f'{slug} unit {i}', src[a:c], tu[str(i)], errs, strict_nums=(str(i) not in t.get('number_ok', [])))
                x = tu[str(i)]
                trans.append(x.replace('"', '&quot;') if src[a - 1:a] == '"' else x)
        if errs: errs_all += errs; continue
        open(f'{out}pages/blog/{slug}.html', 'w', encoding='utf-8', newline='\n').write(apply(src, sp, trans))
        bj[slug] = {k: t[k] for k in ('headline', 'description', 'card')}; done.append(slug)
    json.dump(bj, open(out + 'blog.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(lang, f'blog: {len(done)} written, errors: {len(errs_all)}'); [print('  ', e) for e in errs_all]
    return not errs_all

if __name__ == '__main__':
    if sys.argv[1:] == ['--worksheet']: worksheet(); sys.exit(0)
    sys.exit(0 if run(sys.argv[1], sys.argv[2:] or None) else 1)
