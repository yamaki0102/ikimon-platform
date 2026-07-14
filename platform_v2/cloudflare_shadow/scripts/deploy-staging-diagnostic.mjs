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

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(chunk);
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write(chunk);
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
    process.exitCode = 0;
    return;
  }

  const combined = `${stdout}\n${stderr}`
    .replace(/(?:token|secret|password|authorization)\s*[:=]\s*[^\s"']+/gi, "$1=[REDACTED]")
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
