import {
  listMunicipalWalkMapSourceCatalogV0,
  listMunicipalWalkMapTemplatesV0,
  type MunicipalWalkMapSourceCatalogEntryV0,
} from "../services/municipalWalkMap.js";

type CountRow = {
  id: string;
  label: string;
  count: number;
  sampleSourceIds: string[];
};

type CoverageGap = {
  axis: "primaryType" | "templateId";
  id: string;
  label: string;
  count: number;
  targetMinimum: number;
  nextSearchCue: string;
};

type CoverageReport = {
  schemaVersion: "municipal_walk_map_source_coverage/v0";
  generatedAt: string;
  totalSources: number;
  primaryTypes: CountRow[];
  templates: CountRow[];
  matrix: Array<{
    primaryType: MunicipalWalkMapSourceCatalogEntryV0["primaryType"];
    templateId: string;
    count: number;
    sourceIds: string[];
  }>;
  highAffinitySources: Array<{
    sourceId: string;
    municipality: string;
    title: string;
    affinityScore: number;
    templateId: string;
    primaryType: MunicipalWalkMapSourceCatalogEntryV0["primaryType"];
    sourceUrl: string;
  }>;
  gaps: CoverageGap[];
};

const PRIMARY_TYPE_LABELS: Record<MunicipalWalkMapSourceCatalogEntryV0["primaryType"], string> = {
  walk_route_species_map: "Route/species walk maps",
  species_distribution_map: "Species distribution maps",
  citizen_science_report: "Citizen survey/campaign reports",
  worksheet_or_field_note: "Worksheets and field-note guides",
};

const PRIMARY_TYPE_NEXT_SEARCH: Record<MunicipalWalkMapSourceCatalogEntryV0["primaryType"], string> = {
  walk_route_species_map: "official municipal nature walk PDF course map biodiversity",
  species_distribution_map: "official city biodiversity species map citizen observations",
  citizen_science_report: "municipal citizen biodiversity survey app result report",
  worksheet_or_field_note: "municipal nature observation worksheet field guide PDF",
};

const TEMPLATE_NEXT_SEARCH: Record<string, string> = {
  habitat_micro_walk: "waterfront river park nature observation guide municipality",
  route_species_walk: "nature walking map species route municipality PDF",
  stewardship_manners_walk: "forest conservation area visitor guide nature walk municipality",
  seasonal_target_walk: "seasonal target species citizen survey municipality",
  citizen_campaign_walk: "Biome iNaturalist citizen biodiversity campaign municipality",
  worksheet_family_walk: "family school nature observation worksheet municipality",
};

function countBy<T extends string>(
  sources: MunicipalWalkMapSourceCatalogEntryV0[],
  values: Array<{ id: T; label: string }>,
  getter: (source: MunicipalWalkMapSourceCatalogEntryV0) => T,
): CountRow[] {
  return values.map(({ id, label }) => {
    const matching = sources.filter((source) => getter(source) === id);
    return {
      id,
      label,
      count: matching.length,
      sampleSourceIds: matching.slice(0, 5).map((source) => source.sourceId),
    };
  });
}

function buildGaps(report: Omit<CoverageReport, "gaps">): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  const primaryTarget = 5;
  const templateTarget = 3;

  for (const row of report.primaryTypes) {
    if (row.count < primaryTarget) {
      gaps.push({
        axis: "primaryType",
        id: row.id,
        label: row.label,
        count: row.count,
        targetMinimum: primaryTarget,
        nextSearchCue: PRIMARY_TYPE_NEXT_SEARCH[row.id as MunicipalWalkMapSourceCatalogEntryV0["primaryType"]],
      });
    }
  }

  for (const row of report.templates) {
    if (row.count < templateTarget) {
      gaps.push({
        axis: "templateId",
        id: row.id,
        label: row.label,
        count: row.count,
        targetMinimum: templateTarget,
        nextSearchCue: TEMPLATE_NEXT_SEARCH[row.id] ?? `municipal biodiversity source ${row.id}`,
      });
    }
  }

  return gaps.sort((left, right) => (left.count - right.count) || left.axis.localeCompare(right.axis));
}

function buildCoverageReport(): CoverageReport {
  const sources = listMunicipalWalkMapSourceCatalogV0();
  const templates = listMunicipalWalkMapTemplatesV0();
  const primaryValues = Object.entries(PRIMARY_TYPE_LABELS).map(([id, label]) => ({
    id: id as MunicipalWalkMapSourceCatalogEntryV0["primaryType"],
    label,
  }));
  const templateValues = templates.map((template) => ({
    id: template.templateId,
    label: template.label,
  }));
  const matrix = primaryValues.flatMap((primary) => templateValues.map((template) => {
    const matching = sources.filter((source) => source.primaryType === primary.id && source.templateId === template.id);
    return {
      primaryType: primary.id,
      templateId: template.id,
      count: matching.length,
      sourceIds: matching.map((source) => source.sourceId),
    };
  })).filter((row) => row.count > 0);
  const baseReport: Omit<CoverageReport, "gaps"> = {
    schemaVersion: "municipal_walk_map_source_coverage/v0",
    generatedAt: new Date().toISOString(),
    totalSources: sources.length,
    primaryTypes: countBy(sources, primaryValues, (source) => source.primaryType),
    templates: countBy(sources, templateValues, (source) => source.templateId),
    matrix,
    highAffinitySources: [...sources]
      .sort((left, right) => (right.affinityScore - left.affinityScore) || left.sourceId.localeCompare(right.sourceId))
      .slice(0, 12)
      .map((source) => ({
        sourceId: source.sourceId,
        municipality: source.municipality,
        title: source.title,
        affinityScore: source.affinityScore,
        templateId: source.templateId,
        primaryType: source.primaryType,
        sourceUrl: source.sourceUrl,
      })),
  };
  return {
    ...baseReport,
    gaps: buildGaps(baseReport),
  };
}

function renderMarkdown(report: CoverageReport): string {
  const lines = [
    "# Municipal Walk Map Source Coverage",
    "",
    `Generated: ${report.generatedAt}`,
    `Total sources: ${report.totalSources}`,
    "",
    "## Primary Types",
    "",
    "| Type | Count | Samples |",
    "|---|---:|---|",
    ...report.primaryTypes.map((row) => `| ${row.label} | ${row.count} | ${row.sampleSourceIds.join(", ")} |`),
    "",
    "## Templates",
    "",
    "| Template | Count | Samples |",
    "|---|---:|---|",
    ...report.templates.map((row) => `| ${row.label} | ${row.count} | ${row.sampleSourceIds.join(", ")} |`),
    "",
    "## Thin Areas",
    "",
    report.gaps.length === 0
      ? "No thin areas under the current thresholds."
      : report.gaps.map((gap) => `- ${gap.axis}:${gap.id} has ${gap.count}/${gap.targetMinimum}. Search cue: ${gap.nextSearchCue}`).join("\n"),
    "",
    "## High Affinity Sources",
    "",
    "| Score | Municipality | Title | Source |",
    "|---:|---|---|---|",
    ...report.highAffinitySources.map((source) => `| ${source.affinityScore} | ${source.municipality} | ${source.title} | ${source.sourceUrl} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

const report = buildCoverageReport();
const formatArg = process.argv.find((arg) => arg.startsWith("--format="));
const format = formatArg?.slice("--format=".length) ?? "json";

if (format === "markdown") {
  process.stdout.write(renderMarkdown(report));
} else if (format === "json") {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  throw new Error(`Unsupported format: ${format}`);
}
