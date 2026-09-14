import type { SiteLang } from "../i18n.js";

const ZUKAN_PUBLIC_HOSTS = new Set(["zukan.earth", "www.zukan.earth"]);
const NOCOSIL_PUBLIC_HOSTS = new Set(["nocosil.com", "www.nocosil.com"]);
const RESERVED_PUBLIC_SEGMENTS = new Set(["admin", "api", "auth", "internal", "login", "ops"]);

export type PublicContextAvailability = "eligible" | "unavailable";

export interface PublicContextActionInput {
  publicUrl: string;
  title?: string | null;
  sourceState?: "public" | "withdrawn" | "stale" | "unknown";
  rightsState?: "public" | "unknown" | "restricted";
  handoff?: {
    verified: boolean;
    registeredOrigin?: string | null;
  };
  lang?: SiteLang;
}

export interface PublicContextActionModel {
  availability: PublicContextAvailability;
  canonicalUrl: string | null;
  handoffUrl: string | null;
  reason: "eligible" | "unsafe_or_non_public_url" | "source_not_currently_public";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (!NOCOSIL_PUBLIC_HOSTS.has(host)) return null;
    return `https://${host}`;
  } catch {
    return null;
  }
}

export function normalizeZukanPublicUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (!ZUKAN_PUBLIC_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.pathname.split("/").some((segment) => RESERVED_PUBLIC_SEGMENTS.has(segment.toLowerCase()))) return null;

    const retained = new URLSearchParams();
    for (const [key, entry] of url.searchParams.entries()) {
      if (key === "lang" && /^(ja|en|es|pt-br)$/i.test(entry)) {
        retained.set("lang", entry.toLowerCase() === "pt-br" ? "pt-br" : entry.toLowerCase());
        continue;
      }
      if (key === "view" && entry === "public") {
        retained.set("view", "public");
        continue;
      }
      return null;
    }

    url.hash = "";
    url.search = retained.toString();
    return url.toString();
  } catch {
    return null;
  }
}

export function buildNocosilPublicContextHandoffUrl(canonicalUrl: string, registeredOrigin: string): string | null {
  const normalizedSource = normalizeZukanPublicUrl(canonicalUrl);
  const normalizedOrigin = normalizeOrigin(registeredOrigin);
  if (!normalizedSource || !normalizedOrigin) return null;
  return `${normalizedOrigin}/#/new?source=${encodeURIComponent(normalizedSource)}`;
}

export function getPublicContextActionModel(input: PublicContextActionInput): PublicContextActionModel {
  const canonicalUrl = normalizeZukanPublicUrl(input.publicUrl);
  if (!canonicalUrl) {
    return { availability: "unavailable", canonicalUrl: null, handoffUrl: null, reason: "unsafe_or_non_public_url" };
  }
  if (input.sourceState !== "public" || input.rightsState !== "public") {
    return { availability: "unavailable", canonicalUrl: null, handoffUrl: null, reason: "source_not_currently_public" };
  }
  const handoffUrl = input.handoff?.verified && input.handoff.registeredOrigin
    ? buildNocosilPublicContextHandoffUrl(canonicalUrl, input.handoff.registeredOrigin)
    : null;
  return { availability: "eligible", canonicalUrl, handoffUrl, reason: "eligible" };
}

export function renderPublicContextActions(input: PublicContextActionInput): string {
  const model = getPublicContextActionModel(input);
  if (model.availability !== "eligible" || !model.canonicalUrl) {
    return `<aside class="zukan-public-context-actions is-unavailable" data-public-context-state="unavailable" aria-label="相談案">
  <p class="zukan-public-context-copy">この情報から相談案をつくるには、公開状態と根拠の確認が必要です。</p>
</aside>`;
  }

  const title = input.title?.trim() ? `「${input.title.trim()}」` : "この公開情報";
  const handoff = model.handoffUrl
    ? `<a class="zukan-public-context-link is-handoff" href="${escapeHtml(model.handoffUrl)}" data-public-context-handoff>ノコシルで相談案をつくる</a>`
    : `<p class="zukan-public-context-note">相談案への移動は現在確認できません。公開情報のリンクはコピーできます。</p>`;
  return `<aside class="zukan-public-context-actions" data-public-context-state="eligible" aria-label="公開情報から相談案">
  <p class="zukan-public-context-copy">${escapeHtml(title)}をもとに、相談案の入口をつくれます。公開情報のリンクだけを渡します。</p>
  <div class="zukan-public-context-action-row">
    <button class="zukan-public-context-link is-copy" type="button" data-public-context-copy data-public-url="${escapeHtml(model.canonicalUrl)}">公開情報のリンクをコピー</button>
    <a class="zukan-public-context-link is-open" href="${escapeHtml(model.canonicalUrl)}" data-public-context-open>公開情報を開く</a>
    ${handoff}
  </div>
  <p class="zukan-public-context-status" data-public-context-status role="status" aria-live="polite"></p>
</aside>`;
}

export const PUBLIC_CONTEXT_STYLES = `
.zukan-public-context-actions {
  display: grid;
  gap: 12px;
  margin: 20px 0 0;
  padding: 16px;
  border: 1px solid var(--zukan-border-decorative, #d7ded9);
  border-radius: var(--zukan-radius-content, 16px);
  background: var(--zukan-surface-subtle, #f7f7f3);
}
.zukan-public-context-copy,
.zukan-public-context-note,
.zukan-public-context-status {
  margin: 0;
  color: var(--zukan-text-secondary, #55615a);
  font-size: 14px;
  line-height: 1.65;
}
.zukan-public-context-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.zukan-public-context-link {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  border: 1px solid var(--zukan-action-primary, #143f2e);
  border-radius: 999px;
  background: var(--zukan-surface-base, #fff);
  color: var(--zukan-action-primary, #143f2e);
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.3;
  text-decoration: none;
  cursor: pointer;
}
.zukan-public-context-link.is-copy,
.zukan-public-context-link.is-handoff {
  background: var(--zukan-action-primary, #143f2e);
  color: #fff;
}
.zukan-public-context-link:focus-visible {
  outline: 3px solid var(--zukan-focus-yellow-300, #facc15);
  outline-offset: 3px;
}
.zukan-public-context-link:hover { filter: brightness(.97); }
body[data-zukan-design] .zukan-public-context-status:empty { display: none; }
@media (max-width: 520px) {
  .zukan-public-context-action-row { display: grid; }
  .zukan-public-context-link { width: 100%; }
}
`;

export const PUBLIC_CONTEXT_SCRIPT = `<script>
(function () {
  document.querySelectorAll('[data-public-context-copy]').forEach(function (button) {
    button.addEventListener('click', async function () {
      var url = button.getAttribute('data-public-url') || '';
      var status = button.closest('[data-public-context-state]')?.querySelector('[data-public-context-status]');
      if (!url) return;
      button.setAttribute('disabled', 'disabled');
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') throw new Error('clipboard_unavailable');
        await navigator.clipboard.writeText(url);
        button.textContent = 'リンクをコピーしました';
        if (status) status.textContent = '公開情報のリンクだけをコピーしました。';
      } catch (_) {
        if (status) status.textContent = 'コピーできませんでした。隣の「公開情報を開く」からURLを確認してください。';
      } finally {
        button.removeAttribute('disabled');
      }
    });
  });
})();
</script>`;
