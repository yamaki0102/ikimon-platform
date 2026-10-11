import {
  MUNICIPALITY_DIRECTORY_MAILBOX_SOURCES,
  MUNICIPALITY_DIRECTORY_ROWS,
  MUNICIPALITY_DIRECTORY_SOURCE_URLS,
} from "../content/municipalities20261012.js";

/** Snapshot date is Japan Standard Time; this is source review, not mailbox ownership. */
export const MUNICIPALITY_DIRECTORY_VERSION = "jlis-local-government-directory/2026-10-12";
const VERIFIED_AT = "2026-10-12";

export type MunicipalityDomainSource = Readonly<{
  domain: string;
  kind: "official-website" | "published-mailbox";
  sourceUrl: string;
}>;

export type Municipality = Readonly<{
  /** Six-digit J-LIS local-government code, including the check digit. */
  code: string;
  name: string;
  prefecture: string;
  kind: "prefecture" | "municipality";
  /** Normalized HTTPS origin of the official link listed by J-LIS. */
  website: string;
  /** Exact domains only. An empty list means no supported domain in this snapshot. */
  domains: readonly string[];
  sourceUrl: string;
  codeSourceUrl: string;
  verifiedAt: string;
  domainSources: readonly MunicipalityDomainSource[];
}>;

function isAsciiDomain(domain: string): boolean {
  if (domain.length === 0 || domain.length > 253 || !/^[a-z0-9.-]+$/.test(domain)) return false;
  const labels = domain.split(".");
  return labels.length > 1 && labels.every((label) =>
    label.length <= 63 && !label.startsWith("xn--") &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label));
}

function isLocalGovernmentCode(code: string): boolean {
  if (!/^[0-9]{6}$/.test(code) || code.length !== 6) return false;
  const sum = [...code.slice(0, 5)].reduce((total, digit, index) => total + Number(digit) * (6 - index), 0);
  const check = 11 - (sum % 11);
  return Number(code[5]) === check % 10;
}

function sourceAt(index: number, kind: "map-search" | "code-address"): string {
  const value = MUNICIPALITY_DIRECTORY_SOURCE_URLS[index];
  if (!Number.isInteger(index) || !value || !value.startsWith(`https://www.j-lis.go.jp/spd/${kind}/`)) {
    throw new Error("Invalid municipality directory provenance");
  }
  return value;
}

const municipalitiesByCode = new Map<string, Municipality>();
const municipalitiesByShortCode = new Map<string, Municipality>();
const domainOwners = new Map<string, string>();

/**
 * J-LIS public code/address and official-website tables, joined by exact
 * prefecture/name: 1,741 municipalities plus 47 prefectures. Designated-city
 * administrative wards use the parent city; Tokyo's 23 special wards remain
 * separate municipalities. No address supplied by an applicant is a source.
 *
 * The fixed dataset marks government-restricted domain families using J-LIS
 * and JPRS definitions. An official link permits that exact hostname and, only
 * for a leading `www.`, the hostname with that single prefix removed. Generic
 * hosting and custom domains stay discoverable but unsupported for email until
 * a fresh official page explicitly publishes the mailbox domain. This directory
 * does not discover mailboxes or infer suffix/subdomain authority at runtime.
 *
 * Coverage is of local-government identities, not every departmental mailbox.
 * Unsupported domains return false; there is no manual approval queue. Refresh
 * the versioned official sources to add aliases, then independently prove inbox
 * ownership with an expiring, single-use challenge before creating a session.
 * Email ownership alone never confers authority over all municipal/private data.
 */
export const MUNICIPALITIES: readonly Municipality[] = Object.freeze(MUNICIPALITY_DIRECTORY_ROWS.map((row) => {
  const [code, name, prefecture, host, websiteSourceIndex, codeSourceIndex, officialDomainCandidate] = row;
  if (!isLocalGovernmentCode(code) || !name || !prefecture || !isAsciiDomain(host) ||
      municipalitiesByCode.has(code) || municipalitiesByShortCode.has(code.slice(0, 5))) {
    throw new Error("Invalid or duplicate municipality directory identity");
  }
  const sourceUrl = sourceAt(websiteSourceIndex, "map-search");
  const codeSourceUrl = sourceAt(codeSourceIndex, "code-address");
  const domainSources: MunicipalityDomainSource[] = [];
  if (officialDomainCandidate) {
    for (const domain of new Set([host, host.replace(/^www\./, "")])) {
      domainSources.push(Object.freeze({ domain, kind: "official-website", sourceUrl }));
    }
  }
  for (const alias of MUNICIPALITY_DIRECTORY_MAILBOX_SOURCES) {
    if (alias.code !== code) continue;
    let aliasSource: URL;
    try { aliasSource = new URL(alias.sourceUrl); } catch { throw new Error("Invalid municipality mailbox source"); }
    // Aliases must come from the linked official site, not an applicant's URL.
    // No arbitrary parent or subdomain is inferred from either URL.
    if (!isAsciiDomain(alias.domain) || aliasSource.protocol !== "https:" || aliasSource.username ||
        aliasSource.password || aliasSource.port ||
        !new Set([host, host.replace(/^www\./, "")]).has(aliasSource.hostname)) {
      throw new Error("Invalid municipality mailbox source");
    }
    domainSources.push(Object.freeze({ domain: alias.domain, kind: "published-mailbox", sourceUrl: alias.sourceUrl }));
  }
  const domains = [...new Set(domainSources.map((source) => source.domain))];
  for (const domain of domains) {
    const existing = domainOwners.get(domain);
    if (existing && existing !== code) throw new Error("Conflicting municipality email domain");
    domainOwners.set(domain, code);
  }
  const municipality: Municipality = Object.freeze({
    code, name, prefecture,
    kind: code.slice(2, 5) === "000" ? "prefecture" : "municipality",
    website: `https://${host}/`, domains: Object.freeze(domains), sourceUrl,
    codeSourceUrl, verifiedAt: VERIFIED_AT, domainSources: Object.freeze(domainSources),
  });
  municipalitiesByCode.set(code, municipality);
  municipalitiesByShortCode.set(code.slice(0, 5), municipality);
  return municipality;
}));

if (MUNICIPALITY_DIRECTORY_MAILBOX_SOURCES.some((alias) => !municipalitiesByCode.has(alias.code))) {
  throw new Error("Unknown municipality mailbox identity");
}

/** Accept canonical six-digit codes or the exact five-digit code without check digit. */
export function findMunicipality(code: string): Municipality | null {
  if (typeof code !== "string" || !/^[0-9]{5,6}$/.test(code)) return null;
  return (code.length === 5 ? municipalitiesByShortCode.get(code) : municipalitiesByCode.get(code)) ?? null;
}

/**
 * Eligibility only; the caller must still verify ownership of the exact email.
 * ASCII dot-atom mailboxes are accepted. Quoted local parts, Unicode/IDN,
 * whitespace, controls, address literals and display-name syntax fail closed.
 */
export function matchMunicipalityEmail(code: string, email: string): boolean {
  const municipality = findMunicipality(code);
  if (!municipality || typeof email !== "string" || email.length > 254 || /[^\x21-\x7e]/.test(email)) return false;
  const parts = email.split("@");
  if (parts.length !== 2) return false;
  const [local, rawDomain] = parts;
  if (!local || !rawDomain || local.length > 64 || local.startsWith(".") || local.endsWith(".") ||
      local.includes("..") || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false;
  const domain = rawDomain.toLowerCase();
  return isAsciiDomain(domain) && municipality.domains.includes(domain);
}
