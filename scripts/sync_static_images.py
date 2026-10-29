#!/usr/bin/env python3
"""Met à jour l'image (et son crédit) des pages statiques accidents/<id>/index.html
d'après data/accidents.json. À relancer après tout changement d'image."""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://www.crashplanewebsite.com"
data = json.loads((ROOT / "data" / "accidents.json").read_text(encoding="utf-8"))

for acc in data:
    page = ROOT / "accidents" / acc["id"] / "index.html"
    if not page.exists():
        continue
    s = page.read_text(encoding="utf-8-sig")
    img = (acc.get("images") or [None])[0]
    s = re.sub(r'\s*<figure class="hero-fig">.*?</figure>', "", s, flags=re.S)
    s = re.sub(r'\s*<img class="hero"[^>]*/>', "", s)
    if img:
        e = lambda t: html.escape(str(t or ""), quote=True)
        c = img.get("credit") or {}
        credit = ""
        if c:
            lic = f'<a href="{e(c.get("license_url"))}" rel="license noopener" target="_blank">{e(c.get("license"))}</a>' if c.get("license_url") else e(c.get("license"))
            src = f' · <a href="{e(c.get("source"))}" target="_blank" rel="noopener">Wikimedia Commons</a>' if c.get("source") else ""
            credit = f'<span class="credit">Photo : {e(c.get("author") or "auteur inconnu")}, {lic}{src}</span>'
        fig = (f'\n      <figure class="hero-fig"><img class="hero" src="/{e(img["url"])}" alt="{e(img.get("caption") or acc["title"])}" />'
               f'<figcaption>{e(img.get("caption"))}{credit}</figcaption></figure>')
        s = re.sub(r'(<div class="meta">.*?</div>)', lambda m: m.group(1) + fig, s, count=1, flags=re.S)
        og = f'{BASE}/{img["url"]}'
    else:
        og = f"{BASE}/assets/img/plane.jpg"
    s = re.sub(r'<meta property="og:image" content="[^"]*" />', f'<meta property="og:image" content="{og}" />', s)
    page.write_text(s, encoding="utf-8")
print("pages statiques à jour")
