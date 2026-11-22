import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  VISUAL_EXTRACT_INSTRUCTIONS,
  buildVisualInputParts,
  buildVisualSummaryPrompt,
  formatInputMediaSummaryForPrompt,
  guessSeason,
  renderPrompt,
} from "../services/observationReassessPrompts.js";
import type { AiRouterPart } from "../services/aiModelRouter.js";
import { quantile, recommend, scoreItem, spearman, type BenchExpect, type ConfigAggregate } from "./observationFeedbackBenchScore.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../tools/obs-feedback-bench");
const WAI_RELAY = process.env.BENCH_WAI_RELAY ?? "http://127.0.0.1:8830";
const CALL_TIMEOUT_MS = 240_000;
const WORST_INPUT_TOKENS = 6000;
const MAX_OUTPUT_TOKENS = 4096;

type Item = {
  id: string;
  category: string;
  images?: string[];
  ctx: { lat: number | null; lng: number | null; observedAt: string; place: string; memo: string };
  expect: BenchExpect;
};
type Config = { id: string; extract: string; summary: string; sweep?: string; extractThinking?: string };
type Configs = { prices: Record<string, [number, number]>; baseline: string; judge: string; configs: Config[] };
type CallResult = { text: string; inTok: number; outTok: number; ms: number; costUsd: number; error?: string };
type Row = {
  runId: string; config: string; item: string; category: string; ok: boolean; failure: string | null;
  ms: number; inTok: number; outTok: number; costUsd: number; final: Record<string, unknown> | null; extractText: string;
};

function args(): Record<string, string> {
  const out: Record<string, string> = {};
  const a = process.argv.slice(2);
  out.cmd = a[0] ?? "run";
  for (let i = 1; i < a.length; i++) {
    const k = a[i] ?? "";
    if (!k.startsWith("--")) continue;
    const v = a[i + 1];
    if (v === undefined || v.startsWith("--")) out[k.slice(2)] = "1";
    else { out[k.slice(2)] = v; i++; }
  }
  return out;
}

function parseJson(text: string): Record<string, unknown> | null {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const s = t.indexOf("{");
  const e = t.lastIndexOf("}");
  if (s < 0 || e < s) return null;
  try {
    const v = JSON.parse(t.slice(s, e + 1));
    return Array.isArray(v) ? (v[0] ?? null) : v;
  } catch {
    return null;
  }
}

function price(cfg: Configs, model: string): [number, number] {
  const p = cfg.prices[model];
  if (!p) throw new Error(`price missing for ${model}`);
  return p;
}

const TRANSIENT = /rate limit|3021|8008|Internal server|http_429|http_5dd/i;

async function callModel(cfg: Configs, model: string, parts: AiRouterPart[], opt: { temperature: number; thinking?: string }): Promise<CallResult> {
  let last: CallResult | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    last = await callModelOnce(cfg, model, parts, opt);
    if (!last.error || !TRANSIENT.test(last.error)) return last;
    await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
  }
  return last!;
}

async function callModelOnce(cfg: Configs, model: string, parts: AiRouterPart[], opt: { temperature: number; thinking?: string }): Promise<CallResult> {
  const [provider, name] = [model.slice(0, model.indexOf(":")), model.slice(model.indexOf(":") + 1)];
  const [pin, pout] = price(cfg, model);
  const t = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), CALL_TIMEOUT_MS);
  try {
    if (provider === "gemini") {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY unset");
      const generationConfig: Record<string, unknown> = { responseMimeType: "application/json", temperature: opt.temperature, maxOutputTokens: MAX_OUTPUT_TOKENS };
      if (opt.thinking) generationConfig.thinkingConfig = { thinkingLevel: opt.thinking };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${name}:generateContent`, {
        method: "POST",
        signal: ac.signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
      });
      const j = (await r.json()) as any;
      const u = j.usageMetadata ?? {};
      const inTok = u.promptTokenCount ?? 0;
      const outTok = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
      const text = (j.candidates?.[0]?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("");
      return { text, inTok, outTok, ms: Date.now() - t, costUsd: (inTok * pin + outTok * pout) / 1e6, error: r.ok ? undefined : `http_${r.status}` };
    }
    if (provider === "wai") {
      const content = parts.map((p: any) => (p.inlineData ? { type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } } : { type: "text", text: p.text ?? "" }));
      const input: Record<string, unknown> = { messages: [{ role: "user", content }], response_format: { type: "json_object" }, temperature: opt.temperature, max_tokens: MAX_OUTPUT_TOKENS };
      if (!opt.thinking || opt.thinking === "minimal" || opt.thinking === "off") input.chat_template_kwargs = { enable_thinking: false };
      else input.reasoning_effort = opt.thinking;
      const r = await fetch(WAI_RELAY, { method: "POST", signal: ac.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ model: name, input }) });
      const j = (await r.json()) as any;
      if (!j.ok) return { text: "", inTok: 0, outTok: 0, ms: Date.now() - t, costUsd: 0, error: String(j.err ?? "relay").slice(0, 200) };
      const res = j.r ?? {};
      const msg = res.choices?.[0]?.message ?? {};
      const text = typeof msg.content === "string" ? msg.content : typeof res.response === "string" ? res.response : JSON.stringify(res.response ?? "");
      const inTok = res.usage?.prompt_tokens ?? 0;
      const outTok = res.usage?.completion_tokens ?? 0;
      return { text, inTok, outTok, ms: Date.now() - t, costUsd: (inTok * pin + outTok * pout) / 1e6 };
    }
    throw new Error(`unknown provider ${provider}`);
  } catch (e) {
    return { text: "", inTok: 0, outTok: 0, ms: Date.now() - t, costUsd: 0, error: ac.signal.aborted ? "timeout" : String(e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function worstCost(cfg: Configs, c: Config): number {
  const one = (m: string) => {
    const [pin, pout] = price(cfg, m);
    return (WORST_INPUT_TOKENS * pin + MAX_OUTPUT_TOKENS * pout) / 1e6;
  };
  return one(c.extract) + one(c.summary) + (c.sweep ? one(c.sweep) : 0);
}

const SWEEP_PROMPT = "写っている生きもの（小さく写り込んだもの、葉や枝に隠れたもの、背景のものを含む）をすべて探してください。植物・樹木の群落は1件にまとめてよい。JSONのみ: {\"subjects\":[{\"asset_index\":0,\"label\":\"日本語名\",\"rank\":\"species|genus|family|order|class\",\"confidence\":0.0,\"box_2d\":[ymin,xmin,ymax,xmax]}]} box_2dは0-1000。";

function loadImages(item: Item, dir: string) {
  const files = item.images ?? [`${item.id}.jpg`];
  return files.map((f, i) => ({ mime: "image/jpeg", b64: readFileSync(join(dir, "images", f)).toString("base64"), assetId: `bench-${item.id}-${i}` }));
}

function basePrompt(item: Item, photos: ReturnType<typeof loadImages>): string {
  const c = item.ctx;
  const pkg = [`place=${c.place}`, "observed_subjects=1:未同定 (unknown)", "safe_rank=unknown", "evidence_tier=none", "review=unreviewed", `media_roles=${photos.length > 1 ? "primary,context" : "primary"}`].filter(Boolean).join("\n");
  return renderPrompt({
    occurrenceId: `bench-${item.id}`,
    lat: c.lat == null ? "不明" : c.lat.toFixed(2),
    lng: c.lng == null ? "不明" : c.lng.toFixed(2),
    observedAt: c.observedAt,
    season: guessSeason(c.observedAt),
    existingLabel: "未同定",
    siteBriefLabel: c.place,
    profileDigestSummary: "(なし)",
    observationPackageSummary: pkg,
    knowledgeClaimsContext: "(なし)",
  }) + formatInputMediaSummaryForPrompt("photo", photos);
}

async function runOne(cfg: Configs, c: Config, item: Item, dir: string, runId: string): Promise<Row> {
  const photos = loadImages(item, dir);
  const prompt = basePrompt(item, photos);
  const calls: CallResult[] = [];
  const extractParts = [...buildVisualInputParts(photos), { text: `${prompt}\n\n${VISUAL_EXTRACT_INSTRUCTIONS}` }];
  const extract = await callModel(cfg, c.extract, extractParts, { temperature: 0.1, thinking: c.extractThinking ?? (c.extract.startsWith("gemini:") ? "minimal" : undefined) });
  calls.push(extract);
  let extractText = extract.text;
  if (c.sweep && !extract.error) {
    const sweep = await callModel(cfg, c.sweep, [...buildVisualInputParts(photos), { text: SWEEP_PROMPT }], { temperature: 0.1 });
    calls.push(sweep);
    if (sweep.text) extractText = `${extract.text}\n\n補助の生きもの洗い出しJSON（別モデル。主対象以外の写り込みは coexisting_taxa に入れ、asset_index と box_2d/1000 を rect に換算して media_regions に残す）:\n${sweep.text.slice(0, 4000)}`;
  }
  let final: Record<string, unknown> | null = null;
  let failure: string | null = extract.error ?? (extract.text.trim() ? null : "empty_extract");
  if (!failure) {
    const summary = await callModel(cfg, c.summary, [{ text: buildVisualSummaryPrompt(prompt, extractText, null) }], { temperature: 0.15 });
    calls.push(summary);
    if (summary.error) failure = summary.error;
    else if (!summary.text.trim()) failure = "empty";
    else {
      final = parseJson(summary.text);
      if (!final) failure = "format";
    }
  }
  const sum = (k: "ms" | "inTok" | "outTok" | "costUsd") => calls.reduce((s, x) => s + x[k], 0);
  return { runId, config: c.id, item: item.id, category: item.category, ok: !failure, failure, ms: sum("ms"), inTok: sum("inTok"), outTok: sum("outTok"), costUsd: sum("costUsd"), final, extractText: extractText.slice(0, 6000) };
}

async function pool<T>(tasks: Array<() => Promise<T>>, n: number): Promise<T[]> {
  const out: T[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tasks.length) {
      const k = i++;
      out[k] = await tasks[k]!();
    }
  }));
  return out;
}

function loadSpec(version: string) {
  const dir = join(ROOT, version);
  const spec = JSON.parse(readFileSync(join(dir, "spec.json"), "utf8")) as { version: string; items: Item[] };
  const present = new Set(readdirSync(join(dir, "images")));
  const items = spec.items.filter((it) => (it.images ?? [`${it.id}.jpg`]).every((f) => present.has(f)));
  return { dir, spec, items };
}

async function cmdRun(a: Record<string, string>) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "configs.json"), "utf8")) as Configs;
  const version = a.version ?? "v1";
  const { dir, items } = loadSpec(version);
  const only = a.configs ? new Set(a.configs.split(",")) : null;
  const configs = cfg.configs.filter((c) => !only || only.has(c.id));
  const limit = a.items ? items.filter((it) => (a.items ?? "").split(",").includes(it.id)) : items;
  const maxUsd = Number(a["max-usd"] ?? "5");
  const runId = a.run ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = join(ROOT, "results", version, runId);
  mkdirSync(outDir, { recursive: true });
  const rawPath = join(outDir, "raw.jsonl");
  const done = new Set(existsSync(rawPath) ? readFileSync(rawPath, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return r.failure && TRANSIENT.test(r.failure) ? "" : `${r.config}|${r.item}`; }) : []);
  let spent = existsSync(rawPath) ? readFileSync(rawPath, "utf8").split("\n").filter(Boolean).reduce((s, l) => s + JSON.parse(l).costUsd, 0) : 0;
  let reserved = 0;
  let stopped = false;
  const tasks = configs.flatMap((c) => limit.filter((it) => !done.has(`${c.id}|${it.id}`)).map((it) => async () => {
    const w = worstCost(cfg, c);
    if (stopped || spent + reserved + w > maxUsd) { stopped = true; return null; }
    reserved += w;
    let row: Row;
    try {
      row = await runOne(cfg, c, it, dir, runId);
    } catch (e) {
      reserved -= w;
      process.stdout.write(`HARNESS_ERROR ${c.id} ${it.id} ${String(e).slice(0, 160)}
`);
      return null;
    }
    reserved -= w;
    spent += row.costUsd;
    appendFileSync(rawPath, JSON.stringify(row) + "\n");
    process.stdout.write(`${c.id} ${it.id} ${row.ok ? "ok" : row.failure} ${row.ms}ms $${row.costUsd.toFixed(4)} total=$${spent.toFixed(3)}\n`);
    return row;
  }));
  await pool(tasks, Number(a.concurrency ?? "6"));
  writeFileSync(join(outDir, "meta.json"), JSON.stringify({ runId, version, configs: configs.map((c) => c.id), items: limit.length, maxUsd, spentUsd: spent, stoppedByCap: stopped }, null, 1));
  console.log(stopped ? `STOPPED_BY_COST_CAP spent=$${spent.toFixed(3)} cap=$${maxUsd}` : `DONE spent=$${spent.toFixed(3)}`);
}

function readRows(outDir: string): Row[] {
  const all: Row[] = readFileSync(join(outDir, "raw.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return [...new Map(all.map((r) => [`${r.config}|${r.item}`, r])).values()];
}

const JUDGE_PROMPT = (a: string, b: string) => `あなたは自然観察アプリの品質審査員です。写真と観察条件に対する2つのAIフィードバック(A,B)を比べてください。
基準: 1) 誤同定がない 2) 確信度が証拠に見合う(過信しない) 3) 生きもの以外が主役の写真で無理に生きもの話にしない。景観・環境・人の営みを具体的に読む 4) 写り込んだ別の生きものを拾えている 5) 観察者に役立つ具体性。文章量の多さは評価しない。
JSONのみ: {"winner":"A|B|tie","misid":{"A":false,"B":false},"overconfident":{"A":false,"B":false},"forced_organism":{"A":false,"B":false},"reason":"40字以内"}
A: ${a}
B: ${b}`;

function brief(o: Record<string, unknown> | null): string {
  if (!o) return "(出力なし)";
  const pick = ["recommended_taxon_name", "recommended_rank", "confidence_band", "narrative", "simple_summary", "observer_boost", "area_inference", "coexisting_taxa"];
  return JSON.stringify(Object.fromEntries(pick.map((k) => [k, o[k]]))).slice(0, 3000);
}

async function cmdJudge(a: Record<string, string>) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "configs.json"), "utf8")) as Configs;
  const version = a.version ?? "v1";
  const { dir, items } = loadSpec(version);
  const outDir = join(ROOT, "results", version, a.run ?? "");
  const rows = readRows(outDir);
  const path = join(outDir, "judge.jsonl");
  const done = new Set(existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => { const r = JSON.parse(l); return `${r.config}|${r.item}|${r.order}`; }) : []);
  const maxUsd = Number(a["max-usd"] ?? "2");
  let spent = 0;
  const byKey = new Map(rows.map((r) => [`${r.config}|${r.item}`, r]));
  const tasks: Array<() => Promise<void>> = [];
  const judgeOnly = a.configs ? new Set(a.configs.split(",")) : null;
  for (const c of cfg.configs) {
    if (c.id === cfg.baseline || (judgeOnly && !judgeOnly.has(c.id))) continue;
    for (const it of items) {
      const cand = byKey.get(`${c.id}|${it.id}`);
      const base = byKey.get(`${cfg.baseline}|${it.id}`);
      if (!cand || !base) continue;
      for (const order of ["cb", "bc"] as const) {
        if (done.has(`${c.id}|${it.id}|${order}`)) continue;
        tasks.push(async () => {
          if (spent > maxUsd) return;
          const [A, B] = order === "cb" ? [cand.final, base.final] : [base.final, cand.final];
          const photos = loadImages(it, dir);
          const ctx = `観察条件: ${it.ctx.place} ${it.ctx.observedAt} メモ:${it.ctx.memo || "なし"}`;
          const r = await callModel(cfg, cfg.judge, [...buildVisualInputParts(photos), { text: `${ctx}\n${JUDGE_PROMPT(brief(A), brief(B))}` }], { temperature: 0, thinking: "low" });
          spent += r.costUsd;
          const j = parseJson(r.text) ?? {};
          const w = String(j.winner ?? "tie");
          const candWins = (order === "cb" && w === "A") || (order === "bc" && w === "B");
          const baseWins = (order === "cb" && w === "B") || (order === "bc" && w === "A");
          appendFileSync(path, JSON.stringify({ config: c.id, item: it.id, order, result: candWins ? "win" : baseWins ? "loss" : "tie", raw: j, costUsd: r.costUsd }) + "\n");
        });
      }
    }
  }
  await pool(tasks, Number(a.concurrency ?? "6"));
  console.log(`JUDGED spent=$${spent.toFixed(3)}`);
}

function aggregate(rows: Row[], items: Item[], judge: Array<{ config: string; item: string; order: string; result: string }>): ConfigAggregate[] {
  const exp = new Map(items.map((i) => [i.id, i]));
  const ids = [...new Set(rows.map((r) => r.config))];
  return ids.map((id) => {
    const rs = rows.filter((r) => r.config === id && exp.has(r.item));
    const scores = rs.map((r) => ({ cat: r.category, s: scoreItem(r.final, exp.get(r.item)!.expect).score }));
    const cats: Record<string, number[]> = {};
    for (const x of scores) (cats[x.cat] ??= []).push(x.s);
    const js = judge.filter((j) => j.config === id);
    const pairs = new Map<string, string[]>();
    for (const j of js) pairs.set(j.item, [...(pairs.get(j.item) ?? []), j.result]);
    let win = 0;
    let n = 0;
    for (const res of pairs.values()) {
      if (res.length < 2) continue;
      n++;
      win += res[0] === res[1] ? (res[0] === "win" ? 1 : res[0] === "loss" ? 0 : 0.5) : 0.5;
    }
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      id, n: rs.length,
      quality: Math.round(mean(scores.map((x) => x.s)) * 10) / 10,
      p50ms: quantile(rs.map((r) => r.ms), 0.5),
      p95ms: quantile(rs.map((r) => r.ms), 0.95),
      costPer1000Usd: Math.round(mean(rs.map((r) => r.costUsd)) * 1000 * 100) / 100,
      failureRate: rs.length ? rs.filter((r) => !r.ok).length / rs.length : 1,
      winRateVsBaseline: n ? Math.round((win / n) * 100) / 100 : null,
      byCategory: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, Math.round(mean(v))])),
    };
  });
}

function cmdReport(a: Record<string, string>) {
  const cfg = JSON.parse(readFileSync(join(ROOT, "configs.json"), "utf8")) as Configs;
  const version = a.version ?? "v1";
  const { items } = loadSpec(version);
  const resDir = join(ROOT, "results", version);
  const outDir = join(resDir, a.run ?? "");
  const judgePath = join(outDir, "judge.jsonl");
  const judge = existsSync(judgePath) ? readFileSync(judgePath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const rows = aggregate(readRows(outDir), items, judge).sort((x, y) => y.quality - x.quality);
  const cats = [...new Set(items.map((i) => i.category))];
  const lines = [
    `# ${version} ${a.run}`,
    "",
    `| config | 品質 | 一対比較勝率(対${cfg.baseline}) | 中央値ms | p95ms | 1000件あたりUSD | 失敗率 | ${cats.join(" | ")} |`,
    `|---|---|---|---|---|---|---|${cats.map(() => "---").join("|")}|`,
    ...rows.map((r) => `| ${r.id} | ${r.quality} | ${r.winRateVsBaseline ?? "-"} | ${r.p50ms} | ${r.p95ms} | ${r.costPer1000Usd} | ${(r.failureRate * 100).toFixed(0)}% | ${cats.map((c) => r.byCategory[c] ?? "-").join(" | ")} |`),
    "",
    `推奨: ${recommend(rows, cfg.baseline)}`,
  ];
  if (a.compare) {
    const other = aggregate(readRows(join(resDir, a.compare)), items, []).sort((x, y) => y.quality - x.quality);
    const rho = spearman(rows.map((r) => r.id), other.map((r) => r.id));
    const diffs = rows.map((r) => `${r.id}:${(r.quality - (other.find((o) => o.id === r.id)?.quality ?? NaN)).toFixed(1)}`);
    lines.push("", `再実行(${a.compare})との順位相関: ${rho.toFixed(2)} / 品質差: ${diffs.join(" ")}`);
  }
  const exp = new Map(items.map((i) => [i.id, i]));
  const flagged = readRows(outDir).map((r) => ({ r, s: scoreItem(r.final, exp.get(r.item)?.expect ?? {}) })).filter((x) => x.s.flags.length);
  const flagCount: Record<string, Record<string, number>> = {};
  for (const x of flagged) for (const f of x.s.flags) { const k = f.split(":")[0] ?? f; const m = (flagCount[x.r.config] ??= {}); m[k] = (m[k] ?? 0) + 1; }
  lines.push("", "減点の内訳:", ...Object.entries(flagCount).map(([c, m]) => `- ${c}: ${Object.entries(m).map(([k, v]) => `${k}=${v}`).join(" ")}`));
  const md = lines.join("\n");
  writeFileSync(join(outDir, "report.md"), md);
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(rows, null, 1));
  console.log(md);
}

const a = args();
if (a.cmd === "run") await cmdRun(a);
else if (a.cmd === "judge") await cmdJudge(a);
else if (a.cmd === "report") cmdReport(a);
else if (a.cmd === "all") {
  a.run ??= new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  await cmdRun(a);
  await cmdJudge({ ...a, "max-usd": a["judge-max-usd"] ?? "8" });
  cmdReport(a);
}
else throw new Error("usage: all|run|judge|report");
