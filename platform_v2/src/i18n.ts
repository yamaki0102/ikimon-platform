export type SiteLang = "ja" | "en" | "es" | "pt-BR";

export type LanguageOption = {
  code: SiteLang;
  label: string;
  shortLabel: string;
  urlSegment: string;
};

export const supportedLanguages: LanguageOption[] = [
  { code: "ja", label: "日本語", shortLabel: "JP", urlSegment: "ja" },
  { code: "en", label: "English", shortLabel: "EN", urlSegment: "en" },
  { code: "es", label: "Español", shortLabel: "ES", urlSegment: "es" },
  { code: "pt-BR", label: "Português (Brasil)", shortLabel: "PT", urlSegment: "pt-br" },
];

const languageByUrlSegment = new Map(supportedLanguages.map((language) => [language.urlSegment, language.code] as const));

export function normalizeLang(input?: string | null): SiteLang {
  if (!input) {
    return "ja";
  }

  const value = String(input).trim();
  if (value === "pt" || value.toLowerCase() === "pt-br") {
    return "pt-BR";
  }
  if (value === "ja" || value === "en" || value === "es" || value === "pt-BR") {
    return value;
  }
  return "ja";
}

export function langToUrlSegment(lang: SiteLang): string {
  return supportedLanguages.find((language) => language.code === lang)?.urlSegment ?? "ja";
}

export function langFromBrowserLocale(locale: string | null | undefined): SiteLang {
  if (!locale) {
    return "ja";
  }
  const value = String(locale).trim().toLowerCase();
  if (!value) {
    return "ja";
  }
  if (value === "pt" || value.startsWith("pt-")) {
    return "pt-BR";
  }
  if (value.startsWith("en")) {
    return "en";
  }
  if (value.startsWith("es")) {
    return "es";
  }
  return "ja";
}

export function isSupportedLang(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const raw = String(value).trim();
  if (!raw) {
    return false;
  }
  if (raw === "pt" || raw.toLowerCase() === "pt-br") {
    return true;
  }
  return raw === "ja" || raw === "en" || raw === "es" || raw === "pt-BR";
}

function splitUrlParts(url: string): { path: string; query: string; hash: string } {
  const hashIndex = url.indexOf("#");
  const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const queryIndex = withoutHash.indexOf("?");
  return {
    path: queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash,
    query: queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "",
    hash,
  };
}

export function langFromPathPrefix(pathname: string): SiteLang | null {
  const match = pathname.match(/^\/([^/?#]+)(?:\/|$)/);
  const segment = match?.[1];
  if (!segment) {
    return null;
  }
  return languageByUrlSegment.get(segment.toLowerCase()) ?? null;
}

export function stripLangPathPrefix(pathname: string): string {
  const lang = langFromPathPrefix(pathname);
  if (!lang) {
    return pathname || "/";
  }
  const segment = langToUrlSegment(lang);
  const stripped = pathname.slice(segment.length + 1);
  if (!stripped) {
    return "/";
  }
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export function detectLangFromUrl(url: string): SiteLang {
  const { path, query } = splitUrlParts(url);
  const pathLang = langFromPathPrefix(path);
  if (pathLang) {
    return pathLang;
  }
  const params = new URLSearchParams(query);
  return normalizeLang(params.get("lang"));
}

export function rewriteLangPrefixToQuery(url: string): string {
  const { path, query } = splitUrlParts(url || "/");
  const lang = langFromPathPrefix(path);
  if (!lang) {
    return url || "/";
  }
  const strippedPath = stripLangPathPrefix(path);
  const params = new URLSearchParams(query);
  params.set("lang", lang);
  const rewrittenQuery = params.toString();
  return `${strippedPath}${rewrittenQuery ? `?${rewrittenQuery}` : ""}`;
}

export function appendLangToHref(href: string, lang: SiteLang): string {
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  ) {
    return href;
  }

  const { path, query, hash } = splitUrlParts(href);
  const params = new URLSearchParams(query);
  params.delete("lang");
  const cleanPath = stripLangPathPrefix(path || "/");
  if (!cleanPath.startsWith("/")) {
    params.set("lang", lang);
    return `${cleanPath}?${params.toString()}${hash}`;
  }
  const localizedPath = cleanPath === "/"
    ? `/${langToUrlSegment(lang)}/`
    : `/${langToUrlSegment(lang)}${cleanPath}`;
  const rewrittenQuery = params.toString();
  return `${localizedPath}${rewrittenQuery ? `?${rewrittenQuery}` : ""}${hash}`;
}
