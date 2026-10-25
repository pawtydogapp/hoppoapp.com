#!/usr/bin/env python3
"""Hoppo website generator, adapted from the Pawty site (v31).

Builds every page of hoppoapp.com from the source in this _src folder.
Run from the repository root:   python3 _src/build.py
Output is written next to _src (the repository root), overwriting pages.

Source layout
  config.json            languages, page list, sitemap data
  lastmod.json           sitemap dates, kept by the build: one content hash and date per URL.
                         A page's date moves to the build date only when its text changes.
  guides.json            the 35 "Is this normal?" guides: slug, app id, stage, date.
                         Written by tools/sync_app.mjs from the app, never by hand
  templates/             page shell, guide page, store badges, small partials
  assets/site.css|js     the one stylesheet and the one script, published to /assets/
  lang/<xx>/chrome.json  navigation, footer, badges and guide headings
  lang/<xx>/pages.json   title, description and headline per page
  lang/<xx>/guides.json  optional website-only overrides per guide: title, description, card
  lang/<xx>/pages/*.html the body of every non-guide page
  app/                   the app's own text (en.json, copied by tools/sync_app.mjs)
                         guide text comes from here, word for word, so app and site never drift

Rules
  English lives at the root. Every other language lives in /<xx>/ with identical file names.
  A missing {{placeholder}} stops the build. Nothing is ever silently left blank.
"""
import json, os, re, sys, html, hashlib, subprocess, shutil

SRC = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SRC)
CSS_MODE = os.environ.get('HOPPO_CSS', 'external')

def rd(p): return open(os.path.join(SRC, p), encoding='utf-8').read()
def js(p): return json.loads(rd(p))
def wr(path, s):
    full = os.path.join(ROOT, path); os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w', encoding='utf-8', newline='\n').write(s)

PH = re.compile(r'\{\{([a-z0-9_]+)\}\}')
def render(tpl, v, where):
    def rep(m):
        k = m.group(1)
        if k not in v: raise SystemExit(f'Missing placeholder {{{{{k}}}}} in {where}')
        return v[k]
    return PH.sub(rep, tpl)

cfg = js('config.json')
DOMAIN = cfg['domain']
LANGS = [l[0] for l in cfg['languages']]
NATIVE = {l[0]: l[1] for l in cfg['languages']}
LOCALE = {l[0]: l[2] for l in cfg['languages']}
BLOG = json.load(open(os.path.join(SRC, 'lang', 'en', 'blog.json'), encoding='utf-8')) if os.path.exists(os.path.join(SRC, 'lang', 'en', 'blog.json')) else []
BLOG_LIVE = [b for b in BLOG if os.path.exists(os.path.join(SRC, 'lang', 'en', 'pages', 'blog', b['slug'] + '.html'))]
PAGES = cfg['pages'] + ([{'path': 'blog.html', 'kind': 'page', 'lastmod': max(b['date'] for b in BLOG_LIVE), 'priority': '0.8'}] if BLOG_LIVE else []) + [
    {'path': f"blog/{b['slug']}.html", 'kind': 'post', 'lastmod': b['date'], 'date': b['date'], 'priority': '0.8'} for b in BLOG_LIVE] + [
    {'path': f"guides/{g['slug']}.html", 'kind': 'guide', 'lastmod': g['date'], 'priority': '0.8'}
    for g in json.load(open(os.path.join(SRC, 'guides.json'), encoding='utf-8'))]
PAGE_PATHS = {p['path'] for p in PAGES}
T = {n: rd(f'templates/{n}.html') for n in ['base', 'stores', 'guide', 'guide-card', 'posthog', 'lang-switch']}
CSS = rd('assets/site.css'); JS = rd('assets/site.js')
def h8(s): return hashlib.md5(s.encode()).hexdigest()[:8]

import datetime
TODAY = os.environ.get('HOPPO_DATE', datetime.date.today().isoformat())
LM_PATH = os.path.join(SRC, 'lastmod.json')
LM_SEED = not os.path.exists(LM_PATH)          # first run: English keeps its config date
LM = {} if LM_SEED else json.load(open(LM_PATH, encoding='utf-8'))
def touch(lang, pg, u, content):
    h = hashlib.sha256(content.encode()).hexdigest()[:16]
    old = LM.get(u)
    if old and old['h'] == h: return
    d = pg.get('lastmod', TODAY) if (LM_SEED and lang == 'en') else TODAY
    LM[u] = {'h': h, 'd': d}

def prefix(lang): return '' if lang == 'en' else lang + '/'
def url(lang, path):
    p = prefix(lang) + ('' if path == 'index.html' else path)
    return f'{DOMAIN}/{p}'

def available(lang, path):
    """A page exists in a language once its text exists. Until then links fall back to English."""
    if lang == 'en': return True
    pg = next(p for p in PAGES if p['path'] == path)
    if pg.get('noindex'): return False
    if pg['kind'] == 'guide': return os.path.exists(os.path.join(SRC, 'lang', lang, 'guides.json'))
    return os.path.exists(os.path.join(SRC, 'lang', lang, 'pages', path))

def target(lang, path):
    """Where a link to `path` should go for a reader of `lang`."""
    return path if lang == 'en' or not available(lang, path) else f'{lang}/{path}'

def localize_links(s, lang):
    """Point internal page links at the same language. Images, assets and files stay shared."""
    if lang == 'en': return s
    def rep(m):
        tgt = m.group(2); bare = tgt.split('#')[0].split('?')[0].lstrip('/')
        if bare == '' : bare = 'index.html'
        if bare in PAGE_PATHS and available(lang, bare):
            if bare == 'index.html' and '#' not in tgt: return f'{m.group(1)}"/{lang}/"'
            return f'{m.group(1)}"/{lang}/{tgt.lstrip("/")}"'
        return m.group(0)
    return re.sub(r'(href=)"(/[^"]*)"', rep, s)

def load_app(lang):
    """Guide text and stage names, word for word from the app."""
    if lang == 'en':
        c = js('app/en.json')['content']
    else:
        c = js(f'app/{lang}.json')['content']
    return c['guides'], c['guideStages']

def first_sentence(s):
    m = re.match(r'(.+?[.?])(\s|$)', s)
    return m.group(1) if m else s

def short_desc(s, limit=158):
    """Whole sentences up to the limit, for meta descriptions."""
    out = ''
    for part in re.findall(r'[^.?]+[.?]', s):
        part = part.strip()
        if len(out) + len(part) + 1 > limit: break
        out = (out + ' ' + part).strip()
    return out or s[:limit]

def esc(s): return html.escape(s, quote=False)

def article_ld(headline, desc, u, date):
    return json.dumps({"@context": "https://schema.org", "@type": "Article", "headline": headline,
        "description": desc, "author": {"@type": "Person", "name": "Matej Mesko"},
        "publisher": {"@type": "Organization", "name": "Hoppo"}, "mainEntityOfPage": u,
        "datePublished": date}, ensure_ascii=False)

def build_lang(lang):
    L = f'lang/{lang}/'
    chrome = js(L + 'chrome.json'); meta = js(L + 'pages.json')
    gtext = js(L + 'guides.json') if os.path.exists(os.path.join(SRC, L + 'guides.json')) else {}
    gapp, stages = load_app(lang); gshared = js('guides.json')
    stores_v = dict(chrome, ios_id='', play_id='')
    stores = render(T['stores'], stores_v, 'stores')
    stores_hero = render(T['stores'], dict(chrome, ios_id=' id="get-ios"', play_id=' id="get-android"'), 'stores')
    css = f'<style>{CSS}</style>' if CSS_MODE == 'inline' else f'<link rel="stylesheet" href="/assets/site.css?v={h8(CSS)}">'
    jsx = f'<script>{JS}</script>' if CSS_MODE == 'inline' else f'<script src="/assets/site.js?v={h8(JS)}"></script>'
    written = []
    def card_of(g):
        t = gtext.get(g['id'], {})
        return render(T['guide-card'], {'slug': g['slug'], 'n': esc(gapp[g['id']]['title']),
            'card': esc(t.get('card') or first_sentence(gapp[g['id']]['intro']))}, 'card')
    groups = {st: ''.join(card_of(g) for g in gshared if g['stage'] == st) for st in ['pregnancy', 'baby', 'any', 'toddler', 'parent']}
    bmeta = {b['slug']: b for b in BLOG_LIVE}
    groups_order = ['Pregnancy and newborn', 'Baby', 'Toddler and preschool', 'Family life']
    def post_card(b):
        return f'<div class="postcard"><a href="/blog/{b["slug"]}.html"><h3>{esc(b["headline"])}</h3></a><p>{esc(b["card"])}</p></div>\n'
    blog_cards = ''.join(f'<h2 class="blogcat">{g}</h2>\n' + ''.join(post_card(b) for b in BLOG_LIVE if b['group'] == g)
                         for g in groups_order if any(b['group'] == g for b in BLOG_LIVE))
    latest = sorted(BLOG_LIVE, key=lambda b: (b['date'], b.get('order', 0)), reverse=True)[:3]
    home_blog = ''
    if latest:
        home_blog = ('<h2 class="sec">From the blog</h2>\n<div class="reveal" style="padding:18px 0 8px">\n' + ''.join(post_card(b) for b in latest)
                     + '<div class="postcard"><a href="/blog.html"><h3>All articles</h3></a><p>Sleep, costs, milestones, play and family life.</p></div>\n</div>\n')
    chrome = dict(chrome, nav_blog_link=('<a href="/blog.html">Blog</a>' if BLOG_LIVE else ''))
    page_vars = dict(stores=stores, stores_hero=stores_hero, guide_count=str(len(gshared)), blog_cards=blog_cards, home_blog=home_blog,
                     **{'guide_cards_' + k: v for k, v in groups.items()})
    gby = {'guides/' + g['slug'] + '.html': g for g in gshared}
    for pg in PAGES:
        path = pg['path']; u = url(lang, path)
        if not available(lang, path): continue
        langs_here = [l for l in LANGS if available(l, path)]
        if pg['kind'] == 'guide':
            g = gby[path]; b = gapp[g['id']]; t = gtext.get(g['id'], {})
            li = lambda xs: ''.join(f'<li>{esc(x)}</li>\n' for x in xs)
            help_block = f'<div class="warn"><h2>{chrome["guide_help"]}</h2>\n<ul>\n{li(b["help"])}</ul></div>\n\n' if b.get('help') else ''
            urgent_block = (f'<div class="urgent"><h2>{chrome["guide_urgent"]}</h2>\n<ul>\n{li(b["urgent"])}</ul>\n'
                            f'<p class="note">{chrome["guide_urgent_note"]}</p></div>\n\n') if b.get('urgent') else ''
            stage_name = chrome['stage_' + g['stage']]
            v = dict(chrome, n=esc(b['title']), intro=esc(b['intro']), common=li(b['common']), helps=li(b['helps']),
                     help_block=help_block, urgent_block=urgent_block, stage_name=stage_name, stores=stores)
            main = render(T['guide'], v, path)
            head = t.get('title') or b['title']
            title = head + chrome['title_suffix']; desc = t.get('description') or short_desc(b['intro'])
            ld = article_ld(head, desc, u, g['date'])
        elif pg['kind'] == 'post':
            b = bmeta[path[5:-5]]
            body = rd(L + 'pages/' + path)
            main = render(body, page_vars, path)
            title = b['headline'] + chrome['title_suffix']; desc = b['description']
            ld = article_ld(b['headline'], desc, u, b['date'])
        else:
            m = meta[path]
            body = rd(L + 'pages/' + path)
            main = render(body, page_vars, path)
            title = m['title']; desc = m['description']
            ld = article_ld(m['headline'], desc, u, pg['date']) if pg.get('ld') == 'article' else m.get('ld')
        touch(lang, pg, u, title + '\n' + desc + '\n' + main)
        canonical = '<meta name="robots" content="noindex">' if pg.get('noindex') else f'<link rel="canonical" href="{u}">'
        alts = ''
        if len(langs_here) > 1 and not pg.get('noindex'):
            alts = ''.join(f'\n<link rel="alternate" hreflang="{l}" href="{url(l, path)}">' for l in langs_here)
            alts += f'\n<link rel="alternate" hreflang="x-default" href="{url("en", path)}">'
        v = dict(chrome, lang=lang, title=title, description=desc, url=u, canonical=canonical + alts, og_locale=(f'\n<meta property="og:locale" content="{LOCALE[lang]}">' if len(LANGS) > 1 else ''),
                 css=css, posthog=T['posthog'], ld=(f'<script type="application/ld+json">{ld}</script>\n' if ld else ''),
                 main=main, js=jsx)
        out = localize_links(render(T['base'], v, path), lang)
        out = out.replace('@@LANGSWITCH@@', lang_switch(lang, path, chrome)).replace('@@LANGFOOT@@', lang_footer(lang, path))
        wr(prefix(lang) + path, out); written.append(prefix(lang) + path)
    return written

def lang_href(l, path):
    p = path if available(l, path) else 'index.html'
    return '/' + prefix(l) + ('' if p == 'index.html' else p)

def lang_switch(lang, path, chrome):
    if len(LANGS) < 2: return ''
    links = ''.join(f'<a href="{lang_href(l, path)}" hreflang="{l}" lang="{l}"' + (' aria-current="true"' if l == lang else '') + f'>{NATIVE[l]}</a>' for l in LANGS)
    return render(T['lang-switch'], dict(lang_label=chrome['lang_label'], native=NATIVE[lang], code=lang.upper(), links=links), 'lang-switch')

def lang_footer(lang, path):
    if len(LANGS) < 2: return ''
    return '<div class="langrow">' + ''.join(f'<a href="{lang_href(l, path)}" hreflang="{l}" lang="{l}"' + (' aria-current="true"' if l == lang else '') + f'>{NATIVE[l]}</a>' for l in LANGS) + '</div>\n'

def sitemap():
    rows = []
    for pg in PAGES:
        if 'lastmod' not in pg: continue
        for l in LANGS:
            if not available(l, pg['path']): continue
            rows.append(f'  <url><loc>{url(l, pg["path"])}</loc><lastmod>{LM[url(l, pg["path"])]["d"]}</lastmod><priority>{pg["priority"]}</priority></url>')
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n'

if __name__ == '__main__':
    allw = []
    for l in LANGS: allw += build_lang(l)
    wr('sitemap.xml', sitemap())
    json.dump(dict(sorted(LM.items())), open(LM_PATH, 'w', encoding='utf-8'), indent=0)
    if CSS_MODE != 'inline':
        wr('assets/site.css', CSS); wr('assets/site.js', JS)
    print(f'Built {len(allw)} pages in {len(LANGS)} language(s), css mode {CSS_MODE}')
