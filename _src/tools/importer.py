"""Turn tr/<lang>.json into _src/lang/<lang>/ files."""
import json, os, re, sys, html
sys.path.insert(0, os.path.dirname(__file__)); from seg import units, apply
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); EN = SRC + '/lang/en/'
TR = os.environ.get('PAWTY_TR', '/home/claude/w/tr')   # folder holding the translation JSON files
PAGES_T = ['guides.html', 'support.html', 'approach.html', 'partners.html', 'marketplace.html', 'index.html']
def tags(s): return sorted(re.findall(r'<[^>]+>', s))
def jq(s): return s.replace('\\', '\\\\').replace("'", "\\'")
def run(lang):
    tr = json.load(open(f'{TR}/{lang}.json', encoding='utf-8'))
    out = f'{SRC}/lang/{lang}/'; os.makedirs(out + 'pages', exist_ok=True)
    enc = json.load(open(EN + 'chrome.json')); errs = []
    ch = tr['chrome']
    miss = set(enc) - set(ch); extra = set(ch) - set(enc)
    if miss or extra: errs.append(f'chrome keys missing {miss} extra {extra}')
    for k in enc:
        if k in ch and tags(enc[k]) != tags(ch[k]): errs.append(f'chrome tag mismatch {k}')
    json.dump(ch, open(out + 'chrome.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    # guides
    eng = json.load(open(EN + 'guides.json')); g = {}
    for gid, e in eng.items():
        t, d = tr['guides'][gid]
        card, _, rest = d.partition('¦')
        desc = (card.strip() + ' ' + rest.strip()).strip() if rest else card.strip()
        needs = []
        for x in e['needs']:
            if x not in tr['needs']: errs.append('need missing ' + x)
            else: needs.append(tr['needs'][x])
        g[gid] = {'title': t, 'description': desc, 'card': card.strip(), 'needs': needs}
    if set(tr['guides']) != set(eng): errs.append('guide ids differ')
    json.dump(g, open(out + 'guides.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    # pages
    enm = json.load(open(EN + 'pages.json')); meta = {}
    for p in PAGES_T:
        src = open(EN + 'pages/' + p, encoding='utf-8').read()
        sp = units(src); tu = tr['units'][p]
        if len(sp) != len(tu): errs.append(f'{p}: {len(tu)} units, need {len(sp)}'); continue
        for i, ((a, b), t) in enumerate(zip(sp, tu)):
            if tags(src[a:b]) != tags(t): errs.append(f'{p} unit {i} tags differ: {src[a:b][:50]}')
        body = apply(src, sp, [t.replace('"', '&quot;') if src[a-1:a] == '"' else t for (a, b), t in zip(sp, tu)])
        if p == 'marketplace.html': body = mk_js(body, tr['js'], errs)
        open(out + 'pages/' + p, 'w', encoding='utf-8', newline='\n').write(body)
        m = dict(title=tr['meta'][p]['title'], description=tr['meta'][p]['description'])
        if p == 'index.html':
            ld = json.loads(enm[p]['ld']); ld['description'] = tr['meta'][p]['ld']; ld['url'] = f'https://pawtyapp.com/{lang}/'; ld['inLanguage'] = lang
            m['ld'] = json.dumps(ld, ensure_ascii=False, separators=(',', ':'))
        meta[p] = m
    json.dump(meta, open(out + 'pages.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(lang, 'errors:', len(errs)); [print('  ', e) for e in errs]
    return not errs
def mk_js(b, j, errs):
    R = [
     ("var CAT={food:'Food',gear:'Gear',grooming:'Grooming',insurance:'Insurance',other:'Shops'};",
      "var CAT={food:'%s',gear:'%s',grooming:'%s',insurance:'%s',other:'%s'};" % tuple(jq(j[k]) for k in ['cat_food','cat_gear','cat_grooming','cat_insurance','cat_other'])
      + "\n  var DN=null; try{ DN=new Intl.DisplayNames([document.documentElement.lang],{type:'region'}); }catch(e){}\n  function cn(c){ try{ return (DN&&DN.of(c))||CN[c]||c; }catch(e){ return CN[c]||c; } }"),
     ("codes.length+' countries'", "codes.length+' %s'" % jq(j['countries'])),
     ("return CN[c]||c;}).join(', ')", "return cn(c);}).join(', ')"),
     ("(CN[a]||a).localeCompare(CN[b]||b)", "cn(a).localeCompare(cn(b))"),
     ("esc(CN[c]||c)+'</option>'", "esc(cn(c))+'</option>'"),
     ('<p class="mkpromo">Code <b>', '<p class="mkpromo">%s <b>' % jq(j['code'])),
     ('rel="sponsored nofollow noopener">Visit \'', 'rel="sponsored nofollow noopener">%s\'' % jq(j['visit'])),
     ("' <span>partner link</span></a>'", "' <span>%s</span></a>'" % jq(j['partner_link'])),
     ("No partners match that combination yet. Try All countries.", jq(j['no_match'])),
     ("No partners listed yet. Check back soon.", jq(j['none_yet'])),
     ('data-c="ALL">All</span>', 'data-c="ALL">%s</span>' % jq(j['all'])),
     ('<label class="mksel">Delivers to <select', '<label class="mksel">%s <select' % jq(j['delivers_to'])),
     ('<option value="ALL">All countries</option>', '<option value="ALL">%s</option>' % jq(j['all_countries'])),
     ("Partner list could not load right now. Open the Marketplace tab in the Pawty app to browse partners.", jq(j['load_fail'])),
    ]
    for a, c in R:
        if b.count(a) != 1: errs.append('js anchor count %d: %s' % (b.count(a), a[:50])); continue
        b = b.replace(a, c)
    return b
def _main():
    if len(sys.argv) > 2 and sys.argv[1] == 'blog':
        for l in sys.argv[2:]: run_blog(l)
    elif len(sys.argv) > 2 and sys.argv[1] == 'legal':
        sys.exit(0 if all([run_legal(l) for l in sys.argv[2:]]) else 1)
    else:
        for l in sys.argv[1:]: run(l)

BLOG = ['blog.html', 'post-puppy-cost.html', 'post-shopping-list.html', 'post-vaccination.html', 'post-puppy-sleep.html',
        'post-teething.html', 'post-walks.html', 'post-sit.html', 'post-clicker-vs-marker.html', 'post-5minutes.html',
        'post-cockapoo-grooming.html', 'post-rescue-333.html']
def run_blog(lang):
    tr = json.load(open(f'{TR}/{lang}-blog.json', encoding='utf-8'))
    out = f'{SRC}/lang/{lang}/'; errs = []
    enm = json.load(open(EN + 'pages.json')); meta = json.load(open(out + 'pages.json', encoding='utf-8'))
    for p in BLOG:
        src = open(EN + 'pages/' + p, encoding='utf-8').read()
        sp = units(src); tu = tr['units'].get(p)
        if tu is None: errs.append(p + ' missing'); continue
        if len(sp) != len(tu): errs.append(f'{p}: {len(tu)} units, need {len(sp)}'); continue
        for i, ((a, b), t) in enumerate(zip(sp, tu)):
            if tags(src[a:b]) != tags(t): errs.append(f'{p} unit {i} tags differ: {src[a:b][:50]}')
        body = apply(src, sp, [t.replace('"', '&quot;') if src[a-1:a] == '"' else t for (a, b), t in zip(sp, tu)])
        mt = tr['meta'][p]
        m = dict(title=mt[0], description=mt[1])
        if 'headline' in enm[p]:
            if len(mt) < 3: errs.append(p + ' headline missing')
            else: m['headline'] = mt[2]
        if not errs: open(out + 'pages/' + p, 'w', encoding='utf-8', newline='\n').write(body)
        meta[p] = m
    if not errs: json.dump(meta, open(out + 'pages.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(lang, 'blog errors:', len(errs)); [print('  ', e) for e in errs]
LEGAL = ['legal/terms.html', 'legal/privacy.html']
EN_URL = 'https://pawtyapp.com/'
def run_legal(lang):
    """tr/<lang>-legal.json: units per page, meta [title, description] per page, and the binding line.
    The binding line holds one <a>...</a>, pointed here at the English page of the same name.
    It is inserted right after the effective-date line and has no English counterpart."""
    tr = json.load(open(f'{TR}/{lang}-legal.json', encoding='utf-8'))
    out = f'{SRC}/lang/{lang}/'; errs = []; bodies = {}
    meta = json.load(open(out + 'pages.json', encoding='utf-8'))
    for p in LEGAL:
        src = open(EN + 'pages/' + p, encoding='utf-8').read()
        sp = units(src); tu = tr['units'].get(p)
        if tu is None: errs.append(p + ' missing'); continue
        if len(sp) != len(tu): errs.append(f'{p}: {len(tu)} units, need {len(sp)}'); continue
        for i, ((a, b), t) in enumerate(zip(sp, tu)):
            if tags(src[a:b]) != tags(t): errs.append(f'{p} unit {i} tags differ: {src[a:b][:50]}')
        body = apply(src, sp, [t.replace('"', '&quot;') if src[a-1:a] == '"' else t for (a, b), t in zip(sp, tu)])
        bl = tr['binding']
        if bl.count('<a>') != 1 or bl.count('</a>') != 1 or len(re.findall(r'<[^>]+>', bl)) != 2: errs.append('binding line needs exactly one <a>...</a>')
        note = '\n<p class="meta legal-binding">' + bl.replace('<a>', f'<a href="{EN_URL}{p}" hreflang="en">') + '</p>'
        i = body.find('</p>', body.find('<p class="meta">'))
        if i < 0: errs.append(p + ' meta line not found'); continue
        bodies[p] = body[:i + 4] + note + body[i + 4:]
        t, d = tr['meta'][p]; meta[p] = dict(title=t, description=d)
    if not errs:
        os.makedirs(out + 'pages/legal', exist_ok=True)
        for p, b in bodies.items(): open(out + 'pages/' + p, 'w', encoding='utf-8', newline='\n').write(b)
        json.dump(meta, open(out + 'pages.json', 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(lang, 'legal errors:', len(errs)); [print('  ', e) for e in errs]
    return not errs
if __name__ == '__main__': _main()
