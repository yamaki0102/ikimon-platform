/** Shared anonymous credential primitive. A receipt ID is never an authorization token. */
export async function credentialDigest(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
}

export function randomCredential(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");
}

export async function guestCookieName(scope: string): Promise<string> {
  return "__Host-ikimon_evt_" + (await credentialDigest(scope)).slice(0, 16);
}

export function readOpaqueCookie(header: string | null, name: string): string | null {
  const matches = (header ?? "").split(";").map(part => part.trim()).filter(part => part.startsWith(name + "="));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : null;
}

export async function readGuestCredential(header: string | null, scope: string): Promise<string | null> {
  return readOpaqueCookie(header, await guestCookieName(scope));
}

export function privateCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`;
}
