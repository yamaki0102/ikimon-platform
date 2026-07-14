import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

const workerSourceUrls = [
  new URL("./index.ts", import.meta.url),
  new URL("./runtime.ts", import.meta.url),
];

export function readWorkerSourceSync(): string {
  return workerSourceUrls.map((url) => readFileSync(url, "utf8")).join("\n");
}

export async function readWorkerSource(): Promise<string> {
  return (await Promise.all(workerSourceUrls.map((url) => readFile(url, "utf8")))).join("\n");
}
