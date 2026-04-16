import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadConfig } from "../config.js";

/**
 * Legacy asset pass-through.
 *
 * The SSR shell (siteShell.ts) still references `/assets/img/icon-192.png`,
 * `/favicon.ico`, etc. from the legacy PHP public_html tree. In production
 * those resolve via nginx static serving on top of PHP. In platform_v2's
 * Fastify-only setup they 404, which is why the brand logo disappeared in
 * the header/footer.
 *
 * This module serves a tiny allow-listed prefix of the legacy public root
 * (assets/, favicon files, robots.txt) directly from disk. Nothing outside
 * the allow-list is reachable — path components are rejected if they try
 * to escape the asset root.
 */

const ALLOWED_PREFIXES = ["assets/", "robots.txt", "favicon.ico", "favicon.svg"];

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function mimeFor(ext: string): string {
  return MIME[ext.toLowerCase()] ?? "application/octet-stream";
}

function allowPath(rel: string): boolean {
  if (!rel || rel.includes("..")) return false;
  return ALLOWED_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(prefix));
}

async function serveLegacyFile(rel: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!allowPath(rel)) return null;
  const config = loadConfig();
  const root = path.resolve(config.legacyPublicRoot);
  const full = path.resolve(root, rel);
  // Final guard: resolved path must stay inside the legacy public root.
  if (!full.startsWith(root + path.sep) && full !== root) return null;
  try {
    const data = await fs.readFile(full);
    return { data, mime: mimeFor(path.extname(full)) };
  } catch {
    return null;
  }
}

export async function registerLegacyAssetRoutes(app: FastifyInstance): Promise<void> {
  // Wildcard route for every path under /assets/*
  app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
    const rel = "assets/" + (request.params["*"] ?? "");
    const file = await serveLegacyFile(rel);
    if (!file) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    reply
      .type(file.mime)
      .header("Cache-Control", "public, max-age=86400")
      .send(file.data);
  });

  // Top-level singletons
  for (const name of ["favicon.ico", "favicon.svg", "robots.txt"]) {
    app.get("/" + name, async (_request, reply) => {
      const file = await serveLegacyFile(name);
      if (!file) {
        reply.code(404).type("text/plain").send("not found");
        return;
      }
      reply
        .type(file.mime)
        .header("Cache-Control", "public, max-age=86400")
        .send(file.data);
    });
  }
}
