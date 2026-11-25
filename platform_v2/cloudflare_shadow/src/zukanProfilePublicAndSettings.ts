import type { Env } from "./core/env";
import { escapeHtml, json, readJson } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader } from "./zukanSubpageUi";

type SessionLike = {
  userId: string;
  displayName?: string | null;
  banned?: boolean;
} | null;

async function ensureProfileVisibilityTable(db: Env["OBS_DB"]): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS zukan_profile_visibility (
      user_id TEXT PRIMARY KEY,
      is_public INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

async function isUserProfilePublic(db: Env["OBS_DB"], userId: string): Promise<boolean> {
  await ensureProfileVisibilityTable(db);
  const row = await db.prepare(
    "SELECT is_public FROM zukan_profile_visibility WHERE user_id = ? LIMIT 1"
  ).bind(userId).first<{ is_public: number }>();
  return row?.is_public === 1;
}

export async function handleProfilePublicSettingsRoute(
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  if (!session || session.banned) {
    return new Response("Unauthorized", {
      status: 302,
      headers: { location: `${prefix}/login?redirect=${encodeURIComponent(`${prefix}/profile/public-settings`)}` },
    });
  }

  const isPublic = await isUserProfilePublic(db, session.userId);
  const bodyHtml = `<style>${ZUKAN_SUBPAGE_CSS}.zt-pv-opts{display:grid;gap:4px}.zt-pv-opt{display:flex;gap:14px;align-items:flex-start;min-height:56px;padding:12px 0;border-bottom:1px solid #dde2dc}.zt-pv-opt input{width:24px;height:24px;margin-top:2px;accent-color:#143F2E;flex:none}.zt-pv-opt span{display:grid;gap:2px}.zt-pv-opt small{color:#55615a;line-height:1.6}</style><section class="zt-sp" data-profile-view="i10-pub">
    ${renderSubpageHeader({ title: isEn ? "Who can see this" : "公開の範囲", backHref: `${prefix}/profile/settings/edit`, backLabel: isEn ? "Back" : "戻る" })}
    <h2 class="zt-sp-title" style="font-size:1.125rem;margin:8px 0 0">${isEn ? "Profile" : "プロフィール"}</h2>
    <div class="zt-pv-opts" role="radiogroup" aria-label="${isEn ? "Profile visibility" : "プロフィールの公開"}">
      <label class="zt-pv-opt"><input type="radio" name="profile-vis" value="false" data-profile-vis-option${isPublic ? "" : " checked"}><span><strong>${isEn ? "Keep private" : "非公開にする"}</strong><small>${isEn ? "Your field name and records are not visible to others." : "フィールドネームも記録も、ほかの人には見えません。"}</small></span></label>
      <label class="zt-pv-opt"><input type="radio" name="profile-vis" value="true" data-profile-vis-option${isPublic ? " checked" : ""}><span><strong>${isEn ? "Make public" : "公開する"}</strong><small>${isEn ? "Others see only three numbers: public records, listed species, and recorded places." : "「公開中の記録」「図鑑に掲載」「記録した場所」の3つの数字だけが、ほかの人に見えます。"}</small></span></label>
    </div>
    <p class="zt-sp-text" style="background:#f4f6f3;border-radius:14px;padding:14px">${isEn ? "Only your field name is used; your real name is never registered. Even when private, you can list records on place pages. Your name is not shown then." : "名前はフィールドネームだけを使います。本名は登録もしません。非公開でも、図鑑や場所のページに記録を載せることはできます。そのとき名前は出ません。"}</p>
    <p class="zt-sp-text">${isEn ? "Current status" : "現在の設定"}: <strong id="profile-vis-label">${
      isPublic ? (isEn ? "Public" : "公開中") : (isEn ? "Private (default)" : "非公開（既定）")
    }</strong></p>
    <a class="zt-sp-secondary" href="${escapeHtml(`${prefix}/u/${encodeURIComponent(session.userId)}`)}">${isEn ? "Preview public view" : "他人から見た表示を確認"}</a>
    <script>
      (() => {
        const opts = document.querySelectorAll("[data-profile-vis-option]");
        opts.forEach((o) => o.addEventListener("change", async () => {
          const res = await fetch("/api/v1/profile/visibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ isPublic: o.value === "true" }),
          });
          if (res.ok) location.reload();
        }));
      })();
    </script>
  </section>`;

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Profile visibility" : "プロフィールの公開設定",
    activeNav: "profile",
    authenticated: true,
    displayName: session.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/profile/public-settings`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleUpdateProfileVisibility(
  request: Request,
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  if (!session || session.banned) {
    return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
  }
  const body = await readJson<{ isPublic?: unknown }>(request);
  const isPublic = body.isPublic === true;

  await ensureProfileVisibilityTable(db);
  await db.prepare(
    `INSERT INTO zukan_profile_visibility (user_id, is_public, updated_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       is_public = excluded.is_public,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(session.userId, isPublic ? 1 : 0).run();

  return json({ ok: true, isPublic }, 200, { "cache-control": "no-store" });
}

export async function handlePublicUserProfileRoute(
  targetUserId: string,
  lang: "ja" | "en" | "es" | "pt-br",
  session: SessionLike,
  db: Env["OBS_DB"]
): Promise<Response> {
  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const authenticated = Boolean(session && !session.banned);
  const isPublic = await isUserProfilePublic(db, targetUserId);

  let bodyHtml = "";
  if (!isPublic) {
    bodyHtml = `<style>${ZUKAN_SUBPAGE_CSS}</style><section class="zt-sp" data-profile-view="p2">
      ${renderSubpageHeader({ title: isEn ? "Profile" : "プロフィール", backHref: `${prefix}/library`, backLabel: isEn ? "Back" : "戻る" })}
      <p class="zt-sp-empty"><strong>${isEn ? "Private profile" : "非公開のプロフィール"}</strong><br>${isEn ? "This profile is currently private." : "このプロフィールは非公開です。"}</p>
    </section>`;
  } else {
    const stats = await db.prepare(
      `SELECT COUNT(*) AS public_records,
              COUNT(DISTINCT NULLIF(TRIM(taxon_label), '')) AS zukan_species,
              COUNT(DISTINCT NULLIF(TRIM(public_cell), '')) AS places_count
         FROM observations
        WHERE owner_user_id = ? AND visibility = 'public'`
    ).bind(targetUserId).first<{
      public_records: number;
      zukan_species: number;
      places_count: number;
    }>();

    const publicRecords = Number(stats?.public_records ?? 0);
    const zukanSpecies = Number(stats?.zukan_species ?? 0);
    const placesCount = Number(stats?.places_count ?? 0);

    bodyHtml = `<style>${ZUKAN_SUBPAGE_CSS}
      .zt-pp-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid #dde2dc;border-radius:20px;background:#fff}
      .zt-pp-stats div{display:grid;justify-items:center;gap:2px;padding:16px 4px;border-left:1px solid #dde2dc}.zt-pp-stats div:first-child{border-left:0}
      .zt-pp-stats strong{font-size:1.5rem}.zt-pp-stats span{color:#55615a;font-size:.875rem;text-align:center}
    </style><section class="zt-sp" data-profile-view="p1">
      ${renderSubpageHeader({ title: isEn ? "Public profile" : "公開プロフィール", backHref: `${prefix}/library`, backLabel: isEn ? "Back" : "戻る" })}
      <div class="zt-pp-stats">
        <div data-stat-public-records="${publicRecords}"><strong>${publicRecords}</strong><span>${isEn ? "Public records" : "公開中の記録"}</span></div>
        <div data-stat-zukan-species="${zukanSpecies}"><strong>${zukanSpecies}</strong><span>${isEn ? "Listed in ZUKAN" : "図鑑に掲載"}</span></div>
        <div data-stat-places="${placesCount}"><strong>${placesCount}</strong><span>${isEn ? "Recorded places" : "記録した場所"}</span></div>
      </div>
    </section>`;
  }

  const html = renderZukanCommonShell({
    lang,
    title: isEn ? "Profile" : "プロフィール",
    activeNav: "profile",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/u/${encodeURIComponent(targetUserId)}`,
  });

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
