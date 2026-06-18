import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, mkdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const defaultWorkflow = "cloudflare-quick-preflight.yml";
const defaultArtifact = "cloudflare-production-preflight";
const defaultOutputDir = ".deploy";
const expectedFiles = [
  "production-preflight-latest.json",
  "wrangler-version-cache.json",
];
const allowedArgs = new Set([
  "--run-id",
  "--branch",
  "--workflow",
  "--artifact",
  "--output-dir",
  "--limit",
]);

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key.startsWith("--") || !allowedArgs.has(key)) {
    throw new Error(`Unknown argument: ${key}`);
  }
  if (!value || value.startsWith("--")) {
    throw new Error(`${key} requires a value.`);
  }
  args.set(key, value);
  index += 1;
}

const workflow = args.get("--workflow") ?? defaultWorkflow;
const artifact = args.get("--artifact") ?? defaultArtifact;
const outputDir = args.get("--output-dir") ?? defaultOutputDir;
const limit = Number(args.get("--limit") ?? "30");
if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  throw new Error("--limit must be an integer from 1 to 100.");
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolveRun, reject) => {
    const commandLine = [command, ...commandArgs].join(" ");
    const child = spawn(command, commandArgs, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      reject(new Error(`${commandLine} failed to start: ${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${commandLine} failed with exit code ${code}\n${stderr.trim()}`,
          ),
        );
      }
    });
  });
}

async function gitText(gitArgs) {
  const result = await run("git", gitArgs);
  return result.stdout.trim();
}

async function currentBranch() {
  const branch = await gitText(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch && branch !== "HEAD") return branch;
  return "";
}

async function resolveRunId({ headSha, branch }) {
  const explicitRunId = args.get("--run-id");
  if (explicitRunId) {
    const view = await run("gh", [
      "run",
      "view",
      explicitRunId,
      "--json",
      "conclusion,headSha,status,url,name",
    ]);
    const runInfo = JSON.parse(view.stdout);
    assertUsableRun(runInfo, explicitRunId, headSha);
    return {
      id: explicitRunId,
      url: runInfo.url,
      headSha: runInfo.headSha,
    };
  }

  if (!branch) {
    throw new Error("Detached HEAD detected. Pass --run-id or --branch.");
  }
  const list = await run("gh", [
    "run",
    "list",
    "--workflow",
    workflow,
    "--branch",
    branch,
    "--limit",
    String(limit),
    "--json",
    "databaseId,headSha,conclusion,status,createdAt,url,name",
  ]);
  const runs = JSON.parse(list.stdout);
  const match = runs.find(
    (item) => item.conclusion === "success" && item.headSha === headSha,
  );
  if (!match) {
    const latest = runs
      .slice(0, 5)
      .map(
        (item) =>
          `${item.databaseId}:${item.conclusion ?? item.status}:${item.headSha}`,
      )
      .join(", ");
    throw new Error(
      `No successful ${workflow} artifact run found for ${headSha} on ${branch}. Latest checked: ${latest || "none"}`,
    );
  }
  return {
    id: String(match.databaseId),
    url: match.url,
    headSha: match.headSha,
  };
}

function assertUsableRun(runInfo, runId, headSha) {
  if (runInfo.status !== "completed" || runInfo.conclusion !== "success") {
    throw new Error(
      `Run ${runId} is not a successful completed run: status=${runInfo.status}, conclusion=${runInfo.conclusion}`,
    );
  }
  if (runInfo.headSha !== headSha) {
    throw new Error(
      `Run ${runId} headSha ${runInfo.headSha} does not match current HEAD ${headSha}.`,
    );
  }
}

async function requireFile(path) {
  const info = await stat(path);
  if (!info.isFile() || info.size <= 0) {
    throw new Error(`Downloaded artifact file is empty or not a file: ${path}`);
  }
  return info.size;
}

async function hashFile(path) {
  const source = await readFile(path);
  return createHash("sha256").update(source).digest("hex");
}

const repoRoot = await gitText(["rev-parse", "--show-toplevel"]);
const headSha = await gitText(["rev-parse", "HEAD"]);
const branch = args.get("--branch") ?? (await currentBranch());
const resolvedOutputDir = resolve(outputDir);
const runInfo = await resolveRunId({ headSha, branch });
const tempDir = await mkdtemp(join(tmpdir(), "ikimon-cf-preflight-"));

try {
  await run("gh", [
    "run",
    "download",
    runInfo.id,
    "--name",
    artifact,
    "--dir",
    tempDir,
  ]);

  const sourcePaths = Object.fromEntries(
    expectedFiles.map((file) => [file, join(tempDir, file)]),
  );
  for (const file of expectedFiles) {
    await requireFile(sourcePaths[file]);
  }

  const report = JSON.parse(
    await readFile(sourcePaths["production-preflight-latest.json"], "utf8"),
  );
  if (report.ok !== true) {
    throw new Error("Preflight artifact report is not ok.");
  }
  if (report.gitHead !== headSha) {
    throw new Error(
      `Preflight artifact gitHead ${report.gitHead} does not match current HEAD ${headSha}.`,
    );
  }

  await mkdir(resolvedOutputDir, { recursive: true });
  const copied = [];
  for (const file of expectedFiles) {
    const target = join(resolvedOutputDir, file);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(sourcePaths[file], target);
    copied.push({
      file: basename(target),
      path: target,
      bytes: await requireFile(target),
      sha256: await hashFile(target),
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        workflow,
        artifact,
        runId: runInfo.id,
        runUrl: runInfo.url,
        branch,
        repoRoot,
        headSha,
        outputDir: resolvedOutputDir,
        copied,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
