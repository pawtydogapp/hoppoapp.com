"""Apply a checker's fixes to a post. Usage: python3 applyfix.py post.html fixes.json [skip_index ...]"""
import json, sys
post, fx = sys.argv[1], sys.argv[2]
skip = {int(x) for x in sys.argv[3:]}
s = open(post, encoding='utf-8').read()
d = json.load(open(fx, encoding='utf-8'))
ok = miss = 0
for i, f in enumerate(d.get('fixes', [])):
    if i in skip: continue
    n = s.count(f['old'])
    if n == 1:
        s = s.replace(f['old'], f['new']); ok += 1
    else:
        miss += 1; print(f'MISS {i} (found {n}x): {f["old"][:90]}')
open(post, 'w', encoding='utf-8').write(s)
print(f'applied {ok}, missed {miss}, verdict: {d.get("verdict")}')
