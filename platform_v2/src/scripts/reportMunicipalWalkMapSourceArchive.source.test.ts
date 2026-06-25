import assert from "node:assert/strict";
import test from "node:test";

import {
  buildArchiveManifestReport,
  renderMarkdown,
} from "./reportMunicipalWalkMapSourceArchive.js";

test("municipal walk map source archive manifest preserves citation-only download policy", () => {
  const report = buildArchiveManifestReport();

  assert.equal(report.schemaVersion, "municipal_walk_map_source_archive_manifest/v0");
  assert.ok(report.totalSources >= 65);
  assert.equal(report.entries.length, report.totalSources);
  assert.equal(report.policy.storageScope, "research_archive_manifest_only");
  assert.equal(report.policy.productRepoRule, "do_not_commit_downloaded_pdf_body_or_images");
  assert.equal(report.policy.importPolicy, "citation_only_no_body_copy");
  assert.ok(report.entries.every((entry) => entry.allowedUse === "citation_and_reauthored_metadata_only"));
  assert.ok(report.entries.every((entry) => entry.accessModel.importPolicy === "citation_only_no_body_copy"));
  assert.ok(report.entries.every((entry) => entry.prohibitedUse.some((rule) => /Do not commit downloaded PDF bodies/.test(rule))));

  const directPdf = report.entries.find((entry) => entry.sourceId === "kitakyushu-yamada-green-walking-course");
  assert.equal(directPdf?.archiveAction, "download_direct_pdf_to_research_archive");
  assert.match(directPdf?.archiveUrl ?? "", /\.pdf$/);

  const officialPage = report.entries.find((entry) => entry.sourceId === "shizuoka-ikimono-walk-route");
  assert.equal(officialPage?.archiveAction, "open_official_page_and_follow_links");
  assert.equal(officialPage?.archiveUrl, officialPage?.officialPageUrl);

  const externalTerms = report.entries.find((entry) => entry.sourceId === "kobe-biome-summer-quest");
  assert.equal(externalTerms?.archiveAction, "record_external_terms_only");
  assert.equal(externalTerms?.accessModel.downloadUrl, null);

  assert.ok(report.byArchiveAction.some((row) => row.id === "download_direct_pdf_to_research_archive" && row.count > 0));
  assert.ok(report.byArchiveAction.some((row) => row.id === "open_official_page_and_follow_links" && row.count > 0));
  assert.ok(report.byArchiveAction.some((row) => row.id === "record_external_terms_only" && row.count > 0));
  assert.ok(report.byCoordinateSensitivity.some((row) => row.id === "high_sensitive_or_minor" && row.count > 0));
  assert.ok(report.byReuseRisk.some((row) => row.id === "high_photo_or_minor_content" && row.count > 0));
});

test("municipal walk map source archive manifest renders markdown for handoff review", () => {
  const markdown = renderMarkdown(buildArchiveManifestReport());

  assert.match(markdown, /Municipal Walk Map Source Archive Manifest/);
  assert.match(markdown, /Total sources: 65/);
  assert.match(markdown, /do_not_commit_downloaded_pdf_body_or_images/);
  assert.match(markdown, /download_direct_pdf_to_research_archive/);
  assert.match(markdown, /open_official_page_and_follow_links/);
  assert.match(markdown, /record_external_terms_only/);
  assert.match(markdown, /shizuoka-ikimono-walk-route/);
  assert.match(markdown, /setagaya-nogawa-map/);
  assert.match(markdown, /kanagawa-koajiro-forest-guide/);
});
