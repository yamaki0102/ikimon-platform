#!/usr/bin/env python3
"""Test API responses for species that FAILED in current prefetcher"""
import urllib.request
import json
import time

test_species = [
    "Phaethon rubricauda",  # no_literature
    "Gorsachius goisagi",   # no_literature
    "Cynops pyrrhogaster",  # no_literature (newt)
    "Elaphe quadrivirgata", # no_literature (snake)
    "Nipponia nippon",      # pending (ibis - should be easy)
    "Bubulcus ibis",        # pending (cattle egret)
]

def fetch_json(url, headers=None):
    try:
        req = urllib.request.Request(url)
        if headers:
            for k, v in headers.items():
                req.add_header(k, v)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}

for sp in test_species:
    print("=" * 60)
    print("TESTING: {}".format(sp))
    print("=" * 60)

    # 1. Wikipedia JA - direct title search (current method)
    url = "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={}&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, {"User-Agent": "OmoikaneTest/1.0"})
    pages = data.get("query", {}).get("pages", {})
    ja_direct = any(pid != "-1" and page.get("extract") for pid, page in pages.items())
    print("  Wiki JA (direct title): {}".format("HIT" if ja_direct else "MISS"))

    # 2. Wikipedia JA - opensearch (fuzzy match)
    url = "https://ja.wikipedia.org/w/api.php?action=opensearch&search={}&limit=5&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, {"User-Agent": "OmoikaneTest/1.0"})
    matches = data[1] if isinstance(data, list) and len(data) > 1 else []
    print("  Wiki JA (opensearch): {} matches -> {}".format(len(matches), matches[:3]))

    # 3. Wikipedia EN - direct title
    url = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={}&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, {"User-Agent": "OmoikaneTest/1.0"})
    pages = data.get("query", {}).get("pages", {})
    en_direct = any(pid != "-1" and page.get("extract") for pid, page in pages.items())
    print("  Wiki EN (direct title): {}".format("HIT" if en_direct else "MISS"))

    # 4. Wikipedia EN - opensearch
    url = "https://en.wikipedia.org/w/api.php?action=opensearch&search={}&limit=5&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, {"User-Agent": "OmoikaneTest/1.0"})
    matches = data[1] if isinstance(data, list) and len(data) > 1 else []
    print("  Wiki EN (opensearch): {} matches -> {}".format(len(matches), matches[:3]))

    # 5. Wikidata - get Japanese name via Wikidata
    url = "https://www.wikidata.org/w/api.php?action=wbsearchentities&search={}&language=en&type=item&limit=3&format=json".format(
        urllib.request.quote(sp))
    data = fetch_json(url, {"User-Agent": "OmoikaneTest/1.0"})
    entities = data.get("search", [])
    if entities:
        qid = entities[0].get("id", "")
        label = entities[0].get("label", "")
        desc = entities[0].get("description", "")
        print("  Wikidata: FOUND {} ({}) - {}".format(qid, label, desc))
        # Get Japanese label
        url2 = "https://www.wikidata.org/w/api.php?action=wbgetentities&ids={}&props=labels&languages=ja&format=json".format(qid)
        data2 = fetch_json(url2, {"User-Agent": "OmoikaneTest/1.0"})
        ja_label = data2.get("entities", {}).get(qid, {}).get("labels", {}).get("ja", {}).get("value", "")
        print("  Wikidata JA name: {}".format(ja_label if ja_label else "NOT FOUND"))
        if ja_label:
            # Try Wikipedia JA with Japanese name
            url3 = "https://ja.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles={}&format=json".format(
                urllib.request.quote(ja_label))
            data3 = fetch_json(url3, {"User-Agent": "OmoikaneTest/1.0"})
            pages3 = data3.get("query", {}).get("pages", {})
            ja_via_wikidata = any(pid != "-1" and page.get("extract") for pid, page in pages3.items())
            print("  Wiki JA via Wikidata name '{}': {}".format(ja_label, "HIT" if ja_via_wikidata else "MISS"))
    else:
        print("  Wikidata: NOT FOUND")

    # 6. GBIF Literature
    url = "https://api.gbif.org/v1/literature/search?q={}&limit=3".format(urllib.request.quote(sp))
    data = fetch_json(url)
    results = data.get("results", [])
    gbif_hits = sum(1 for r in results if r.get("abstract") and len(r.get("abstract","")) > 50)
    print("  GBIF Literature: {} results, {} with abstracts".format(len(results), gbif_hits))

    # 7. GBIF Species - taxon description
    url = "https://api.gbif.org/v1/species/match?name={}&strict=true".format(urllib.request.quote(sp))
    data = fetch_json(url)
    if data.get("usageKey"):
        usage_key = data["usageKey"]
        print("  GBIF Species Match: usageKey={}".format(usage_key))
        # Get species descriptions
        url2 = "https://api.gbif.org/v1/species/{}/descriptions".format(usage_key)
        data2 = fetch_json(url2)
        descs = data2.get("results", [])
        has_desc = sum(1 for d in descs if d.get("description") and len(d.get("description","")) > 50)
        print("  GBIF Species Descriptions: {} total, {} substantive".format(len(descs), has_desc))
    else:
        print("  GBIF Species Match: NOT FOUND")

    # 8. Semantic Scholar
    url = "https://api.semanticscholar.org/graph/v1/paper/search?query={}&fields=title,abstract,year&limit=3".format(
        urllib.request.quote(sp))
    data = fetch_json(url)
    papers = data.get("data", [])
    s2_hits = sum(1 for p in papers if p.get("abstract") and len(p.get("abstract","")) > 50)
    print("  Semantic Scholar: {} results, {} with abstracts".format(len(papers), s2_hits))

    # 9. J-STAGE (Japanese academic papers)
    url = "https://api.jstage.jst.go.jp/searchapi/do?service=3&pubyearfrom=2000&keyword={}&count=3".format(
        urllib.request.quote(sp))
    data = fetch_json(url)
    if "error" not in data:
        # J-STAGE returns XML but let's check
        print("  J-STAGE: Got response (needs XML parse)")
    else:
        print("  J-STAGE: {}".format(data.get("error","")))

    print()
    time.sleep(1.5)  # polite delay
