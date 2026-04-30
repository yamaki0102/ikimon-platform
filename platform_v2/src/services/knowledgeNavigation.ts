import { createHash } from "node:crypto";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { getPool } from "../db.js";
import type { ObservationPackage, ObservationPackageClaimRef } from "./observationPackage.js";
import { retrieveBranchKnowledgeClaims, type NavigableBranch } from "./knowledgeClaimRetrieval.js";

type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

export const MAX_NAVIGATION_SUMMARY_LENGTH = 2048;
export const DEFAULT_NAVIGATION_MAX_TURNS = 5;
export const KNOWLEDGE_NAVIGATION_ROOT_ID = "knowledge_navigation_root";

export const KNOWLEDGE_NAVIGATION_BRANCHES: NavigableBranch[] = [
  "observation_quality",
  "identification_granularity",
  "evidence_tier_review",
  "knowledge_claims",
  "feedback_contract",
  "mypage_learning",
  "enterprise_reporting",
  "privacy_claim_boundary",
  "freshness_sources",
  "evaluation",
];

const BRANCH_LABELS: Record<NavigableBranch, string> = {
  observation_quality: "Observation quality",
  identification_granularity: "Identification granularity",
  evidence_tier_review: "Evidence tier review",
  knowledge_claims: "Knowledge claims",
  feedback_contract: "Feedback contract",
  mypage_learning: "Mypage learning",
  enterprise_reporting: "Enterprise reporting",
  privacy_claim_boundary: "Privacy and claim boundary",
  freshness_sources: "Freshness sources",
  evaluation: "Evaluation",
};

const BRANCH_QUESTION_TYPES: Record<NavigableBranch, string[]> = {
  observation_quality: ["retake", "quality", "media"],
  identification_granularity: ["safe_rank", "similar_taxa", "identification"],
  evidence_tier_review: ["review_route", "evidence_tier", "authority"],
  knowledge_claims: ["ecology", "seasonality", "habitat", "distribution"],
  feedback_contract: ["feedback", "next_shot", "missing_evidence"],
  mypage_learning: ["learning", "weekly", "habit"],
  enterprise_reporting: ["researcher", "site_report", "enterprise_report"],
  privacy_claim_boundary: ["rare_species", "invasive_species", "legal", "privacy"],
  freshness_sources: ["paper", "freshness", "source_review"],
  evaluation: ["eval", "regression", "overclaim"],
};

export type KnowledgeNavigationSourceKind = "knowledge_claim" | "regional_knowledge_card" | "research_paper";

export type KnowledgeNavigationSourceDocument = {
  sourceKind: KnowledgeNavigationSourceKind;
  sourceRefId: string;
  title: string;
  citation: string;
  accessPolicy: "metadata_only" | "open_abstract" | "oa_license_verified" | "licensed_excerpt" | "public";
  body: string;
  claimRefs: string[];
  keyTerms: string[];
  branch: NavigableBranch;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

export type KnowledgeNavigationNode = {
  nodeId: string;
  parentId: string | null;
  depth: number;
  label: string;
  summary: string;
  questionTypes: string[];
  keyTerms: string[];
  childCount: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeNavigationDocument = {
  docId: string;
  nodeId: string;
  sourceKind: KnowledgeNavigationSourceKind;
  sourceRefId: string;
  title: string;
  citation: string;
  accessPolicy: string;
  contentDigest: string;
  claimRefs: string[];
  keyTerms: string[];
  metadata: Record<string, unknown>;
};

export type CompiledKnowledgeNavigationTree = {
  sourceSnapshotHash: string;
  nodes: KnowledgeNavigationNode[];
  documents: KnowledgeNavigationDocument[];
  sourceDocumentCount: number;
};

export type KnowledgeNavigationLatestVersion = {
  versionId: string;
  sourceSnapshotHash: string;
  builtAt: string;
  status: "building" | "success" | "failed";
  nodeCount: number;
  documentCount: number;
  metadata: Record<string, unknown>;
};

export type KnowledgeNavigationResult = {
  selectedBranch: NavigableBranch;
  visitedNodeIds: string[];
  retrievedDocIds: string[];
  claimRefs: ObservationPackageClaimRef[];
  citations: Array<{
    docId: string;
    sourceKind: KnowledgeNavigationSourceKind;
    sourceRefId: string;
    title: string;
    citation: string;
    claimRefs: string[];
  }>;
  confidence: number;
  fallbackReason: string | null;
};

export type NavigateKnowledgeTreeInput = {
  query: string;
  observationPackage: ObservationPackage;
  maxTurns?: number;
  queryable?: Queryable;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return [...new Set(value.map(String).map((v) => v.trim()).filter(Boolean))];
  return [];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sanitizeNavigationLabel(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "Knowledge branch";
}

export function clipNavigationSummary(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_NAVIGATION_SUMMARY_LENGTH) return cleaned || "No reviewed source documents are available yet.";
  return `${cleaned.slice(0, MAX_NAVIGATION_SUMMARY_LENGTH - 3).trim()}...`;
}

export function extractNavigationKeyTerms(value: string, limit = 12): string[] {
  const stop = new Set(["and", "the", "for", "with", "from", "this", "that", "です", "ます", "する", "ある", "いる"]);
  const terms = value
    .toLowerCase()
    .split(/[^0-9a-zA-Z\u3040-\u30ff\u3400-\u9fff]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stop.has(term));
  const counts = new Map<string, number>();
  for (const term of terms) counts.set(term, (counts.get(term) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function digestForSourceDocument(doc: Pick<KnowledgeNavigationSourceDocument, "sourceKind" | "sourceRefId" | "title" | "citation" | "body" | "claimRefs" | "updatedAt">): string {
  return hashText(stableJson({
    sourceKind: doc.sourceKind,
    sourceRefId: doc.sourceRefId,
    title: doc.title,
    citation: doc.citation,
    body: doc.body,
    claimRefs: doc.claimRefs,
    updatedAt: doc.updatedAt,
  }));
}

export function sourceSnapshotHash(docs: KnowledgeNavigationSourceDocument[]): string {
  const rows = docs
    .map((doc) => ({
      sourceKind: doc.sourceKind,
      sourceRefId: doc.sourceRefId,
      digest: digestForSourceDocument(doc),
    }))
    .sort((a, b) => `${a.sourceKind}:${a.sourceRefId}`.localeCompare(`${b.sourceKind}:${b.sourceRefId}`));
  return hashText(stableJson(rows));
}

function sourceDocId(versionHash: string, doc: KnowledgeNavigationSourceDocument): string {
  return `kndoc_${hashText(`${versionHash}|${doc.sourceKind}|${doc.sourceRefId}`).slice(0, 24)}`;
}

function branchNodeId(versionHash: string, branch: NavigableBranch): string {
  return `knnode_${hashText(`${versionHash}|${branch}`).slice(0, 20)}`;
}

function rootNodeId(versionHash: string): string {
  return `knroot_${hashText(`${versionHash}|root`).slice(0, 20)}`;
}

function branchForKnowledgeClaim(row: { claim_type: string; risk_lane: string; target_outputs: unknown; evidence_type: string }): NavigableBranch {
  const outputs = asStringArray(row.target_outputs);
  if (row.risk_lane === "rare" || row.risk_lane === "invasive" || row.claim_type === "risk") return "privacy_claim_boundary";
  if (row.claim_type === "identification_trait") return "identification_granularity";
  if (row.claim_type === "missing_evidence" || row.claim_type === "retake_guidance") return "feedback_contract";
  if (row.claim_type === "monitoring_interpretation" || row.claim_type === "site_condition_note") return "enterprise_reporting";
  if (outputs.some((value) => value === "mypage_weekly")) return "mypage_learning";
  if (row.evidence_type === "mixed") return "evidence_tier_review";
  return "knowledge_claims";
}

function branchForRegionalCard(row: { category: string; sensitivity_level: string }): NavigableBranch {
  if (row.sensitivity_level !== "public") return "privacy_claim_boundary";
  if (row.category === "policy" || row.category === "industry") return "enterprise_reporting";
  if (row.category === "ecology" || row.category === "water" || row.category === "landform" || row.category === "agriculture") return "knowledge_claims";
  if (row.category === "history" || row.category === "cultural_asset" || row.category === "local_life") return "mypage_learning";
  return "feedback_contract";
}

function branchForResearchPaper(row: { status: string; metadata: unknown }): NavigableBranch {
  const metadata = asObject(row.metadata);
  const text = stableJson(metadata).toLowerCase();
  if (row.status === "review_pending") return "freshness_sources";
  if (text.includes("evaluation") || text.includes("benchmark")) return "evaluation";
  if (text.includes("identification") || text.includes("taxonomy")) return "identification_granularity";
  return "freshness_sources";
}

async function queryOptional<T extends QueryResultRow>(queryable: Queryable, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await queryable.query<T>(sql, params);
    return result.rows;
  } catch {
    return [];
  }
}

export async function loadKnowledgeNavigationSourceDocuments(queryable: Queryable = getPool()): Promise<KnowledgeNavigationSourceDocument[]> {
  const claimRows = await queryOptional<{
    claim_id: string;
    claim_type: string;
    claim_text: string;
    taxon_name: string;
    scientific_name: string;
    taxon_group: string;
    place_region: string;
    season_bucket: string;
    habitat: string;
    evidence_type: string;
    risk_lane: string;
    target_outputs: unknown;
    citation_span: string;
    source_title: string;
    source_doi: string;
    source_url: string;
    source_provider: string;
    source_text_policy: KnowledgeNavigationSourceDocument["accessPolicy"];
    confidence: string | number;
    updated_at: string;
  }>(
    queryable,
    `SELECT claim_id::text AS claim_id,
            claim_type,
            claim_text,
            taxon_name,
            scientific_name,
            taxon_group,
            place_region,
            season_bucket,
            habitat,
            evidence_type,
            risk_lane,
            target_outputs,
            citation_span,
            source_title,
            source_doi,
            source_url,
            source_provider,
            source_text_policy,
            confidence::text AS confidence,
            updated_at::text AS updated_at
       FROM knowledge_claims
      WHERE human_review_status = 'ready'
        AND use_in_feedback = TRUE
      ORDER BY updated_at DESC, claim_id::text ASC`,
  );

  const regionalRows = await queryOptional<{
    card_id: string;
    region_scope: string;
    place_hint: string;
    category: string;
    title: string;
    summary: string;
    retrieval_text: string;
    source_url: string;
    source_label: string;
    license: string;
    tags: unknown;
    observation_hooks: unknown;
    sensitivity_level: string;
    updated_at: string;
  }>(
    queryable,
    `SELECT card_id,
            region_scope,
            place_hint,
            category,
            title,
            summary,
            retrieval_text,
            source_url,
            source_label,
            license,
            tags,
            observation_hooks,
            sensitivity_level,
            updated_at::text AS updated_at
       FROM regional_knowledge_cards
      WHERE review_status IN ('approved', 'retrieval')
      ORDER BY updated_at DESC, card_id ASC`,
  );

  const paperRows = await queryOptional<{
    queue_id: string;
    source_kind: string;
    external_id: string;
    doi: string | null;
    title: string;
    publication_year: number | null;
    publisher: string;
    license_label: string;
    access_policy: KnowledgeNavigationSourceDocument["accessPolicy"];
    discovered_taxa: string[];
    relevance_score: string | number;
    status: string;
    metadata: unknown;
    updated_at: string;
  }>(
    queryable,
    `SELECT queue_id::text AS queue_id,
            source_kind,
            external_id,
            doi,
            title,
            publication_year,
            publisher,
            license_label,
            access_policy,
            discovered_taxa,
            relevance_score::text AS relevance_score,
            status,
            metadata,
            updated_at::text AS updated_at
       FROM research_paper_ingest_queue
      WHERE status IN ('approved', 'review_pending')
      ORDER BY relevance_score DESC, updated_at DESC, queue_id::text ASC`,
  );

  const claimDocs = claimRows.map((row): KnowledgeNavigationSourceDocument => {
    const body = [
      row.claim_text,
      row.taxon_name,
      row.scientific_name,
      row.taxon_group,
      row.place_region,
      row.season_bucket,
      row.habitat,
      row.evidence_type,
      row.risk_lane,
      row.citation_span,
    ].filter(Boolean).join(" ");
    const title = row.source_title || `${row.claim_type}: ${row.taxon_name || row.scientific_name || row.taxon_group || "general"}`;
    return {
      sourceKind: "knowledge_claim",
      sourceRefId: row.claim_id,
      title,
      citation: row.source_doi || row.citation_span || row.source_url || row.source_provider,
      accessPolicy: row.source_text_policy,
      body,
      claimRefs: [row.claim_id],
      keyTerms: extractNavigationKeyTerms(body),
      branch: branchForKnowledgeClaim(row),
      updatedAt: row.updated_at,
      metadata: {
        claim_type: row.claim_type,
        taxon_name: row.taxon_name,
        scientific_name: row.scientific_name,
        taxon_group: row.taxon_group,
        place_region: row.place_region,
        risk_lane: row.risk_lane,
        confidence: Number(row.confidence ?? 0),
      },
    };
  });

  const regionalDocs = regionalRows.map((row): KnowledgeNavigationSourceDocument => {
    const tags = asStringArray(row.tags);
    const hooks = asStringArray(row.observation_hooks);
    const body = [row.title, row.summary, row.retrieval_text, row.region_scope, row.place_hint, row.category, ...tags, ...hooks].filter(Boolean).join(" ");
    return {
      sourceKind: "regional_knowledge_card",
      sourceRefId: row.card_id,
      title: row.title,
      citation: [row.source_label, row.source_url, row.license].filter(Boolean).join(" | "),
      accessPolicy: row.sensitivity_level === "public" ? "public" : "metadata_only",
      body,
      claimRefs: [],
      keyTerms: extractNavigationKeyTerms(body),
      branch: branchForRegionalCard(row),
      updatedAt: row.updated_at,
      metadata: {
        region_scope: row.region_scope,
        place_hint: row.place_hint,
        category: row.category,
        sensitivity_level: row.sensitivity_level,
      },
    };
  });

  const paperDocs = paperRows.map((row): KnowledgeNavigationSourceDocument => {
    const metadata = asObject(row.metadata);
    const abstract = asString(metadata.abstract ?? metadata.abstract_text ?? metadata.summary);
    const body = [row.title, abstract, row.publisher, row.publication_year, row.doi, ...asStringArray(row.discovered_taxa)].filter(Boolean).join(" ");
    return {
      sourceKind: "research_paper",
      sourceRefId: row.queue_id,
      title: row.title || row.external_id,
      citation: [row.doi, row.publisher, row.publication_year, row.license_label].filter(Boolean).join(" | "),
      accessPolicy: row.access_policy,
      body,
      claimRefs: [],
      keyTerms: extractNavigationKeyTerms(body),
      branch: branchForResearchPaper(row),
      updatedAt: row.updated_at,
      metadata: {
        source_kind: row.source_kind,
        external_id: row.external_id,
        doi: row.doi,
        publication_year: row.publication_year,
        discovered_taxa: row.discovered_taxa,
        relevance_score: Number(row.relevance_score ?? 0),
        status: row.status,
      },
    };
  });

  const seen = new Set<string>();
  return [...claimDocs, ...regionalDocs, ...paperDocs].filter((doc) => {
    const key = `${doc.sourceKind}:${doc.sourceRefId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function summarizeBranch(branch: NavigableBranch, docs: KnowledgeNavigationSourceDocument[]): string {
  const sourceCounts = docs.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.sourceKind] = (acc[doc.sourceKind] ?? 0) + 1;
    return acc;
  }, {});
  const terms = extractNavigationKeyTerms(docs.flatMap((doc) => doc.keyTerms).join(" "), 10);
  const examples = docs.slice(0, 3).map((doc) => doc.title).filter(Boolean).join(" / ");
  return clipNavigationSummary([
    `${BRANCH_LABELS[branch]} branch with ${docs.length} reviewed or queued source document(s).`,
    `Sources: ${Object.entries(sourceCounts).map(([kind, count]) => `${kind}=${count}`).join(", ") || "none"}.`,
    terms.length > 0 ? `Key terms: ${terms.join(", ")}.` : "",
    examples ? `Representative documents: ${examples}.` : "",
  ].filter(Boolean).join(" "));
}

export function buildKnowledgeNavigationTree(docs: KnowledgeNavigationSourceDocument[]): CompiledKnowledgeNavigationTree {
  const versionHash = sourceSnapshotHash(docs);
  const byBranch = new Map<NavigableBranch, KnowledgeNavigationSourceDocument[]>();
  for (const branch of KNOWLEDGE_NAVIGATION_BRANCHES) byBranch.set(branch, []);
  for (const doc of docs) byBranch.get(doc.branch)?.push(doc);

  const activeBranches = KNOWLEDGE_NAVIGATION_BRANCHES.filter((branch) => (byBranch.get(branch)?.length ?? 0) > 0);
  const rootId = rootNodeId(versionHash);
  const rootTerms = extractNavigationKeyTerms(docs.flatMap((doc) => doc.keyTerms).join(" "), 16);
  const nodes: KnowledgeNavigationNode[] = [{
    nodeId: rootId,
    parentId: null,
    depth: 0,
    label: "Navigable Biodiversity OS",
    summary: clipNavigationSummary(`Root map for reviewed biodiversity knowledge. Active branches: ${activeBranches.map((branch) => BRANCH_LABELS[branch]).join(", ") || "none yet"}.`),
    questionTypes: ["overview", "branch_selection"],
    keyTerms: rootTerms,
    childCount: activeBranches.length,
    metadata: { branch_count: activeBranches.length },
  }];

  const documents: KnowledgeNavigationDocument[] = [];
  for (const branch of activeBranches) {
    const branchDocs = byBranch.get(branch) ?? [];
    const nodeId = branchNodeId(versionHash, branch);
    const keyTerms = extractNavigationKeyTerms(branchDocs.flatMap((doc) => doc.keyTerms).join(" "), 12);
    nodes.push({
      nodeId,
      parentId: rootId,
      depth: 1,
      label: sanitizeNavigationLabel(BRANCH_LABELS[branch]),
      summary: summarizeBranch(branch, branchDocs),
      questionTypes: BRANCH_QUESTION_TYPES[branch],
      keyTerms,
      childCount: 0,
      metadata: { branch, document_count: branchDocs.length },
    });
    for (const doc of branchDocs) {
      documents.push({
        docId: sourceDocId(versionHash, doc),
        nodeId,
        sourceKind: doc.sourceKind,
        sourceRefId: doc.sourceRefId,
        title: sanitizeNavigationLabel(doc.title),
        citation: doc.citation.slice(0, 600),
        accessPolicy: doc.accessPolicy,
        contentDigest: digestForSourceDocument(doc),
        claimRefs: doc.claimRefs,
        keyTerms: doc.keyTerms,
        metadata: doc.metadata,
      });
    }
  }

  return {
    sourceSnapshotHash: versionHash,
    nodes,
    documents,
    sourceDocumentCount: docs.length,
  };
}

export async function getLatestKnowledgeNavigationVersion(queryable: Queryable = getPool()): Promise<KnowledgeNavigationLatestVersion | null> {
  const result = await queryable.query<{
    version_id: string;
    source_snapshot_hash: string;
    built_at: string;
    status: KnowledgeNavigationLatestVersion["status"];
    node_count: number;
    document_count: number;
    metadata: unknown;
  }>(
    `SELECT version_id::text AS version_id,
            source_snapshot_hash,
            built_at::text AS built_at,
            status,
            node_count,
            document_count,
            metadata
       FROM knowledge_navigation_versions
      ORDER BY built_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    versionId: row.version_id,
    sourceSnapshotHash: row.source_snapshot_hash,
    builtAt: row.built_at,
    status: row.status,
    nodeCount: Number(row.node_count ?? 0),
    documentCount: Number(row.document_count ?? 0),
    metadata: asObject(row.metadata),
  };
}

async function getLatestSuccessfulNavigationVersion(queryable: Queryable): Promise<KnowledgeNavigationLatestVersion | null> {
  const result = await queryable.query<{
    version_id: string;
    source_snapshot_hash: string;
    built_at: string;
    status: KnowledgeNavigationLatestVersion["status"];
    node_count: number;
    document_count: number;
    metadata: unknown;
  }>(
    `SELECT version_id::text AS version_id,
            source_snapshot_hash,
            built_at::text AS built_at,
            status,
            node_count,
            document_count,
            metadata
       FROM knowledge_navigation_versions
      WHERE status = 'success'
      ORDER BY built_at DESC
      LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    versionId: row.version_id,
    sourceSnapshotHash: row.source_snapshot_hash,
    builtAt: row.built_at,
    status: row.status,
    nodeCount: Number(row.node_count ?? 0),
    documentCount: Number(row.document_count ?? 0),
    metadata: asObject(row.metadata),
  };
}

export async function persistKnowledgeNavigationTree(
  tree: CompiledKnowledgeNavigationTree,
  queryable: Queryable = getPool(),
): Promise<{ versionId: string; skipped: boolean; sourceSnapshotHash: string; nodeCount: number; documentCount: number }> {
  const poolLike = queryable as Queryable & { connect?: () => Promise<PoolClient>; release?: unknown };
  if (typeof poolLike.connect === "function" && typeof poolLike.release !== "function") {
    const client = await poolLike.connect();
    try {
      return await persistKnowledgeNavigationTree(tree, client);
    } finally {
      client.release();
    }
  }

  const latestSuccess = await getLatestSuccessfulNavigationVersion(queryable).catch(() => null);
  if (latestSuccess?.sourceSnapshotHash === tree.sourceSnapshotHash) {
    return {
      versionId: latestSuccess.versionId,
      skipped: true,
      sourceSnapshotHash: tree.sourceSnapshotHash,
      nodeCount: latestSuccess.nodeCount,
      documentCount: latestSuccess.documentCount,
    };
  }

  let versionId = "";
  await queryable.query("BEGIN");
  try {
    const inserted = await queryable.query<{ version_id: string }>(
      `INSERT INTO knowledge_navigation_versions (source_snapshot_hash, status, metadata)
       VALUES ($1, 'building', $2::jsonb)
       ON CONFLICT (source_snapshot_hash) DO UPDATE
         SET built_at = NOW(),
             status = 'building',
             metadata = EXCLUDED.metadata
       RETURNING version_id::text AS version_id`,
      [tree.sourceSnapshotHash, JSON.stringify({ compiler: "knowledge_navigation/v1", source_document_count: tree.sourceDocumentCount })],
    );
    versionId = inserted.rows[0]?.version_id ?? "";
    if (!versionId) throw new Error("knowledge_navigation_version_insert_failed");

    await queryable.query("DELETE FROM knowledge_navigation_nodes WHERE version_id = $1::uuid", [versionId]);

    for (const node of tree.nodes) {
      await queryable.query(
        `INSERT INTO knowledge_navigation_nodes (
           node_id, version_id, parent_id, depth, label, summary, question_types, key_terms, child_count, metadata
         ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7::text[], $8::text[], $9, $10::jsonb)`,
        [
          node.nodeId,
          versionId,
          node.parentId,
          node.depth,
          node.label,
          node.summary,
          node.questionTypes,
          node.keyTerms,
          node.childCount,
          JSON.stringify(node.metadata),
        ],
      );
    }

    for (const doc of tree.documents) {
      await queryable.query(
        `INSERT INTO knowledge_navigation_documents (
           doc_id, version_id, node_id, source_kind, source_ref_id, title, citation, access_policy,
           content_digest, claim_refs, key_terms, metadata
         ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[], $12::jsonb)`,
        [
          doc.docId,
          versionId,
          doc.nodeId,
          doc.sourceKind,
          doc.sourceRefId,
          doc.title,
          doc.citation,
          doc.accessPolicy,
          doc.contentDigest,
          doc.claimRefs,
          doc.keyTerms,
          JSON.stringify(doc.metadata),
        ],
      );
    }

    await queryable.query(
      `UPDATE knowledge_navigation_versions
          SET status = 'success',
              node_count = $2,
              document_count = $3,
              metadata = metadata || $4::jsonb
        WHERE version_id = $1::uuid`,
      [
        versionId,
        tree.nodes.length,
        tree.documents.length,
        JSON.stringify({ completed_at: new Date().toISOString() }),
      ],
    );
    await queryable.query("COMMIT");
  } catch (error) {
    await queryable.query("ROLLBACK").catch(() => undefined);
    if (versionId) {
      await queryable.query(
        `UPDATE knowledge_navigation_versions
            SET status = 'failed',
                metadata = metadata || $2::jsonb
          WHERE version_id = $1::uuid`,
        [versionId, JSON.stringify({ error: error instanceof Error ? error.message : String(error) })],
      ).catch(() => undefined);
    }
    throw error;
  }

  return {
    versionId,
    skipped: false,
    sourceSnapshotHash: tree.sourceSnapshotHash,
    nodeCount: tree.nodes.length,
    documentCount: tree.documents.length,
  };
}

function inferQueryBranch(query: string, pkg: ObservationPackage): NavigableBranch {
  const text = [
    query,
    pkg.reviewState.publicClaimLimit,
    pkg.reviewState.reviewStatus,
    ...pkg.reviewState.blockingIssues,
    ...pkg.occurrences.map((occurrence) => [occurrence.riskLane, occurrence.safePublicRank, occurrence.taxonRank, occurrence.scientificName, occurrence.vernacularName].filter(Boolean).join(" ")),
  ].join(" ").toLowerCase();
  if (text.includes("rare") || text.includes("希少") || text.includes("invasive") || text.includes("外来") || text.includes("legal") || text.includes("privacy")) return "privacy_claim_boundary";
  if (text.includes("research") || text.includes("研究") || text.includes("report") || text.includes("site")) return "enterprise_reporting";
  if (text.includes("paper") || text.includes("論文") || text.includes("fresh") || text.includes("source")) return "freshness_sources";
  if (text.includes("同定") || text.includes("identify") || text.includes("species") || text.includes("rank")) return "identification_granularity";
  if (text.includes("撮") || text.includes("retake") || text.includes("missing") || text.includes("feedback")) return "feedback_contract";
  if (text.includes("tier") || text.includes("review") || text.includes("証拠")) return "evidence_tier_review";
  if (text.includes("eval") || text.includes("評価")) return "evaluation";
  if (text.includes("学習") || text.includes("mypage") || text.includes("weekly")) return "mypage_learning";
  return "knowledge_claims";
}

function scoreNavigationDocument(
  doc: KnowledgeNavigationDocument,
  queryTerms: string[],
  pkg: ObservationPackage,
): number {
  const docText = [
    doc.title,
    doc.citation,
    doc.sourceKind,
    ...doc.keyTerms,
    stableJson(doc.metadata),
  ].join(" ").toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    if (docText.includes(term.toLowerCase())) score += 2;
  }
  for (const occurrence of pkg.occurrences) {
    for (const value of [occurrence.scientificName, occurrence.vernacularName, occurrence.riskLane, occurrence.taxonRank]) {
      if (value && docText.includes(value.toLowerCase())) score += 3;
    }
  }
  for (const value of [pkg.visit.observedPrefecture, pkg.visit.observedMunicipality]) {
    if (value && docText.includes(value.toLowerCase())) score += 2;
  }
  if (doc.claimRefs.length > 0) score += 1;
  return score;
}

async function loadBranchNodeAndDocuments(queryable: Queryable, versionId: string, branch: NavigableBranch): Promise<{
  node: KnowledgeNavigationNode | null;
  documents: KnowledgeNavigationDocument[];
}> {
  const nodeResult = await queryable.query<{
    node_id: string;
    parent_id: string | null;
    depth: number;
    label: string;
    summary: string;
    question_types: string[];
    key_terms: string[];
    child_count: number;
    metadata: unknown;
  }>(
    `SELECT node_id, parent_id, depth, label, summary, question_types, key_terms, child_count, metadata
       FROM knowledge_navigation_nodes
      WHERE version_id = $1::uuid
        AND metadata->>'branch' = $2
      LIMIT 1`,
    [versionId, branch],
  );
  const nodeRow = nodeResult.rows[0];
  if (!nodeRow) return { node: null, documents: [] };
  const docResult = await queryable.query<{
    doc_id: string;
    node_id: string;
    source_kind: KnowledgeNavigationSourceKind;
    source_ref_id: string;
    title: string;
    citation: string;
    access_policy: string;
    content_digest: string;
    claim_refs: string[];
    key_terms: string[];
    metadata: unknown;
  }>(
    `SELECT doc_id,
            node_id,
            source_kind,
            source_ref_id,
            title,
            citation,
            access_policy,
            content_digest,
            claim_refs,
            key_terms,
            metadata
       FROM knowledge_navigation_documents
      WHERE version_id = $1::uuid
        AND node_id = $2
      ORDER BY CASE WHEN array_length(claim_refs, 1) IS NULL THEN 1 ELSE 0 END, title ASC
      LIMIT 60`,
    [versionId, nodeRow.node_id],
  );
  return {
    node: {
      nodeId: nodeRow.node_id,
      parentId: nodeRow.parent_id,
      depth: Number(nodeRow.depth ?? 0),
      label: nodeRow.label,
      summary: nodeRow.summary,
      questionTypes: asStringArray(nodeRow.question_types),
      keyTerms: asStringArray(nodeRow.key_terms),
      childCount: Number(nodeRow.child_count ?? 0),
      metadata: asObject(nodeRow.metadata),
    },
    documents: docResult.rows.map((row) => ({
      docId: row.doc_id,
      nodeId: row.node_id,
      sourceKind: row.source_kind,
      sourceRefId: row.source_ref_id,
      title: row.title,
      citation: row.citation,
      accessPolicy: row.access_policy,
      contentDigest: row.content_digest,
      claimRefs: asStringArray(row.claim_refs),
      keyTerms: asStringArray(row.key_terms),
      metadata: asObject(row.metadata),
    })),
  };
}

async function fallbackToBranchClaims(
  reason: string,
  branch: NavigableBranch,
  pkg: ObservationPackage,
  queryable: Queryable,
): Promise<KnowledgeNavigationResult> {
  const claimRefs = await retrieveBranchKnowledgeClaims({ branch, observationPackage: pkg, limit: 8 }, queryable);
  return {
    selectedBranch: branch,
    visitedNodeIds: [],
    retrievedDocIds: [],
    claimRefs,
    citations: claimRefs.map((claim) => ({
      docId: `claim:${claim.claimId}`,
      sourceKind: "knowledge_claim",
      sourceRefId: claim.claimId,
      title: claim.claimType,
      citation: claim.citationSpan,
      claimRefs: [claim.claimId],
    })),
    confidence: claimRefs.length > 0 ? 0.48 : 0.2,
    fallbackReason: reason,
  };
}

export async function navigateKnowledgeTree(input: NavigateKnowledgeTreeInput): Promise<KnowledgeNavigationResult> {
  const queryable = input.queryable ?? getPool();
  const branch = inferQueryBranch(input.query, input.observationPackage);
  const maxTurns = Math.max(1, Math.min(10, input.maxTurns ?? DEFAULT_NAVIGATION_MAX_TURNS));

  const latest = await getLatestSuccessfulNavigationVersion(queryable).catch(() => null);
  if (!latest) {
    return fallbackToBranchClaims("no_successful_navigation_version", branch, input.observationPackage, queryable);
  }

  const { node, documents } = await loadBranchNodeAndDocuments(queryable, latest.versionId, branch).catch(() => ({ node: null, documents: [] }));
  if (!node || documents.length === 0) {
    return fallbackToBranchClaims("no_matching_navigation_documents", branch, input.observationPackage, queryable);
  }

  const queryTerms = extractNavigationKeyTerms(input.query, 10);
  const selectedDocs = documents
    .map((doc) => ({ doc, score: scoreNavigationDocument(doc, queryTerms, input.observationPackage) }))
    .sort((a, b) => b.score - a.score || a.doc.title.localeCompare(b.doc.title))
    .slice(0, Math.max(3, maxTurns * 2))
    .map(({ doc }) => doc);

  const claimRefs = await retrieveBranchKnowledgeClaims({ branch, observationPackage: input.observationPackage, limit: 8 }, queryable).catch(() => []);
  const docClaimIds = new Set(selectedDocs.flatMap((doc) => doc.claimRefs));
  const scopedClaimRefs = claimRefs.filter((claim) => docClaimIds.size === 0 || docClaimIds.has(claim.claimId));
  const finalClaimRefs = scopedClaimRefs.length > 0 ? scopedClaimRefs : claimRefs;

  return {
    selectedBranch: branch,
    visitedNodeIds: [node.parentId ?? KNOWLEDGE_NAVIGATION_ROOT_ID, node.nodeId],
    retrievedDocIds: selectedDocs.map((doc) => doc.docId),
    claimRefs: finalClaimRefs,
    citations: selectedDocs
      .filter((doc) => doc.citation || doc.claimRefs.length > 0)
      .map((doc) => ({
        docId: doc.docId,
        sourceKind: doc.sourceKind,
        sourceRefId: doc.sourceRefId,
        title: doc.title,
        citation: doc.citation,
        claimRefs: doc.claimRefs,
      })),
    confidence: Math.min(0.92, 0.55 + Math.min(0.2, selectedDocs.length * 0.03) + (finalClaimRefs.length > 0 ? 0.15 : 0)),
    fallbackReason: null,
  };
}

export function formatNavigationContextForPrompt(result: KnowledgeNavigationResult): string {
  return [
    `selected_branch=${result.selectedBranch}`,
    `visited_node_ids=${result.visitedNodeIds.join(",") || "none"}`,
    `retrieved_doc_ids=${result.retrievedDocIds.join(",") || "none"}`,
    `fallback_reason=${result.fallbackReason ?? "none"}`,
    result.citations.length > 0
      ? result.citations.map((citation) => `- doc_id=${citation.docId} source=${citation.sourceKind}:${citation.sourceRefId} title=${citation.title} citation=${citation.citation} claim_refs=${citation.claimRefs.join(",")}`).join("\n")
      : "No source documents selected.",
  ].join("\n");
}
