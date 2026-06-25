import {
  listMunicipalWalkMapSourceCatalogV0,
  sourceAccessModelV0,
  sourceOperationalModelV0,
  sourceRiskModelV0,
  type MunicipalWalkMapOperationalModelV0,
  type MunicipalWalkMapSourceCatalogEntryV0,
  type MunicipalWalkMapSourceAccessModelV0,
  type MunicipalWalkMapSourceRiskModelV0,
} from "../services/municipalWalkMap.js";

type ArchiveAction =
  | "download_direct_pdf_to_research_archive"
  | "open_official_page_and_follow_links"
  | "record_external_terms_only";

type ArchiveManifestEntry = {
  sourceId: string;
  municipality: string;
  title: string;
  primaryType: MunicipalWalkMapSourceCatalogEntryV0["primaryType"];
  templateId: string;
  operationalModel: MunicipalWalkMapOperationalModelV0;
  sourceUrl: string;
  officialPageUrl: string;
  accessModel: MunicipalWalkMapSourceAccessModelV0;
  riskModel: MunicipalWalkMapSourceRiskModelV0;
  archiveAction: ArchiveAction;
  archiveUrl: string;
  allowedUse: "citation_and_reauthored_metadata_only";
  prohibitedUse: string[];
};

type ArchiveManifestSummaryRow = {
  id: string;
  count: number;
  sampleSourceIds: string[];
};

type ArchiveManifestReport = {
  schemaVersion: "municipal_walk_map_source_archive_manifest/v0";
  generatedAt: string;
  totalSources: number;
  entries: ArchiveManifestEntry[];
  byArchiveAction: ArchiveManifestSummaryRow[];
  byAccessKind: ArchiveManifestSummaryRow[];
  byCoordinateSensitivity: ArchiveManifestSummaryRow[];
  byReuseRisk: ArchiveManifestSummaryRow[];
  policy: {
    storageScope: "research_archive_manifest_only";
    productRepoRule: "do_not_commit_downloaded_pdf_body_or_images";
    importPolicy: "citation_only_no_body_copy";
  };
};

function archiveActionFor(access: MunicipalWalkMapSourceAccessModelV0): ArchiveAction {
  if (access.downloadKind === "direct_pdf") return "download_direct_pdf_to_research_archive";
  if (access.downloadKind === "official_page_with_links") return "open_official_page_and_follow_links";
  return "record_external_terms_only";
}

function archiveUrlFor(
  source: MunicipalWalkMapSourceCatalogEntryV0,
  access: MunicipalWalkMapSourceAccessModelV0,
): string {
  return access.downloadUrl ?? source.officialPageUrl;
}

function countBy<T extends string>(entries: ArchiveManifestEntry[], values: T[], getter: (entry: ArchiveManifestEntry) => T): ArchiveManifestSummaryRow[] {
  return values.map((id) => {
    const matching = entries.filter((entry) => getter(entry) === id);
    return {
      id,
      count: matching.length,
      sampleSourceIds: matching.slice(0, 5).map((entry) => entry.sourceId),
    };
  });
}

function buildArchiveManifestReport(): ArchiveManifestReport {
  const entries = listMunicipalWalkMapSourceCatalogV0().map((source): ArchiveManifestEntry => {
    const accessModel = sourceAccessModelV0(source);
    const riskModel = sourceRiskModelV0(source);
    return {
      sourceId: source.sourceId,
      municipality: source.municipality,
      title: source.title,
      primaryType: source.primaryType,
      templateId: source.templateId,
      operationalModel: sourceOperationalModelV0(source),
      sourceUrl: source.sourceUrl,
      officialPageUrl: source.officialPageUrl,
      accessModel,
      riskModel,
      archiveAction: archiveActionFor(accessModel),
      archiveUrl: archiveUrlFor(source, accessModel),
      allowedUse: "citation_and_reauthored_metadata_only",
      prohibitedUse: [
        "Do not commit downloaded PDF bodies or images to the product repository.",
        "Do not copy official text, figures, photos, or map artwork into ikimon.life.",
        "Do not extract exact rare-species, school, home, or restricted-area locations for public display.",
      ],
    };
  });
  return {
    schemaVersion: "municipal_walk_map_source_archive_manifest/v0",
    generatedAt: new Date().toISOString(),
    totalSources: entries.length,
    entries,
    byArchiveAction: countBy(entries, [
      "download_direct_pdf_to_research_archive",
      "open_official_page_and_follow_links",
      "record_external_terms_only",
    ], (entry) => entry.archiveAction),
    byAccessKind: countBy(entries, [
      "direct_pdf",
      "official_page_with_links",
      "html_or_external_form",
    ], (entry) => entry.accessModel.downloadKind),
    byCoordinateSensitivity: countBy(entries, [
      "low_public_route",
      "medium_area_only",
      "high_sensitive_or_minor",
    ], (entry) => entry.riskModel.coordinateSensitivity),
    byReuseRisk: countBy(entries, [
      "low_citation_page",
      "medium_pdf_or_external_terms",
      "high_photo_or_minor_content",
    ], (entry) => entry.riskModel.reuseRisk),
    policy: {
      storageScope: "research_archive_manifest_only",
      productRepoRule: "do_not_commit_downloaded_pdf_body_or_images",
      importPolicy: "citation_only_no_body_copy",
    },
  };
}

function renderMarkdown(report: ArchiveManifestReport): string {
  const lines = [
    "# Municipal Walk Map Source Archive Manifest",
    "",
    `Generated: ${report.generatedAt}`,
    `Total sources: ${report.totalSources}`,
    "",
    "## Policy",
    "",
    `- Storage scope: ${report.policy.storageScope}`,
    `- Product repo rule: ${report.policy.productRepoRule}`,
    `- Import policy: ${report.policy.importPolicy}`,
    "",
    "## Archive Actions",
    "",
    "| Action | Count | Samples |",
    "|---|---:|---|",
    ...report.byArchiveAction.map((row) => `| ${row.id} | ${row.count} | ${row.sampleSourceIds.join(", ")} |`),
    "",
    "## Source Manifest",
    "",
    "| Source | Municipality | Access | Risk | Archive action | Archive URL |",
    "|---|---|---|---|---|---|",
    ...report.entries.map((entry) => [
      entry.sourceId,
      entry.municipality,
      entry.accessModel.downloadKind,
      `${entry.riskModel.coordinateSensitivity} / ${entry.riskModel.reuseRisk}`,
      entry.archiveAction,
      entry.archiveUrl,
    ].join(" | ")).map((row) => `| ${row} |`),
    "",
  ];
  return `${lines.join("\n")}\n`;
}

export {
  buildArchiveManifestReport,
  renderMarkdown,
};

const isMainModule = process.argv[1]?.endsWith("reportMunicipalWalkMapSourceArchive.ts")
  || process.argv[1]?.endsWith("reportMunicipalWalkMapSourceArchive.js");

if (isMainModule) {
  const report = buildArchiveManifestReport();
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
