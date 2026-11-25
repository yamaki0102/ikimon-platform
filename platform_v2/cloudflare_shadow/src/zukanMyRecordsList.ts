import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type MyRecordRow = {
  observation_id: string;
  taxon_display_name: string;
  observed_at: string;
  visibility: string;
};

type VisibilityFilter = "all" | "public" | "private";

function normalizeVisibilityFilter(raw: string | null): VisibilityFilter {
  if (raw === "public" || raw === "private") {
    return raw;
  }
  return "all";
}

async function queryMyRecords(userId: string, filter: VisibilityFilter, db: Env["OBS_DB"]) {
  const rows = await db
    .prepare(
      `SELECT observation_id, taxon_display_name, observed_at, visibility
         FROM observations
        WHERE owner_user_id = ?
        ORDER BY observed_at DESC
        LIMIT 100`
    )
    .bind(userId)
    .all<MyRecordRow>()
    .then((r) => r.results)
    .catch(() => [] as MyRecordRow[]);

  return rows
    .filter((r) => filter === "all" || r.visibility === filter)
    .map((r) => ({
      observationId: r.observation_id,
      taxonDisplayName: r.taxon_display_name,
      observedAt: r.observed_at,
      visibility: r.visibility === "public" ? "public" : "private",
    }));
}

export async function handleMyRecordsApi(
  url: URL,
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session?.userId) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const filter = normalizeVisibilityFilter(url.searchParams.get("visibility"));
  const records = await queryMyRecords(session.userId, filter, db);
  return json({ ok: true, visibility: filter, records });
}

export async function handleMyRecordsRoute(
  url: URL,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session?.userId) {
    const html = renderZukanCommonShell({
      title: "自分の記録 | ikimon",
      lang,
      activeNav: "profile",
      authenticated: false,
      bodyHtml: `<section class="zt-hub-card" data-profile-view="i2-i3" data-my-records-auth-required="1">
        <h1>自分の記録</h1>
        <p>自分の記録を見るにはログインしてください。</p>
        <a class="zt-btn-capture" href="/${lang}/login">ログイン</a>
      </section>`,
    });
    return new Response(html, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const filter = normalizeVisibilityFilter(url.searchParams.get("visibility"));
  const allRecords = await queryMyRecords(session.userId, "all", db);
  const shown = filter === "all" ? allRecords : allRecords.filter((r) => r.visibility === filter);
  const publicCount = allRecords.filter((r) => r.visibility === "public").length;

  const filterLinks = (
    [
      { key: "all", label: `すべて (${allRecords.length})` },
      { key: "public", label: `公開中 (${publicCount})` },
      { key: "private", label: `非公開 (${allRecords.length - publicCount})` },
    ] as const
  )
    .map((f) => {
      const active = f.key === filter;
      return `<a class="zt-my-tab${active ? " is-active" : ""}" href="/${lang}/profile/records?visibility=${f.key}"${active ? ' aria-current="page"' : ""}>${f.label}</a>`;
    })
    .join("");

  const cards = shown
    .map(
      (r) => `<a class="zt-my-card" href="/${lang}/records/${encodeURIComponent(r.observationId)}">
        <div class="zt-my-meta">
          <span class="zt-my-badge${r.visibility === "public" ? " is-public" : ""}">${r.visibility === "public" ? "公開中" : "非公開"}</span>
          <span>${escapeHtml(r.observedAt.slice(0, 10))}</span>
        </div>
        <strong>${escapeHtml(r.taxonDisplayName)}</strong>
      </a>`
    )
    .join("");

  const body = `<style>
    .zt-my-layout{display:grid;gap:16px;padding:16px 0}
    @media(min-width:960px){.zt-my-layout{grid-template-columns:280px 1fr;align-items:start}}
    .zt-my-aside{padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:12px}
    .zt-my-tabs{display:flex;flex-wrap:wrap;gap:8px}
    .zt-my-tab,.zt-my-tab:visited{min-height:36px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);text-decoration:none;font-size:13px;font-weight:700;display:inline-flex;align-items:center}
    .zt-my-tab.is-active,.zt-my-tab.is-active:visited{background:var(--green);border-color:var(--green);color:#fff}
    .zt-my-list{display:grid;gap:10px}
    .zt-my-card,.zt-my-card:visited{display:grid;gap:6px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--ink);text-decoration:none}
    .zt-my-meta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:12px;color:var(--muted)}
    .zt-my-badge{padding:2px 8px;border-radius:999px;background:var(--surface);border:1px solid var(--line);font-weight:700;color:var(--muted)}
    .zt-my-badge.is-public{color:var(--green);border-color:var(--green)}
  </style>
  <section class="zt-my-layout" data-profile-view="i2-i3">
    <aside class="zt-my-aside">
      <h1>${escapeHtml(session.displayName ?? "自分の記録")}</h1>
      <p>記録 ${allRecords.length}件（公開 ${publicCount}件）</p>
      <a class="zt-btn-capture" href="/${lang}/record">新しく記録する</a>
    </aside>
    <div class="zt-my-main">
      <nav class="zt-my-tabs" aria-label="公開範囲">${filterLinks}</nav>
      <div class="zt-my-list">
        ${cards || `<p>表示できる記録がありません。</p>`}
      </div>
    </div>
  </section>`;

  const html = renderZukanCommonShell({
    title: "自分の記録一覧 | ikimon",
    lang,
    activeNav: "profile",
    authenticated: true,
    displayName: session.displayName ?? null,
    bodyHtml: body,
  });
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
