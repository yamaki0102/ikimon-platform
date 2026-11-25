import type { Env } from "./core/env";
import { escapeHtml, json, readJson } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

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
  const bodyHtml = `<section class="zt-hub-card" data-profile-view="i10-pub">
    <h1>${isEn ? "Profile visibility settings" : "プロフィールの公開設定"}</h1>
    <p>${
      isEn
        ? "Your profile is private by default. When public, only your public record count, listed species, and recorded places are shown."
        : "既定は非公開です。公開にすると「公開中の記録」「図鑑に掲載」「記録した場所」の3つの数字だけが表示されます。"
    }</p>
    <p>${isEn ? "Current status" : "現在の設定"}: <strong id="profile-vis-label">${
      isPublic ? (isEn ? "Public" : "公開中") : (isEn ? "Private (default)" : "非公開（既定）")
    }</strong></p>
    <div style="display:flex;flex-wrap:wrap;gap:10px;">
      <button type="button" class="zt-btn-capture" id="profile-vis-toggle" data-next-public="${isPublic ? "false" : "true"}">${
        isPublic
          ? (isEn ? "Switch to private" : "非公開にする")
          : (isEn ? "Make profile public" : "プロフィールを公開する")
      }</button>
      <a class="zt-btn-outline" href="${escapeHtml(`${prefix}/u/${encodeURIComponent(session.userId)}`)}">${isEn ? "Preview public view" : "他人から見た表示を確認"}</a>
    </div>
    <script>
      (() => {
        const btn = document.getElementById("profile-vis-toggle");
        if (!btn) return;
        btn.addEventListener("click", async () => {
          const nextPublic = btn.getAttribute("data-next-public") === "true";
          const res = await fetch("/api/v1/profile/visibility", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ isPublic: nextPublic }),
          });
          if (res.ok) location.reload();
        });
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
    bodyHtml = `<section class="zt-hub-card" data-profile-view="p2">
      <h1>${isEn ? "Private profile" : "非公開のプロフィール"}</h1>
      <p>${isEn ? "This profile is currently private." : "このプロフィールは非公開です。"}</p>
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

    bodyHtml = `<section class="zt-hub-card" data-profile-view="p1">
      <h1>${isEn ? "Public profile" : "公開プロフィール"}</h1>
      <div class="zt-hub-grid">
        <div class="zt-hub-dest" data-stat-public-records="${publicRecords}">
          <strong>${publicRecords}</strong>
          <span>${isEn ? "Public records" : "公開中の記録"}</span>
        </div>
        <div class="zt-hub-dest" data-stat-zukan-species="${zukanSpecies}">
          <strong>${zukanSpecies}</strong>
          <span>${isEn ? "Listed in ZUKAN" : "図鑑に掲載"}</span>
        </div>
        <div class="zt-hub-dest" data-stat-places="${placesCount}">
          <strong>${placesCount}</strong>
          <span>${isEn ? "Recorded places" : "記録した場所"}</span>
        </div>
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
