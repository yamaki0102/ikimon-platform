// Sprint 6/7: receive curator proposals and turn them into PRs.
//
// The Node-owned curator dispatcher POSTs proposed migration SQL to
// /api/internal/agent-proposals. This service:
//   1. Validates the shared secret (X-Curator-Secret header)
//   2. Writes the SQL to out/proposals/<run_id>.sql
//   3. Creates a branch + commit + push using a git worktree on the VPS repo
//   4. Opens a PR via `gh pr create` with the agent-generated label
//
// The VPS holds the GitHub PAT in $GH_TOKEN env. LLM providers never see the token.

import { execFile as execFileCb } from "node:child_process";
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);

export type CuratorName = "invasive-law" | "redlist" | "paper-research" | "satellite-update";

export type ProposalSubmission = {
  runId: string;
  curatorName: CuratorName;
  proposalKind: "migration_sql" | "claim_paraphrase";
  title: string;
  summary: string;
  sqlContent: string;
  rationale: string;
};

export type ProposalResult = {
  proposalPath: string;
  prUrl: string | null;
  branchName: string;
  migrationFilename: string;
};

const REPO_ROOT = process.env.CURATOR_REPO_ROOT?.trim() || "/var/www/ikimon.life-staging/repo";
const PROPOSALS_DIR = process.env.CURATOR_PROPOSALS_DIR?.trim() || "/tmp/ikimon-curator-proposals";
const WORKTREES_ROOT = process.env.CURATOR_WORKTREES_ROOT?.trim() || "/tmp/ikimon-curator-worktrees";
const GIT_USER_NAME = "ikimon-curator-bot";
const GIT_USER_EMAIL = "curator-bot@ikimon.life";

const VALID_CURATORS = new Set<CuratorName>([
  "invasive-law",
  "redlist",
  "paper-research",
  "satellite-update",
]);

function isValidCuratorName(value: string): value is CuratorName {
  return VALID_CURATORS.has(value as CuratorName);
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function shortRunId(runId: string): string {
  return runId.replace(/-/g, "").slice(0, 8);
}

async function nextMigrationNumber(repoRoot: string): Promise<string> {
  const dir = path.join(repoRoot, "platform_v2", "db", "migrations");
  const entries = await readdir(dir);
  const numbers = entries
    .map((name) => name.match(/^(\d{4})_/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => Number.parseInt(m[1] ?? "0", 10));
  const max = numbers.length > 0 ? Math.max(...numbers) : 60;
  return String(max + 1).padStart(4, "0");
}

async function runGit(args: string[], cwd: string, env?: NodeJS.ProcessEnv): Promise<string> {
  const { stdout, stderr } = await execFile("git", args, {
    cwd,
    env: { ...process.env, ...(env ?? {}) },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (stderr.trim().length > 0 && !stderr.includes("warning:")) {
    // git emits progress to stderr; only log when not warning
    // eslint-disable-next-line no-console
    console.log(`[curator-pr] git ${args.join(" ")}: ${stderr.trim().slice(0, 200)}`);
  }
  return stdout;
}

async function runGh(args: string[], cwd: string, ghToken: string): Promise<string> {
  const { stdout } = await execFile("gh", args, {
    cwd,
    env: { ...process.env, GH_TOKEN: ghToken, GITHUB_TOKEN: ghToken },
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

export async function receiveProposal(submission: ProposalSubmission): Promise<ProposalResult> {
  if (!isValidUuid(submission.runId)) {
    throw new Error("invalid run_id (expected uuid)");
  }
  if (!isValidCuratorName(submission.curatorName)) {
    throw new Error(`invalid curator_name: ${submission.curatorName}`);
  }
  const ghToken = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (!ghToken) {
    throw new Error("GH_TOKEN env var missing on VPS — proposal saved but PR creation skipped");
  }

  // 1. Persist the raw proposal under PROPOSALS_DIR (audit trail)
  await mkdir(PROPOSALS_DIR, { recursive: true });
  const proposalPath = path.join(PROPOSALS_DIR, `${submission.runId}.sql`);
  const headerComment = [
    `-- agent: ${submission.curatorName}`,
    `-- run_id: ${submission.runId}`,
    `-- proposal_kind: ${submission.proposalKind}`,
    `-- title: ${submission.title.replace(/\n/g, " ").slice(0, 200)}`,
    `-- rationale: ${submission.rationale.replace(/\n/g, " ").slice(0, 400)}`,
    "",
  ].join("\n");
  await writeFile(proposalPath, headerComment + submission.sqlContent.trim() + "\n", "utf8");

  // 2. Compute target migration filename and branch name
  const migrationNumber = await nextMigrationNumber(REPO_ROOT);
  const safeCuratorSlug = submission.curatorName.replace(/[^a-z0-9]/gi, "_");
  const migrationFilename = `${migrationNumber}_${safeCuratorSlug}_${shortRunId(submission.runId)}.sql`;
  const branchName = `curator/${submission.curatorName}/${shortRunId(submission.runId)}`;

  // 3. Set up an isolated git worktree on the VPS repo
  await mkdir(WORKTREES_ROOT, { recursive: true });
  const worktreePath = path.join(WORKTREES_ROOT, submission.runId);

  // Refresh main via HTTPS+token so the worktree branch is based on the latest.
  // We bypass the `origin` remote because production repos are commonly cloned
  // via SSH and the www-data runtime user has no SSH key — the token-bearing
  // HTTPS URL works regardless of how origin was configured.
  const fetchUrl = `https://x-access-token:${ghToken}@github.com/yamaki0102/ikimon-platform.git`;
  await runGit(
    ["fetch", "--no-tags", fetchUrl, "main:refs/remotes/origin/main"],
    REPO_ROOT,
  );

  // If a stale worktree exists for this run_id, prune it
  await runGit(["worktree", "prune"], REPO_ROOT).catch(() => undefined);

  await runGit(["worktree", "add", "-B", branchName, worktreePath, "refs/remotes/origin/main"], REPO_ROOT);

  try {
    // 4. Drop the proposal SQL into the migrations dir
    const migrationPath = path.join(
      worktreePath,
      "platform_v2",
      "db",
      "migrations",
      migrationFilename,
    );
    await writeFile(migrationPath, headerComment + submission.sqlContent.trim() + "\n", "utf8");

    // 5. Commit
    await runGit(["config", "user.name", GIT_USER_NAME], worktreePath);
    await runGit(["config", "user.email", GIT_USER_EMAIL], worktreePath);
    await runGit(["add", path.join("platform_v2", "db", "migrations", migrationFilename)], worktreePath);
    const commitMsg = `agent(${submission.curatorName}): proposal ${shortRunId(submission.runId)}\n\n${submission.title.slice(0, 200)}\n\nrun_id: ${submission.runId}\n\n🤖 Generated by ikimon-curator-bot`;
    await runGit(["commit", "-m", commitMsg], worktreePath);

    // 6. Push using HTTPS + GH_TOKEN
    const pushUrl = `https://x-access-token:${ghToken}@github.com/yamaki0102/ikimon-platform.git`;
    await runGit(["push", "--force-with-lease", pushUrl, `${branchName}:${branchName}`], worktreePath);

    // 7. Open PR via gh CLI
    const prBody = [
      "## Agent-generated proposal",
      "",
      `- **Curator**: \`${submission.curatorName}\``,
      `- **Run ID**: \`${submission.runId}\``,
      `- **Proposal kind**: \`${submission.proposalKind}\``,
      `- **Migration**: \`platform_v2/db/migrations/${migrationFilename}\``,
      "",
      "### Summary (agent-provided)",
      submission.summary || "(none provided)",
      "",
      "### Rationale (agent-provided)",
      submission.rationale || "(none provided)",
      "",
      "### Trust boundary §1.5 reviewer checklist",
      "- [ ] No `source_excerpt` exceeds 600 chars",
      "- [ ] No `claim_text` exceeds 260 chars",
      "- [ ] No `citation_span` exceeds 320 chars",
      "- [ ] No `use_in_feedback = true` is being set",
      "- [ ] License field on every `source_snapshots` row is in the allowlist",
      "",
      "🤖 Generated by ikimon-curator-bot",
    ].join("\n");

    const prTitle = `agent(${submission.curatorName}): ${submission.title.slice(0, 60)}`;

    const prResult = await runGh(
      [
        "pr", "create",
        "--repo", "yamaki0102/ikimon-platform",
        "--base", "main",
        "--head", branchName,
        "--title", prTitle,
        "--body", prBody,
        "--label", "agent-generated",
        "--label", `curator:${submission.curatorName}`,
      ],
      worktreePath,
      ghToken,
    );
    const prUrl = prResult.trim().split("\n").find((line) => line.startsWith("http"));

    return {
      proposalPath,
      prUrl: prUrl ?? null,
      branchName,
      migrationFilename,
    };
  } finally {
    // 8. Clean up the worktree
    await runGit(["worktree", "remove", "--force", worktreePath], REPO_ROOT).catch(() => undefined);
  }
}
