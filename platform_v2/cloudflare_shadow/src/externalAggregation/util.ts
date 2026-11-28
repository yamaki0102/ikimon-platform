export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function safeChar(code: number): string {
  try { return String.fromCodePoint(code); } catch { return ""; }
}

export function clean(text: unknown, max = 300): string | null {
  if (typeof text !== "string") return null;
  const value = text.replace(/\s+/g, " ").trim().slice(0, max);
  return value === "" ? null : value;
}

export function resolveUrl(raw: unknown, base: string): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const url = new URL(raw.trim(), base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch { return null; }
}

const pad = (n: number | string) => String(n).padStart(2, "0");

export function jstInstant(y: string, mo: string, d: string, h?: string, mi?: string): string {
  const date = `${y}-${pad(mo)}-${pad(d)}`;
  return h === undefined ? date : `${date}T${pad(h)}:${pad(mi ?? "0")}:00+09:00`;
}

export function normalizeDateValue(raw: unknown): { value: string; allDay: boolean } | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  let m = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(text);
  if (m) return { value: jstInstant(m[1]!, m[2]!, m[3]!), allDay: true };
  m = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?[T\s]+(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(text);
  if (m) {
    if (m[6] === undefined) return { value: jstInstant(m[1]!, m[2]!, m[3]!, m[4], m[5]), allDay: false };
    const t = Date.parse(text.replace(/\s+/, "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    return Number.isNaN(t) ? null : { value: new Date(t).toISOString(), allDay: false };
  }
  return null;
}
