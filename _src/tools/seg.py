import re
from html.parser import HTMLParser
INLINE={'a','strong','b','em','i','br','span','code','small','sup','sub'}
SKIP={'script','style','svg','noscript_'}
class Seg(HTMLParser):
    """Collect translatable runs: maximal stretches of text plus inline tags between block boundaries."""
    def __init__(s,src):
        super().__init__(convert_charrefs=False); s.src=src; s.runs=[]; s.cur=None; s.skip=0; s.attrs=[]; s.stack_inl=[]
        # line offsets
        s.lo=[0]
        for m in re.finditer('\n',src): s.lo.append(m.end())
    def pos(s):
        l,c=s.getpos(); return s.lo[l-1]+c
    def start_run(s):
        if s.cur is None: s.cur=[s.pos(),None]
    def end_run(s):
        if s.cur is not None:
            s.cur[1]=s.pos(); s.runs.append(tuple(s.cur)); s.cur=None
    def handle_starttag(s,t,a):
        p=s.pos(); raw=s.get_starttag_text()
        for k,v in a:
            if k in ('alt','aria-label','placeholder','title') and v and not s.skip and re.search('[A-Za-z]',v):
                i=raw.find(f'{k}="'); 
                if i>=0: st=p+i+len(k)+2; s.attrs.append((st,st+len(v)))
        if t in SKIP: s.end_run(); s.skip+=1; return
        if s.skip: return
        if t not in ('br','img','meta','link','input','source','hr'): s.stack_inl.append(s.inl(t,a))
        if s.inl(t,a):
            if s.cur is None and t!='br': s.start_run()
        else: s.end_run()
    def inl(s,t,a):
        d=dict(a)
        if t in ('b','span'): return 'class' not in d and 'id' not in d
        if t=='a': return d.get('class')!='gcard'
        return t in ('strong','em','i','br','code','small','sup','sub')
    def handle_startendtag(s,t,a): s.handle_starttag(t,a)
    def handle_endtag(s,t):
        if t in SKIP: s.skip-=1; return
        if s.skip: return
        if s.stack_inl.pop() if s.stack_inl and t not in ('br',) else False: return
        s.end_run()
    def handle_data(s,d):
        if s.skip: return
        if d.strip() and s.cur is None: s.start_run()
    def handle_comment(s,d): s.end_run()
def units(src):
    p=Seg(src); p.feed(src); p.end_run()
    out=[]
    for a,b in p.runs:
        seg=src[a:b]; lead=len(seg)-len(seg.lstrip()); trail=len(seg)-len(seg.rstrip())
        a2,b2=a+lead,b-trail
        if a2<b2 and re.search(r'[A-Za-z]',re.sub(r'<[^>]+>','',src[a2:b2])) and not re.fullmatch(r'\{\{[a-z_]+\}\}',src[a2:b2]): out.append((a2,b2))
    out+= p.attrs
    return sorted(out)
def apply(src,spans,trans):
    assert len(spans)==len(trans)
    out=[];last=0
    for (a,b),t in zip(spans,trans): out.append(src[last:a]); out.append(t); last=b
    out.append(src[last:]); return ''.join(out)
