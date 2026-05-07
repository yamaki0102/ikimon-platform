export type EntityKeyIssueKind =
  | "missing_entity_key"
  | "non_namespaced_entity_key"
  | "unstable_generated_certification_id";

export type EntityKeyAuditRow = {
  field_id?: string | null;
  source?: string | null;
  admin_level?: string | null;
  name?: string | null;
  certification_id?: string | null;
  entity_key?: string | null;
  owner_user_id?: string | null;
  valid_to?: string | null;
  payload?: Record<string, unknown> | null;
};

export type EntityKeyIssue = {
  kind: EntityKeyIssueKind;
  severity: "error" | "warning";
  message: string;
};

const PUBLIC_AREA_LEVELS = new Set([
  "admin_country",
  "admin_prefecture",
  "admin_municipality",
  "osm_park",
  "symbiosis",
  "tsunag",
  "school",
  "protected",
  "oecm",
  "nature_symbiosis_site",
  "protected_area",
]);

const STABLE_PROPERTY_KEYS = [
  "entity_key",
  "osm_entity_key",
  "wikidata",
  "wikidata_id",
  "wd_id",
  "geonames_id",
  "geonameid",
  "wof:id",
  "wof_id",
  "gadm_gid",
  "GID_0",
  "GID_1",
  "GID_2",
  "iso3166",
  "iso3166_1",
  "iso3166-1",
  "iso3166_2",
  "iso3166-2",
  "ISO3166-1",
  "ISO3166-2",
  "WDPAID",
  "wdpaid",
  "protectedplanet_id",
  "school_code",
  "SchoolCode",
  "学校コード",
  "P29_002",
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function compactKeyPart(value: unknown): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function normalizeEntityKey(value: unknown): string {
  return clean(value).replace(/\s+/g, "");
}

function valueFromProperties(props: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = clean(props[key]);
    if (value) return value;
  }
  return "";
}

export function entityKeyFromGeoProperties(props: Record<string, unknown> | null | undefined): string | null {
  if (!props) return null;

  const explicit = normalizeEntityKey(valueFromProperties(props, ["entity_key", "osm_entity_key"]));
  if (explicit) return explicit;

  const osmType = compactKeyPart(valueFromProperties(props, ["osm_type", "osm:type", "@type"]));
  const osmId = compactKeyPart(valueFromProperties(props, ["osm_id", "osm:id", "@id"]));
  if (osmId) {
    const atIdMatch = /^(node|way|relation)\/(\d+)$/.exec(osmId);
    if (atIdMatch) return `osm:${atIdMatch[1]}:${atIdMatch[2]}`;
    if (osmType && /^(node|way|relation)$/.test(osmType)) return `osm:${osmType}:${osmId}`;
  }

  const wikidata = normalizeEntityKey(valueFromProperties(props, ["wikidata", "wikidata_id", "wd_id"]));
  if (/^Q\d+$/i.test(wikidata)) return `wikidata:${wikidata.toUpperCase()}`;

  const geonames = compactKeyPart(valueFromProperties(props, ["geonames_id", "geonameid"]));
  if (geonames) return `geonames:${geonames}`;

  const wof = compactKeyPart(valueFromProperties(props, ["wof:id", "wof_id"]));
  if (wof) return `whosonfirst:${wof}`;

  const gadm = compactKeyPart(valueFromProperties(props, ["gadm_gid", "GID_2", "GID_1", "GID_0"]));
  if (gadm) return `gadm:${gadm}`;

  const iso = compactKeyPart(valueFromProperties(props, ["iso3166-2", "ISO3166-2", "iso3166_2", "iso3166-1", "ISO3166-1", "iso3166_1", "iso3166"]));
  if (iso) return `iso3166:${iso.toUpperCase()}`;

  const wdpa = compactKeyPart(valueFromProperties(props, ["WDPAID", "wdpaid", "protectedplanet_id"]));
  if (wdpa && wdpa !== "0") return `protectedplanet:${wdpa}`;

  const schoolCode = normalizeEntityKey(valueFromProperties(props, ["school_code", "SchoolCode", "SchoolCode ", "学校コード", "P29_002"]));
  if (schoolCode) return `mext_school:${schoolCode}`;

  return null;
}

export function defaultCertifiedEntityKey(input: {
  source?: string | null;
  certificationId?: string | null;
  entityKey?: string | null;
  payload?: Record<string, unknown> | null;
}): string {
  const explicit = normalizeEntityKey(input.entityKey);
  if (explicit) return explicit;

  const fromPayload = entityKeyFromGeoProperties(input.payload ?? null);
  if (fromPayload) return fromPayload;
  const rawProperties = input.payload?.raw_properties;
  if (rawProperties && typeof rawProperties === "object" && !Array.isArray(rawProperties)) {
    const fromRawProperties = entityKeyFromGeoProperties(rawProperties as Record<string, unknown>);
    if (fromRawProperties) return fromRawProperties;
  }

  const source = compactKeyPart(input.source);
  const certificationId = compactKeyPart(input.certificationId);
  if (source && certificationId) return `${source}:${certificationId}`;
  return "";
}

export function isLikelyGeneratedCertificationId(value: string | null | undefined): boolean {
  const normalized = clean(value);
  return /^(?:a10|a11|a12|a14|a15|generic)-.+-\d+$/i.test(normalized);
}

export function classifyEntityKeyIssues(row: EntityKeyAuditRow): EntityKeyIssue[] {
  const issues: EntityKeyIssue[] = [];
  const level = clean(row.admin_level || row.source);
  const source = clean(row.source);
  const entityKey = normalizeEntityKey(row.entity_key);
  const isCurrent = !clean(row.valid_to);
  const isPublicArea = PUBLIC_AREA_LEVELS.has(level) || PUBLIC_AREA_LEVELS.has(source);
  const isUserOwnedField = source === "user_defined" && Boolean(clean(row.owner_user_id));

  if (isCurrent && isPublicArea && !isUserOwnedField && !entityKey) {
    issues.push({
      kind: "missing_entity_key",
      severity: "error",
      message: "current public/admin area has no stable entity_key",
    });
  }

  if (entityKey && !entityKey.includes(":")) {
    issues.push({
      kind: "non_namespaced_entity_key",
      severity: "warning",
      message: "entity_key should use a source namespace such as osm:, wikidata:, geonames:, gadm:, iso3166:, protectedplanet:, or source:id",
    });
  }

  if (isCurrent && isPublicArea && isLikelyGeneratedCertificationId(row.certification_id)) {
    issues.push({
      kind: "unstable_generated_certification_id",
      severity: "warning",
      message: "certification_id looks file/index-generated; prefer an external stable ID for overseas and long-term imports",
    });
  }

  return issues;
}

export const ENTITY_KEY_STABLE_PROPERTY_KEYS = STABLE_PROPERTY_KEYS;
