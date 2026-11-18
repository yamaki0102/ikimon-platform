// In-isolate cache for versioned original-UI reads.
//
// A version prefix is named after the hash of its whole manifest, so a manifest and the
// manifest-listed objects under it never change. Only objects whose bytes match the
// manifest sha256 are cached. Entries expire after a short TTL so that withdrawing an
// object from R2 still takes effect within minutes, and the cache is scoped to the
// bucket binding it was read from.

import type { R2ObjectBody } from "./core/env";

export const ORIGINAL_UI_CACHE_TTL_MS = 5 * 60_000;
export const ORIGINAL_UI_CACHE_MAX_OBJECT_BYTES = 1024 * 1024;
const MAX_TOTAL_OBJECT_BYTES = 24 * 1024 * 1024;
const MAX_MANIFESTS = 4;

export type OriginalUiManifestEntry = { versionPrefix: string; sha256: string };
type ManifestIndex = { expires: number; entries: Map<string, OriginalUiManifestEntry> };
type CachedObject = { expires: number; bytes: ArrayBuffer; contentType: string | undefined; sha256: string };
type BucketCache = { manifests: Map<string, ManifestIndex>; objects: Map<string, CachedObject>; bytes: number };

const CACHES = new WeakMap<object, BucketCache>();

function cacheFor(bucket: object): BucketCache {
  let cache = CACHES.get(bucket);
  if (!cache) {
    cache = { manifests: new Map(), objects: new Map(), bytes: 0 };
    CACHES.set(bucket, cache);
  }
  return cache;
}

export function indexOriginalUiManifest(items: unknown): Map<string, OriginalUiManifestEntry> {
  const entries = new Map<string, OriginalUiManifestEntry>();
  if (!Array.isArray(items)) return entries;
  for (const item of items as Array<{ key?: unknown; version_prefix?: unknown; sha256?: unknown } | null>) {
    const key = String(item?.key ?? "");
    if (!key || entries.has(key)) continue;
    const candidate = String(item?.version_prefix ?? "");
    const digest = String(item?.sha256 ?? "").toLowerCase();
    entries.set(key, {
      versionPrefix: /^original-ui\/versions\/[a-f0-9]{64}$/.test(candidate) ? candidate : "",
      sha256: /^[a-f0-9]{64}$/.test(digest) ? digest : "",
    });
  }
  return entries;
}

export function getCachedOriginalUiManifest(bucket: object, versionPrefix: string, now = Date.now()): Map<string, OriginalUiManifestEntry> | null {
  const cache = cacheFor(bucket);
  const hit = cache.manifests.get(versionPrefix);
  if (!hit) return null;
  cache.manifests.delete(versionPrefix);
  if (hit.expires <= now) return null;
  cache.manifests.set(versionPrefix, hit);
  return hit.entries;
}

export function storeOriginalUiManifest(bucket: object, versionPrefix: string, entries: Map<string, OriginalUiManifestEntry>, now = Date.now()): void {
  const cache = cacheFor(bucket);
  cache.manifests.delete(versionPrefix);
  cache.manifests.set(versionPrefix, { expires: now + ORIGINAL_UI_CACHE_TTL_MS, entries });
  while (cache.manifests.size > MAX_MANIFESTS) {
    const oldest = cache.manifests.keys().next().value as string;
    cache.manifests.delete(oldest);
  }
}

function objectFromBytes(key: string, bytes: ArrayBuffer, contentType: string | undefined, sha256: string): R2ObjectBody {
  return {
    key,
    size: bytes.byteLength,
    body: new Response(bytes.slice(0)).body,
    httpMetadata: contentType ? { contentType } : {},
    checksums: { sha256 },
  } as unknown as R2ObjectBody;
}

export function getCachedOriginalUiObject(bucket: object, key: string, now = Date.now()): R2ObjectBody | null {
  const cache = cacheFor(bucket);
  const hit = cache.objects.get(key);
  if (!hit) return null;
  cache.objects.delete(key);
  if (hit.expires <= now) {
    cache.bytes -= hit.bytes.byteLength;
    return null;
  }
  cache.objects.set(key, hit);
  return objectFromBytes(key, hit.bytes, hit.contentType, hit.sha256);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Buffers a small manifest-listed object, caches it only if its bytes match the manifest
// digest, and returns an equivalent object for the current request. Anything else is
// returned untouched.
export async function cacheVerifiedOriginalUiObject(
  bucket: object,
  key: string,
  object: R2ObjectBody | null,
  expectedSha256: string,
  now = Date.now(),
): Promise<R2ObjectBody | null> {
  if (!object?.body || !/^[a-f0-9]{64}$/.test(expectedSha256)) return object;
  const size = (object as { size?: unknown }).size;
  if (typeof size !== "number" || size > ORIGINAL_UI_CACHE_MAX_OBJECT_BYTES) return object;
  const bytes = await new Response(object.body).arrayBuffer();
  const contentType = object.httpMetadata?.contentType;
  const replacement = objectFromBytes(key, bytes, contentType, expectedSha256);
  if (bytes.byteLength > ORIGINAL_UI_CACHE_MAX_OBJECT_BYTES || await sha256Hex(bytes) !== expectedSha256) {
    (replacement as { checksums: unknown }).checksums = object.checksums;
    return replacement;
  }
  const cache = cacheFor(bucket);
  const previous = cache.objects.get(key);
  if (previous) {
    cache.objects.delete(key);
    cache.bytes -= previous.bytes.byteLength;
  }
  cache.objects.set(key, { expires: now + ORIGINAL_UI_CACHE_TTL_MS, bytes, contentType, sha256: expectedSha256 });
  cache.bytes += bytes.byteLength;
  for (const [oldestKey, oldest] of cache.objects) {
    if (cache.bytes <= MAX_TOTAL_OBJECT_BYTES) break;
    cache.objects.delete(oldestKey);
    cache.bytes -= oldest.bytes.byteLength;
  }
  return replacement;
}
