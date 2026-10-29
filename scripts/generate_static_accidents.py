#!/usr/bin/env python3
"""Génère les pages statiques des accidents (accidents/<id>/index.html), la liste accidents/index.html
et sitemap.xml à partir de data/accidents.json. Remplace l'ancien script PowerShell.

Le gabarit (en-tête, pied de page, polices) est repris d'une page existante.
Usage : python3 scripts/generate_static_accidents.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://www.crashplanewebsite.com"
MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
          "septembre", "octobre", "novembre", "décembre"]


def e(t) -> str:
    return html.escape(str(t or ""), quote=True)


def fr_date(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{int(d)}{'er' if d == '01' else ''} {MONTHS[int(m) - 1]} {y}"


def plain(htm: str, n: int = 180) -> str:
    t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", htm or "")).strip()
    return t if len(t) <= n else t[:n].rsplit(" ", 1)[0] + "…"


def template() -> tuple[str, str]:
    page = (ROOT / "accidents" / "af447-2009" / "index.html").read_text(encoding="utf-8")
    head, rest = page.split('<main class="article" id="content">', 1)
    foot = rest.split("</main>", 1)[1]
    return head, foot


def page_for(acc: dict, head: str, foot: str) -> str:
    url = f"{BASE}/accidents/{acc['id']}/"
    title, desc = e(acc["title"]), e(plain(acc.get("description")))
    img = (acc.get("images") or [None])[0]
    og = f"{BASE}/{img['url']}" if img else f"{BASE}/assets/img/og-image.png"
    h = head
    h = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", h, count=1)
    h = re.sub(r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{desc}" />', h, count=1)
    h = re.sub(r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />', h, count=1)
    h = re.sub(r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{title}" />', h, count=1)
    h = re.sub(r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{desc}" />', h, count=1)
    h = re.sub(r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />', h, count=1)
    h = re.sub(r'<meta property="og:image" content="[^"]*" />', f'<meta property="og:image" content="{og}" />', h, count=1)
    meta = " — ".join(e(x) for x in [fr_date(acc["date"]), acc.get("location"), acc.get("airline"), acc.get("aircraft")] if x)
    srcs = "".join(f'<li><a href="{e(s["url"])}" target="_blank" rel="noopener">{e(s.get("title") or s["url"])}</a></li>'
                   for s in acc.get("sources", []) if re.match(r"^https?://", s.get("url", "")))
    main = f"""<main class="article" id="content">
      <a class="back" href="/">← Retour à l’accueil</a>
      <h1>{title}</h1>
      <div class="meta">{meta}</div>
      <article class="story">{acc.get("description", "")}</article>
      <section class="sources"><h2>Sources</h2><ul>{srcs}</ul></section>
      <p><a class="btn" href="/#/accident/{e(acc['id'])}">Voir la fiche interactive</a></p>
    </main>"""
    return h + main + foot


def main() -> None:
    data = json.loads((ROOT / "data" / "accidents.json").read_text(encoding="utf-8"))
    head, foot = template()
    for acc in data:
        d = ROOT / "accidents" / acc["id"]
        d.mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(page_for(acc, head, foot), encoding="utf-8")
    # liste
    lst = ROOT / "accidents" / "index.html"
    s = lst.read_text(encoding="utf-8")
    items = "\n".join(f'<li><a href="/accidents/{e(a["id"])}/">{e(a["title"])}</a> <span class="meta">({a["date"][:4]})</span></li>'
                      for a in sorted(data, key=lambda a: a["date"], reverse=True))
    s = re.sub(r"<ul>.*?</ul>", lambda m: f"<ul>{items}</ul>", s, count=1, flags=re.S)
    lst.write_text(s, encoding="utf-8")
    # plan du site
    urls = [f"{BASE}/", f"{BASE}/accidents/", f"{BASE}/actualites/"] + [f"{BASE}/accidents/{a['id']}/" for a in data]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "\n".join(f"  <url><loc>{u}</loc></url>" for u in urls) + "\n</urlset>\n", encoding="utf-8")
    print(f"{len(data)} pages générées")


if __name__ == "__main__":
    main()
