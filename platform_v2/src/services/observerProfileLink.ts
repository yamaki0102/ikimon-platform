import { withBasePath } from "../httpBasePath.js";

export function buildObserverProfileHref(basePath: string, userId: string | null | undefined): string | null {
  if (!userId) return null;
  const encoded = encodeURIComponent(userId);
  if (userId.startsWith("guest_")) {
    return withBasePath(basePath, `/guest/${encoded}`);
  }
  return withBasePath(basePath, `/profile/${encoded}`);
}
