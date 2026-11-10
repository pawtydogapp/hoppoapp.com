#!/usr/bin/env python3
"""Submit URLs to IndexNow (Bing, Yandex, Seznam, Naver). Usage:
  python3 _src/tools/indexnow.py            submit all URLs from sitemap.xml
  python3 _src/tools/indexnow.py url1 url2  submit given URLs
"""
import json, re, sys, urllib.request
cfg = json.load(open('_src/config.json', encoding='utf-8'))
host = cfg['domain'].replace('https://', '').rstrip('/')
key = cfg['indexnow_key']
urls = sys.argv[1:]
if not urls:
    urls = re.findall(r'<loc>([^<]+)</loc>', open('sitemap.xml', encoding='utf-8').read())
for i in range(0, len(urls), 9000):
    body = json.dumps({'host': host, 'key': key, 'keyLocation': f'https://{host}/{key}.txt', 'urlList': urls[i:i+9000]}).encode()
    req = urllib.request.Request('https://api.indexnow.org/indexnow', body, {'Content-Type': 'application/json; charset=utf-8'})
    try:
        r = urllib.request.urlopen(req, timeout=60); print('HTTP', r.status, len(urls[i:i+9000]), 'URLs')
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read().decode()[:200]); sys.exit(1)
