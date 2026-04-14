export type SiteLang = "ja" | "en" | "es" | "pt-BR";

export type LanguageOption = {
  code: SiteLang;
  label: string;
  shortLabel: string;
};

export const supportedLanguages: LanguageOption[] = [
  { code: "ja", label: "日本語", shortLabel: "JP" },
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "es", label: "Español", shortLabel: "ES" },
  { code: "pt-BR", label: "Português (Brasil)", shortLabel: "PT" },
];

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

export function detectLangFromUrl(url: string): SiteLang {
  const queryIndex = url.indexOf("?");
  if (queryIndex === -1) {
    return "ja";
  }
  const params = new URLSearchParams(url.slice(queryIndex + 1));
  return normalizeLang(params.get("lang"));
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

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);
  params.set("lang", lang);
  return `${path}?${params.toString()}${hash}`;
}
