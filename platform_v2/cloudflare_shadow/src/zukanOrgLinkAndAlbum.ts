import type { Env } from "./core/env";
import { assertSameOriginRequest, escapeHtml, html } from "./core/http";
import { publicLangFromPath, readCompatibleSession } from "./core/shared";
import { loadUserLibraryData, type TopLibraryGroup } from "./zukanTopPage";

export type OrgLinkStatus = "pending" | "approved" | "declined" | "cancelled" | "linked";

export type OrgLinkRequest = {
  id: string;
  userId: string;
  orgName: string;
  groupKey: string;
  placeName: string;
  dateLabel: string;
  photoCount: number;
  observationIds: string[];
  photoUrl: string | null;
  status: OrgLinkStatus;
  sentAt: string;
  receivedAt: string | null;
  decidedAt: string | null;
  linkedAt: string | null;
};

export type AlbumShareRecord = {
  token: string;
  kind: "album";
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  placeId: string | null;
  placeName: string;
  observedOn: string;
  photos: Array<{ observationId: string; photoUrl: string }>;
};

export const ZUKAN_ORG_ALBUM_STYLES = `
:root{--zk-g:#143f2e;--zk-ink:#17251b;--zk-muted:#5a6a60;--zk-surface:#f6f7f4;--zk-line:#e4e8e2;--zk-red:#b3261e;--zk-fast:120ms;--zk-std:240ms;--zk-out:cubic-bezier(.2,0,0,1)}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--zk-ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6}
.oa-top{display:flex;align-items:center;justify-content:space-between;padding:12px 20px}
.oa-logo,.oa-logo:visited{color:var(--zk-g);font-weight:800;font-size:22px;letter-spacing:.04em;text-decoration:none}
.oa-login,.oa-login:visited{display:inline-flex;align-items:center;min-height:44px;padding:0 22px;border:1.5px solid var(--zk-g);border-radius:999px;color:var(--zk-g);font-weight:800;text-decoration:none}
.oa-back{display:flex;align-items:center;justify-content:center;position:relative;min-height:56px;font-weight:800;font-size:18px}
.oa-back a{position:absolute;left:8px;top:6px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--zk-ink)}
.oa-page{max-width:520px;margin:0 auto;padding:0 20px 120px}
.oa-center{text-align:center;padding-top:56px}
.oa-circle{width:76px;height:76px;margin:0 auto 18px;border-radius:50%;background:#e8efe9;display:flex;align-items:center;justify-content:center;color:var(--zk-g)}
.oa-circle.wait{background:var(--zk-surface);color:#4a5a50}
.oa-center h1{margin:0 0 8px;font-size:22px}
.oa-center p{margin:0 0 22px;color:var(--zk-muted)}
.oa-steps{list-style:none;margin:0 0 26px;padding:0;text-align:left}
.oa-steps li{display:flex;gap:14px;align-items:flex-start;padding:14px 4px;border-bottom:1px solid var(--zk-line)}
.oa-box{flex:none;width:26px;height:26px;margin-top:2px;border-radius:7px;border:2px solid #b8c0ba;background:#fff;display:flex;align-items:center;justify-content:center;color:#fff}
.oa-steps li.on .oa-box{background:var(--zk-g);border-color:var(--zk-g)}
.oa-steps li:not(.on){opacity:.55}
.oa-steps strong{display:block}
.oa-steps small{color:var(--zk-muted);font-size:14px}
.oa-btn,.oa-btn:visited{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:16px;background:var(--zk-g);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer;transition:transform var(--zk-fast) var(--zk-out)}
.oa-btn:active{transform:scale(.98)}
.oa-btn.sub,.oa-btn.sub:visited{background:#fff;color:var(--zk-g);border:1px solid var(--zk-g);margin-top:12px}
.oa-text-danger{display:block;width:100%;margin-top:14px;min-height:44px;border:0;background:transparent;color:var(--zk-red);font:inherit;font-weight:800;cursor:pointer}
.oa-row{display:flex;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--zk-line);margin-bottom:18px;text-align:left}
.oa-row img,.oa-row .oa-ph{width:64px;height:64px;border-radius:12px;object-fit:cover;background:var(--zk-surface);flex:none}
.oa-row strong{display:block;font-size:18px}
.oa-row span{color:var(--zk-muted);font-size:14px}
.oa-tabs{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border-top:1px solid var(--zk-line);padding:6px 4px 10px}
.oa-tabs a,.oa-tabs a:visited{display:flex;flex-direction:column;align-items:center;gap:2px;min-height:48px;color:var(--zk-muted);font-size:12px;font-weight:700;text-decoration:none}
.oa-tabs a[aria-current="page"]{color:var(--zk-g)}
.oa-album h1{margin:8px 0 6px;font-size:26px}
.oa-album .oa-meta{margin:0 0 16px;color:var(--zk-muted)}
.oa-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-bottom:18px}
.oa-grid img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;background:var(--zk-surface);display:block}
.oa-note{margin:0 0 18px;padding:16px;border-radius:16px;background:var(--zk-surface);color:#3b4a40;font-size:14px}
.oa-label{margin:22px 0 8px;font-weight:800;font-size:14px;color:#3b4a40}
.oa-opts{border:0;margin:0;padding:0}
.oa-opt{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--zk-line);cursor:pointer;transition:opacity var(--zk-std) var(--zk-out)}
.oa-opt input{position:absolute;opacity:0;pointer-events:none}
.oa-radio{flex:none;width:24px;height:24px;margin-top:2px;border:2px solid #aab3ad;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
.oa-opt input:checked+.oa-radio{border-color:var(--zk-g)}
.oa-opt input:checked+.oa-radio::after{content:"";width:12px;height:12px;border-radius:50%;background:var(--zk-g)}
.oa-opts:has(input:checked) .oa-opt:not(:has(input:checked)){opacity:.55}
.oa-opt strong{display:block;font-size:17px}
.oa-opt .oa-hint{display:block;color:var(--zk-muted);font-size:14px}
.oa-linkbox{display:flex;gap:10px;align-items:center;padding:14px 16px;border:1px solid var(--zk-line);border-radius:16px;background:var(--zk-surface);font-weight:800}
.oa-linkbox input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-weight:800;color:var(--zk-ink)}
@media(min-width:900px){.oa-page{max-width:640px}.oa-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`;

const ICON = {
  back: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`,
  check: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  clock: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  tick: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
};

function pageDoc(title: string, lang: string, body: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(title)} — ZUKAN</title>
<style>${ZUKAN_ORG_ALBUM_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

const jst = (iso: string | null): string => {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 9 * 3600000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${hh}:${mm}`;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
export function longDateJa(day: string): string {
  const m = day.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日（${WEEKDAYS[date.getUTCDay()]}）`;
}

function monthDay(groupKey: string): string {
  const m = groupKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : "";
}

function tabs(prefix: string): string {
  const item = (href: string, label: string, current = false) =>
    `<a href="${prefix}${href}"${current ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<nav class="oa-tabs" aria-label="メニュー">${item("/library", "ライブラリ")}${item("/community/events", "イベント")}${item("/record", "撮る")}${item("/map", "場所")}${item("/profile", "自分", true)}</nav>`;
}

export function renderOrgRequestPendingPage(options: { lang: string; request: OrgLinkRequest }): string {
  const prefix = `/${options.lang}`;
  const { request } = options;
  const received = Boolean(request.receivedAt);
  return pageDoc(
    "許可を待っています",
    options.lang,
    `<main class="oa-page oa-center" data-zukan-org-request="j6">
<div class="oa-circle wait">${ICON.clock}</div>
<h1>許可を待っています</h1>
<p>「${escapeHtml(request.orgName)}」のホームページへ<br>写真 ${request.photoCount}枚をつなぐお願いを送りました。</p>
<ul class="oa-steps">
<li class="on"><span class="oa-box">${ICON.tick}</span><span><strong>お願いを送った</strong><small>${escapeHtml(jst(request.sentAt))}</small></span></li>
<li class="${received ? "on" : ""}"><span class="oa-box">${received ? ICON.tick : ""}</span><span><strong>団体が受け取った</strong>${received ? `<small>${escapeHtml(jst(request.receivedAt))}</small>` : ""}</span></li>
<li><span class="oa-box"></span><span><strong>許可の確認中</strong><small>結果はお知らせで届きます</small></span></li>
</ul>
<a class="oa-btn sub" href="${prefix}/library">ライブラリへ戻る</a>
<form method="post" action="${prefix}/library/link/request/cancel"><input type="hidden" name="id" value="${escapeHtml(request.id)}"><button class="oa-text-danger" type="submit">お願いを取り消す</button></form>
</main>`
  );
}

export function renderOrgRequestApprovedPage(options: { lang: string; request: OrgLinkRequest; linked: boolean }): string {
  const prefix = `/${options.lang}`;
  const { request, linked } = options;
  const img = request.photoUrl ? `<img src="${escapeHtml(request.photoUrl)}" alt="">` : `<span class="oa-ph"></span>`;
  const actions = linked
    ? `<a class="oa-btn" href="${prefix}/library">ライブラリへ戻る</a>`
    : `<form method="post" action="${prefix}/library/link/request/connect"><input type="hidden" name="id" value="${escapeHtml(request.id)}"><button class="oa-btn" type="submit">今すぐつなぐ</button></form>
<a class="oa-btn sub" href="${prefix}/library">あとで</a>`;
  return pageDoc(
    linked ? "つなぎました" : "許可されました",
    options.lang,
    `<div class="oa-back"><a href="${prefix}/library" aria-label="戻る">${ICON.back}</a>お知らせ</div>
<main class="oa-page oa-center" data-zukan-org-request="${linked ? "j7-linked" : "j7"}" style="padding-top:28px">
<div class="oa-circle">${ICON.check}</div>
<h1>${linked ? "つなぎました" : "許可されました"}</h1>
<p>「${escapeHtml(request.orgName)}」のホームページへ<br>${linked ? `写真 ${request.photoCount}枚をつなぎました。` : `写真 ${request.photoCount}枚をつなげるようになりました。`}</p>
<div class="oa-row">${img}<div><strong>写真 ${request.photoCount}枚</strong><span>${escapeHtml(request.dateLabel)} ・ ${escapeHtml(request.placeName)}</span></div></div>
${actions}
</main>${tabs(prefix)}`
  );
}

export function renderOrgRequestDeclinedPage(options: { lang: string; request: OrgLinkRequest }): string {
  const prefix = `/${options.lang}`;
  return pageDoc(
    "許可されませんでした",
    options.lang,
    `<main class="oa-page oa-center" data-zukan-org-request="declined">
<div class="oa-circle wait">${ICON.clock}</div>
<h1>許可されませんでした</h1>
<p>「${escapeHtml(options.request.orgName)}」のホームページには、今回はつなげませんでした。<br>写真は、あなたのライブラリに残っています。</p>
<a class="oa-btn" href="${prefix}/library">ライブラリへ戻る</a>
</main>`
  );
}

export function renderAlbumShareCreatePage(options: {
  lang: string;
  group: TopLibraryGroup;
  linkUrl: string | null;
  expiresLabel: string | null;
}): string {
  const prefix = `/${options.lang}`;
  const { group } = options;
  const linkBox = options.linkUrl
    ? `<div class="oa-linkbox" data-album-link-box><input type="text" readonly value="${escapeHtml(options.linkUrl)}" aria-label="共有リンク"></div>${options.expiresLabel ? `<p class="oa-note">${escapeHtml(options.expiresLabel)}</p>` : ""}`
    : "";
  return pageDoc(
    "共有リンク",
    options.lang,
    `<div class="oa-back"><a href="${prefix}/library" aria-label="戻る">${ICON.back}</a>共有リンク</div>
<form class="oa-page" method="post" action="${prefix}/library/link/album" data-zukan-album-share="create">
<p style="margin:12px 0 4px;color:var(--zk-muted)">リンクを知っている人が、このアルバム（写真 ${group.photos.length}枚）を見られます。</p>
${linkBox}
<div class="oa-label">見られる期間</div>
<fieldset class="oa-opts">
<label class="oa-opt"><input type="radio" name="expires" value="none" checked><span class="oa-radio"></span><span><strong>無期限</strong><span class="oa-hint">取り消すまで見られます</span></span></label>
<label class="oa-opt"><input type="radio" name="expires" value="30d"><span class="oa-radio"></span><span><strong>30日</strong><span class="oa-hint">30日たつと見られなくなります</span></span></label>
</fieldset>
<p class="oa-note">アルバムには、あなたの名前は出ません。</p>
<input type="hidden" name="group" value="${escapeHtml(group.groupKey)}">
<button class="oa-btn" type="submit">リンクを作る</button>
</form>`
  );
}

export function renderSharedAlbumPage(options: {
  lang: string;
  record: AlbumShareRecord;
  authenticated: boolean;
  photos: Array<{ observationId: string; photoUrl: string }>;
}): string {
  const prefix = `/${options.lang}`;
  const { record } = options;
  const top = options.authenticated
    ? `<a class="oa-logo" href="${prefix}/library">ZUKAN</a>`
    : `<a class="oa-logo" href="${prefix}/">ZUKAN</a><a class="oa-login" href="${prefix}/login">ログイン</a>`;
  const placeHref = record.placeId ? `${prefix}/places/${encodeURIComponent(record.placeId)}` : `${prefix}/map`;
  return pageDoc(
    `${record.placeName} のアルバム`,
    options.lang,
    `<header class="oa-top">${top}</header>
<main class="oa-page oa-album" data-zukan-shared-album="j8">
<h1>${escapeHtml(record.placeName)} のアルバム</h1>
<p class="oa-meta">${escapeHtml(longDateJa(record.observedOn))} ・ 写真 ${options.photos.length}枚 ・ 共有リンクで見られます</p>
<div class="oa-grid">${options.photos.map((p) => `<img src="${escapeHtml(p.photoUrl)}" alt="" loading="lazy">`).join("")}</div>
<p class="oa-note">このアルバムは、リンクを知っている人だけが見られます。</p>
<a class="oa-btn" href="${prefix}/register">登録して、自分の写真も加える</a>
<a class="oa-btn sub" href="${escapeHtml(placeHref)}">${escapeHtml(record.placeName)}の図鑑を見る</a>
</main>`
  );
}

const requestKey = (userId: string, id: string): string =>
  `zukan-org-link-requests/${encodeURIComponent(userId)}/${encodeURIComponent(id)}.json`;
const shareKey = (token: string): string => `observation-share-links/${encodeURIComponent(token)}.json`;
const redirect = (location: string, status = 302): Response =>
  new Response(null, { status, headers: { location, "cache-control": "no-store" } });

async function readJsonObject<T>(env: Env, key: string): Promise<T | null> {
  const obj = await env.ASSET_BUCKET.get(key).catch(() => null);
  if (!obj) return null;
  return ((await new Response(obj.body).json().catch(() => null)) as T | null) ?? null;
}

async function putJson(env: Env, key: string, value: unknown): Promise<void> {
  await env.ASSET_BUCKET.put(key, JSON.stringify(value), { httpMetadata: { contentType: "application/json; charset=utf-8" } });
}

export async function handleSharedAlbumView(
  token: string,
  lang: "ja" | "en" | "es" | "pt-br",
  env: Env,
  authenticated: boolean
): Promise<Response | null> {
  const record = await readJsonObject<AlbumShareRecord>(env, shareKey(token));
  if (!record || record.kind !== "album") return null;
  if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  let photos = record.photos;
  if (photos.length > 0) {
    try {
      const placeholders = photos.map(() => "?").join(", ");
      const rows = await env.OBS_DB.prepare(
        `SELECT observation_id FROM observations WHERE observation_id IN (${placeholders}) AND COALESCE(emergency_hidden, 0) = 0`
      ).bind(...photos.map((p) => p.observationId)).all<{ observation_id: string }>();
      const visible = new Set((rows.results ?? []).map((r) => r.observation_id));
      photos = photos.filter((p) => visible.has(p.observationId));
    } catch {
      photos = [];
    }
  }
  if (photos.length === 0) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  return html(renderSharedAlbumPage({ lang, record, authenticated, photos }), 200, {
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
  });
}

export async function handleZukanOrgLinkRoute(
  request: Request,
  env: Env,
  url: URL,
  nativePathname: string
): Promise<Response | null> {
  const routes = [
    "/library/link/org-request",
    "/library/link/request",
    "/library/link/request/cancel",
    "/library/link/request/connect",
    "/library/link/album",
  ];
  if (!routes.includes(nativePathname)) return null;
  const lang = publicLangFromPath(url.pathname) ?? "ja";
  const prefix = `/${lang}`;
  const session = await readCompatibleSession(request, env).catch(() => null);
  if (!session || session.banned) return redirect(`${prefix}/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  const isPost = request.method === "POST";
  let form: FormData | null = null;
  if (isPost) {
    const blocked = assertSameOriginRequest(request);
    if (blocked) return blocked;
    form = await request.formData().catch(() => null);
  } else if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  const param = (name: string): string => {
    const value = form ? form.get(name) : url.searchParams.get(name);
    return typeof value === "string" ? value : "";
  };
  const headers = { "cache-control": "private, no-store" };
  const findGroup = async (): Promise<TopLibraryGroup | null> => {
    const groupKey = param("group").slice(0, 160);
    if (!groupKey) return null;
    const library = await loadUserLibraryData(env, session.userId);
    return library.groups.find((g) => g.groupKey === groupKey) ?? null;
  };
  const loadRequest = async (): Promise<OrgLinkRequest | null> => {
    const id = param("id");
    if (!/^req_[a-f0-9]{32}$/.test(id)) return null;
    return readJsonObject<OrgLinkRequest>(env, requestKey(session.userId, id));
  };

  if (nativePathname === "/library/link/org-request" && isPost) {
    const orgName = param("org").trim().slice(0, 60);
    const group = await findGroup();
    if (!group || !orgName) return redirect(`${prefix}/library`, 303);
    const now = new Date().toISOString();
    const created: OrgLinkRequest = {
      id: `req_${crypto.randomUUID().replace(/-/g, "")}`,
      userId: session.userId,
      orgName,
      groupKey: group.groupKey,
      placeName: group.placeName,
      dateLabel: monthDay(group.groupKey),
      photoCount: group.photos.length,
      observationIds: group.photos.map((p) => p.observationId),
      photoUrl: group.photos.find((p) => p.photoUrl)?.photoUrl ?? null,
      status: "pending",
      sentAt: now,
      receivedAt: null,
      decidedAt: null,
      linkedAt: null,
    };
    await putJson(env, requestKey(session.userId, created.id), created);
    return redirect(`${prefix}/library/link/request?id=${created.id}`, 303);
  }

  if (nativePathname === "/library/link/request" && !isPost) {
    const found = await loadRequest();
    if (!found || found.userId !== session.userId || found.status === "cancelled") return redirect(`${prefix}/library`);
    if (found.status === "pending") return html(renderOrgRequestPendingPage({ lang, request: found }), 200, headers);
    if (found.status === "declined") return html(renderOrgRequestDeclinedPage({ lang, request: found }), 200, headers);
    return html(renderOrgRequestApprovedPage({ lang, request: found, linked: found.status === "linked" }), 200, headers);
  }

  if (nativePathname === "/library/link/request/cancel" && isPost) {
    const found = await loadRequest();
    if (found && found.userId === session.userId && found.status === "pending") {
      await putJson(env, requestKey(session.userId, found.id), { ...found, status: "cancelled", decidedAt: new Date().toISOString() });
    }
    return redirect(`${prefix}/library`, 303);
  }

  if (nativePathname === "/library/link/request/connect" && isPost) {
    const found = await loadRequest();
    if (!found || found.userId !== session.userId || (found.status !== "approved" && found.status !== "linked")) {
      return redirect(`${prefix}/library`, 303);
    }
    if (found.status === "approved") {
      await putJson(env, requestKey(session.userId, found.id), { ...found, status: "linked", linkedAt: new Date().toISOString() });
    }
    return redirect(`${prefix}/library/link/request?id=${found.id}`, 303);
  }

  if (nativePathname === "/library/link/album") {
    const group = await findGroup();
    if (!group) return redirect(`${prefix}/library`, isPost ? 303 : 302);
    if (!isPost) {
      let linkUrl: string | null = null;
      let expiresLabel: string | null = null;
      const token = url.searchParams.get("token") ?? "";
      if (/^share_[a-f0-9]{32}$/.test(token)) {
        const stored = await readJsonObject<AlbumShareRecord>(env, shareKey(token));
        if (stored && stored.kind === "album" && stored.createdBy === session.userId) {
          linkUrl = `${url.origin}${prefix}/share/${token}`;
          const exp = stored.expiresAt ? new Date(Date.parse(stored.expiresAt) + 9 * 3600000) : null;
          expiresLabel = exp ? `${exp.getUTCMonth() + 1}月${exp.getUTCDate()}日まで見られます` : "取り消すまで見られます";
        }
      }
      return html(renderAlbumShareCreatePage({ lang, group, linkUrl, expiresLabel }), 200, headers);
    }
    const photos = group.photos
      .filter((p): p is typeof p & { photoUrl: string } => Boolean(p.photoUrl))
      .map((p) => ({ observationId: p.observationId, photoUrl: p.photoUrl }));
    if (photos.length === 0) return redirect(`${prefix}/library`, 303);
    const days = param("expires") === "30d" ? 30 : null;
    const token = `share_${crypto.randomUUID().replace(/-/g, "")}`;
    const record: AlbumShareRecord = {
      token,
      kind: "album",
      createdBy: session.userId,
      createdAt: new Date().toISOString(),
      expiresAt: days ? new Date(Date.now() + days * 86400000).toISOString() : null,
      placeId: group.placeId ?? null,
      placeName: group.placeName,
      observedOn: group.groupKey.slice(0, 10),
      photos,
    };
    await putJson(env, shareKey(token), record);
    return redirect(`${prefix}/library/link/album?group=${encodeURIComponent(group.groupKey)}&token=${token}`, 303);
  }

  return null;
}
