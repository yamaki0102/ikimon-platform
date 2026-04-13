#!/usr/bin/env python3
import json

with open("/home/yamaki/projects/ikimon-platform/upload_package/data/library/extraction_queue.json") as f:
    q = json.load(f)

statuses = {}
for k, v in q.items():
    s = v.get("status", "unknown")
    statuses[s] = statuses.get(s, 0) + 1

print(f"Total items: {len(q)}")
for s, c in sorted(statuses.items()):
    print(f"  {s}: {c}")

print()
no_lit = [(k, v) for k, v in q.items() if v.get("status") == "no_literature"]
print(f"No literature examples (first 15 of {len(no_lit)}):")
for k, v in no_lit[:15]:
    sn = v.get("species_name", "")
    sc = v.get("scientific_name", "")
    print(f"  {k} | name={sn} | sci={sc}")

print()
lit_ready = [(k, v) for k, v in q.items() if v.get("status") == "literature_ready"]
print(f"Literature ready examples (first 10 of {len(lit_ready)}):")
for k, v in lit_ready[:10]:
    sn = v.get("species_name", "")
    sc = v.get("scientific_name", "")
    texts = v.get("prefetched_literature", [])
    sources = [t.get("source") for t in texts]
    print(f"  {k} | name={sn} | sci={sc} | sources={sources}")

# Analyze what sources are found in successful ones
print()
print("=== Source distribution in successful fetches ===")
source_counts = {}
for k, v in q.items():
    if v.get("status") == "literature_ready":
        for t in v.get("prefetched_literature", []):
            src = t.get("source", "unknown")
            source_counts[src] = source_counts.get(src, 0) + 1
for s, c in sorted(source_counts.items(), key=lambda x: -x[1]):
    print(f"  {s}: {c}")

# Analyze pending/fetching items
print()
pending = [(k, v) for k, v in q.items() if v.get("status") in ("pending", "fetching_lit")]
print(f"Pending/fetching items: {len(pending)}")
for k, v in pending[:5]:
    sn = v.get("species_name", "")
    sc = v.get("scientific_name", "")
    print(f"  {k} | name={sn} | sci={sc}")
