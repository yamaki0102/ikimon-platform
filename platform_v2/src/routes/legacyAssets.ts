import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import path from "node:path";
import { loadConfig } from "../config.js";

/**
 * Legacy asset pass-through.
 *
 * The SSR shell and observation cards still reference legacy static files and
 * uploaded media via `/assets/...`, `/favicon.ico`, `/uploads/...`, etc. In
 * production those resolve via nginx static serving on top of PHP. In
 * platform_v2's Fastify-only setup they 404 unless we proxy them from disk.
 *
 * This module serves an allow-listed slice of the legacy public root plus the
 * public uploads root directly from disk. Nothing outside those roots is
 * reachable — path components are rejected if they try to escape.
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

async function serveFileFromRoot(rootDir: string, rel: string): Promise<{ data: Buffer; mime: string } | null> {
  if (!rel || rel.includes("..")) return null;
  const root = path.resolve(rootDir);
  const full = path.resolve(root, rel);
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
    if (!allowPath(rel)) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    const file = await serveFileFromRoot(loadConfig().legacyPublicRoot, rel);
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
      if (!allowPath(name)) {
        reply.code(404).type("text/plain").send("not found");
        return;
      }
      const file = await serveFileFromRoot(loadConfig().legacyPublicRoot, name);
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

  app.get<{ Params: { "*": string } }>("/uploads/*", async (request, reply) => {
    const rel = request.params["*"] ?? "";
    const file = await serveFileFromRoot(loadConfig().legacyUploadsRoot, rel);
    if (!file) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    reply
      .type(file.mime)
      .header("Cache-Control", "public, max-age=86400")
      .send(file.data);
  });

  // Some imported legacy rows still reference `data/uploads/...` even though
  // the actual public files live under the uploads root.
  app.get<{ Params: { "*": string } }>("/data/uploads/*", async (request, reply) => {
    const rel = request.params["*"] ?? "";
    const file = await serveFileFromRoot(loadConfig().legacyUploadsRoot, rel);
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
