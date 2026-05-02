import { getPool } from "../db.js";
import {
  buildKnowledgeNavigationTree,
  loadKnowledgeNavigationSourceDocuments,
  persistKnowledgeNavigationTree,
} from "../services/knowledgeNavigation.js";

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

async function main(): Promise<void> {
  const dryRun = hasArg("--dry-run");
  const json = hasArg("--json");
  const pool = getPool();

  try {
    const docs = await loadKnowledgeNavigationSourceDocuments(pool);
    const tree = buildKnowledgeNavigationTree(docs);
    if (dryRun) {
      const payload = {
        dryRun: true,
        sourceSnapshotHash: tree.sourceSnapshotHash,
        sourceDocumentCount: tree.sourceDocumentCount,
        nodeCount: tree.nodes.length,
        documentCount: tree.documents.length,
        branchNodes: tree.nodes.filter((node) => node.depth === 1).map((node) => ({
          nodeId: node.nodeId,
          label: node.label,
          documentCount: Number(node.metadata.document_count ?? 0),
        })),
      };
      if (json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        console.log(`knowledge-navigation dry-run hash=${payload.sourceSnapshotHash} nodes=${payload.nodeCount} documents=${payload.documentCount}`);
      }
      return;
    }

    const result = await persistKnowledgeNavigationTree(tree, pool);
    const payload = {
      dryRun: false,
      ...result,
    };
    if (json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`knowledge-navigation version=${result.versionId} skipped=${result.skipped} hash=${result.sourceSnapshotHash} nodes=${result.nodeCount} documents=${result.documentCount}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
