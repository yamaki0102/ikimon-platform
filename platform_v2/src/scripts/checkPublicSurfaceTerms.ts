import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ForbiddenTerm = {
  term: string;
  reason: string;
  allowedFiles?: RegExp[];
};

const FORBIDDEN_TERMS: ForbiddenTerm[] = [
  {
    term: "見返",
    reason: "light-user copy rule: avoid retrospective/heavy phrasing; use 開く, 確認する, 残る, 次を見る, or 比べる by context",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "読み返",
    reason: "light-user copy rule: avoid retrospective/heavy phrasing; use 開く or 確認する by context",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "厚く",
    reason: "light-user copy rule: vague metaphor; use 記録が増える, 記録量, or 散策資料に育つ by context",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "厚み",
    reason: "light-user copy rule: vague metaphor; use 記録量, 手がかり, or 資料に育つ by context",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "貢献",
    reason: "light-user copy rule: too duty-heavy for the public surface; use 記録, 残す, 関わる, or 地域に残る形 by context",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "役立って",
    reason: "light-user copy rule: avoid utility/impact claims; state the visible result instead",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "役立った",
    reason: "light-user copy rule: avoid utility/impact claims; state the visible result instead",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "おかげ",
    reason: "light-user copy rule: avoid praise/guilt framing; use neutral record state changes",
    allowedFiles: [/\.test\.ts$/],
  },
  {
    term: "フィールドガイド",
    reason: "canonical pack §5.2: rename to ライブガイド (for /guide) or その場で調べる (for /lens)",
  },
  {
    term: "フィールドスキャン",
    reason: "canonical pack §5.2: rename to 探索マップ (for /map) or センサースキャン",
  },
  {
    term: "sponsor",
    reason: "canonical pack §6: rename public label to 団体相談 (internal identifier still allowed in code)",
    allowedFiles: [/\.test\.ts$/, /\/db\.ts$/, /\/migrations\//],
  },
  {
    term: "スポンサー",
    reason: "canonical pack §6: rename public label to 団体相談",
  },
  {
    term: "authority policy",
    reason: "canonical pack §6: rename public label to 同定の信頼のしくみ",
    allowedFiles: [/\.test\.ts$/, /\/db\.ts$/],
  },
  {
    term: "権限ポリシー",
    reason: "canonical pack §6: rename public label to 同定の信頼のしくみ",
  },
];

const SCAN_ROOT = "src";
const IGNORED_DIRS = new Set(["node_modules", "dist", ".git"]);
const TARGET_EXTS = new Set([".ts", ".tsx", ".json", ".md", ".html", ".njk", ".hbs"]);
const SELF_FILE = /\/scripts\/checkPublicSurfaceTerms\.ts$/;

type Hit = {
  term: string;
  file: string;
  line: number;
  excerpt: string;
  reason: string;
  allowed: boolean;
};

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile() && TARGET_EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

function isAllowed(file: string, allowedFiles?: RegExp[]): boolean {
  if (!allowedFiles || allowedFiles.length === 0) return false;
  const normalized = file.replace(/\\/g, "/");
  return allowedFiles.some((rx) => rx.test(normalized));
}

async function scanFile(file: string): Promise<Hit[]> {
  const normalized = file.replace(/\\/g, "/");
  if (SELF_FILE.test(normalized)) return [];
  const content = await readFile(file, "utf8");
  const lines = content.split(/\r?\n/);
  const hits: Hit[] = [];
  for (const rule of FORBIDDEN_TERMS) {
    lines.forEach((line, idx) => {
      if (line.includes(rule.term)) {
        hits.push({
          term: rule.term,
          file,
          line: idx + 1,
          excerpt: line.trim().slice(0, 160),
          reason: rule.reason,
          allowed: isAllowed(file, rule.allowedFiles),
        });
      }
    });
  }
  return hits;
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const platformRoot = path.resolve(here, "..", "..");
  const scanRoot = path.resolve(platformRoot, SCAN_ROOT);
  const rootStat = await stat(scanRoot);
  if (!rootStat.isDirectory()) {
    console.error(`scan root not found: ${scanRoot}`);
    process.exit(2);
  }

  const allHits: Hit[] = [];
  for await (const file of walk(scanRoot)) {
    const hits = await scanFile(file);
    allHits.push(...hits);
  }

  const violations = allHits.filter((h) => !h.allowed);
  const allowed = allHits.filter((h) => h.allowed);

  if (allowed.length > 0) {
    console.log("Allow-listed hits (reported, not blocking):");
    for (const hit of allowed) {
      const rel = path.relative(platformRoot, hit.file).replace(/\\/g, "/");
      console.log(`  [${hit.term}] ${rel}:${hit.line}  ${hit.excerpt}`);
    }
    console.log("");
  }

  if (violations.length === 0) {
    console.log(`PASS: no forbidden public-surface terms in ${SCAN_ROOT}`);
    process.exit(0);
  }

  console.error(`FAIL: ${violations.length} forbidden-term hit(s):`);
  const byTerm = new Map<string, Hit[]>();
  for (const hit of violations) {
    const bucket = byTerm.get(hit.term) ?? [];
    bucket.push(hit);
    byTerm.set(hit.term, bucket);
  }
  for (const [term, hits] of byTerm) {
    console.error(`\n  === ${term} ===  (${hits[0]!.reason})`);
    for (const hit of hits) {
      const rel = path.relative(platformRoot, hit.file).replace(/\\/g, "/");
      console.error(`    ${rel}:${hit.line}  ${hit.excerpt}`);
    }
  }
  process.exit(1);
}

void main();
