import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const workerSourcePaths = ["index.ts", "runtime.ts"].map((filename) =>
  path.join(process.cwd(), "cloudflare_shadow", "src", filename)
);

export function readCloudflareWorkerSourceSync(): string {
  return workerSourcePaths.map((filename) => readFileSync(filename, "utf8")).join("\n");
}

export async function readCloudflareWorkerSource(): Promise<string> {
  return (await Promise.all(workerSourcePaths.map((filename) => readFile(filename, "utf8")))).join("\n");
}
