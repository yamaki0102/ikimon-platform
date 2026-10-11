import {
  findMunicipality,
  MUNICIPALITIES,
  type Municipality,
} from "../../src/services/municipalityDirectory";

export const MUNICIPAL_DOMAIN_EVIDENCE_LIMITS = Object.freeze({
  requests: 4,
  pageBytes: 200 * 1024,
  timeoutMilliseconds: 8000,
  anchorsPerPage: 1024,
});

export type OfficialMailboxDomainEvidence = Readonly<{
  domain: string;
  sourceUrl: string;
  verifiedAt: string;
}>;

const GENERIC_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "outlook.jp", "hotmail.co.jp", "yahoo.co.jp", "yahoo.com", "ymail.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com",
  "gmx.com", "mail.com", "fastmail.com", "zoho.com",
]);
const SHARED_HOSTING_SUFFIXES = [
  "github.io", "pages.dev", "workers.dev", "vercel.app", "netlify.app",
  "cloudfront.net", "azurewebsites.net", "web.app", "firebaseapp.com",
  "blogspot.com", "wordpress.com", "wixsite.com", "jimdosite.com",
  "weebly.com", "notion.site", "sites.google.com",
];
const GEOGRAPHIC_LABELS = new Set((
  "hokkaido aomori iwate miyagi akita yamagata fukushima ibaraki tochigi gunma " +
  "saitama chiba tokyo kanagawa niigata toyama ishikawa fukui yamanashi nagano " +
  "gifu shizuoka aichi mie shiga kyoto osaka hyogo nara wakayama tottori shimane " +
  "okayama hiroshima yamaguchi tokushima kagawa ehime kochi fukuoka saga nagasaki " +
  "kumamoto oita miyazaki kagoshima okinawa sapporo sendai yokohama kawasaki " +
  "sagamihara hamamatsu nagoya sakai kobe kitakyushu"
).split(" "));

function domainLabels(domain: string): string[] | null {
  if (!domain || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) return null;
  const labels = domain.split(".");
  if (labels.length < 2 || labels.some(label => label.length > 63 || label.startsWith("xn--") ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  // Reject address literals, all-numeric names and private/local namespaces.
  if (!/^[a-z]{2,}$/.test(labels.at(-1)!) ||
      ["localhost", "local", "internal", "test", "invalid", "example"].includes(labels.at(-1)!)) return null;
  return labels;
}

/** Same strict ASCII dot-atom subset as municipalityDirectory; no URL decoding. */
export function officialMailboxDomain(email: string): string | null {
  if (typeof email !== "string" || email.length > 254 || /[^\x21-\x7e]/.test(email)) return null;
  const parts = email.split("@");
  const local = parts[0];
  const domain = parts[1]?.toLowerCase();
  if (parts.length !== 2 || !local || !domain || local.length > 64 || local.startsWith(".") ||
      local.endsWith(".") || local.includes("..") || !/^[A-Za-z0-9!#$%&'*+/=?^_\x60{|}~.-]+$/.test(local)) return null;
  return domainLabels(domain) ? domain : null;
}

const normalizedSiteHost = (host: string): string => host.replace(/^www\./, "");
const isWithin = (host: string, suffix: string): boolean => host === suffix || host.endsWith("." + suffix);
function detachedNamespace(domain: string): boolean {
  return GENERIC_MAIL_DOMAINS.has(domain) ||
    SHARED_HOSTING_SUFFIXES.some(suffix => isWithin(domain, suffix)) ||
    /(?:^|\.)(?:ne|gr|co|ac|ed|ad)\.jp$/.test(domain);
}

// This is a conflict check over fixed official identities, not a suffix grant.
const knownOwners = new Map<string, string>();
const governmentLabelOwners = new Map<string, Set<string>>();
function governmentIdentity(domain: string): { kind: string; entity: string } | null {
  const labels = domainLabels(domain);
  if (!labels) return null;
  const lg = domain.match(/(?:^|\.)(city|town|vill|pref|metro)\.([a-z0-9-]+)\.lg\.jp$/);
  if (lg) return { kind: lg[1]!, entity: lg[2]! };
  if (labels.at(-1) !== "jp" || !GEOGRAPHIC_LABELS.has(labels.at(-2)!)) return null;
  if (labels.length >= 3 && ["city", "town", "vill", "pref", "metro"].includes(labels.at(-3)!)) {
    return { kind: labels.at(-3)!, entity: labels.at(-2)! };
  }
  if (labels.length >= 4 && ["city", "town", "vill"].includes(labels.at(-4)!)) {
    return { kind: labels.at(-4)!, entity: labels.at(-3)! };
  }
  return null;
}
for (const row of MUNICIPALITIES) {
  const site = new URL(row.website).hostname;
  for (const host of new Set([site, normalizedSiteHost(site), ...row.domains])) {
    knownOwners.set(host, row.code);
    const identity = governmentIdentity(host);
    if (!identity) continue;
    const key = identity.kind + ":" + identity.entity;
    const owners = governmentLabelOwners.get(key) ?? new Set<string>();
    owners.add(row.code); governmentLabelOwners.set(key, owners);
  }
}

function eligibleNamespace(municipality: Municipality, domain: string, host: string): boolean {
  if (detachedNamespace(domain)) return false;
  let exactOwner = false;
  for (let candidate = domain; candidate.includes("."); candidate = candidate.slice(candidate.indexOf(".") + 1)) {
    const owner = knownOwners.get(candidate);
    if (owner && owner !== municipality.code) return false;
    if (owner === municipality.code) exactOwner = true;
  }
  // A third-party company or generic mailbox published in a footer is not an
  // organizational domain. A dedicated site namespace or government-restricted
  // namespace still needs a literal mailbox on the municipality's own page.
  if (isWithin(domain, normalizedSiteHost(host))) return true;
  const identity = governmentIdentity(domain);
  if (!identity) return false;
  const owners = governmentLabelOwners.get(identity.kind + ":" + identity.entity);
  // A prefecture's unlisted .lg.jp alias on a city's contact page still belongs
  // to that prefecture. Recognize the fixed catalog identity across JP families.
  if (owners) return owners.has(municipality.code) && (owners.size === 1 || exactOwner);
  // A custom official website can publish a government-domain alias only when
  // its entity label also occurs as a complete label/token in that fixed host.
  // Unknown or ambiguous government names are not upgraded merely by a mailto.
  const expectedKind = municipality.kind === "prefecture" ? (municipality.name === "東京都" ? "metro" : "pref")
    : municipality.name.endsWith("町") ? "town" : municipality.name.endsWith("村") ? "vill" : "city";
  const hostTokens = normalizedSiteHost(host).split(/[.-]/);
  return identity.kind === expectedKind && identity.entity.length >= 3 && hostTokens.includes(identity.entity);
}

function safeOfficialUrl(raw: string, base: URL, knownHosts: ReadonlySet<string>): URL | null {
  if (!raw || raw.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(raw)) return null;
  let url: URL;
  try { url = new URL(raw, base); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password ||
      url.port || !domainLabels(url.hostname) || !knownHosts.has(url.hostname)) return null;
  // Source-provided HTTP links may only be upgraded, never fetched over HTTP.
  url.protocol = "https:";
  url.hash = "";
  return url;
}

type Anchor = { href: string; label: string };
type Tag = { name: string; closing: boolean; end: number; attributes: Map<string, string> };
function decodeAttribute(value: string): string {
  const names: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", colon: ":", commat: "@", period: "." };
  return value.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt|colon|commat|period);/gi, (whole, entity: string) => {
    if (!entity.startsWith("#")) return names[entity.toLowerCase()] ?? whole;
    const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
    return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
      ? String.fromCodePoint(code) : "\uFFFD";
  });
}

// Bounded tokenizer for real anchor attributes. It does not execute scripts,
// parse text as links, honor external base URLs, or inspect embedded documents.
// Ambiguous/malformed markup fails closed instead of a regex matching a mailto
// string inside another attribute, a comment, JavaScript or an SVG namespace.
function readTag(html: string, start: number): Tag | null {
  let end = start + 1;
  let quote = "";
  for (; end < html.length && end - start <= 8192; end++) {
    const char = html[end]!;
    if (quote) { if (char === quote) quote = ""; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === ">") break;
    if (char === "<") return null;
  }
  if (end >= html.length || end - start > 8192 || quote) return null;
  const body = html.slice(start + 1, end);
  const head = body.match(/^(\/?)([A-Za-z][A-Za-z0-9:-]*)/);
  if (!head) return { name: "", closing: false, end: end + 1, attributes: new Map() };
  const attributes = new Map<string, string>();
  let offset = head[0].length;
  while (offset < body.length) {
    const rest = body.slice(offset);
    if (/^\s*\/?\s*$/.test(rest)) break;
    const attribute = rest.match(/^\s+([^\s"'<>\/=\x00-\x1f]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\x60]+)))?/);
    if (!attribute) return null;
    const name = attribute[1]!.toLowerCase();
    if (attributes.has(name)) return null;
    attributes.set(name, decodeAttribute(attribute[2] ?? attribute[3] ?? attribute[4] ?? ""));
    offset += attribute[0].length;
  }
  return { name: head[2]!.toLowerCase(), closing: head[1] === "/", end: end + 1, attributes };
}

function anchorsIn(html: string): Anchor[] | null {
  const anchors: Anchor[] = [];
  const lower = html.toLowerCase();
  const blocked: string[] = [];
  let offset = 0;
  while (offset < html.length) {
    const start = html.indexOf("<", offset);
    if (start < 0) break;
    if (html.startsWith("<!--", start)) {
      const end = html.indexOf("-->", start + 4);
      if (end < 0) return null;
      offset = end + 3; continue;
    }
    const tag = readTag(html, start);
    if (!tag) return null;
    offset = tag.end;
    if (!tag.closing && tag.name === "plaintext") break;
    if (!tag.closing && ["script", "style", "title", "textarea", "xmp", "iframe", "noembed", "noframes", "noscript"].includes(tag.name)) {
      const close = new RegExp("</" + tag.name + "\\s*>", "g");
      close.lastIndex = offset;
      const match = close.exec(lower);
      if (!match) return null;
      offset = close.lastIndex; continue;
    }
    if (["template", "svg", "math"].includes(tag.name)) {
      if (tag.closing) { if (blocked.at(-1) === tag.name) blocked.pop(); }
      else blocked.push(tag.name);
      continue;
    }
    if (blocked.length || tag.closing || tag.name !== "a") continue;
    const href = tag.attributes.get("href");
    if (!href || href.length > 2048) continue;
    const end = lower.indexOf("</a", offset);
    const label = html.slice(offset, end < 0 ? offset : Math.min(end, offset + 512)).replace(/<[^>]*>/g, " ");
    anchors.push({ href, label: [tag.attributes.get("title") ?? "", tag.attributes.get("aria-label") ?? "", label].join(" ") });
    if (anchors.length >= MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.anchorsPerPage) break;
  }
  return blocked.length ? null : anchors;
}

function contactScore(anchor: Anchor): number {
  const value = anchor.label + " " + anchor.href;
  if (/(?:問い合わせ|問合せ|お問合|連絡先|contact|inquir|toiawase|otoiawase)/i.test(value)) return 100;
  if (/(?:組織|部署|担当課|機構|soshiki|sosiki|organi[sz]|department|section)/i.test(value)) return 80;
  if (/(?:市役所|役場|県庁|概要|行政|庁舎|about|yakuba|shisei|chosei|sonsei|kensei)/i.test(value)) return 30;
  return 0;
}

function cancelBody(response: Response): void {
  if (response.body) void response.body.cancel().catch(() => undefined);
}

async function readHtml(response: Response, signal: AbortSignal): Promise<string | null> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/.test(contentType) || !response.body) { cancelBody(response); return null; }
  const advertised = response.headers.get("content-length");
  if (advertised && (!/^[0-9]+$/.test(advertised) || Number(advertised) > MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.pageBytes)) {
    cancelBody(response); return null;
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (!signal.aborted) {
      const part = await reader.read();
      if (signal.aborted) return null;
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.pageBytes) { cancel(); return null; }
      chunks.push(part.value);
    }
    if (signal.aborted) return null;
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength; }
    // ASCII mailto/path bytes remain literal; invalid UTF-8 cannot create an
    // ASCII mailbox. Unsupported legacy obfuscation simply yields no evidence.
    return new TextDecoder("utf-8").decode(bytes);
  } catch { return null; }
  finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
}

/**
 * Resolve a published exact mailbox domain without accepting applicant URLs.
 * At most four HTTPS GETs (redirects included), 200 KiB per response and eight
 * seconds total. No JS, image, iframe, cookie, credential or applicant email is
 * sent to the publisher. Only contact/organization links on the catalog host or
 * its normal www equivalent are followed. Shared/detached mailbox namespaces
 * and domains already belonging to another catalog authority are rejected.
 *
 * This is evidence of official publication, not proof of mailbox ownership or
 * authority to represent the entire municipality. Callers must rate-limit before
 * retrieval, cache briefly with directory version/source/expiry, then issue a
 * single-use inbox challenge. Missing or ambiguous evidence returns null.
 */
export async function resolveOfficialMailboxDomain(
  municipality: Municipality,
  email: string,
  fetcher: typeof fetch = fetch,
): Promise<OfficialMailboxDomainEvidence | null> {
  const canonical = municipality && findMunicipality(municipality.code);
  const domain = officialMailboxDomain(email);
  if (!canonical || !domain || canonical.website !== municipality.website) return null;
  const start = new URL(canonical.website);
  const host = start.hostname;
  if (start.protocol !== "https:" || start.username || start.password || start.port ||
      !domainLabels(host) || SHARED_HOSTING_SUFFIXES.some(suffix => isWithin(host, suffix)) ||
      !eligibleNamespace(canonical, domain, host)) return null;
  const plainHost = normalizedSiteHost(host);
  const hosts = new Set([host, plainHost, "www." + plainHost]);
  const controller = new AbortController();
  const queue: { url: URL; score: number }[] = [{ url: start, score: 1000 }];
  const visited = new Set<string>();
  let requests = 0;
  const discover = async (): Promise<OfficialMailboxDomainEvidence | null> => {
    while (queue.length && requests < MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.requests && !controller.signal.aborted) {
      queue.sort((a, b) => b.score - a.score);
      const current = queue.shift()!.url;
      if (visited.has(current.href)) continue;
      visited.add(current.href);
      requests++;
      const response = await fetcher(current.href, {
        method: "GET", redirect: "manual", credentials: "omit", referrerPolicy: "no-referrer",
        signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml;q=0.8", "accept-language": "ja" },
      });
      if (controller.signal.aborted) { cancelBody(response); return null; }
      // A fetch adapter must not have followed redirects behind this boundary.
      if (response.redirected || (response.url && response.url !== current.href)) { cancelBody(response); return null; }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        cancelBody(response);
        const target = safeOfficialUrl(response.headers.get("location") ?? "", current, hosts);
        if (!target) return null;
        queue.unshift({ url: target, score: 2000 });
        continue;
      }
      if (response.status !== 200) { cancelBody(response); continue; }
      const html = await readHtml(response, controller.signal);
      if (html === null || controller.signal.aborted) continue;
      const anchors = anchorsIn(html);
      if (!anchors) continue;
      for (const anchor of anchors) {
        if (!/^mailto:/i.test(anchor.href)) continue;
        const mailbox = anchor.href.slice(7).split("?", 1)[0]!;
        if (officialMailboxDomain(mailbox) === domain) {
          return { domain, sourceUrl: current.href, verifiedAt: new Date().toISOString() };
        }
      }
      for (const anchor of anchors) {
        const score = contactScore(anchor);
        if (!score) continue;
        const target = safeOfficialUrl(anchor.href, current, hosts);
        if (target && !visited.has(target.href) && !queue.some(item => item.url.href === target.href)) queue.push({ url: target, score });
      }
      // Keep only the bounded number of useful next pages, not the whole site.
      queue.sort((a, b) => b.score - a.score);
      queue.splice(MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.requests - requests);
    }
    return null;
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => { controller.abort(); resolve(null); }, MUNICIPAL_DOMAIN_EVIDENCE_LIMITS.timeoutMilliseconds);
  });
  try { return await Promise.race([discover().catch(() => null), timeout]); }
  finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); }
}
