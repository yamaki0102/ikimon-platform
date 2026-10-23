# Local SSR route benchmark

Run from `platform_v2/` after dependencies are installed:

```sh
PERF_SOURCE_REF="$(git rev-parse --short HEAD)" PERF_TREE_STATE="clean-or-working-tree" node --import tsx scripts/perf/routeBenchmark.mjs > /tmp/zukan-route-perf.json
```

The harness calls the real Fastify routes with `app.inject()` and stable synthetic fixtures. It reports p50/p95 Fastify request timing, decoded HTML bytes and actual raw response bytes for four successful renders: `/`, `/map`, `/observations/:id`, and `/learn/invasive-species/:slug`. The map snapshot has three public records; the observation detail has 12 subjects and a matching subject-specific detail row for each ID. PostgreSQL's `Pool.query` and `Pool.connect` are replaced before app import; no database is contacted and database execution time is excluded. SQL patterns not explicitly seeded return empty rows, so optional database-backed page sections are absent.

`serverRenderMs` measures through a benchmark app-level `onSend` hook and may end before route-local response encoding. `materializationMs` times the complete `app.inject()` call, including route encoding and post-response HTML transforms. Payload measurements cover the HTML route response only; they exclude API, tile, CDN asset and media requests. SQL counts measure attempted calls answered by the fixture mock, not database cost. None of these measurements includes real PostgreSQL execution, browser paint, or external network time.

The default run requests both `identity` and `gzip`; set `PERF_ACCEPT_ENCODINGS=identity` or `gzip` to run one variant. The `wireBytes` fields measure the raw response body size after route-level encoding. For identity routes the decoded and wire sizes match. Tune run size with `PERF_WARMUPS` (default `5`) and `PERF_SAMPLES` (default `30`). Use the same Node version, fixture revision, warmups and sample count for before/after comparisons, and report a dirty working tree as such instead of attributing it to `HEAD`. Results are local source measurements, not browser, network, database, staging, or production performance evidence.

## Z3 before/after sample

The checked-in reports use Node v24.19.0, 10 warmups, and 100 samples per route and encoding. Baseline is clean commit `87b1d7562`; after uses the same base commit with the current working-tree patch marked `dirty-working-tree`. Both use this harness and fixtures. The table uses identity response timing and decoded HTML payload size.

| Render | Server p50/p95 before | Server p50/p95 after | HTML payload before → after |
|---|---:|---:|---:|
| Home `/` | 26.79 / 38.85 ms | 10.10 / 13.28 ms | 324,935 → 324,935 B |
| Map `/map` | 34.24 / 50.32 ms | 26.52 / 31.01 ms | 926,343 → 926,343 B |
| Observation detail `/observations/:id` | 30.35 / 57.79 ms | 24.95 / 28.31 ms | 685,009 → 685,009 B |
| Invasive species detail `/learn/invasive-species/:slug` | 11.13 / 16.89 ms | 8.54 / 11.24 ms | 307,074 → 307,074 B |

The baseline does not negotiate gzip for `/map`, so its `Accept-Encoding: gzip` response remains identity at 926,343 B. After the change, map gzip sends p50/p95 235,309/235,315 B (about 74.6% smaller), while decoded HTML stays 926,343 B. On the final run, map gzip `materializationMs` was p50/p95 42.67/56.45 ms versus identity 37.66/42.24 ms; gzip trades roughly 47 KB more wire size than level 6 for faster compression. The detail route's mocked SQL call count fell from 209 to 111 per request for the 12-subject fixture. Identity and gzip timings for every route, plus exact environment and fixture metadata, are in [baseline-87b1d7562.json](./results/baseline-87b1d7562.json) and [after-working-tree.json](./results/after-working-tree.json).

The measured code changes include a linear whitespace-removal scan for large HTML transforms, route-level gzip negotiation for the map response, and batched/capped identification detail reads across sibling subjects. The data supports local route and payload comparisons; it does not establish browser experience or production latency.

## Reproduce the baseline with the same harness

From the repository root, export the exact baseline and copy the current harness into it. Run the two commands sequentially, without concurrent builds or tests:

```sh
repo_root=$(git rev-parse --show-toplevel)
mkdir -p "$repo_root/work"
baseline_root=$(mktemp -d "$repo_root/work/z3-baseline.XXXXXX")
git archive 87b1d7562 | tar -x -C "$baseline_root"
mkdir -p "$baseline_root/platform_v2/scripts/perf"
cp "$repo_root/platform_v2/scripts/perf/"*.mjs "$baseline_root/platform_v2/scripts/perf/"
ln -s "$repo_root/platform_v2/node_modules" "$baseline_root/platform_v2/node_modules"
ln -s "$repo_root/platform_v2/node_modules" "$baseline_root/node_modules"
(cd "$baseline_root/platform_v2" && PERF_SOURCE_REF=87b1d7562 PERF_TREE_STATE=clean-baseline-with-copied-harness PERF_WARMUPS=10 PERF_SAMPLES=100 node --import tsx scripts/perf/routeBenchmark.mjs) > "$repo_root/work/z3-before.json"
(cd "$repo_root/platform_v2" && PERF_SOURCE_REF="$(git rev-parse --short HEAD)" PERF_TREE_STATE=describe-current-tree PERF_WARMUPS=10 PERF_SAMPLES=100 node --import tsx scripts/perf/routeBenchmark.mjs) > "$repo_root/work/z3-after.json"
```

The baseline and after runs above must use identical copies of both the harness and fixture files. The synthetic dataset is deliberately small and excludes optional page sections; it is a renderer regression fixture, not a production traffic model. No index migration was added without database query-plan evidence.

## Verification

The 13-file integration selection passed 12 files. `observationDetailFriendlyCopy.test.ts` passed 45/46 cases; the existing assertion at line 399 expects adjacent owner-state/contribution/tools blocks, but the baseline already inserts `publicationReturnBlock` between them. The identical failure was reproduced on clean `87b1d7562` and left unchanged. Typecheck and the benchmark contract tests (2/2) pass. New tests cover subject isolation and batched disputes, encoded-response integrity, whitespace output equivalence and adversarial input, gzip negotiation/decoded equivalence, and cache variants; existing assertions were preserved.
