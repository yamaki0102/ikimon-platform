// Sprint 6: /api/internal/agent-proposals — receives CMA curator proposals
// and turns them into PRs against ikimon-platform.
//
// Auth: X-Curator-Secret header timing-safe compared with
// process.env.CURATOR_RECEIVER_SECRET. Agents never see GitHub credentials;
// the VPS holds GH_TOKEN and uses it server-side.

import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  receiveProposal,
  type CuratorName,
  type ProposalSubmission,
} from "../services/curatorProposalReceiver.js";

type RequestBody = {
  run_id?: string;
  curator_name?: string;
  proposal_kind?: string;
  title?: string;
  summary?: string;
  sql_content?: string;
  rationale?: string;
};

function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function asString(value: unknown, max = 50_000): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

export async function registerCuratorProposalsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: RequestBody;
    Headers: { "x-curator-secret"?: string };
  }>("/api/internal/agent-proposals", async (request, reply) => {
    const expectedSecret = process.env.CURATOR_RECEIVER_SECRET?.trim();
    if (!expectedSecret) {
      reply.code(503);
      return { ok: false, error: "CURATOR_RECEIVER_SECRET env not configured on server" };
    }

    const headerSecret = request.headers["x-curator-secret"];
    const providedSecret = typeof headerSecret === "string" ? headerSecret : "";
    if (!timingSafeStringEqual(providedSecret, expectedSecret)) {
      reply.code(401);
      return { ok: false, error: "invalid X-Curator-Secret header" };
    }

    const body = request.body ?? {};
    const runId = asString(body.run_id, 64);
    const curatorName = asString(body.curator_name, 64);
    const proposalKind = asString(body.proposal_kind, 64);
    const title = asString(body.title, 200);
    const summary = asString(body.summary, 4_000);
    const sqlContent = asString(body.sql_content, 200_000);
    const rationale = asString(body.rationale, 4_000);

    if (!runId || !curatorName || !sqlContent) {
      reply.code(400);
      return { ok: false, error: "run_id, curator_name, sql_content are required" };
    }
    if (proposalKind !== "migration_sql" && proposalKind !== "claim_paraphrase") {
      reply.code(400);
      return { ok: false, error: "proposal_kind must be migration_sql or claim_paraphrase" };
    }

    const submission: ProposalSubmission = {
      runId,
      curatorName: curatorName as CuratorName,
      proposalKind: proposalKind as "migration_sql" | "claim_paraphrase",
      title,
      summary,
      sqlContent,
      rationale,
    };

    try {
      const result = await receiveProposal(submission);
      reply.code(201);
      return {
        ok: true,
        proposal_path: result.proposalPath,
        pr_url: result.prUrl,
        branch_name: result.branchName,
        migration_filename: result.migrationFilename,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[curator-proposals] receive failed:", msg);
      reply.code(500);
      return { ok: false, error: msg };
    }
  });
}
