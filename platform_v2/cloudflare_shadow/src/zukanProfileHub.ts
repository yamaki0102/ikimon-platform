import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS, renderSubpageHeader, renderSubpageRow } from "./zukanSubpageUi";

type Lang = "ja" | "en" | "es" | "pt-br";
const pfx = (lang: Lang): string => (lang === "ja" ? "/ja" : `/${lang}`);
const CHEV = '<svg class="zt-sp-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';

const jpDate = (value: string | null | undefined, withTime = false): string => {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return "";
  const opt: Intl.DateTimeFormatOptions = withTime
    ? { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: false, timeZone: "Asia/Tokyo" }
    : { month: "long", day: "numeric", timeZone: "Asia/Tokyo" };
  const parts = new Intl.DateTimeFormat("ja", opt).formatToParts(new Date(time));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return withTime ? `${get("month")}月${get("day")}日 ${get("hour")}:${get("minute")}` : `${get("month")}月${get("day")}日`;
};

type Db = Env["OBS_DB"];
type HubRecord = { id: string; title: string; observedAt: string; visibility: string; area: string | null; assetId: string | null };

export type ProfileHubData = {
  displayName: string;
  bio: string;
  recordCount: number;
  savedPlaceCount: number;
  joinedEventCount: number;
  unreadCount: number;
  records: HubRecord[];
};

const num = (row: { n?: number } | null | undefined): number => Number(row?.n ?? 0) || 0;

export async function loadProfileHubData(
  env: { OBS_DB: Db; CORE_DB: Db },
  session: { userId: string; displayName?: string | null }
): Promise<ProfileHubData> {
  const uid = session.userId;
  const [recordCount, joined, saved, unread, bioRow, coreBio, recs] = await Promise.all([
    env.OBS_DB.prepare("SELECT COUNT(*) AS n FROM observations WHERE owner_user_id = ?").bind(uid).first<{ n: number }>().catch(() => null),
    env.OBS_DB.prepare("SELECT COUNT(DISTINCT session_id) AS n FROM observation_event_participants WHERE user_id = ?").bind(uid).first<{ n: number }>().catch(() => null),
    env.CORE_DB.prepare("SELECT COUNT(*) AS n FROM user_saved_items WHERE user_id = ? AND state = 'saved' AND object_kind = 'place'").bind(uid).first<{ n: number }>().catch(() => null),
    env.CORE_DB.prepare("SELECT COUNT(*) AS n FROM alert_deliveries WHERE user_id = ? AND acknowledged_at IS NULL").bind(uid).first<{ n: number }>().catch(() => null),
    env.OBS_DB.prepare("SELECT bio FROM user_account_settings WHERE user_id = ?").bind(uid).first<{ bio: string | null }>().catch(() => null),
    env.CORE_DB.prepare("SELECT profile_bio FROM user_profiles WHERE user_id = ?").bind(uid).first<{ profile_bio: string | null }>().catch(() => null),
    env.OBS_DB
      .prepare(
        `SELECT o.observation_id AS id, o.taxon_label AS title, o.observed_at AS observed_at, o.visibility AS visibility, o.public_area_label AS area,
                (SELECT a.asset_id FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.exif_scrub_state = 'scrubbed' LIMIT 1) AS asset_id
           FROM observations o WHERE o.owner_user_id = ? ORDER BY o.observed_at DESC LIMIT 12`
      )
      .bind(uid)
      .all<{ id: string; title: string | null; observed_at: string; visibility: string; area: string | null; asset_id: string | null }>()
      .then((r) => r.results)
      .catch(() => [] as Array<{ id: string; title: string | null; observed_at: string; visibility: string; area: string | null; asset_id: string | null }>),
  ]);
  return {
    displayName: session.displayName || uid,
    bio: (bioRow?.bio || coreBio?.profile_bio || "").trim(),
    recordCount: num(recordCount),
    savedPlaceCount: num(saved),
    joinedEventCount: num(joined),
    unreadCount: num(unread),
    records: recs.map((r) => ({
      id: r.id,
      title: (r.title ?? "").trim() || "名前なしの記録",
      observedAt: r.observed_at,
      visibility: r.visibility === "public" ? "public" : "private",
      area: r.area ?? null,
      assetId: r.asset_id ?? null,
    })),
  };
}

const HUB_CSS = `
.zt-ph{display:grid;gap:20px;max-width:720px;margin:0 auto;width:100%;color:#17251b}
.zt-ph-cover{position:relative;height:150px;margin:0 -20px;background:linear-gradient(135deg,#143F2E,#3f7a58);overflow:hidden}
.zt-ph-cover img{display:block;width:100%;height:100%;object-fit:cover}
.zt-ph-id{display:flex;align-items:flex-start;gap:16px;margin-top:-44px;position:relative}
.zt-ph svg.zt-sp-chev{fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;width:20px;height:20px;color:#8a948d;flex:none}
.zt-ph-av{flex:none;display:grid;place-items:center;width:84px;height:84px;border-radius:50%;background:#143F2E;color:#fff;font-size:2.25rem;font-weight:700;border:4px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.zt-ph-id div{min-width:0;padding-top:50px}
.zt-ph-id h1{margin:0;font-size:1.75rem;line-height:1.3;overflow-wrap:anywhere}
.zt-ph-bio{margin:2px 0 0;color:#55615a;font-size:1rem;line-height:1.6;overflow-wrap:anywhere}
.zt-ph-stats{display:grid;grid-template-columns:repeat(3,1fr);margin:0;padding:14px 0;border:1px solid #dde2dc;border-radius:22px;background:#fff}
.zt-ph-stats div{display:grid;justify-items:center;gap:2px;border-left:1px solid #dde2dc}.zt-ph-stats div:first-child{border-left:0}
.zt-ph-stats dd{margin:0;font-size:1.5rem;font-weight:700;order:1}.zt-ph-stats dt{order:2;font-size:.875rem;color:#55615a}
.zt-ph-sec{display:flex;align-items:center;justify-content:space-between;gap:12px}
.zt-ph-sec h2{margin:0;font-size:1.375rem}
.zt-ph-more,.zt-ph-more:visited{color:#0055ad;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:2px}
.zt-ph-more svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.zt-ph-mosaic{display:grid;grid-template-columns:1.4fr 1fr;grid-template-rows:1fr 1fr;gap:4px;aspect-ratio:16/10;border-radius:22px;overflow:hidden;border:1px solid #dde2dc}
.zt-ph-mosaic a{display:block;overflow:hidden;background:#eef1ed}.zt-ph-mosaic a:first-child{grid-row:1/3}
.zt-ph-mosaic img{display:block;width:100%;height:100%;object-fit:cover}
.zt-ph-mosaic.is-1{grid-template-columns:1fr}.zt-ph-mosaic.is-1 a:first-child{grid-row:auto}
.zt-ph-list{margin:0;padding:0;list-style:none}
.zt-ph-row,.zt-ph-row:visited{display:flex;align-items:center;gap:12px;min-height:72px;padding:16px 0;border-bottom:1px solid #dde2dc;color:#17251b;text-decoration:none}
.zt-ph-row .zt-sp-body strong{font-size:1.125rem}
.zt-ph-badge{flex:none;display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 8px;border-radius:999px;background:#b3261e;color:#fff;font-weight:700;font-size:.875rem}
.zt-ph-empty{margin:0;padding:24px 16px;border:1px solid #dde2dc;border-radius:20px;text-align:center;color:#55615a;background:#fff;display:grid;gap:12px;justify-items:center}
@media(min-width:900px){.zt-ph-cover{margin:0;border-radius:22px}}
`;

export function renderProfileHub(lang: Lang, data: ProfileHubData): string {
  const p = pfx(lang);
  const initial = esc1(data.displayName);
  const withPhoto = data.records.filter((r) => r.assetId);
  const cover = withPhoto[0] ? `<img src="/thumb/600/${encodeURIComponent(withPhoto[0].assetId!)}" alt="" decoding="async">` : "";
  const mosaic = withPhoto.slice(0, 3);
  const mosaicHtml = mosaic.length
    ? `<div class="zt-ph-mosaic is-${mosaic.length === 1 ? 1 : 3}" data-testid="profile-hub-mosaic">${mosaic
        .map((r) => `<a href="${escapeHtml(`${p}/observations/${encodeURIComponent(r.id)}`)}" aria-label="${escapeHtml(r.title)}"><img src="/thumb/400/${encodeURIComponent(r.assetId!)}" alt="" loading="lazy" decoding="async"></a>`)
        .join("")}</div>`
    : "";
  const rows = data.records.slice(0, 2).map((r) =>
    renderSubpageRow({
      href: `${p}/observations/${encodeURIComponent(r.id)}`,
      title: r.title,
      meta: [jpDate(r.observedAt), r.area ?? "", r.visibility === "public" ? "公開中" : "自分だけ"].filter(Boolean).join(" ・ "),
      thumbUrl: r.assetId ? `/thumb/400/${encodeURIComponent(r.assetId)}` : null,
    })
  ).join("");
  const recordsBlock = data.recordCount > 0
    ? `${mosaicHtml}${rows ? `<ul class="zt-ph-list">${rows}</ul>` : ""}`
    : `<p class="zt-ph-empty">まだ記録がありません。最初の1件を残してみましょう。<a class="zt-btn-capture" href="${p}/record">記録する</a></p>`;
  const menu = (href: string, title: string, meta: string, badge = "") =>
    `<li><a class="zt-ph-row" href="${escapeHtml(href)}"><span class="zt-sp-body"><strong>${escapeHtml(title)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span>${badge}${CHEV}</a></li>`;
  const badge = data.unreadCount > 0 ? `<span class="zt-ph-badge" aria-label="未読 ${data.unreadCount}件">${data.unreadCount > 99 ? "99+" : data.unreadCount}</span>` : "";
  const body = `<style>${ZUKAN_SUBPAGE_CSS}${HUB_CSS}</style>
  <section class="zt-ph" data-testid="self-control-hub" data-profile-view="i1">
    <div class="zt-ph-cover" aria-hidden="true">${cover}</div>
    <div class="zt-ph-id"><span class="zt-ph-av" aria-hidden="true">${escapeHtml(initial)}</span><div><h1 data-testid="profile-heading">${escapeHtml(data.displayName)}</h1>${data.bio ? `<p class="zt-ph-bio">${escapeHtml(data.bio)}</p>` : ""}</div></div>
    <dl class="zt-ph-stats">
      <div><dd>${data.recordCount}</dd><dt>自分の記録</dt></div>
      <div><dd>${data.savedPlaceCount}</dd><dt>保存した場所</dt></div>
      <div><dd>${data.joinedEventCount}</dd><dt>参加イベント</dt></div>
    </dl>
    <div class="zt-ph-sec"><h2>自分の記録</h2><a class="zt-ph-more" href="${p}/profile/records">すべて見る<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a></div>
    ${recordsBlock}
    <ul class="zt-ph-list">
      ${menu(`${p}/profile/public-settings`, "公開先", "図鑑・アルバム・共有リンク。取り消しもここから")}
      ${menu(`${p}/profile/linked-saved`, "保存した場所・イベント", "")}
      ${menu(`${p}/profile/notifications`, "通知", "", badge)}
      ${menu(`${p}/profile/settings`, "設定", "プロフィール・通知・公開範囲")}
    </ul>
  </section>`;
  return renderZukanCommonShell({ lang, title: "自分", activeNav: "profile", authenticated: true, displayName: data.displayName, bodyHtml: body, pathname: `${p}/profile` });
}

function esc1(name: string): string {
  return Array.from(name.trim())[0] ?? "自";
}

export function renderProfileSettingsHub(lang: Lang, opts: { displayName: string; email: string | null; recordCount: number; flash: string | null }): string {
  const p = pfx(lang);
  const plain = (href: string, title: string, meta: string) =>
    `<li><a class="zt-sp-row" href="${escapeHtml(href)}" style="min-height:64px"><span class="zt-sp-body"><strong>${escapeHtml(title)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span>${CHEV}</a></li>`;
  const wLines = `退会すると、自分の記録${opts.recordCount}件とアカウントが全部消えます。図鑑に載せた記録も消えます。消したあとは、元に戻せません。`;
  const body = `<style>${ZUKAN_SUBPAGE_CSS}
.zt-ps-id{display:flex;align-items:center;gap:16px;padding:8px 0 16px;border-bottom:1px solid #dde2dc}
.zt-ps-av{flex:none;display:grid;place-items:center;width:64px;height:64px;border-radius:50%;background:#143F2E;color:#fff;font-size:1.75rem;font-weight:700}
.zt-ps-id strong{display:block;font-size:1.125rem}.zt-ps-id small{color:#55615a;overflow-wrap:anywhere}
.zt-ps-h{margin:8px 0 0;font-size:1.375rem}
.zt-ps-warn{margin:0;padding:18px;border-radius:18px;background:#fdecea;color:#b3261e;line-height:1.8}
.zt-ps-danger,.zt-ps-danger:visited{display:inline-flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:1.5px solid #b3261e;border-radius:16px;background:#fff;color:#b3261e;font:inherit;font-weight:700;cursor:pointer}
.zt-ps-danger[disabled]{opacity:.45;cursor:not-allowed}
.zt-ps-ack{display:flex;gap:10px;align-items:center;font-weight:600}.zt-ps-ack input{width:24px;height:24px;accent-color:#b3261e}
.zt-ps-lang{display:flex;gap:10px}.zt-ps-lang select{flex:1}
</style>
  <section class="zt-sp" data-profile-view="i12" data-testid="profile-settings">
    ${renderSubpageHeader({ title: "ログアウト・退会", backHref: `${p}/profile`, backLabel: "自分に戻る" })}
    <div class="zt-ps-id"><span class="zt-ps-av" aria-hidden="true">${escapeHtml(esc1(opts.displayName))}</span><div><strong>${escapeHtml(opts.displayName)}</strong>${opts.email ? `<small>${escapeHtml(opts.email)}</small>` : ""}</div></div>
    ${opts.flash ? `<p class="zt-sp-lead" role="status">保存しました。</p>` : ""}
    <ul class="zt-sp-list">
      ${plain(`${p}/profile/settings/edit`, "プロフィール", "名前と自己紹介")}
      ${plain(`${p}/profile/settings/notifications`, "通知", "コメントや観察会のお知らせ")}
      ${plain(`${p}/profile/public-settings`, "公開の範囲", "ほかの人に何が見えるかを決めます")}
      ${plain(`${p}/profile/settings/account`, "連携とアカウント", "")}
    </ul>
    <form class="zt-sp-field" action="/api/v1/profile/language" method="post" data-testid="language-form">
      <span>表示言語</span>
      <div class="zt-ps-lang"><select class="zt-sp-input" name="lang" aria-label="表示言語">
        <option value="ja"${lang === "ja" ? " selected" : ""}>日本語</option><option value="en"${lang === "en" ? " selected" : ""}>English</option><option value="es"${lang === "es" ? " selected" : ""}>Español</option><option value="pt-br"${lang === "pt-br" ? " selected" : ""}>Português</option>
      </select><button class="zt-sp-secondary" type="submit" style="width:auto">保存</button></div>
    </form>
    <button class="zt-sp-secondary" type="button" data-logout>ログアウト</button>
    <h2 class="zt-ps-h">退会</h2>
    <p class="zt-ps-warn" data-testid="withdrawal-confirmation">${escapeHtml(wLines)}</p>
    <form method="post" action="/api/v1/account/withdraw" style="display:grid;gap:12px">
      <label class="zt-ps-ack"><input type="checkbox" name="acknowledged" value="yes" required data-withdrawal-ack><span>消える内容を確認しました</span></label>
      <button type="submit" class="zt-ps-danger" data-withdrawal-submit>退会する</button>
    </form>
  </section>
  <script>(()=>{const b=document.querySelector("[data-logout]");if(b)b.addEventListener("click",async()=>{b.disabled=true;try{await fetch("/api/v1/auth/session/logout",{method:"POST",credentials:"same-origin"});}catch{}location.href="${p}/";});})();</script>`;
  return renderZukanCommonShell({ lang, title: "ログアウト・退会", activeNav: "profile", authenticated: true, displayName: opts.displayName, bodyHtml: body, pathname: `${p}/profile/settings` });
}

export type AlertItem = {
  deliveryId: string;
  occurrenceId: string | null;
  triggerKind: string;
  createdAt: string;
  acknowledgedAt: string | null;
  payload: Record<string, unknown>;
};

const KIND_TITLE: Record<string, string> = {
  record_feedback_ready: "記録についてのお知らせが届きました",
  subject_proposal: "記録の候補が届きました",
  taxon_match: "フォロー中の生きものの記録があります",
  area_watch: "見ている場所に新しい記録があります",
  municipality_invasive: "外来種らしき記録のお知らせ",
};
const KIND_ICON: Record<string, string> = {
  record_feedback_ready: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  subject_proposal: '<path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 3.5V15h0A2.5 2.5 0 0 1 5 12.5z"/>',
};
const BELL = '<path d="M6 17h12l-1.5-2v-4.5a4.5 4.5 0 0 0-9 0V15z"/><path d="M10 20a2 2 0 0 0 4 0"/>';

const alertTitle = (a: AlertItem): string => {
  const t = a.payload?.title;
  return typeof t === "string" && t.trim() ? t.trim() : (KIND_TITLE[a.triggerKind] ?? "お知らせが届きました");
};

const NOTIF_CSS = `
.zt-nt-row,.zt-nt-row:visited{display:flex;align-items:center;gap:14px;padding:16px 0;border-bottom:1px solid #dde2dc;color:#17251b;text-decoration:none}
.zt-nt-ic{flex:none;display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:#f4f5f0;color:#143F2E}
.zt-nt-ic svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.zt-nt-dot{flex:none;width:12px;height:12px;border-radius:50%;background:#b3261e}
.zt-nt-body{flex:1;min-width:0}.zt-nt-body strong{display:block;font-size:1.0625rem;line-height:1.5;overflow-wrap:anywhere}.zt-nt-body small{display:block;color:#55615a;margin-top:4px}
.zt-nt-quote{margin:0;padding:18px;border-radius:18px;background:#f4f5f0;line-height:1.8;overflow-wrap:anywhere;white-space:pre-wrap}
`;

export function renderNotificationsList(lang: Lang, displayName: string, alerts: AlertItem[]): string {
  const p = pfx(lang);
  const items = alerts.map((a) => {
    const unread = !a.acknowledgedAt;
    return `<li><a class="zt-nt-row" href="${escapeHtml(`${p}/profile/notifications/${encodeURIComponent(a.deliveryId)}`)}"><span class="zt-nt-ic"><svg viewBox="0 0 24 24" aria-hidden="true">${KIND_ICON[a.triggerKind] ?? BELL}</svg></span><span class="zt-nt-body"><strong>${escapeHtml(alertTitle(a))}</strong><small>${escapeHtml(jpDate(a.createdAt, true))}</small></span>${unread ? '<span class="zt-nt-dot" aria-label="未読"></span>' : ""}</a></li>`;
  }).join("");
  const body = `<style>${ZUKAN_SUBPAGE_CSS}${NOTIF_CSS}</style>
  <section class="zt-sp" data-profile-view="i6" data-testid="notifications-list">
    ${renderSubpageHeader({ title: "通知", backHref: `${p}/profile`, backLabel: "自分に戻る" })}
    ${items ? `<ul class="zt-sp-list">${items}</ul>` : `<p class="zt-sp-empty">まだ通知はありません。</p>`}
  </section>`;
  return renderZukanCommonShell({ lang, title: "通知", activeNav: "profile", authenticated: true, displayName, bodyHtml: body, pathname: `${p}/profile/notifications` });
}

export function renderNotificationDetail(lang: Lang, displayName: string, a: AlertItem, record: { id: string; title: string; observedAt: string; area: string | null; assetId: string | null } | null): string {
  const p = pfx(lang);
  const text = typeof a.payload?.body === "string" ? a.payload.body.trim() : "";
  const recordRow = record
    ? `<ul class="zt-sp-list">${renderSubpageRow({
        href: `${p}/observations/${encodeURIComponent(record.id)}`,
        title: record.title,
        meta: [jpDate(record.observedAt), record.area ?? ""].filter(Boolean).join(" ・ "),
        thumbUrl: record.assetId ? `/thumb/400/${encodeURIComponent(record.assetId)}` : null,
      })}</ul>`
    : "";
  const body = `<style>${ZUKAN_SUBPAGE_CSS}${NOTIF_CSS}</style>
  <section class="zt-sp" data-profile-view="i7" data-testid="notification-detail">
    ${renderSubpageHeader({ title: "通知", backHref: `${p}/profile/notifications`, backLabel: "通知に戻る" })}
    <p class="zt-sp-lead">${escapeHtml(jpDate(a.createdAt, true))}</p>
    <h2 class="zt-sp-title">${escapeHtml(alertTitle(a))}</h2>
    ${text ? `<p class="zt-nt-quote">${escapeHtml(text)}</p>` : ""}
    ${recordRow}
    ${record ? `<a class="zt-sp-primary" href="${escapeHtml(`${p}/observations/${encodeURIComponent(record.id)}`)}">記録を見る</a>` : ""}
    <a class="zt-sp-secondary" href="${p}/profile/notifications">通知の一覧へ</a>
  </section>
  <script>(()=>{try{fetch("/api/v1/me/alerts/read",{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({ids:[${JSON.stringify(a.deliveryId)}]})}).catch(()=>{});}catch{}})();</script>`;
  return renderZukanCommonShell({ lang, title: "通知", activeNav: "profile", authenticated: true, displayName, bodyHtml: body, pathname: `${p}/profile/notifications/${a.deliveryId}` });
}
