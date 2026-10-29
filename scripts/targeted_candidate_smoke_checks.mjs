export function validateHtmlPage(payload, { bodyMarker }) {
  const html = String(payload ?? "");
  const normalized = html.toLowerCase();
  if (!normalized.includes("<!doctype html") || !normalized.includes("<body")) {
    return "response is not a complete HTML document";
  }
  if (!html.includes(bodyMarker)) {
    return `HTML body marker mismatch: ${bodyMarker}`;
  }
  if (normalized.includes("html_not_materialized")) {
    return "response contains html_not_materialized";
  }
  return null;
}
