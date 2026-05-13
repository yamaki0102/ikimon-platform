import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getRegionalStoryCue } from "../services/regionalStory.js";

const routeSource = readFileSync(new URL("../routes/read.ts", import.meta.url), "utf8");

function sourceBetween(startMarker: string, endMarker: string): string {
  const start = routeSource.indexOf(startMarker);
  const end = routeSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing ${startMarker}`);
  assert.notEqual(end, -1, `missing ${endMarker}`);
  return routeSource.slice(start, end);
}

const sections = {
  candidatePanel: sourceBetween("function renderAiCandidateLearningPanel", "function subjectSpecificityScore"),
  heroReadout: sourceBetween("function renderHeroAiReadout", "type ObservationMediaCopyContext"),
  subjectHint: sourceBetween("function renderSubjectHint", "function renderCivicContextBlock"),
  subjectTaxonomy: sourceBetween("function renderSubjectTaxonomy", "function renderIdentificationParticipation"),
  identify: sourceBetween("function renderIdentificationParticipation", "type ObservationNextAction"),
  learning: sourceBetween("function observationLearningDoneText", "function renderObservationNextActionRail"),
  nextCapture: sourceBetween("function renderVisualNextCaptureSuggestions", "function renderObservationReadingHero"),
  recordStory: sourceBetween("function renderObservationRecordStory", "function observationLearningDoneText"),
  routeAssembly: sourceBetween("const prominentAiCandidateCount", "const nextActions: ObservationNextAction[]"),
};

async function observationRegionalStoryPublicCopy(): Promise<string> {
  const story = await getRegionalStoryCue({
    surface: "observation",
    viewerUserId: null,
    recordExposure: false,
    place: {
      placeId: "copy-gate:hamamatsu",
      placeName: "浜松市中央区の公園",
      municipality: "浜松市",
      publicLabel: "浜松市",
      allowPrecisePlaceLabel: true,
    },
    observation: {
      observationId: "copy-gate-observation",
      displayName: "タンポポ",
      observedAt: "2026-04-20T10:00:00Z",
    },
    maxCards: 2,
  });
  if (!story) return "";
  return [
    story.placeHook,
    story.whyHere,
    story.nextObservationAngle,
    story.collectiveNote,
    ...story.cards.flatMap((card) => [card.title, card.summary, card.sourceLabel, ...card.tags]),
  ].join("\n");
}

const publicCopySource = [
  Object.values(sections).join("\n"),
  await observationRegionalStoryPublicCopy(),
].join("\n");

const forbiddenTerms = [
  "AIのヒント",
  "AI判定",
  "AI推定",
  "species / genus / family",
  "run:",
  "taxonomy:",
  "マクロ",
  "花序",
  "鋸歯",
  "総苞",
  "植生構造",
  "遷移段階",
  "人為影響",
  "決定論",
  "エビデンス",
  "データ駆動",
  "生物多様性",
  "コミュニティ",
  "オープンデータ",
  "デジタルツイン",
  "地域の見方が一段深くなる",
  "ところが面白い",
  "いっしょに絞るためのメモ",
];

const failures: string[] = [];

function normalizeCopySegment(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/[、。！？!?，．「」（）]/g, "")
    .trim();
}

function extractJapaneseCopySegments(source: string): string[] {
  const displayLikeText = source
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "\n")
    .replace(/\$\{[^}]*\}/g, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/[A-Za-z0-9_:.#/[\\\]=?&%+~-]+/g, "\n");
  return [...displayLikeText.matchAll(/[ぁ-んァ-ヶー一-龠々〆ヵヶ、。！？「」（）・\s]{10,}/g)]
    .map((match) => normalizeCopySegment(match[0]))
    .filter((value) => value.length >= 10 && /[ぁ-んァ-ヶ一-龠]/.test(value));
}

for (const term of forbiddenTerms) {
  if (publicCopySource.includes(term)) {
    failures.push(`forbidden observation detail copy term: ${term}`);
  }
}

const initialAutomaticBlockSpecs: Array<[string, string, string]> = [
  ["hero readout", sections.heroReadout, "obs-ai-readout"],
  ["extra candidate panel", sections.candidatePanel, "obs-ai-cutout"],
  ["next capture panel", sections.nextCapture, "obs-visual-next-capture"],
];

const initiallyVisibleAutomaticBlocks = initialAutomaticBlockSpecs.filter(([, source, marker]) => source.includes(marker));

if (initiallyVisibleAutomaticBlocks.length > 3) {
  failures.push(`too many initially visible automatic-reading blocks: ${initiallyVisibleAutomaticBlocks.map(([name]) => name).join(", ")}`);
}

for (const [name, source] of [
  ["subject hint", sections.subjectHint],
  ["subject comparison", sections.subjectTaxonomy],
] as const) {
  if (name === "subject hint" && !source.includes("<details class=\"obs-fold obs-hint-fold\"")) {
    failures.push("subject hint must be collapsed behind details on first view");
  }
  if (name === "subject comparison" && source.includes("function renderSubjectComparison") && !source.includes("<details class=\"obs-fold\">")) {
    failures.push("subject comparison must stay collapsed behind details");
  }
}

const longKanjiRuns = [...publicCopySource.matchAll(/[\p{Script=Han}]{9,}/gu)]
  .map((match) => match[0])
  .filter((value) => !["観察レコード"].some((allowed) => value.includes(allowed)));
if (longKanjiRuns.length > 0) {
  failures.push(`long kanji-only runs in public observation copy: ${[...new Set(longKanjiRuns)].slice(0, 8).join(", ")}`);
}

const copySegmentCounts = new Map<string, number>();
for (const segment of extractJapaneseCopySegments(publicCopySource)) {
  copySegmentCounts.set(segment, (copySegmentCounts.get(segment) ?? 0) + 1);
}
const duplicatedCopySegments = [...copySegmentCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([segment, count]) => `${segment} (${count})`);
if (duplicatedCopySegments.length > 0) {
  failures.push(`duplicated observation detail copy segments: ${duplicatedCopySegments.slice(0, 8).join(", ")}`);
}

if (failures.length > 0) {
  console.error("Observation copy quality gate failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PASS: observation detail copy keeps automatic-reading blocks <= 3 and avoids hard, abstract, or duplicated public copy`);
