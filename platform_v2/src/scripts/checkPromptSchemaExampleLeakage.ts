import { existsSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type PromptJsonExampleBlock = {
  filePath: string;
  content: string;
  startOffset: number;
  source: "fenced-json" | "output-schema";
};

export type PromptSchemaLeakage = {
  filePath: string;
  line: number;
  value: string;
  reason: string;
};

const promptsRoot = fileURLToPath(new URL("../prompts", import.meta.url));

const knownConcreteTaxonExamples: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /カラスノエンドウ|Vicia sativa(?: subsp\. nigra)?/i, reason: "known crow-vetch reassess schema leak" },
  { pattern: /ヒメイワダレソウ|Phyla nodiflora/i, reason: "known guide/reassess fixture taxon" },
  { pattern: /セイヨウミツバチ|Apis mellifera/i, reason: "known guide/reassess fixture taxon" },
  { pattern: /ヒメスミレ|Viola inconspicua/i, reason: "known reassess example taxon" },
  { pattern: /タチツボスミレ|Viola grypoceras/i, reason: "known reassess example taxon" },
  { pattern: /セイヨウタンポポ|Taraxacum officinale/i, reason: "known guide example taxon" },
  { pattern: /Aphis|アブラムシ/i, reason: "known taxon insight example taxon" },
];

const latinBinomialOrTrinomialPattern =
  /\b[A-Z][a-z]{2,}\s+[a-z][a-z-]{2,}(?:\s+(?:subsp\.|ssp\.|var\.)?\s*[a-z][a-z-]{2,})?\b/;

const japaneseTaxonishPattern =
  /[ぁ-んァ-ヶー一-龠々]{2,}(?:エンドウ|タンポポ|スミレ|ミツバチ|イワダレソウ|アブラムシ|シャクナゲ|ニチニチソウ|ツバメ|メジロ|スズメ|カラス|フクロウ|カエル|トンボ|チョウ|セミ|バッタ|クモ|キノコ|サクラ|ツツジ|アジサイ)/;

const placeholderHints = [
  "<",
  ">",
  "...",
  "名前",
  "和名",
  "学名",
  "候補",
  "主種",
  "主対象",
  "副対象",
  "分類群",
  "対象班名",
  "見出し",
  "誘い文",
  "理由",
  "補足",
  "不明",
  "省略可",
  "detectedFeatures",
];

function listMarkdownFiles(root: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMarkdownFiles(path));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) results.push(path);
  }
  return results;
}

function findBalancedJsonObject(source: string, startOffset: number): { content: string; startOffset: number } | null {
  const objectStart = source.indexOf("{", startOffset);
  if (objectStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = objectStart; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return { content: source.slice(objectStart, index + 1), startOffset: objectStart };
      }
    }
  }
  return null;
}

export function extractPromptJsonExampleBlocks(source: string, filePath = "<memory>"): PromptJsonExampleBlock[] {
  const blocks: PromptJsonExampleBlock[] = [];
  const fencedJsonPattern = /```json\s*\r?\n([\s\S]*?)\r?\n```/g;

  for (const match of source.matchAll(fencedJsonPattern)) {
    const content = match[1] ?? "";
    blocks.push({
      filePath,
      content,
      startOffset: (match.index ?? 0) + match[0].indexOf(content),
      source: "fenced-json",
    });
  }

  const outputSchemaPattern = /(?:出力\s*スキーマ|output\s+schema)\s*[:：]/gi;
  for (const match of source.matchAll(outputSchemaPattern)) {
    const balanced = findBalancedJsonObject(source, (match.index ?? 0) + match[0].length);
    if (!balanced) continue;
    const alreadyCovered = blocks.some(
      (block) =>
        balanced.startOffset >= block.startOffset &&
        balanced.startOffset <= block.startOffset + block.content.length,
    );
    if (!alreadyCovered) {
      blocks.push({
        filePath,
        content: balanced.content,
        startOffset: balanced.startOffset,
        source: "output-schema",
      });
    }
  }

  return blocks.sort((a, b) => a.startOffset - b.startOffset);
}

function lineAtOffset(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/).length;
}

function unescapeJsonishString(value: string): string {
  return value.replace(/\\"/g, "\"").replace(/\\\\/g, "\\");
}

function concreteTaxonReason(value: string): string | null {
  for (const { pattern, reason } of knownConcreteTaxonExamples) {
    if (pattern.test(value)) return reason;
  }

  const looksPlaceholder = placeholderHints.some((hint) => value.includes(hint));
  if (latinBinomialOrTrinomialPattern.test(value) && !looksPlaceholder) {
    return "latin binomial/trinomial in JSON schema example";
  }
  if (japaneseTaxonishPattern.test(value) && !looksPlaceholder) {
    return "Japanese concrete taxon-like name in JSON schema example";
  }

  return null;
}

export function findPromptSchemaExampleLeakage(source: string, filePath = "<memory>"): PromptSchemaLeakage[] {
  const failures: PromptSchemaLeakage[] = [];
  for (const block of extractPromptJsonExampleBlocks(source, filePath)) {
    const stringLiteralPattern = /"((?:\\.|[^"\\])*)"/g;
    for (const match of block.content.matchAll(stringLiteralPattern)) {
      const value = unescapeJsonishString(match[1] ?? "");
      const reason = concreteTaxonReason(value);
      if (!reason) continue;
      failures.push({
        filePath,
        line: lineAtOffset(source, block.startOffset + (match.index ?? 0)),
        value,
        reason: `${reason} (${block.source})`,
      });
    }
  }
  return failures;
}

function runCli(): void {
  if (!existsSync(promptsRoot)) {
    throw new Error(`prompts directory not found: ${promptsRoot}`);
  }

  const failures = listMarkdownFiles(promptsRoot).flatMap((filePath) => {
    const source = readFileSync(filePath, "utf8");
    return findPromptSchemaExampleLeakage(source, relative(process.cwd(), filePath));
  });

  if (failures.length > 0) {
    console.error("Prompt JSON schema/example leakage gate failed:");
    for (const failure of failures) {
      console.error(`- ${failure.filePath}:${failure.line}: ${failure.reason}: ${JSON.stringify(failure.value)}`);
    }
    console.error("Use placeholders such as <主対象の表示名> instead of concrete real taxon names in JSON examples.");
    process.exit(1);
  }

  console.log("PASS: prompt JSON schema/examples avoid concrete real taxon names");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  runCli();
}
