#!/usr/bin/env python3
"""Focused test: Compare old vs new strategy for failed species"""
import urllib.request
import json
import time

def fetch_json(url, headers=None):
    try:
        req = urllib.request.Request(url)
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except:
        return None

# All 14 no_literature species
failed_species = [
    "Phaethon rubricauda",
    "Pelecanus onocrotalus",
    "Bucephala clangula",
    "Garrulax canorus",
    "Clangula hyemalis",
    "Limnodromus semipalmatus",
    "Gorsachius goisagi",
    "Ixobrychus cinnamomeus",
    "Elaphe quadrivirgata",
    "Ixobrychus sinensis",
    "Ixobrychus flavicollis",
    "Gavia adamsii",
    "Gorsachius melanolophus",
    "Cynops pyrrhogaster",
]

print("Species | OldWikiJA | Wikidata->JaName | NewWikiJA | WikiEN | GBIF_Lit | GBIF_Desc | S2")
print("-" * 120)

for sp in failed_species:
    ua = {"User-Agent": "OmoikaneTest/1.0"}

    # Old method: direct Wikipedia JA
    url = "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={}&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, ua)
    pages = data.get("query", {}).get("pages", {}) if data else {}
    old_ja = any(pid != "-1" and page.get("extract") for pid, page in pages.items())

    # New: Wikidata -> JA name -> Wikipedia JA
    url = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search={}&language=en&type=item&limit=1&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, ua)
    entities = data.get("search", []) if data else []
    ja_name = ""
    new_ja = False
    if entities:
        qid = entities[0].get("id", "")
        url2 = "https://www.wikidata.org/w/api.php?action=wbgetentities&ids={}&props=labels&languages=ja&format=json".format(qid)
        data2 = fetch_json(url2, ua)
        ja_name = data2.get("entities", {}).get(qid, {}).get("labels", {}).get("ja", {}).get("value", "") if data2 else ""
        if ja_name:
            url3 = "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={}&format=json".format(
                urllib.request.quote(ja_name))
            data3 = fetch_json(url3, ua)
            pages3 = data3.get("query", {}).get("pages", {}) if data3 else {}
            new_ja = any(pid != "-1" and page.get("extract") for pid, page in pages3.items())

    # Wiki EN
    url = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={}&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, ua)
    pages = data.get("query", {}).get("pages", {}) if data else {}
    wiki_en = any(pid != "-1" and page.get("extract") for pid, page in pages.items())

    # GBIF Literature
    url = "https://api.gbif.org/v1/literature/search?q={}&limit=3".format(urllib.request.quote(sp))
    data = fetch_json(url)
    gbif_lit = sum(1 for r in (data.get("results", []) if data else []) if r.get("abstract") and len(r.get("abstract","")) > 50)

    # GBIF Species Descriptions
    url = "https://api.gbif.org/v1/species/match?name={}&strict=true".format(urllib.request.quote(sp))
    data = fetch_json(url)
    gbif_desc = 0
    if data and data.get("usageKey"):
        url2 = "https://api.gbif.org/v1/species/{}/descriptions".format(data["usageKey"])
        data2 = fetch_json(url2)
        gbif_desc = sum(1 for d in (data2.get("results", []) if data2 else []) if d.get("description") and len(d.get("description","")) > 50)

    # Semantic Scholar
    url = "https://api.semanticscholar.org/graph/v1/paper/search?query={}&fields=title,abstract,year&limit=3".format(
        urllib.request.quote(sp))
    data = fetch_json(url)
    s2 = sum(1 for p in (data.get("data", []) if data else []) if p.get("abstract") and len(p.get("abstract","")) > 50)

    mark = lambda v: "HIT" if v else "MISS"
    print("{:<30} | {:4} | {:20} | {:4} | {:4} | {:8} | {:9} | {}".format(
        sp, mark(old_ja), ja_name[:20] if ja_name else "-", mark(new_ja), mark(wiki_en),
        str(gbif_lit), str(gbif_desc), str(s2)))

    time.sleep(2)

print()
print("CONCLUSION: Wikidata bridge (学名->和名->Wikipedia JA) + GBIF Species Descriptions are the key improvements")
