import { createHash } from "node:crypto";

export type CuratorSourceKind = "env_invasive_jp" | "iucn_redlist" | "openalex" | "stac_landuse" | "other";

export type CuratorSourceSnapshot = {
  sourceKind: CuratorSourceKind;
  sourceUrl: string;
  fetchedAtIso: string;
  contentSha256: string;
  contentBytes: number;
  storagePath: string;
  license: "gov-jp-open" | "cc-by-4.0" | "oa-license-verified" | "unknown";
  text: string;
};

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function fetchSourceSnapshot(input: {
  url: string;
  sourceKind: CuratorSourceKind;
  license: CuratorSourceSnapshot["license"];
  timeoutMs?: number;
}): Promise<CuratorSourceSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 30_000);
  try {
    const response = await fetch(input.url, {
      headers: { "user-agent": "ikimon-curator/7.2 (+https://ikimon.life)" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`source_fetch_failed:${response.status}`);
    }
    const text = await response.text();
    const contentSha256 = sha256Hex(text);
    return {
      sourceKind: input.sourceKind,
      sourceUrl: input.url,
      fetchedAtIso: new Date().toISOString(),
      contentSha256,
      contentBytes: Buffer.byteLength(text, "utf8"),
      storagePath: `curator://${input.sourceKind}/${contentSha256}.txt`,
      license: input.license,
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function chunkText(text: string, maxChars = 30_000): string[] {
  if (text.length <= maxChars) return [text];
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length; offset += maxChars) {
    chunks.push(text.slice(offset, offset + maxChars));
  }
  return chunks;
}
