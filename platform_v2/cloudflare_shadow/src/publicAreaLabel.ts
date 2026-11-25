import { normalizeOptionalText } from "./core/http";

const PUBLIC_AREA_LABEL_MAX_LENGTH = 40;
const PUBLIC_AREA_LABEL_SENSITIVE_PATTERN = /(学校|小学校|中学校|高校|高等学校|幼稚園|保育園|こども園|児童|自宅|住所|番地|丁目|号室|マンション|アパート|寮|private|school|home|residence|address|apartment|condo|nursery|kindergarten)/i;
const PUBLIC_AREA_LABEL_ADDRESS_PATTERN = /[0-9]|[-.,;:/\\@#]|[!?"$%&'()*+<=>\[\]^_`{|}~]/;
const PUBLIC_STREAM_ALLOWED_LOCATION_PRECISIONS = new Set(["municipality", "mesh"]);

export type PublicSafetyContextRow = {
  audience_scope: string | null;
  public_precision: string | null;
  risk_lane: string | null;
};

export function publicSafetyDecisionForContext(context: PublicSafetyContextRow | null): { blocked: boolean; reason: string | null } {
  if (!context) return { blocked: false, reason: null };
  const riskLane = normalizeOptionalText(context.risk_lane) ?? "normal";
  if (riskLane !== "normal") return { blocked: true, reason: `risk_lane:${riskLane}` };
  const audienceScope = normalizeOptionalText(context.audience_scope);
  if (audienceScope && audienceScope !== "public") {
    return { blocked: true, reason: `audience_scope:${audienceScope}` };
  }
  const publicPrecision = normalizeOptionalText(context.public_precision);
  if (publicPrecision === "hidden" || publicPrecision === "exact_private") {
    return { blocked: true, reason: `public_precision:${publicPrecision}` };
  }
  if (!publicStreamAllowsLocationPrecision(publicPrecision)) {
    return { blocked: true, reason: `public_stream_precision:${publicPrecision}` };
  }
  return { blocked: false, reason: null };
}

export function normalizeSafePublicAreaLabelCandidate(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  const normalized = text.normalize("NFKC").replace(/\s+/g, "");
  if (!normalized || normalized.length > PUBLIC_AREA_LABEL_MAX_LENGTH) return null;
  if (PUBLIC_AREA_LABEL_SENSITIVE_PATTERN.test(normalized)) return null;
  if (PUBLIC_AREA_LABEL_ADDRESS_PATTERN.test(normalized)) return null;
  return normalized;
}

export function shouldCoarsenPublicAreaLabel(label: string): boolean {
  const normalized = label.normalize("NFKC").toLowerCase();
  return normalized.endsWith("村")
    || normalized.endsWith("mura")
    || normalized.endsWith("son")
    || normalized.endsWith("village");
}

export function resolveSafePublicAreaLabel(input: { municipality?: unknown; prefecture?: unknown }): string | null {
  const municipality = normalizeSafePublicAreaLabelCandidate(input.municipality);
  const prefecture = normalizeSafePublicAreaLabelCandidate(input.prefecture);
  if (municipality && !shouldCoarsenPublicAreaLabel(municipality)) return municipality;
  return prefecture;
}

export function publicStreamAllowsLocationPrecision(value: unknown): boolean {
  const precision = normalizeOptionalText(value);
  return !precision || PUBLIC_STREAM_ALLOWED_LOCATION_PRECISIONS.has(precision);
}
