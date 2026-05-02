import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationPackage } from "./observationPackage.js";
import {
  MAX_NAVIGATION_SUMMARY_LENGTH,
  buildKnowledgeNavigationTree,
  clipNavigationSummary,
  formatNavigationContextForPrompt,
  navigateKnowledgeTree,
  persistKnowledgeNavigationTree,
  sanitizeNavigationLabel,
  sourceSnapshotHash,
  type KnowledgeNavigationSourceDocument,
} from "./knowledgeNavigation.js";

function samplePackage(): ObservationPackage {
  return {
    packageVersion: "observation_package/v1",
    packageId: "obspkg_test",
    generatedAt: "2026-05-01T00:00:00.000Z",
    visit: {
      visitId: "visit-1",
      legacyObservationId: null,
      observedAt: "2026-04-30T12:00:00.000Z",
      placeId: "place-1",
      locationPrecision: "point_medium",
      observedPrefecture: "静岡県",
      observedMunicipality: "浜松市",
      effortMinutes: 10,
      targetTaxaScope: null,
      sourceKind: "test",
    },
    occurrences: [{
      occurrenceId: "occ-1",
      visitId: "visit-1",
      scientificName: "Taraxacum officinale",
      vernacularName: "セイヨウタンポポ",
      taxonRank: "species",
      confidenceScore: 0.7,
      evidenceTier: 1,
      qualityGrade: "research",
      riskLane: "normal",
      safePublicRank: "species",
      sourcePayload: { taxon_group: "plant" },
    }],
    evidenceAssets: [],
    identifications: [],
    aiRuns: [],
    feedbackPayload: null,
    claimRefs: [],
    reviewState: {
      currentEvidenceTier: 1,
      tierLabel: "ai_suggestion",
      reviewStatus: "reviewable",
      reviewPriority: "normal",
      requiredReviewerScope: null,
      blockingIssues: [],
      publicClaimLimit: "observation_supported",
    },
    reportOutputs: [],
  };
}

function sourceDoc(overrides: Partial<KnowledgeNavigationSourceDocument> = {}): KnowledgeNavigationSourceDocument {
  return {
    sourceKind: "knowledge_claim",
    sourceRefId: "claim-1",
    title: "タンポポの撮影角度",
    citation: "reviewed source span",
    accessPolicy: "metadata_only",
    body: "タンポポの総苞片と葉を撮ると同定支援に使える",
    claimRefs: ["claim-1"],
    keyTerms: ["タンポポ", "同定", "撮影"],
    branch: "feedback_contract",
    updatedAt: "2026-05-01T00:00:00.000Z",
    metadata: { claim_type: "retake_guidance" },
    ...overrides,
  };
}

function fakeQueryable(handler: (sql: string, params: unknown[]) => { rows: unknown[] }): never {
  return {
    async query(sql: string, params: unknown[] = []) {
      return handler(sql, params);
    },
  } as never;
}

test("navigation tree enforces safe labels, summary length, and unique source documents", () => {
  assert.equal(sanitizeNavigationLabel(" bad\n<label> "), "bad label");
  assert.equal(clipNavigationSummary("x".repeat(3000)).length, MAX_NAVIGATION_SUMMARY_LENGTH);

  const tree = buildKnowledgeNavigationTree([
    sourceDoc({ sourceRefId: "claim-1" }),
    sourceDoc({ sourceRefId: "claim-2", title: "別角度", body: "葉と花を同じ画面に入れる", claimRefs: ["claim-2"] }),
  ]);

  assert.equal(new Set(tree.documents.map((doc) => `${doc.sourceKind}:${doc.sourceRefId}`)).size, tree.documents.length);
  assert.ok(tree.nodes.every((node) => node.summary.length <= MAX_NAVIGATION_SUMMARY_LENGTH));
  assert.ok(tree.nodes.every((node) => !/[<>]/.test(node.label)));
});

test("source snapshot hash is stable across input order", () => {
  const docs = [
    sourceDoc({ sourceRefId: "claim-1", title: "A" }),
    sourceDoc({ sourceRefId: "claim-2", title: "B" }),
  ];
  assert.equal(sourceSnapshotHash(docs), sourceSnapshotHash([...docs].reverse()));
});

test("persist uses an already connected PoolClient without reconnecting it", async () => {
  const tree = buildKnowledgeNavigationTree([sourceDoc()]);
  let connectCalls = 0;
  const client = {
    release() {},
    async connect() {
      connectCalls += 1;
      throw new Error("client_should_not_reconnect");
    },
    async query(sql: string) {
      if (sql.includes("SELECT version_id::text AS version_id") && sql.includes("WHERE status = 'success'")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO knowledge_navigation_versions")) {
        return { rows: [{ version_id: "00000000-0000-0000-0000-000000000002" }] };
      }
      return { rows: [] };
    },
  } as never;

  const result = await persistKnowledgeNavigationTree(tree, client);
  assert.equal(connectCalls, 0);
  assert.equal(result.skipped, false);
  assert.equal(result.nodeCount, tree.nodes.length);
  assert.equal(result.documentCount, tree.documents.length);
});

test("navigation never turns node summaries into evidence", async () => {
  const queryable = fakeQueryable((sql) => {
    if (sql.includes("FROM knowledge_navigation_versions")) {
      return { rows: [{ version_id: "00000000-0000-0000-0000-000000000001", source_snapshot_hash: "hash", built_at: "2026-05-01", status: "success", node_count: 2, document_count: 1, metadata: {} }] };
    }
    if (sql.includes("FROM knowledge_navigation_nodes")) {
      return { rows: [{ node_id: "node-feedback", parent_id: "knowledge_navigation_root", depth: 1, label: "Feedback", summary: "summary-only strong claim", question_types: ["feedback"], key_terms: ["撮影"], child_count: 0, metadata: { branch: "feedback_contract" } }] };
    }
    if (sql.includes("FROM knowledge_navigation_documents")) {
      return { rows: [{ doc_id: "doc-1", node_id: "node-feedback", source_kind: "regional_knowledge_card", source_ref_id: "card-1", title: "地域カード", citation: "浜松市資料", access_policy: "public", content_digest: "digest", claim_refs: [], key_terms: ["撮影"], metadata: {} }] };
    }
    if (sql.includes("FROM knowledge_claims")) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  const result = await navigateKnowledgeTree({
    query: "撮影し直しの助言を作る",
    observationPackage: samplePackage(),
    queryable,
  });

  assert.equal(result.fallbackReason, null);
  assert.deepEqual(result.claimRefs, []);
  assert.deepEqual(result.retrievedDocIds, ["doc-1"]);
  assert.equal(result.citations[0]?.citation, "浜松市資料");
  assert.ok(!formatNavigationContextForPrompt(result).includes("summary-only strong claim"));
});

test("fallback keeps ready knowledge_claim retrieval behavior when no navigation version exists", async () => {
  const queryable = fakeQueryable((sql) => {
    if (sql.includes("FROM knowledge_navigation_versions")) {
      return { rows: [] };
    }
    if (sql.includes("FROM knowledge_claims")) {
      return {
        rows: [{
          claim_id: "claim-ready-1",
          claim_type: "retake_guidance",
          claim_text: "葉と花を同時に撮ると次の確認に役立つ。",
          taxon_name: "セイヨウタンポポ",
          scientific_name: "Taraxacum officinale",
          taxon_group: "plant",
          place_region: "浜松市",
          season_bucket: "spring",
          habitat: "roadside",
          evidence_type: "image",
          risk_lane: "normal",
          target_outputs: ["observation_feedback"],
          citation_span: "reviewed span",
          confidence: "0.800",
          human_review_status: "ready",
          use_in_feedback: true,
        }],
      };
    }
    return { rows: [] };
  });

  const result = await navigateKnowledgeTree({
    query: "撮影し直しの助言を作る",
    observationPackage: samplePackage(),
    queryable,
  });

  assert.equal(result.fallbackReason, "no_successful_navigation_version");
  assert.equal(result.claimRefs.length, 1);
  assert.equal(result.claimRefs[0]?.humanReviewStatus, "ready");
  assert.equal(result.claimRefs[0]?.useInFeedback, true);
});
