import { normalizeOptionalText } from "./core/http";

export const PUBLIC_AREA_LABEL_MAX_LENGTH = 40;
export const PUBLIC_AREA_LABEL_SENSITIVE_PATTERN = /(学校|小学校|中学校|高校|高等学校|幼稚園|保育園|こども園|児童|自宅|住所|番地|丁目|号室|マンション|アパート|寮|private|school|home|residence|address|apartment|condo|nursery|kindergarten)/i;
export const PUBLIC_AREA_LABEL_ADDRESS_PATTERN = /[0-9]|[-.,;:/\@#]|[!?"$%&'()*+<=>\[\]^_`{|}~]/;

export function normalizeSafePublicAreaLabelCandidate(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  const normalized = text.normalize("NFKC").replace(/\s+/g, "");
  if (!normalized || normalized.length > PUBLIC_AREA_LABEL_MAX_LENGTH) return null;
  if (PUBLIC_AREA_LABEL_SENSITIVE_PATTERN.test(normalized)) return null;
  if (PUBLIC_AREA_LABEL_ADDRESS_PATTERN.test(normalized)) return null;
  return normalized;
}
