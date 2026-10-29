"""Génère les pages statiques des actualités à partir de data/news/stories.json :
- une page par brève publiée : actualites/<id>/index.html (adresse partageable, indexable) ;
- le flux RSS : actualites/feed.xml ;
- le plan du site des actualités : sitemap-actualites.xml.

Le gabarit (en-tête, pied de page) est repris de actualites/index.html.
Tout le texte est échappé : le contenu vient de sources externes et d'une IA.
"""
from __future__ import annotations

import datetime as dt
import email.utils
import html
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NEWS_DIR = ROOT / "actualites"
BASE = "https://www.crashplanewebsite.com"
RESERVED = {"brouillons"}
MARKER = ".genere-par-le-robot"
MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
          "septembre", "octobre", "novembre", "décembre"]
STATUS = {"officiel": "Confirmé par une source officielle", "corrobore": "Corroboré par plusieurs sources"}


def e(t) -> str:
    return html.escape(str(t or ""), quote=True)


def fr_date(iso: str) -> str:
    d = dt.datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(dt.timezone(dt.timedelta(hours=1)))
    return f"{d.day}{'er' if d.day == 1 else ''} {MONTHS[d.month - 1]} {d.year} à {d.hour:02d} h {d.minute:02d}"


def visible(s: dict) -> bool:
    return s.get("published") is True and not s.get("hidden") and not s.get("withdrawn")


def safe_id(s: dict) -> str | None:
    return s["id"] if re.fullmatch(r"[a-z0-9][a-z0-9-]{5,120}", s.get("id", "")) else None


def _template() -> tuple[str, str]:
    page = (NEWS_DIR / "index.html").read_text(encoding="utf-8")
    head, rest = page.split('<main class="wrap news-page">', 1)
    foot = rest.split("</main>", 1)[1].replace('    <script src="/assets/js/news.js"></script>\n', "")
    head = head.replace(' aria-current="page"', ' aria-current="page"')  # Actualités reste la rubrique active
    return head, foot


def _head(head: str, s: dict, url: str) -> str:
    desc = e(s["chapo"][:200])
    title = e(s["titre"]) + " — Carnet de Vol"
    head = re.sub(r"<title>.*?</title>", f"<title>{title}</title>", head, count=1)
    head = re.sub(r'<meta name="description" content="[^"]*" />', f'<meta name="description" content="{desc}" />', head, count=1)
    head = re.sub(r'<meta property="og:description" content="[^"]*" />', f'<meta property="og:description" content="{desc}" />', head, count=1)
    head = re.sub(r'<meta property="og:title" content="[^"]*" />', f'<meta property="og:title" content="{title}" />', head, count=1)
    head = re.sub(r'<link rel="canonical" href="[^"]*" />', f'<link rel="canonical" href="{url}" />', head, count=1)
    head = re.sub(r'<meta property="og:url" content="[^"]*" />', f'<meta property="og:url" content="{url}" />', head, count=1)
    head = head.replace('<meta property="og:type" content="website" />', '<meta property="og:type" content="article" />')
    head = head.replace("</head>", f'    <link rel="alternate" type="application/rss+xml" title="Carnet de Vol — Actualités" href="{BASE}/actualites/feed.xml" />\n  </head>')
    return head.replace('<body data-mode="published">', "<body>")


def _article(s: dict) -> str:
    v = s.get("verification") or {}
    badge = f'<span class="news-status {"st-official" if v.get("status") == "officiel" else "st-corroborated"}">{e(STATUS[v["status"]])}</span>' if v.get("status") in STATUS else ""
    meta = f"Publié le {fr_date(s['created'])}"
    if s.get("version", 1) > 1:
        meta += f" · mis à jour le {fr_date(s['updated'])}"
    paras = "".join(f"<p>{e(p)}</p>" for p in s.get("paragraphes", []))
    contra = f'<p class="news-warning">Points divergents entre les sources : {e(s["contradictions"])}</p>' if s.get("contradictions") else ""
    srcs = "".join(
        f'<li><a href="{e(x["url"])}" target="_blank" rel="noopener nofollow">{e(x.get("title") or x.get("name"))}</a>'
        f'<span class="meta"> — {e(x.get("name"))}{" (source officielle)" if x.get("official") else ""}</span></li>'
        for x in s.get("sources", []) if re.match(r"^https?://", x.get("url", ""))
    )
    return f"""<main class="wrap news-page">
      <nav class="crumbs" aria-label="Fil d’Ariane"><a class="link" href="/actualites/">Actualités</a><span aria-hidden="true">/</span><span>{e(s["categorie"])}</span></nav>
      <article class="news-card news-single">
        {f'<div class="news-head">{badge}</div>' if badge else ''}
        <h1 class="news-title">{e(s["titre"])}</h1>
        <p class="meta">{e(meta)}</p>
        <p class="news-chapo">{e(s["chapo"])}</p>
        {paras}{contra}
        <section class="news-sources-static"><h2>Sources ({len(s.get("sources", []))})</h2><ul>{srcs}</ul></section>
      </article>
      <p class="news-note">Brève rédigée automatiquement par une IA à partir des sources citées. <a class="link" href="/#/a-propos">Comment elle est vérifiée</a></p>
    </main>"""


def _rss(stories: list[dict]) -> str:
    items = []
    for s in stories[:30]:
        url = f"{BASE}/actualites/{s['id']}/"
        pub = email.utils.format_datetime(dt.datetime.fromisoformat(s["created"].replace("Z", "+00:00")))
        items.append(f"""  <item>
    <title>{e(s["titre"])}</title>
    <link>{url}</link>
    <guid isPermaLink="true">{url}</guid>
    <pubDate>{pub}</pubDate>
    <category>{e(s["categorie"])}</category>
    <description>{e(s["chapo"])}</description>
  </item>""")
    now = email.utils.format_datetime(dt.datetime.now(dt.timezone.utc))
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Carnet de Vol — Actualités aéronautiques</title>
  <link>{BASE}/actualites/</link>
  <atom:link href="{BASE}/actualites/feed.xml" rel="self" type="application/rss+xml" />
  <description>L’actualité aéronautique recoupée entre plusieurs sources.</description>
  <language>fr-fr</language>
  <lastBuildDate>{now}</lastBuildDate>
{chr(10).join(items)}
</channel>
</rss>
"""


def _sitemap(stories: list[dict]) -> str:
    urls = "\n".join(
        f"  <url><loc>{BASE}/actualites/{s['id']}/</loc><lastmod>{s['updated'][:10]}</lastmod></url>" for s in stories
    )
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{urls}\n</urlset>\n'


def generate(stories: list[dict]) -> int:
    pub = [s for s in stories if visible(s) and safe_id(s)]
    pub.sort(key=lambda s: s["created"], reverse=True)
    head, foot = _template()
    wanted = set()
    for s in pub:
        d = NEWS_DIR / s["id"]
        d.mkdir(exist_ok=True)
        (d / MARKER).write_text("", encoding="utf-8")
        url = f"{BASE}/actualites/{s['id']}/"
        (d / "index.html").write_text(_head(head, s, url) + _article(s) + foot, encoding="utf-8")
        wanted.add(s["id"])
    # supprime les pages de brèves retirées (uniquement celles créées par le robot)
    for d in NEWS_DIR.iterdir():
        if d.is_dir() and d.name not in RESERVED and d.name not in wanted and (d / MARKER).exists():
            shutil.rmtree(d)
    (NEWS_DIR / "feed.xml").write_text(_rss(pub), encoding="utf-8")
    (ROOT / "sitemap-actualites.xml").write_text(_sitemap(pub), encoding="utf-8")
    return len(pub)
