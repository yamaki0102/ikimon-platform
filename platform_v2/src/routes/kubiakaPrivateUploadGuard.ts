import type { KubiakaDbQuery } from "./kubiakaFocusedExperience.js";

/**
 * The Fastify/PostgreSQL upload guard was retired with the VPS runtime. The
 * Cloudflare Worker owns the D1 owner/private scope and does not call this
 * adapter. Keeping a fail-closed export prevents accidental legacy reuse.
 */
export async function assertOwnedKubiakaPrivateUploadTarget(
  _query: KubiakaDbQuery,
  _recordId: string,
  _userId: string,
): Promise<void> {
  throw new Error("kubiaka_cloudflare_native_required");
}

export async function registerKubiakaPrivateUploadGuard(app: unknown): Promise<void> {
  void app;
}
