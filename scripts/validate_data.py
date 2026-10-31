#!/usr/bin/env python3
"""Valide la base de données JSON de la carte d'interopérabilité.

Usage :
    python scripts/validate_data.py              # contrôle structurel
    python scripts/validate_data.py --check-links  # teste aussi que chaque URL répond

Code de sortie : 0 si tout est valide, 1 sinon.
"""
import json
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

DATA = Path(__file__).resolve().parent.parent / "data"
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
EVIDENCE = {"read", "excerpt", "community"}
DIRECTIONS = {"uni", "bi"}
FORMAT_KINDS = {"open", "proprietary", "api"}


def load(name):
    with open(DATA / name, encoding="utf-8") as fh:
        return json.load(fh)


def is_http_url(value):
    try:
        parsed = urlparse(value)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def main():
    check_links = "--check-links" in sys.argv
    errors = []
    urls = {}

    def err(msg):
        errors.append(msg)

    def need(obj, keys, where):
        for key in keys:
            if key not in obj or obj[key] in ("", None):
                err(f"{where}: champ obligatoire manquant « {key} »")

    meta = load("meta.json")
    formats = load("formats.json")
    software = load("software.json")
    connections = load("connections.json")

    for group, entries in (("categories", meta["categories"]), ("kinds", meta["kinds"])):
        for entry in entries:
            for color_key in ("color", "colorDark"):
                if color_key in entry and not HEX_RE.match(entry[color_key]):
                    err(f"meta.{group}[{entry.get('id')}]: {color_key} doit être une couleur #rrggbb")

    for cat in meta["categories"]:
        if "column" in cat and not (isinstance(cat["column"], int) and cat["column"] >= 0):
            err(f"meta.categories[{cat.get('id')}]: column doit être un entier >= 0")

    category_ids = {c["id"] for c in meta["categories"]}
    domain_ids = {d["id"] for d in meta["domains"]}
    family_ids = {f["id"] for f in meta["formatFamilies"]}
    kind_ids = {k["id"] for k in meta["kinds"]}
    confidence_ids = {c["id"] for c in meta["confidence"]}

    format_ids = set()
    for f in formats:
        where = f"formats[{f.get('id')}]"
        need(f, ["id", "name", "fullName", "kind", "family", "description", "carries", "caveats", "url"], where)
        if f.get("family") not in family_ids:
            err(f"{where}: famille inconnue « {f.get('family')} »")
        if f["id"] in format_ids:
            err(f"{where}: identifiant dupliqué")
        format_ids.add(f["id"])
        if not ID_RE.match(f["id"]):
            err(f"{where}: identifiant invalide")
        if f["kind"] not in FORMAT_KINDS:
            err(f"{where}: kind inconnu « {f['kind']} »")
        if not is_http_url(f["url"]):
            err(f"{where}: URL invalide")
        urls.setdefault(f["url"], []).append(where)

    software_ids = set()
    for s in software:
        where = f"software[{s.get('id')}]"
        need(s, ["id", "name", "vendor", "category", "domain", "description", "website"], where)
        if s.get("domain") not in domain_ids:
            err(f"{where}: domaine inconnu « {s.get('domain')} »")
        if s["id"] in software_ids:
            err(f"{where}: identifiant dupliqué")
        software_ids.add(s["id"])
        if not ID_RE.match(s["id"]):
            err(f"{where}: identifiant invalide")
        if s["category"] not in category_ids:
            err(f"{where}: catégorie inconnue « {s['category']} »")
        for fid in s.get("formats", []):
            if fid not in format_ids:
                err(f"{where}: format inconnu « {fid} »")
        for pos_key in ("position", "positionPortrait"):
            if pos_key not in s:
                continue
            pos = s[pos_key]
            if not all(isinstance(pos.get(k), (int, float)) for k in ("x", "y")):
                err(f"{where}: {pos_key} x/y numérique requise")
        if "shortName" in s and not (isinstance(s["shortName"], str) and 0 < len(s["shortName"]) <= 16):
            err(f"{where}: shortName doit être un texte de 1 à 16 caractères (étiquette du nœud)")
        logo = s.get("logo")
        if logo and (urlparse(logo).scheme or logo.startswith("/") or ".." in logo):
            err(f"{where}: logo doit être un chemin relatif dans le dépôt (ex. assets/logos/revit.svg)")
        if not is_http_url(s["website"]):
            err(f"{where}: URL de site invalide")
        urls.setdefault(s["website"], []).append(where)

    connection_ids = set()
    pairs = {}
    for c in connections:
        where = f"connections[{c.get('id')}]"
        need(
            c,
            ["id", "source", "target", "direction", "kind", "summary", "transfers",
             "limitations", "confidence", "evidence", "verifiedOn", "sources"],
            where,
        )
        if c["id"] in connection_ids:
            err(f"{where}: identifiant dupliqué")
        connection_ids.add(c["id"])
        for end in ("source", "target"):
            if c[end] not in software_ids:
                err(f"{where}: {end} inconnu « {c[end]} »")
        if c["source"] == c["target"]:
            err(f"{where}: source et cible identiques")
        pair = frozenset((c["source"], c["target"]))
        if pair in pairs:
            err(f"{where}: paire déjà couverte par « {pairs[pair]} » (fusionner les formats dans une seule liaison)")
        pairs[pair] = c["id"]
        if c["direction"] not in DIRECTIONS:
            err(f"{where}: direction invalide")
        if c["kind"] not in kind_ids:
            err(f"{where}: type de liaison inconnu « {c['kind']} »")
        if c["confidence"] not in confidence_ids:
            err(f"{where}: niveau de confiance inconnu")
        if c["evidence"] not in EVIDENCE:
            err(f"{where}: evidence doit être parmi {sorted(EVIDENCE)}")
        if not DATE_RE.match(c["verifiedOn"]):
            err(f"{where}: verifiedOn doit être AAAA-MM-JJ")
        for fid in c.get("formats", []):
            if fid not in format_ids:
                err(f"{where}: format inconnu « {fid} »")
        if not c["sources"]:
            err(f"{where}: au moins une source est exigée")
        for src in c["sources"]:
            if not src.get("title") or not is_http_url(src.get("url", "")):
                err(f"{where}: source invalide {src}")
            else:
                urls.setdefault(src["url"], []).append(where)
        if c["kind"] == "conditional" and c["confidence"] == "high":
            err(f"{where}: une liaison « conditionnelle » ne peut pas avoir une confiance élevée")

    # Base documentaire : références, fiches, Madagascar.
    references = load("references.json")
    ref_ids = set()
    for r in references:
        where = f"references[{r.get('id')}]"
        need(r, ["id", "title", "publisher", "type", "url", "accessed", "evidence"], where)
        if r["id"] in ref_ids:
            err(f"{where}: identifiant dupliqué")
        ref_ids.add(r["id"])
        if not DATE_RE.match(r["accessed"]):
            err(f"{where}: accessed doit être AAAA-MM-JJ")
        if not is_http_url(r["url"]):
            err(f"{where}: URL invalide")
        urls.setdefault(r["url"], []).append(where)

    def walk(node, where):
        """Toute référence citée doit exister ; toute affirmation confirmée doit être sourcée."""
        if isinstance(node, dict):
            for rid in node.get("refs", []):
                if rid not in ref_ids:
                    err(f"{where}: référence inconnue « {rid} »")
            if node.get("v") is True and not node.get("refs"):
                err(f"{where}: affirmation confirmée sans référence")
            if node.get("nature") == "fait" and not node.get("refs"):
                err(f"{where}: fait sans référence")
            for key, value in node.items():
                walk(value, f"{where}.{key}")
        elif isinstance(node, list):
            for index, value in enumerate(node):
                walk(value, f"{where}[{index}]")

    profile_ids = load("profiles/index.json")
    for pid in profile_ids:
        where = f"profiles/{pid}"
        if pid not in software_ids:
            err(f"{where}: logiciel inconnu")
        profile = load(f"profiles/{pid}.json")
        if profile.get("id") != pid:
            err(f"{where}: id différent du nom de fichier")
        if not DATE_RE.match(profile.get("reviewed", "")):
            err(f"{where}: reviewed doit être AAAA-MM-JJ")
        walk(profile, where)
    on_disk = {p.stem for p in (DATA / "profiles").glob("*.json")} - {"index"}
    for orphan in on_disk - set(profile_ids):
        err(f"profiles/{orphan}: fichier absent de profiles/index.json")

    madagascar = load("madagascar.json")
    for entry in madagascar["entries"]:
        if entry["software"] not in software_ids:
            err(f"madagascar: logiciel inconnu « {entry['software']} »")

    print(f"{len(software)} logiciels, {len(connections)} liaisons, {len(formats)} formats, "
          f"{len(profile_ids)} fiches détaillées, {len(references)} références")

    if check_links:
        def probe(url):
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (link-check)"})
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    return url, resp.status
            except urllib.error.HTTPError as exc:
                return url, exc.code
            except Exception as exc:  # noqa: BLE001
                return url, f"{type(exc).__name__}"

        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(probe, urls))
        for url, status in sorted(results, key=lambda r: str(r[1])):
            flag = "OK " if status == 200 else "?? "
            print(f"{flag}{status}  {url}  <- {', '.join(urls[url][:2])}")

    if errors:
        print("\nERREURS :")
        for e in errors:
            print(" -", e)
        return 1
    print("Données valides.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
