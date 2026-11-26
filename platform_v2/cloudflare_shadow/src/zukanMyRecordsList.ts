import type { Env } from "./core/env";
import { escapeHtml, json } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { resolveWeakLabels } from "./legacyImportNames";
import { isWeakTaxonLabel } from "./taxonNameResolver";
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

const PAGE_SIZE = 100;

function parseBefore(raw: string | null): { at: string; id: string } | null {
  if (!raw) return null;
  const i = raw.indexOf("|");
  if (i <= 0 || i === raw.length - 1) return null;
  return { at: raw.slice(0, i), id: raw.slice(i + 1) };
}

async function queryMyRecords(userId: string, filter: VisibilityFilter, before: string | null, db: Env["OBS_DB"]) {
  const cursor = parseBefore(before);
  const where = ["o.owner_user_id = ?"];
  const binds: string[] = [userId];
  if (filter === "public") where.push("o.visibility = 'public'");
  if (filter === "private") where.push("o.visibility <> 'public'");
  if (cursor) {
    where.push("(o.observed_at < ? OR (o.observed_at = ? AND o.observation_id < ?))");
    binds.push(cursor.at, cursor.at, cursor.id);
  }
  const rows = await db
    .prepare(
      `SELECT o.observation_id AS observation_id, o.taxon_label AS taxon_label, o.observed_at AS observed_at, o.visibility AS visibility,
              o.public_area_label AS public_area_label,
              (SELECT a.asset_id FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.exif_scrub_state = 'scrubbed' LIMIT 1) AS asset_id
         FROM observations o
        WHERE ${where.join(" AND ")}
        ORDER BY o.observed_at DESC, o.observation_id DESC
        LIMIT ${PAGE_SIZE + 1}`
    )
    .bind(...binds)
    .all<MyRecordRow>()
    .then((r) => r.results)
    .catch(() =>
      db
        .prepare(
          `SELECT o.observation_id AS observation_id, o.taxon_label AS taxon_label, o.observed_at AS observed_at, o.visibility AS visibility
             FROM observations o
            WHERE ${where.join(" AND ")}
            ORDER BY o.observed_at DESC, o.observation_id DESC
            LIMIT ${PAGE_SIZE + 1}`
        )
        .bind(...binds)
        .all<MyRecordRow>()
        .then((r) => r.results)
        .catch(() => [] as MyRecordRow[])
    );

  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor = rows.length > PAGE_SIZE && last ? `${last.observed_at}|${last.observation_id}` : null;
  const importNames = await resolveWeakLabels(
    db,
    page.map((r) => ({ id: r.observation_id, label: r.taxon_label }))
  );
  const records = page.map((r) => ({
    observationId: r.observation_id,
    taxonDisplayName: isWeakTaxonLabel(r.taxon_label) ? importNames.get(r.observation_id) ?? "" : (r.taxon_label ?? "").trim(),
    observedAt: r.observed_at,
    visibility: r.visibility === "public" ? "public" : "private",
    areaLabel: r.public_area_label ?? null,
    assetId: r.asset_id ?? null,
  }));
  return { records, nextCursor };
}

async function queryMyRecordCounts(userId: string, db: Env["OBS_DB"]): Promise<{ total: number; publicCount: number } | null> {
  return db
    .prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN visibility = 'public' THEN 1 ELSE 0 END) AS public_count FROM observations WHERE owner_user_id = ?")
    .bind(userId)
    .all<{ total: number | null; public_count: number | null }>()
    .then((r) => {
      const row = r.results?.[0];
      return row ? { total: Number(row.total ?? 0) || 0, publicCount: Number(row.public_count ?? 0) || 0 } : null;
    })
    .catch(() => null);
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
  const { records, nextCursor } = await queryMyRecords(session.userId, filter, url.searchParams.get("before"), db);
  return json({ ok: true, visibility: filter, records, nextCursor });
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
  const [{ records: shown, nextCursor }, counts] = await Promise.all([
    queryMyRecords(session.userId, filter, url.searchParams.get("before"), db),
    queryMyRecordCounts(session.userId, db),
  ]);
  const totalCount = counts?.total ?? shown.length;
  const publicCount = counts?.publicCount ?? shown.filter((r) => r.visibility === "public").length;

  const filterLinks = (
    [
      { key: "all", label: `すべて (${totalCount})` },
      { key: "public", label: `公開中 (${publicCount})` },
      { key: "private", label: `自分だけ (${totalCount - publicCount})` },
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
    <p class="zt-sp-lead">${totalCount}件あります（公開 ${publicCount}件）。どこに出ているかも一緒に見えます。</p>
    <nav class="zt-my-tabs" aria-label="公開範囲">${filterLinks}</nav>
    ${rowsHtml ? `<ul class="zt-sp-list">${rowsHtml}</ul>` : `<p class="zt-sp-empty">${totalCount === 0 ? "まだ記録がありません。最初の1件を残してみましょう。" : "この条件に合う記録はありません。"}</p>`}
    ${nextCursor ? `<a class="zt-sp-secondary" data-my-records-older="1" rel="next" href="/${lang}/profile/records?visibility=${filter}&amp;before=${encodeURIComponent(nextCursor)}">もっと古い記録</a>` : ""}
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
