"""House style check for blog post bodies. Usage: python3 stylecheck.py file.html [...]"""
import re, sys, html
BANNED = "delve landscape realm multifaceted tapestry testament paradigm nuanced robust intricate pivotal moreover furthermore notably embark foster harnessing showcasing revolutionize groundbreaking cutting-edge game-changer synergy holistic streamline spearheaded bolster underscore navigate scaffolding".split()
total = 0
for f in sys.argv[1:]:
    s = open(f, encoding='utf-8').read()
    probs = []
    if '{{' in s.replace('{{stores}}', ''): probs.append('stray placeholder')
    if s.count('{{stores}}') != 1: probs.append('stores placeholder count %d' % s.count('{{stores}}'))
    checks = re.findall(r'<!--\s*CHECK:(.*?)-->', s, flags=re.S)
    body = re.sub(r'<!--.*?-->', '', s, flags=re.S)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    prose = text.split(' Sources ')[0] if ' Sources ' in text else text
    for pat, name in [(r'[–—]', 'dash'), (r"\b\w+n['’]t\b|\b(it's|you're|we're|they're|let's|I'm|we'll|you'll|that's|there's|what's|he's|she's)\b", 'contraction'),
                      (r'[A-Za-z\)];', 'semicolon'), (r'!', 'exclamation'), (r'\b(two|three|four|five|six|seven|eight|nine|ten)\b', 'number word'),
                      (r'\b(' + '|'.join(BANNED) + r')\w*', 'banned word'), (r'\b(diaper|crib|pacifier|stroller|Mom|color|favorite|behavior|pediatrician)\b', 'US spelling')]:
        for m in re.finditer(pat, prose, flags=re.I if name in ('number word', 'banned word') else 0):
            probs.append(f'{name}: ...{prose[max(0, m.start()-35):m.end()+25].strip()}...')
    words = len(re.findall(r"\b\w+\b", prose))
    links = re.findall(r'href="(https?://[^"]+)"', s)
    print(f'== {f.split("/")[-1]}: {words} words, {len(links)} external links, {len(checks)} CHECK comments, {len(probs)} problems')
    for p in probs: print('  -', p)
    for c in checks: print('  CHECK:', c.strip())
    total += len(probs)
print('TOTAL problems', total)
