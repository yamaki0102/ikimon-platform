import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { loadConfig } from "../config.js";
import { THUMBNAIL_PRESET_SIZES, type ThumbnailPreset } from "../services/thumbnailUrl.js";

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

const ALLOWED_PREFIXES = ["assets/", "favicon.ico", "favicon.svg"];

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
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".tflite": "application/octet-stream",
  ".task": "application/octet-stream",
  ".bin": "application/octet-stream",
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

async function serveUploadFile(rel: string): Promise<{ data: Buffer; mime: string } | null> {
  const config = loadConfig();
  const candidateRoots = [
    config.legacyUploadsRoot,
    path.join(config.legacyPublicRoot, "uploads"),
    path.resolve(process.cwd(), "../upload_package/public_html/uploads"),
  ];
  const seen = new Set<string>();
  for (const root of candidateRoots) {
    const resolved = path.resolve(root);
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    const file = await serveFileFromRoot(resolved, rel);
    if (file) return file;
  }
  return null;
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
  for (const name of ["favicon.ico", "favicon.svg"]) {
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
    const file = await serveUploadFile(rel);
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
    const file = await serveUploadFile(rel);
    if (!file) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    reply
      .type(file.mime)
      .header("Cache-Control", "public, max-age=86400")
      .send(file.data);
  });

  const thumbCache = new Map<string, { data: Buffer; etag: string }>();
  const THUMB_CACHE_MAX = 256;
  const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

  app.get<{ Params: { preset: string; "*": string } }>("/thumb/:preset/*", async (request, reply) => {
    const preset = request.params.preset as ThumbnailPreset;
    const rel = request.params["*"] ?? "";
    const width = THUMBNAIL_PRESET_SIZES[preset];
    if (!width) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    if (!rel || rel.includes("..") || !IMAGE_EXT_RE.test(rel)) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    const cacheKey = preset + ":" + rel;
    const cached = thumbCache.get(cacheKey);
    if (cached) {
      if (request.headers["if-none-match"] === cached.etag) {
        reply.code(304).send();
        return;
      }
      reply
        .type("image/webp")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("ETag", cached.etag)
        .send(cached.data);
      return;
    }
    const src = await serveUploadFile(rel);
    if (!src) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    try {
      const resizeOptions = preset === "sm"
        ? { width, height: width, fit: "cover" as const, withoutEnlargement: true }
        : { width, fit: "inside" as const, withoutEnlargement: true };
      const data = await sharp(src.data, { failOn: "none" })
        .rotate()
        .resize(resizeOptions)
        .webp({ quality: preset === "lg" ? 82 : 72, effort: 4 })
        .toBuffer();
      const etag = '"' + createHash("sha1").update(data).digest("base64url") + '"';
      if (thumbCache.size >= THUMB_CACHE_MAX) {
        const oldestKey = thumbCache.keys().next().value;
        if (oldestKey !== undefined) thumbCache.delete(oldestKey);
      }
      thumbCache.set(cacheKey, { data, etag });
      reply
        .type("image/webp")
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .header("ETag", etag)
        .send(data);
    } catch (err) {
      request.log.warn({ err, rel, preset }, "thumbnail generation failed");
      reply
        .type(src.mime)
        .header("Cache-Control", "public, max-age=3600")
        .send(src.data);
    }
  });
}
