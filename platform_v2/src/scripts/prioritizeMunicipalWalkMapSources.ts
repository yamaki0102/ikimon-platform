import {
  buildArchiveManifestReport,
} from "./reportMunicipalWalkMapSourceArchive.js";

type PriorityLane =
  | "map_first_light_entry"
  | "guide_or_admin_seed"
  | "research_reference_only"
  | "defer_until_safety_review";

type PrioritizedSource = {
  sourceId: string;
  municipality: string;
  title: string;
  score: number;
  lane: PriorityLane;
  reasons: string[];
  sourceUrl: string;
};

type PriorityReport = {
  schemaVersion: "municipal_walk_map_source_priority/v0";
  generatedAt: string;
  totalSources: number;
  topLightEntries: PrioritizedSource[];
  lanes: Array<{
    lane: PriorityLane;
    count: number;
    sampleSourceIds: string[];
  }>;
  candidates: PrioritizedSource[];
};

function scoreSource(source: ReturnType<typeof buildArchiveManifestReport>["entries"][number]): PrioritizedSource {
  let score = source.sourceId === "shizuoka-ikimono-walk-route" ? 8 : source.sourceId.includes("shizuoka") ? 4 : 0;
  const reasons: string[] = [];
  if (source.primaryType === "walk_route_species_map") {
    score += 18;
    reasons.push("route/species map is close to the first map experience");
  }
  if (source.templateId === "habitat_micro_walk") {
    score += 14;
    reasons.push("waterfront/park micro-walk is easy to try casually");
  }
  if (source.templateId === "route_species_walk") {
    score += 12;
    reasons.push("route source can become loose stops");
  }
  if (source.templateId === "stewardship_manners_walk") {
    score += 8;
    reasons.push("manners/source boundary is useful for public guide cards");
  }
  if (source.operationalModel === "official_walk_pdf") {
    score += 10;
    reasons.push("official walk/PDF source is concrete enough for guide seeding");
  }
  if (source.accessModel.downloadKind === "official_page_with_links") {
    score += 6;
    reasons.push("official page keeps citation stable");
  }
  if (source.riskModel.coordinateSensitivity === "low_public_route") {
    score += 10;
    reasons.push("low coordinate sensitivity suits map-first display");
  }
  if (source.riskModel.coordinateSensitivity === "medium_area_only") {
    score += 3;
    reasons.push("area-level display is usable with review");
  }
  if (source.riskModel.coordinateSensitivity === "high_sensitive_or_minor") {
    score -= 16;
    reasons.push("sensitive/minor context needs safety review before map-first display");
  }
  if (source.riskModel.reuseRisk === "high_photo_or_minor_content") {
    score -= 12;
    reasons.push("photo/minor reuse risk keeps it out of first-light entry");
  }
  if (source.accessModel.downloadKind === "html_or_external_form") {
    score -= 6;
    reasons.push("external app/form source is better as admin reference");
  }
  if (/学校|小学校|school|minor|子ども|こども|親子/.test(`${source.title} ${source.riskModel.reviewFlags.join(" ")}`)) {
    score -= 8;
    reasons.push("school/minor wording should stay away from map-first routes");
  }
  const lane: PriorityLane = score >= 36
    ? "map_first_light_entry"
    : score >= 22
      ? "guide_or_admin_seed"
      : source.riskModel.coordinateSensitivity === "high_sensitive_or_minor" || source.riskModel.reuseRisk === "high_photo_or_minor_content"
        ? "defer_until_safety_review"
        : "research_reference_only";
  return {
    sourceId: source.sourceId,
    municipality: source.municipality,
    title: source.title,
    score,
    lane,
    reasons,
    sourceUrl: source.sourceUrl,
  };
}

function buildPriorityReport(): PriorityReport {
  const candidates = buildArchiveManifestReport().entries
    .map(scoreSource)
    .sort((left, right) => (right.score - left.score) || left.sourceId.localeCompare(right.sourceId));
  const laneValues: PriorityLane[] = [
    "map_first_light_entry",
    "guide_or_admin_seed",
    "research_reference_only",
    "defer_until_safety_review",
  ];
  return {
    schemaVersion: "municipal_walk_map_source_priority/v0",
    generatedAt: new Date().toISOString(),
    totalSources: candidates.length,
    topLightEntries: candidates.filter((candidate) => candidate.lane === "map_first_light_entry").slice(0, 12),
    lanes: laneValues.map((lane) => {
      const matching = candidates.filter((candidate) => candidate.lane === lane);
      return {
        lane,
        count: matching.length,
        sampleSourceIds: matching.slice(0, 5).map((candidate) => candidate.sourceId),
      };
    }),
    candidates,
  };
}

function renderMarkdown(report: PriorityReport): string {
  const lines = [
    "# Municipal Walk Map Source Priority",
    "",
    `Generated: ${report.generatedAt}`,
    `Total sources: ${report.totalSources}`,
    "",
    "## Lanes",
    "",
    "| Lane | Count | Samples |",
    "|---|---:|---|",
    ...report.lanes.map((lane) => `| ${lane.lane} | ${lane.count} | ${lane.sampleSourceIds.join(", ")} |`),
    "",
    "## Top Light Entries",
    "",
    "| Score | Source | Municipality | Title | Why |",
    "|---:|---|---|---|---|",
    ...report.topLightEntries.map((source) => `| ${source.score} | ${source.sourceId} | ${source.municipality} | ${source.title} | ${source.reasons.slice(0, 3).join("; ")} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export {
  buildPriorityReport,
  renderMarkdown,
};

const isMainModule = process.argv[1]?.endsWith("prioritizeMunicipalWalkMapSources.ts")
  || process.argv[1]?.endsWith("prioritizeMunicipalWalkMapSources.js");

if (isMainModule) {
  const report = buildPriorityReport();
  const formatArg = process.argv.find((arg) => arg.startsWith("--format="));
  const format = formatArg?.slice("--format=".length) ?? "json";
  if (format === "markdown") {
    process.stdout.write(renderMarkdown(report));
  } else if (format === "json") {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    throw new Error(`Unsupported format: ${format}`);
  }
}
