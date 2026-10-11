import { appendLangToHref } from "../i18n.js";
import { withBasePath } from "../httpBasePath.js";
import { escapeHtml } from "../ui/siteShell.js";
import type { LearnCatalogEntry } from "./catalog.js";
import { createLearnSearch } from "./search.js";

/** Scoped to the Japanese reading catalogue; the shared shell owns its tokens. */
export const LEARN_CATALOG_STYLES = `
.learn-catalog { min-width: 0; margin: 0 0 32px; }
.learn-catalog [hidden] { display: none !important; }
.is-learn-hub:has(.learn-catalog[data-learn-active="true"]) .doc-sidebar { display: none; }
.learn-catalog .learn-catalog-form { display: grid; gap: 16px; margin: 0 0 24px; }
.learn-catalog .learn-catalog-label { display: block; margin: 0 0 8px; font-size: 1rem; font-weight: 700; color: var(--ink); }
.learn-catalog .learn-catalog-search { display: flex; gap: 8px; min-width: 0; }
.learn-catalog input[type="search"] { flex: 1; min-width: 0; width: 100%; min-height: 48px; padding: 10px 12px; border: 1px solid var(--zukan-border-control); border-radius: var(--zukan-radius-control); background: var(--surface); color: var(--ink); font: inherit; font-size: 1rem; }
.learn-catalog .learn-catalog-submit { flex: none; min-width: 64px; min-height: 48px; padding: 10px 16px; border: 1px solid var(--accent); border-radius: var(--zukan-radius-control); background: var(--accent); color: #fff; font: inherit; font-size: 1rem; font-weight: 700; cursor: pointer; }
.learn-catalog .learn-catalog-submit:hover { background: var(--accent-hover); }
.learn-catalog .learn-catalog-hint { margin: 8px 0 0; color: var(--muted); font-size: .875rem; line-height: 1.7; }
.learn-catalog .learn-catalog-filters { display: flex; flex-wrap: wrap; gap: 4px 12px; min-width: 0; margin: 0; padding: 0; border: 0; }
.learn-catalog .learn-catalog-filters legend { margin: 0 0 4px; padding: 0; font-size: .875rem; color: var(--muted); }
.learn-catalog .learn-catalog-filter { display: inline-flex; gap: 8px; align-items: center; min-height: 44px; padding: 0 8px; border-radius: var(--zukan-radius-control); color: var(--ink); font-size: 1rem; cursor: pointer; }
.learn-catalog .learn-catalog-filter:has(input:checked) { background: var(--zukan-surface-subtle); font-weight: 700; }
.learn-catalog .learn-catalog-filter input { width: 18px; height: 18px; margin: 0; accent-color: var(--accent); }
.learn-catalog .learn-catalog-filter:has(input:focus-visible) { outline: 2px solid var(--zukan-focus-outline); outline-offset: 2px; box-shadow: 0 0 0 4px var(--zukan-focus-yellow-300); }
.learn-catalog .learn-catalog-state { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; margin: 0 0 12px; }
.learn-catalog .learn-catalog-status { margin: 0; font-size: 1rem; color: var(--muted); }
.learn-catalog .learn-catalog-clear { display: inline-flex; align-items: center; min-height: 44px; font-size: 1rem; }
.learn-catalog .learn-catalog-results { margin: 0 0 32px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.learn-catalog .learn-catalog-results > summary { min-height: 48px; padding: 12px 0; color: var(--ink); font-size: 1rem; font-weight: 700; cursor: pointer; }
.learn-catalog .learn-catalog-results > summary:focus-visible { outline: 2px solid var(--zukan-focus-outline); outline-offset: 2px; box-shadow: 0 0 0 4px var(--zukan-focus-yellow-300); }
.learn-catalog .learn-catalog-list { display: block; margin: 0; padding: 0; list-style: none; }
.learn-catalog .learn-catalog-list > li { margin: 0; padding: 0; border-top: 1px solid var(--border); }
.learn-catalog .learn-catalog-link { display: grid; gap: 4px; min-height: 44px; padding: 16px 0; font-weight: 400; text-decoration: none; overflow-wrap: anywhere; }
.learn-catalog .learn-catalog-link strong { color: var(--zukan-link); font-size: 1.0625rem; font-weight: 700; line-height: 1.6; text-decoration: underline; text-underline-offset: 3px; }
.learn-catalog .learn-catalog-link:visited strong { color: var(--zukan-link-visited); }
.learn-catalog .learn-catalog-kind { color: var(--muted); font-size: .875rem; line-height: 1.5; }
.learn-catalog .learn-catalog-summary { color: var(--ink); font-size: 1rem; line-height: 1.7; }
.learn-catalog .learn-catalog-empty { padding: 16px 0 24px; }
.learn-catalog .learn-catalog-empty p { margin: 0 0 8px; font-size: 1rem; }
`;

type LearnSearch = ReturnType<typeof createLearnSearch>;

/** No network, storage, HTML insertion, or dependency on the surrounding navigation. */
function mountLearnCatalog(root: HTMLElement, search: LearnSearch): void {
  const form = root.querySelector<HTMLFormElement>("[data-learn-form]");
  const input = root.querySelector<HTMLInputElement>("#learn-query");
  const data = root.querySelector<HTMLScriptElement>("[data-learn-data]");
  const results = root.querySelector<HTMLDetailsElement>("[data-learn-results]");
  const summary = root.querySelector<HTMLElement>("[data-learn-summary]");
  const status = root.querySelector<HTMLElement>("[data-learn-status]");
  const empty = root.querySelector<HTMLElement>("[data-learn-empty]");
  const themes = root.querySelector<HTMLElement>("[data-learn-themes]");
  const clear = root.querySelector<HTMLAnchorElement>("[data-learn-clear]");
  if (!form || !input || !data || !results || !summary || !status || !empty || !themes || !clear) return;

  try {
    const entries = JSON.parse(data.textContent || "[]") as LearnCatalogEntry[];
    const rows = Array.from(root.querySelectorAll<HTMLElement>("[data-learn-entry]"));
    const filters = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="kind"]'));
    const readingCount = entries.filter((entry) => entry.kind === "reading").length;
    let composing = false;
    const controller = {
      apply(state: ReturnType<LearnSearch["readState"]>, push: boolean): void {
        const canonical = search.readState(search.writeState(state));
        const matches = search.search(entries, canonical);
        const paths = new Set(matches.map((entry) => entry.path));
        const active = Boolean(canonical.q) || canonical.kind !== "all";
        root.dataset.learnActive = String(active);
        for (const row of rows) row.hidden = !paths.has(row.dataset.learnEntry || "");
        input.value = canonical.q;
        for (const filter of filters) filter.checked = filter.value === canonical.kind;
        results.open = active;
        themes.hidden = active;
        empty.hidden = matches.length !== 0;
        clear.hidden = !active;
        summary.textContent = active
          ? `検索結果（${matches.length}件）`
          : `すべての記事・用語（${entries.length}件）`;
        status.textContent = active
          ? `検索結果 ${matches.length}件 / 全${entries.length}件`
          : `全${entries.length}件（読みもの${readingCount}件・用語${entries.length - readingCount}件）`;
        if (push) {
          const next = window.location.pathname + search.writeState(canonical) + window.location.hash;
          if (next !== window.location.pathname + window.location.search + window.location.hash) {
            window.history.pushState(null, "", next);
          }
        }
      },
      submit(): void {
        const selected = filters.find((filter) => filter.checked)?.value || "all";
        controller.apply(search.readState(new URLSearchParams({ q: input.value, kind: selected }).toString()), true);
      },
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!composing) controller.submit();
    });
    input.addEventListener("compositionstart", () => { composing = true; });
    input.addEventListener("compositionend", () => { composing = false; });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.isComposing || composing || event.keyCode === 229)) event.preventDefault();
    });
    form.addEventListener("change", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "kind" && !composing) controller.submit();
    });
    clear.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      controller.apply(search.readState(""), true);
      input.focus({ preventScroll: true });
    });
    window.addEventListener("popstate", () => controller.apply(search.readState(window.location.search), false));
    window.addEventListener("pageshow", (event) => {
      // Initial mount restores the URL before the form becomes usable. A late
      // initial pageshow must not overwrite a draft while resources finish loading.
      if (event.persisted) controller.apply(search.readState(window.location.search), false);
    });
    controller.apply(search.readState(window.location.search), false);
    form.hidden = false;
    root.dataset.learnReady = "true";
  } catch {
    // The server-rendered links remain a usable catalogue if enhancement is unavailable.
    results.open = true;
    status.textContent = "検索を読み込めませんでした。下の目録から記事を選べます。";
  }
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

export function renderLearnCatalog(basePath: string, entries: LearnCatalogEntry[], themeHtml: string): string {
  const action = appendLangToHref(withBasePath(basePath, "/learn"), "ja");
  const readingCount = entries.filter((entry) => entry.kind === "reading").length;
  const maxQueryLength = createLearnSearch().maxQueryLength;
  const items = entries.map((entry) => `<li data-learn-entry="${escapeHtml(entry.path)}">
    <a class="learn-catalog-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, entry.path), "ja"))}">
      <span class="learn-catalog-kind">${entry.kind === "term" ? "用語" : "読みもの"}</span>
      <strong>${escapeHtml(entry.title)}</strong>
      <span class="learn-catalog-summary">${escapeHtml(entry.summary)}</span>
    </a>
  </li>`).join("");

  return `<section class="learn-catalog" data-learn-catalog aria-label="読みもの・用語を探す">
    <form class="learn-catalog-form" data-learn-form role="search" aria-label="読みもの・用語の検索" action="${escapeHtml(action)}" method="get" hidden>
      <div>
        <label class="learn-catalog-label" for="learn-query">知りたい言葉から探す</label>
        <div class="learn-catalog-search">
          <input id="learn-query" type="search" name="q" maxlength="${maxQueryLength}" placeholder="例：生物多様性、TNFD" aria-describedby="learn-search-hint" enterkeyhint="search" />
          <button class="learn-catalog-submit" type="submit">検索</button>
        </div>
        <p class="learn-catalog-hint" id="learn-search-hint">タイトル・要約・本文の見出しを検索します。言葉を空白で区切ると、すべてを含む記事を探せます。</p>
      </div>
      <fieldset class="learn-catalog-filters">
        <legend>記事の種類</legend>
        <label class="learn-catalog-filter"><input type="radio" name="kind" value="all" checked /><span>すべて</span></label>
        <label class="learn-catalog-filter"><input type="radio" name="kind" value="reading" /><span>読みもの</span></label>
        <label class="learn-catalog-filter"><input type="radio" name="kind" value="term" /><span>用語</span></label>
      </fieldset>
    </form>
    <noscript><p>検索にはJavaScriptを使います。下の「すべての記事・用語」やテーマ別のリンクからも記事を読めます。</p></noscript>
    <div class="learn-catalog-state">
      <p class="learn-catalog-status" data-learn-status role="status" aria-live="polite" aria-atomic="true">全${entries.length}件（読みもの${readingCount}件・用語${entries.length - readingCount}件）</p>
      <a class="learn-catalog-clear" data-learn-clear href="${escapeHtml(action)}" hidden>条件を解除</a>
    </div>
    <details class="learn-catalog-results" data-learn-results>
      <summary><span data-learn-summary>すべての記事・用語（${entries.length}件）</span></summary>
      <div class="learn-catalog-empty" data-learn-empty hidden>
        <p><strong>条件に合う記事が見つかりませんでした。</strong></p>
        <p>短い言葉や別の表記で探すか、「すべて」を選んでください。「条件を解除」するとテーマ別の入口に戻れます。</p>
      </div>
      <ul class="learn-catalog-list" data-learn-list>${items}</ul>
    </details>
    <div data-learn-themes>${themeHtml}</div>
    <script type="application/json" data-learn-data>${scriptJson(entries)}</script>
    <script>(${mountLearnCatalog.toString()})(document.querySelector('[data-learn-catalog]'), (${createLearnSearch.toString()})());</script>
  </section>`;
}
