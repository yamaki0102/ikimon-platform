/** Navigation back to an existing records search, never a caller-supplied URL. */
export type RecordsDiscoveryContext = Readonly<{ view: "public" | "mine"; query: string }>;
type RecordsLang = "ja" | "en" | "es" | "pt-br";

export function recordsSearchQuery(value: string | null): string {
  return String(value ?? "").trim().slice(0, 80);
}

export function collectRecordsDiscoveryContext(params: URLSearchParams): RecordsDiscoveryContext | null {
  const view = params.get("records_view");
  if (view !== "public" && view !== "mine") return null;
  return { view, query: recordsSearchQuery(params.get("records_q")) };
}

export function recordsDiscoveryListHref(lang: RecordsLang, context: RecordsDiscoveryContext | null): string {
  const path = `/${lang}/records`;
  if (!context) return path;
  const params = new URLSearchParams({ view: context.view });
  const query = recordsSearchQuery(context.query);
  if (query) params.set("q", query);
  return `${path}?${params}`;
}

export function recordsDiscoveryDetailHref(recordId: string, lang: RecordsLang, context: RecordsDiscoveryContext | null): string {
  const path = `/${lang}/observations/${encodeURIComponent(recordId)}`;
  if (!context) return path;
  const params = new URLSearchParams({ records_view: context.view });
  const query = recordsSearchQuery(context.query);
  if (query) params.set("records_q", query);
  return `${path}?${params}`;
}
