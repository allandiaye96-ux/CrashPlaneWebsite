#!/usr/bin/env python3
"""Recherche et pose d'images libres de droits (Wikimedia Commons) pour la base d'accidents.

Deux modes, lancés par le workflow « Images libres » (GitHub Actions, qui a accès à internet) :

  python3 scripts/images_libres.py search
      Pour chaque accident, interroge Commons (immatriculation de l'appareil, puis nom du vol),
      garde les images sous licence libre et télécharge des vignettes dans review/images/
      avec un rapport review/candidats.json. Rien n'est modifié sur le site.

  python3 scripts/images_libres.py apply
      Lit review/choix.json ({"id": "Titre de fichier Commons" ou null}), télécharge l'image retenue
      dans assets/img/libres/, met à jour data/accidents.json (url, légende, crédit, licence)
      et supprime l'ancienne image de presse de la fiche.

Bibliothèque standard uniquement.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "accidents.json"
REVIEW = ROOT / "review"
OUT_DIR = ROOT / "assets" / "img" / "libres"
API = "https://commons.wikimedia.org/w/api.php"
UA = "CarnetDeVolImages/1.0 (https://www.crashplanewebsite.com; contact via GitHub allandiaye96-ux)"

# Immatriculations absentes ou mal formées dans les données, et requêtes de secours.
EXTRA = {
    "tenerife-1977": (["PH-BUF", "N736PA"], "Tenerife airport disaster"),
    "btk2937-2002": (["RA-85816", "A9C-DHL"], "Überlingen mid-air collision"),
    "ua173-1978": (["N8082U"], "United Airlines Flight 173"),
    "av52-1990": (["HK-2016"], "Avianca Flight 52"),
    "bm92-1989": (["G-OBME"], "Kegworth air disaster"),
    "sv163-1980": (["HZ-AHK"], "Saudia Flight 163"),
    "et961-1996": (["ET-AIZ"], "Ethiopian Airlines Flight 961"),
    "ac797-1983": (["C-FTLU"], "Air Canada Flight 797"),
    "ci140-1994": (["B-1816"], "China Airlines Flight 140"),
    "on1363-1989": (["C-FONF"], "Air Ontario Flight 1363"),
    "oz214-2013": (["HL7742"], "Asiana Airlines Flight 214"),
    "lamia2933-2016": (["CP-2933"], "LaMia Flight 2933"),
    "ups2976-2025": ([], "UPS Airlines Flight 2976"),
    "selfridge-1908": ([], "Thomas Selfridge Wright Military Flyer Fort Myer 1908"),
    "charkhidadri-1996": (["HZ-AIH"], "Charkhi Dadri mid-air collision"),
    "psa5342-2025": (["N709PS"], "2025 Potomac River mid-air collision"),
    "us1549-2009": (["N106US"], "US Airways Flight 1549"),
    "pa103-1988": (["N739PA"], "Lockerbie memorial"),
    "kal007-1983": (["HL7442"], "Korean Air Lines Flight 007 memorial"),
}

OK_LICENSE = re.compile(r"^(cc[ -]?by(-sa)?[ -]?[0-9.]*|cc0|public domain|pd\b|pd-)", re.I)


def get(url: str, params: dict | None = None, raw: bool = False):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            return data if raw else json.loads(data)
        except Exception as exc:  # noqa: BLE001
            print(f"  réessai {attempt + 1} : {exc}")
            time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"échec : {url}")


def strip(html: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()


def registrations(acc: dict) -> list[str]:
    regs, _ = EXTRA.get(acc["id"], ([], None))
    if regs:
        return regs
    text = (acc.get("aircraft") or "").replace("‑", "-").replace("‐", "-")
    return re.findall(r"\(([A-Z0-9]{1,2}-?[A-Z0-9]{2,6})\)", text)


def search(query: str, limit: int = 12) -> list[dict]:
    res = get(API, {
        "action": "query", "format": "json", "generator": "search", "gsrnamespace": 6,
        "gsrsearch": f"{query} filetype:bitmap", "gsrlimit": limit,
        "prop": "imageinfo", "iiprop": "url|size|extmetadata", "iiurlwidth": 1200,
        "iiextmetadatafilter": "LicenseShortName|LicenseUrl|Artist|ImageDescription|DateTimeOriginal",
    })
    out = []
    for page in (res.get("query", {}).get("pages", {}) or {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        lic = (meta.get("LicenseShortName", {}) or {}).get("value", "")
        out.append({
            "title": page["title"],
            "license": lic,
            "license_url": (meta.get("LicenseUrl", {}) or {}).get("value", ""),
            "author": strip((meta.get("Artist", {}) or {}).get("value", ""))[:150],
            "description": strip((meta.get("ImageDescription", {}) or {}).get("value", ""))[:300],
            "date": strip((meta.get("DateTimeOriginal", {}) or {}).get("value", ""))[:40],
            "width": info.get("width", 0),
            "thumb": info.get("thumburl") or info.get("url"),
            "page": info.get("descriptionurl"),
            "index": page.get("index", 99),
        })
    return sorted(out, key=lambda c: c["index"])


def candidates(acc: dict) -> list[dict]:
    regs = registrations(acc)
    _, fallback = EXTRA.get(acc["id"], ([], None))
    queries = [f'"{r}"' for r in regs]
    if fallback:
        queries.append(fallback)
    seen, out = set(), []
    for q in queries:
        for c in search(q):
            if c["title"] in seen or not OK_LICENSE.match(c["license"] or ""):
                continue
            seen.add(c["title"])
            c["query"] = q
            c["has_reg"] = any(r.replace("-", "").lower() in c["title"].replace("-", "").lower() for r in regs)
            out.append(c)
        time.sleep(0.5)
    out.sort(key=lambda c: (not c["has_reg"], c["width"] < 800))
    return out[:5]


def cmd_search(only_missing: bool = False) -> None:
    data = json.loads(DATA.read_text(encoding="utf-8"))
    if only_missing:
        data = [a for a in data if not a.get("images")]
    img_dir = REVIEW / "images"
    img_dir.mkdir(parents=True, exist_ok=True)
    report = {}
    for acc in data:
        print(f"{acc['id']} …")
        cands = candidates(acc)
        for i, c in enumerate(cands):
            thumb = c["thumb"].replace("/1200px-", "/480px-") if "/1200px-" in c["thumb"] else c["thumb"]
            try:
                (img_dir / f"{acc['id']}-{i}.jpg").write_bytes(get(thumb, raw=True))
            except Exception as exc:  # noqa: BLE001
                print(f"  vignette impossible : {exc}")
            time.sleep(0.3)
        report[acc["id"]] = {"regs": registrations(acc), "candidats": cands}
    (REVIEW / "candidats.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("terminé :", sum(1 for r in report.values() if r["candidats"]), "/", len(report), "accidents avec au moins une image")


def cmd_apply() -> None:
    choices = json.loads((REVIEW / "choix.json").read_text(encoding="utf-8"))
    # les fiches non traitées dans ce lot gardent leur image actuelle
    report = json.loads((REVIEW / "candidats.json").read_text(encoding="utf-8"))
    data = json.loads(DATA.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for acc in data:
        if acc["id"] not in choices:
            continue
        choice = choices[acc["id"]]
        if not choice:
            acc["images"] = []  # aucune image libre convenable : on retire l'image de presse
            continue
        title, caption = choice["title"], choice["caption"]
        c = next(x for x in report[acc["id"]]["candidats"] if x["title"] == title)
        ext = ".png" if title.lower().endswith(".png") else ".jpg"
        dest = OUT_DIR / f"{acc['id']}{ext}"
        dest.write_bytes(get(c["thumb"], raw=True))
        acc["images"] = [{
            "url": f"assets/img/libres/{dest.name}",
            "caption": caption,
            "credit": {"author": c["author"] or "Auteur inconnu", "license": c["license"],
                       "license_url": c["license_url"], "source": c["page"]},
        }]
        print(f"{acc['id']} ← {title}")
        time.sleep(0.3)
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    {"search": cmd_search, "search-missing": lambda: cmd_search(True), "apply": cmd_apply}[sys.argv[1]]()
