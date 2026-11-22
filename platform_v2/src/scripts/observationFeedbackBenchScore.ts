export type BenchExpect = {
  must_any?: string[][];
  must_not?: string[];
  max_band?: "low" | "medium" | "high";
  max_rank?: string;
  organism?: boolean;
  subjects?: Array<{ asset_index: number; label: string; box_2d?: [number, number, number, number] }>;
};

export type ItemScore = {
  score: number;
  coverage: number;
  flags: string[];
};

const BAND_ORDER = ["low", "medium", "high"];
const RANK_ORDER = ["lifeform", "kingdom", "phylum", "class", "order", "family", "genus", "species"];
const NARRATIVE_MAX = 160;
const SUMMARY_MAX = 80;

type Json = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function arr(v: unknown): Json[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : [];
}

export function normalizeBand(v: unknown): string {
  const s = str(v).toLowerCase();
  if (s.includes("high") || s === "高") return "high";
  if (s.includes("med") || s === "中") return "medium";
  if (s.includes("low") || s === "低") return "low";
  return "unknown";
}

export function feedbackText(out: Json): string {
  const area = out.area_inference && typeof out.area_inference === "object" ? (out.area_inference as Json) : {};
  const areaLabels = Object.values(area).flatMap((v) => arr(v).map((c) => `${str(c.label)} ${str(c.why)}`));
  const names = [...arr(out.candidate_readings), ...arr(out.coexisting_taxa), ...arr(out.taxonomic_candidates)].map(
    (c) => `${str(c.name)} ${str(c.taxon_name)} ${str(c.scientific_name)}`,
  );
  return [
    out.recommended_taxon_name,
    out.recommended_scientific_name,
    out.narrative,
    out.simple_summary,
    out.observer_boost,
    ...areaLabels,
    ...names,
    ...arr(out.management_action_candidates).map((c) => str(c.label)),
  ]
    .map(str)
    .join(" ");
}

export function areaInferenceCount(out: Json): number {
  const area = out.area_inference && typeof out.area_inference === "object" ? (out.area_inference as Json) : {};
  return Object.values(area).reduce<number>((n, v) => n + arr(v).length, 0);
}

function subjectFound(out: Json, s: NonNullable<BenchExpect["subjects"]>[number]): boolean {
  const pools = [
    ...arr(out.coexisting_taxa).map((c) => ({ text: `${str(c.name)} ${str(c.scientific_name)} ${str(c.rank)}`, regions: arr(c.media_regions) })),
    { text: `${str(out.recommended_taxon_name)} ${str(out.recommended_scientific_name)}`, regions: arr(out.recommended_media_regions) },
  ];
  const isBird = /鳥|Aves/.test(s.label);
  for (const p of pools) {
    const labelOk = isBird ? /鳥|Aves|Passeri|スズメ目|シジュウカラ|カラ科|ヤマガラ|メジロ|ヒヨドリ|ウグイス|エナガ|ツグミ|キツツキ/.test(p.text) : p.text.includes(s.label);
    if (!labelOk) continue;
    if (p.regions.length === 0) return true;
    for (const r of p.regions) {
      const idx = Number(r.asset_index ?? r.assetIndex ?? 0);
      if (idx !== s.asset_index) continue;
      if (!s.box_2d) return true;
      const rect = (r.rect ?? {}) as Json;
      const cx = (Number(rect.x ?? 0) + Number(rect.width ?? 0) / 2) * 1000;
      const cy = (Number(rect.y ?? 0) + Number(rect.height ?? 0) / 2) * 1000;
      const [y0, x0, y1, x1] = s.box_2d;
      const pad = 60;
      if (cx >= x0 - pad && cx <= x1 + pad && cy >= y0 - pad && cy <= y1 + pad) return true;
    }
  }
  return false;
}

export function scoreItem(out: Json | null, expect: BenchExpect): ItemScore {
  if (!out) return { score: 0, coverage: 0, flags: ["format"] };
  const flags: string[] = [];
  if (!str(out.narrative) && !str(out.simple_summary)) return { score: 0, coverage: 0, flags: ["empty"] };
  const text = feedbackText(out);
  const groups = expect.must_any ?? [];
  const hit = groups.filter((g) => g.some((k) => text.includes(k))).length;
  const coverage = groups.length ? hit / groups.length : 1;
  let score = 50 + 50 * coverage;
  const headline = `${str(out.recommended_taxon_name)} ${str(out.narrative)} ${str(out.simple_summary)}`;
  for (const k of expect.must_not ?? []) {
    if (headline.includes(k)) {
      score -= 30;
      flags.push(`must_not:${k}`);
    }
  }
  const band = normalizeBand(out.confidence_band);
  const rank = str(out.recommended_rank).toLowerCase();
  if (expect.max_band && BAND_ORDER.indexOf(band) > BAND_ORDER.indexOf(expect.max_band)) {
    score -= 20;
    flags.push("overconfident_band");
  }
  if (expect.max_rank && RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(expect.max_rank)) {
    score -= 20;
    flags.push("overconfident_rank");
  }
  if (expect.organism === false) {
    if ((rank === "species" || rank === "genus") && band === "high") {
      score -= 15;
      flags.push("forced_organism");
    }
    if (areaInferenceCount(out) === 0) {
      score -= 15;
      flags.push("no_environment");
    }
  }
  for (const s of expect.subjects ?? []) {
    if (!subjectFound(out, s)) {
      score -= 30;
      flags.push(`missed_subject:${s.label}@${s.asset_index}`);
    }
  }
  if (str(out.narrative).length > NARRATIVE_MAX) {
    score -= 5;
    flags.push("narrative_too_long");
  }
  if (str(out.simple_summary).length > SUMMARY_MAX) {
    score -= 5;
    flags.push("summary_too_long");
  }
  return { score: Math.max(0, Math.min(100, Math.round(score))), coverage, flags };
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1));
  return s[i] ?? 0;
}

export function spearman(a: string[], b: string[]): number {
  const common = a.filter((x) => b.includes(x));
  const n = common.length;
  if (n < 2) return 1;
  const ra = new Map(common.map((x, i) => [x, i]));
  const rb = new Map(b.filter((x) => common.includes(x)).map((x, i) => [x, i]));
  const d2 = common.reduce((s, x) => s + (ra.get(x)! - rb.get(x)!) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}

export type ConfigAggregate = {
  id: string;
  n: number;
  quality: number;
  p50ms: number;
  p95ms: number;
  costPer1000Usd: number;
  failureRate: number;
  winRateVsBaseline: number | null;
  byCategory: Record<string, number>;
};

export const MAX_ACCEPTABLE_P95_MS = 300_000;

export function recommend(rows: ConfigAggregate[], baselineId: string, maxQualityDrop = 3): string {
  const base = rows.find((r) => r.id === baselineId);
  if (!base) return "baseline missing";
  const ok = rows.filter(
    (r) => r.failureRate <= Math.max(base.failureRate, 0.05) && r.p95ms <= MAX_ACCEPTABLE_P95_MS && r.quality >= base.quality - maxQualityDrop && (r.winRateVsBaseline ?? 0.5) >= 0.4,
  );
  ok.sort((a, b) => a.costPer1000Usd - b.costPer1000Usd || a.p50ms - b.p50ms);
  const pick = ok[0] ?? base;
  return pick.id;
}
