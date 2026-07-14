import { spawn } from "node:child_process";

const forwardedArgs = process.argv.slice(2);
const child = spawn(
  process.execPath,
  ["scripts/deploy-staging-guard.mjs", ...forwardedArgs],
  {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  },
);

let stdout = "";
let stderr = "";
const captureLimitBytes = 48 * 1024;

function appendTail(current, chunk) {
  const combined = current + chunk.toString();
  return combined.length > captureLimitBytes
    ? combined.slice(-captureLimitBytes)
    : combined;
}

child.stdout.on("data", (chunk) => {
  stdout = appendTail(stdout, chunk);
});

child.stderr.on("data", (chunk) => {
  stderr = appendTail(stderr, chunk);
});

child.on("error", (error) => {
  console.error(JSON.stringify({
    status: "staging_diagnostic_spawn_failed",
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});

child.on("close", (code) => {
  if (code === 0) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    process.exitCode = 0;
    return;
  }

  const combined = `${stdout}\n${stderr}`
    .replace(/(token|secret|password|authorization)\s*[:=]\s*[^\s"']+/gi, "$1=[REDACTED]")
    .replace(/[A-Za-z0-9+/=_-]{80,}/g, "[REDACTED_LONG_VALUE]");
  const lines = combined.split(/\r?\n/).filter(Boolean);
  const diagnosticTail = lines.slice(-120).join("\n").slice(-24000);

  console.error(JSON.stringify({
    status: "staging_diagnostic_failed",
    exitCode: code,
    diagnosticTail,
    personalData: "not intentionally stored",
  }, null, 2));
  process.exitCode = typeof code === "number" ? code : 1;
});
