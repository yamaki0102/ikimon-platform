import type { ExtractedFact } from "./types";
import { clean, decodeEntities, jstInstant, resolveUrl, sha256Hex } from "./util";

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  if (!m) return null;
  return decodeEntities(m[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")).trim();
}

function linkOf(block: string): string | null {
  const text = tag(block, "link");
  if (text) return text;
  const m = /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(block);
  return m ? decodeEntities(m[1]!) : null;
}

const DATE = "(\\d{4})[/.\\-年](\\d{1,2})[/.\\-月](\\d{1,2})日?";
const TIME = "(\\d{1,2}):(\\d{2})";
const WEEKDAY = "(?:\\s*(?:\\([^)]*\\)|（[^）]*）))?";

function plainText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n").replace(/<[^>]+>/g, "");
}

function parseWhen(text: string): { start: string; end: string | null; allDay: boolean } | null {
  const label = /(?:開催日時|日時|開催日)\s*[:：]\s*([^\n]{0,80})/.exec(text);
  const src = label ? label[1]! : "";
  const s = new RegExp(`${DATE}${WEEKDAY}(?:\\s*${TIME})?`).exec(src);
  if (!s) return null;
  const start = jstInstant(s[1]!, s[2]!, s[3]!, s[4], s[5]);
  const rest = src.slice(s.index + s[0].length);
  let end: string | null = null;
  const sep = /^\s*[～〜~－-]\s*(.*)$/.exec(rest);
  if (sep) {
    const e = new RegExp(`^(?:${DATE})?${WEEKDAY}\\s*(?:${TIME})?`).exec(sep[1]!);
    if (e && (e[1] || e[4])) {
      const [y, mo, d] = e[1] ? [e[1], e[2]!, e[3]!] : [s[1]!, s[2]!, s[3]!];
      end = jstInstant(y, mo, d, e[4], e[5]);
    }
  }
  return { start, end, allDay: s[4] === undefined };
}

function labeled(text: string, labels: string[]): string | null {
  const m = new RegExp(`(?:${labels.join("|")})\\s*[:：]\\s*([^\\n]{1,120})`).exec(text);
  return m ? clean(m[1]) : null;
}

export async function extractRss(xml: string, sourceId: string, baseUrl: string, fetchedAt: string): Promise<ExtractedFact[]> {
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  const re = /<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const block = m[2]!;
    const title = clean(tag(block, "title"));
    const url = resolveUrl(linkOf(block), baseUrl);
    if (title === null || url === null) continue;
    const desc = plainText(decodeEntities(tag(block, "description") ?? tag(block, "summary") ?? tag(block, "content") ?? ""));
    const when = parseWhen(desc);
    if (when === null) continue;
    const guid = clean(tag(block, "guid") ?? tag(block, "id"), 500);
    const externalRef = guid ?? url ?? `h:${(await sha256Hex(`${title}|${when.start}`)).slice(0, 24)}`;
    if (seen.has(externalRef)) continue;
    seen.add(externalRef);
    facts.push({
      kind: "event", source_id: sourceId, external_ref: externalRef, url, title,
      starts_at: when.start, ends_at: when.end, all_day: when.allDay,
      venue_name: labeled(desc, ["開催場所", "会場", "場所"]), venue_address: null, lat: null, lng: null,
      organizer_name: labeled(desc, ["主催者", "主催"]), fetched_at: fetchedAt,
    });
  }
  return facts;
}
