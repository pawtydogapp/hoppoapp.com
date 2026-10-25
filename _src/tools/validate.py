import glob,os,re,sys
from html.parser import HTMLParser
R=sys.argv[1]; errs=[]
VOID={'meta','link','img','br','input','source','hr','area','base','col','embed','param','track','wbr','path','ellipse','circle','rect','line','polyline','polygon'}
class P(HTMLParser):
    def __init__(s): super().__init__(); s.st=[]; s.e=[]
    def handle_starttag(s,t,a):
        if t not in VOID: s.st.append(t)
    def handle_startendtag(s,t,a): pass
    def handle_endtag(s,t):
        if t in VOID: return
        if not s.st or s.st[-1]!=t: s.e.append(f'unexpected </{t}> open={s.st[-3:]}'); 
        if t in s.st:
            while s.st and s.st.pop()!=t: pass
files=[f for f in glob.glob(R+'/**/*.html',recursive=True) if '/_src/' not in f and not os.path.basename(f).startswith('08a')]
for f in files:
    s=open(f,encoding='utf-8').read(); r=f[len(R):]
    p=P(); p.feed(s); p.close()
    if p.e: errs.append((r,p.e[:3]))
    if p.st: errs.append((r,'unclosed '+str(p.st)))
    if s.count('<div')!=s.count('</div>'): errs.append((r,'div count'))
    if re.search(r'\{\{[a-z0-9_]+\}\}',s): errs.append((r,'placeholder left'))
    if len(s)>100000: errs.append((r,'oversize %d'%len(s)))
    sc=re.sub(r'<!--.*?-->','',s,flags=re.S)
    for h in re.findall(r'(?:href|src)="(/[^"]*)"',sc):
        t=h.split('#')[0].split('?')[0]
        t='/index.html' if t=='/' else t
        if not os.path.exists(R+t) and t not in ('/press-icon.png',): errs.append((r,'broken link '+h))
    for u in re.findall(r'https://hoppoapp\.com(/[^"<\s]*)',s):
        t=u.split('#')[0]; t=t+'index.html' if t.endswith('/') else t
        if not os.path.exists(R+t): errs.append((r,'broken absolute '+u))
print(len(files),'pages checked'); [print(e) for e in errs]; print('errors',len(errs))
