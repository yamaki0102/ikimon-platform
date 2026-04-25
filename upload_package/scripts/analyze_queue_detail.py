#!/usr/bin/env python3
import json

with open("/home/yamaki/projects/ikimon-platform/upload_package/data/library/extraction_queue.json") as f:
    q = json.load(f)

# Show successful ones
lit = [(k,v) for k,v in q.items() if v.get("status")=="literature_ready"]
print("=== SUCCESS cases ===")
for k,v in lit[:10]:
    sn = v.get("species_name","")
    sc = v.get("scientific_name","")
    texts = v.get("prefetched_literature", [])
    sources = [t.get("source") for t in texts]
    print("  {} (sci={}) -> {}".format(sn, sc, sources))

print()
print("=== FAIL cases (no_literature) ===")
no = [(k,v) for k,v in q.items() if v.get("status")=="no_literature"]
for k,v in no[:14]:
    sn = v.get("species_name","")
    sc = v.get("scientific_name","")
    print("  {} (sci={})".format(sn, sc))

print()
# Check what pending items look like
pend = [(k,v) for k,v in q.items() if v.get("status")=="pending"]
print("=== PENDING sample (out of {}) ===".format(len(pend)))
for k,v in pend[:15]:
    sn = v.get("species_name","")
    sc = v.get("scientific_name","")
    print("  {} (sci={})".format(sn, sc))

print()
# Check source distribution of successful fetches
print("=== Source distribution in successful fetches ===")
source_counts = {}
for k, v in q.items():
    if v.get("status") == "literature_ready":
        for t in v.get("prefetched_literature", []):
            src = t.get("source", "unknown")
            source_counts[src] = source_counts.get(src, 0) + 1
for s, c in sorted(source_counts.items(), key=lambda x: -x[1]):
    print("  {}: {}".format(s, c))

# Check how many have scientific_name vs not
print()
has_sci = sum(1 for k,v in q.items() if v.get("scientific_name"))
no_sci = sum(1 for k,v in q.items() if not v.get("scientific_name"))
print("Has scientific_name: {}".format(has_sci))
print("Missing scientific_name: {}".format(no_sci))
