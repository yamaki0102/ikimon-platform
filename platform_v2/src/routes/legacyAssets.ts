import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
const BLOCKED_PUBLIC_UPLOAD_EXTENSIONS = new Set([".svg", ".html", ".htm", ".xml", ".js", ".mjs"]);
const LOCAL_LANDING_ASSET_ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../assets");

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
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/ogg",
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

function allowPublicUploadPath(rel: string): boolean {
  if (!rel || rel.includes("..")) return false;
  const ext = path.extname(rel).toLowerCase();
  return !BLOCKED_PUBLIC_UPLOAD_EXTENSIONS.has(ext);
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
  if (!allowPublicUploadPath(rel)) return null;
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

async function renderMissingThumbnail(width: number, rel: string): Promise<{ data: Buffer; etag: string }> {
  const label = path.basename(rel).replace(/[<>&"]/g, "").slice(0, 42) || "media";
  const height = Math.max(144, Math.round(width * 0.75));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#ecfdf5"/>
        <stop offset="1" stop-color="#e0f2fe"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect x="18" y="18" width="${width - 36}" height="${height - 36}" rx="18" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="9 9" opacity=".72"/>
    <circle cx="${Math.round(width / 2)}" cy="${Math.round(height * 0.38)}" r="${Math.max(22, Math.round(width * 0.055))}" fill="#ffffff" opacity=".8"/>
    <path d="M${Math.round(width * 0.42)} ${Math.round(height * 0.62)}h${Math.round(width * 0.16)}l-${Math.round(width * 0.05)}-${Math.round(height * 0.10)}h-${Math.round(width * 0.06)}z" fill="#0f766e" opacity=".72"/>
    <text x="50%" y="${Math.round(height * 0.76)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(16, Math.round(width * 0.035))}" font-weight="700" fill="#334155">Media unavailable</text>
    <text x="50%" y="${Math.round(height * 0.86)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.max(11, Math.round(width * 0.022))}" fill="#64748b">${label}</text>
  </svg>`;
  const data = await sharp(Buffer.from(svg))
    .webp({ quality: 72, effort: 4 })
    .toBuffer();
  return {
    data,
    etag: '"' + createHash("sha1").update(data).digest("base64url") + '"',
  };
}

export async function registerLegacyAssetRoutes(app: FastifyInstance): Promise<void> {
  // Wildcard route for every path under /assets/*
  app.get<{ Params: { "*": string } }>("/assets/*", async (request, reply) => {
    const rel = "assets/" + (request.params["*"] ?? "");
    if (!allowPath(rel)) {
      reply.code(404).type("text/plain").send("not found");
      return;
    }
    const localFile = rel.startsWith("assets/img/landing/")
      ? await serveFileFromRoot(LOCAL_LANDING_ASSET_ROOT, rel.slice("assets/".length))
      : null;
    const file = localFile ?? await serveFileFromRoot(loadConfig().legacyPublicRoot, rel);
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
      const fallback = await renderMissingThumbnail(width, rel);
      reply
        .type("image/webp")
        .header("Cache-Control", "public, max-age=300")
        .header("ETag", fallback.etag)
        .send(fallback.data);
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
