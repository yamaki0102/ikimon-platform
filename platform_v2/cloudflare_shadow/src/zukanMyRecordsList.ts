import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader, renderSubpageRow } from "./zukanSubpageUi";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

type MyRecordRow = {
  observation_id: string;
  taxon_label: string | null;
  observed_at: string;
  visibility: string;
  public_area_label?: string | null;
  asset_id?: string | null;
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
      `SELECT o.observation_id AS observation_id, o.taxon_label AS taxon_label, o.observed_at AS observed_at, o.visibility AS visibility,
              o.public_area_label AS public_area_label,
              (SELECT a.asset_id FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.exif_scrub_state = 'scrubbed' LIMIT 1) AS asset_id
         FROM observations o
        WHERE o.owner_user_id = ?
        ORDER BY o.observed_at DESC
        LIMIT 100`
    )
    .bind(userId)
    .all<MyRecordRow>()
    .then((r) => r.results)
    .catch(() =>
      db
        .prepare(
          `SELECT observation_id, taxon_label, observed_at, visibility
             FROM observations
            WHERE owner_user_id = ?
            ORDER BY observed_at DESC
            LIMIT 100`
        )
        .bind(userId)
        .all<MyRecordRow>()
        .then((r) => r.results)
        .catch(() => [] as MyRecordRow[])
    );

  return rows
    .filter((r) => filter === "all" || r.visibility === filter)
    .map((r) => ({
      observationId: r.observation_id,
      taxonDisplayName: (r.taxon_label ?? "").trim(),
      observedAt: r.observed_at,
      visibility: r.visibility === "public" ? "public" : "private",
      areaLabel: r.public_area_label ?? null,
      assetId: r.asset_id ?? null,
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
      { key: "private", label: `自分だけ (${allRecords.length - publicCount})` },
    ] as const
  )
    .map((f) => {
      const active = f.key === filter;
      return `<a class="zt-my-tab${active ? " is-active" : ""}" href="/${lang}/profile/records?visibility=${f.key}"${active ? ' aria-current="page"' : ""}>${f.label}</a>`;
    })
    .join("");

  const shortDate = (value: string): string => {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Intl.DateTimeFormat("ja", { month: "long", day: "numeric", timeZone: "Asia/Tokyo" }).format(new Date(time)) : "";
  };
  const rowsHtml = shown
    .map((r) => {
      const title = r.taxonDisplayName || "名前なしの記録";
      const meta = [shortDate(r.observedAt), r.areaLabel ?? "", r.visibility === "public" ? "公開中" : "自分だけ"].filter(Boolean).join(" ・ ");
      return renderSubpageRow({
        href: `/${lang}/observations/${encodeURIComponent(r.observationId)}`,
        title,
        meta,
        thumbUrl: r.assetId ? `/thumb/400/${encodeURIComponent(r.assetId)}` : null,
      });
    })
    .join("");

  const body = `<style>${ZUKAN_SUBPAGE_CSS}
    .zt-my-tabs{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:8px;scrollbar-width:none}
    .zt-my-tab,.zt-my-tab:visited{flex:none;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #dde2dc;background:#fff;color:#17251b;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
    .zt-my-tab.is-active,.zt-my-tab.is-active:visited{background:#143F2E;border-color:#143F2E;color:#fff}
  </style>
  <section class="zt-sp" data-profile-view="i2-i3">
    ${renderSubpageHeader({ title: "自分の記録", backHref: `/${lang}/profile`, backLabel: "自分に戻る" })}
    <p class="zt-sp-lead">${allRecords.length}件あります（公開 ${publicCount}件）。どこに出ているかも一緒に見えます。</p>
    <nav class="zt-my-tabs" aria-label="公開範囲">${filterLinks}</nav>
    ${rowsHtml ? `<ul class="zt-sp-list">${rowsHtml}</ul>` : `<p class="zt-sp-empty">${allRecords.length === 0 ? "まだ記録がありません。最初の1件を残してみましょう。" : "この条件に合う記録はありません。"}</p>`}
    <a class="zt-sp-primary" href="/${lang}/record">新しく記録する</a>
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
