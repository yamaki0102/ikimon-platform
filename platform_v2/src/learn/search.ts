export type LearnEntryKind = "reading" | "term";
export type LearnSearchKind = "all" | LearnEntryKind;

export type LearnSearchState = {
  q: string;
  kind: LearnSearchKind;
};

export type LearnCatalogEntry = {
  /** Unprefixed registered route; the view adds the Japanese/base-path prefix. */
  path: string;
  kind: LearnEntryKind;
  title: string;
  summary: string;
  headings: string[];
  /** Alternative title/lead text from the same canonical page metadata. */
  searchAliases?: string[];
};

/**
 * No imports or outer-scope runtime dependencies: the rendered HTML uses this
 * same tested factory in the browser, without a second search implementation.
 */
export function createLearnSearch() {
  const maxQueryLength = 200;
  const normalizedEntries = new WeakMap<LearnCatalogEntry, string>();

  // Object methods keep the serialized factory independent of dev transpilers'
  // function-name helpers as well as the production compiler's output.
  const methods = {
    normalize(value: string): string {
      return value.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
    },

    cleanState(state: { q?: string; kind?: string | null }): LearnSearchState {
      const q = (state.q ?? "").slice(0, maxQueryLength).replace(/[\uD800-\uDBFF]$/u, "").trim();
      const kind = state.kind === "reading" || state.kind === "term" ? state.kind : "all";
      return { q, kind };
    },

    readState(search: string): LearnSearchState {
      const params = new URLSearchParams(search);
      return methods.cleanState({ q: params.get("q") ?? "", kind: params.get("kind") });
    },

    writeState(state: LearnSearchState): string {
      const clean = methods.cleanState(state);
      const params = new URLSearchParams();
      if (clean.q) params.set("q", clean.q);
      if (clean.kind !== "all") params.set("kind", clean.kind);
      const search = params.toString();
      return search ? `?${search}` : "";
    },

    search<T extends LearnCatalogEntry>(entries: readonly T[], state: LearnSearchState): T[] {
      const clean = methods.cleanState(state);
      const query = methods.normalize(clean.q);
      const tokens = query ? query.split(" ") : [];
      return entries.filter((entry) => {
        if (clean.kind !== "all" && entry.kind !== clean.kind) return false;
        if (tokens.length === 0) return true;
        let text = normalizedEntries.get(entry);
        if (text === undefined) {
          text = methods.normalize([entry.title, entry.summary, ...entry.headings, ...(entry.searchAliases ?? [])].join("\n"));
          normalizedEntries.set(entry, text);
        }
        // Treat every input as literal text, never as HTML or a regular expression.
        return tokens.every((token) => text!.includes(token));
      });
    },
  };

  return {
    maxQueryLength,
    normalize: methods.normalize,
    readState: methods.readState,
    writeState: methods.writeState,
    search: methods.search,
  };
}
