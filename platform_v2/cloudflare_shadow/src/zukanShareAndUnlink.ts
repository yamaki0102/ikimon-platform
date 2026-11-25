import type { Env } from "./core/env";
import { assertSameOriginRequest, escapeHtml, html } from "./core/http";
import { publicLangFromPath, readCompatibleSession } from "./core/shared";
import { handleCreateObservationShareLink } from "./zukanObservationCommentsAndShare";
import {
  ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL,
  ZUKAN_OBSERVATION_PUBLICATIONS_CREATE_SQL,
  loadUserLibraryGroup,
  type TopLibraryGroup,
} from "./zukanTopPage";

export type ShareExpiry = "none" | "30d";

export const ZUKAN_SHARE_UNLINK_STYLES = `
:root{--zk-g:#143f2e;--zk-ink:#17251b;--zk-muted:#5a6a60;--zk-surface:#f6f7f4;--zk-line:#e4e8e2;--zk-red:#b3261e;--zk-fast:120ms;--zk-std:240ms;--zk-out:cubic-bezier(.2,0,0,1)}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--zk-ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6}
.su-back{display:flex;align-items:center;justify-content:center;position:relative;min-height:56px;font-weight:800;font-size:18px}
.su-back a{position:absolute;left:8px;top:6px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--zk-ink)}
.su-page{max-width:520px;margin:0 auto;padding:0 20px 48px}
.su-lead{margin:12px 0 4px;color:var(--zk-muted)}
.su-label{margin:22px 0 8px;font-weight:800;font-size:14px;color:#3b4a40}
.su-btn,.su-btn:visited{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:16px;background:var(--zk-g);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer;transition:transform var(--zk-fast) var(--zk-out)}
.su-btn:active{transform:scale(.98)}
.su-btn.danger{background:var(--zk-red)}
.su-btn.sub,.su-btn.sub:visited{background:#fff;color:var(--zk-ink);border:1px solid #d9dfda;margin-top:12px}
.su-linkbox{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border:1px solid var(--zk-line);border-radius:16px;background:var(--zk-surface);font-weight:800;min-width:0}
.su-linkbox input{flex:1;min-width:0;border:0;background:transparent;font:inherit;font-weight:800;color:var(--zk-ink)}
.su-linkbox.empty{color:var(--zk-muted);font-weight:500}
.su-copy{flex:none;min-height:44px;padding:0 18px;border:1.5px solid var(--zk-g);border-radius:999px;background:#fff;color:var(--zk-g);font:inherit;font-weight:800;cursor:pointer}
.su-opts{border:0;margin:0;padding:0}
.su-opt{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--zk-line);cursor:pointer;transition:opacity var(--zk-std) var(--zk-out)}
.su-opt input{position:absolute;opacity:0;pointer-events:none}
.su-radio{flex:none;width:24px;height:24px;margin-top:2px;border:2px solid #aab3ad;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
.su-opt input:checked+.su-radio{border-color:var(--zk-g)}
.su-opt input:checked+.su-radio::after{content:"";width:12px;height:12px;border-radius:50%;background:var(--zk-g)}
.su-opt input:focus-visible+.su-radio{outline:3px solid #8fb9a0;outline-offset:2px}
.su-opt strong{display:block;font-size:17px}
.su-opt .su-hint{display:block;color:var(--zk-muted);font-size:14px}
.su-opts:has(input:checked) .su-opt:not(:has(input:checked)){opacity:.55}
.su-note{margin:18px 0;padding:16px;border-radius:16px;background:var(--zk-surface);color:#3b4a40;font-size:14px}
.su-bg{padding:20px;opacity:.55;max-width:520px;margin:0 auto}
.su-bg img,.su-bg .su-ph{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:20px;background:var(--zk-surface);display:block}
.su-bg h2{margin:16px 0 4px;font-size:24px}
.su-shade{position:fixed;inset:0;background:rgba(20,30,25,.45)}
.su-dialog{position:fixed;left:16px;right:16px;top:50%;transform:translateY(-50%);max-width:420px;margin:0 auto;padding:26px 24px 24px;background:#fff;border-radius:28px;box-shadow:0 12px 40px rgba(0,0,0,.2);animation:su-in var(--zk-std) var(--zk-out) both}
.su-dialog h1{margin:0 0 10px;font-size:20px}
.su-dialog p{margin:0 0 18px;color:#3b4a40}
@keyframes su-in{from{opacity:0;transform:translateY(-46%)}to{opacity:1;transform:translateY(-50%)}}
@media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`;

const ICON_BACK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;

function pageDoc(title: string, lang: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — ZUKAN</title>
<style>${ZUKAN_SHARE_UNLINK_STYLES}</style>
</head>
<body>${body}${script}</body>
</html>`;
}

export function renderUnlinkConfirmPage(options: { lang: string; group: TopLibraryGroup }): string {
  const prefix = `/${options.lang}`;
  const { group } = options;
  const first = group.photos[0];
  const img = first?.photoUrl
    ? `<img src="${escapeHtml(first.photoUrl)}" alt="">`
    : `<span class="su-ph"></span>`;
  return pageDoc(
    "つなぎを取り消す",
    options.lang,
    `<div class="su-bg" aria-hidden="true">${img}<h2>${escapeHtml(first?.title || group.placeName)}</h2></div>
<div class="su-shade"></div>
<form class="su-dialog" method="post" action="${prefix}/library/link/cancel" role="alertdialog" aria-labelledby="su-t" data-zukan-unlink-dialog="j4">
<h1 id="su-t">つなぎを取り消しますか？</h1>
<p>「${escapeHtml(group.placeName)} の図鑑」から見えなくなります。<br>写真そのものは、あなたのライブラリに残ります。</p>
<input type="hidden" name="group" value="${escapeHtml(group.groupKey)}">
<button class="su-btn danger" type="submit">取り消す</button>
<a class="su-btn sub" href="${prefix}/library">やめる</a>
</form>`
  );
}

export function renderShareLinkPage(options: {
  lang: string;
  observationId: string;
  shareable: boolean;
  linkUrl: string | null;
  expiresLabel: string | null;
}): string {
  const prefix = `/${options.lang}`;
  const back = `${prefix}/observations/${encodeURIComponent(options.observationId)}`;
  const linkBox = options.linkUrl
    ? `<div class="su-linkbox" data-share-link-box><input id="su-url" type="text" readonly value="${escapeHtml(options.linkUrl)}" aria-label="共有リンク"><button class="su-copy" type="button" data-share-copy>コピー</button></div>${options.expiresLabel ? `<p class="su-lead">${escapeHtml(options.expiresLabel)}</p>` : ""}`
    : `<div class="su-linkbox empty">「リンクを作る」を押すと、ここに出ます</div>`;
  const script = options.linkUrl
    ? `<script>(function(){var b=document.querySelector("[data-share-copy]"),i=document.getElementById("su-url");if(!b||!i)return;b.addEventListener("click",function(){i.select();var done=function(){b.textContent="コピーしました"};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(i.value).then(done,function(){document.execCommand("copy");done()})}else{document.execCommand("copy");done()}})})();</script>`
    : "";
  const body = options.shareable
    ? `<form class="su-page" method="post" action="${prefix}/library/link/share" data-zukan-share-link="j5">
<p class="su-lead">リンクを知っている人が、この記録を見られます。</p>
<div class="su-label">リンク</div>
${linkBox}
<div class="su-label">見られる期間</div>
<fieldset class="su-opts">
<label class="su-opt"><input type="radio" name="expires" value="none" checked><span class="su-radio"></span><span><strong>無期限</strong><span class="su-hint">取り消すまで見られます</span></span></label>
<label class="su-opt"><input type="radio" name="expires" value="30d"><span class="su-radio"></span><span><strong>30日</strong><span class="su-hint">30日たつと見られなくなります</span></span></label>
</fieldset>
<p class="su-note">リンクは「公開先」からいつでも取り消せます。</p>
<input type="hidden" name="observation" value="${escapeHtml(options.observationId)}">
<button class="su-btn" type="submit">リンクを作る</button>
</form>`
    : `<div class="su-page" data-zukan-share-link="j5-private">
<p class="su-lead">この記録は、まだ公開されていません。</p>
<p class="su-note">リンクで見せるには、先に図鑑に載せてください。載せたあとで、共有リンクを作れます。</p>
<a class="su-btn" href="${prefix}/library">ライブラリへ</a>
</div>`;
  return pageDoc(
    "共有リンク",
    options.lang,
    `<div class="su-back"><a href="${escapeHtml(back)}" aria-label="戻る">${ICON_BACK}</a>共有リンク</div>${body}`,
    script
  );
}

const ledgerKey = (userId: string, groupKey: string): string =>
  `zukan-link-ledger/${encodeURIComponent(userId)}/${encodeURIComponent(groupKey)}.json`;

const redirect = (location: string, status = 302): Response =>
  new Response(null, { status, headers: { location, "cache-control": "no-store" } });

export async function handleZukanShareAndUnlinkRoute(
  request: Request,
  env: Env,
  url: URL,
  nativePathname: string
): Promise<Response | null> {
  if (nativePathname !== "/library/link/cancel" && nativePathname !== "/library/link/share") return null;
  const lang = publicLangFromPath(url.pathname) ?? "ja";
  const prefix = `/${lang}`;
  const session = await readCompatibleSession(request, env).catch(() => null);
  if (!session || session.banned) {
    return redirect(`${prefix}/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
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

  if (nativePathname === "/library/link/cancel") {
    const groupKey = param("group").slice(0, 160);
    const group = groupKey ? await loadUserLibraryGroup(env, session.userId, groupKey) : null;
    if (!group || !group.published) return redirect(`${prefix}/library`);
    if (!isPost) return html(renderUnlinkConfirmPage({ lang, group }), 200, headers);
    const now = Date.now();
    await env.CORE_DB.prepare(ZUKAN_OBSERVATION_PUBLICATIONS_CREATE_SQL).run();
    for (const photo of group.photos) {
      await env.CORE_DB.prepare(
        "UPDATE zukan_observation_publications SET published = 0, updated_at = ?3 WHERE user_id = ?1 AND observation_id = ?2"
      ).bind(session.userId, photo.observationId, now).run();
    }
    await env.CORE_DB.prepare(
      "UPDATE zukan_observation_publications SET published = 0, updated_at = ?3 WHERE user_id = ?1 AND legacy_group_key = ?2"
    ).bind(session.userId, group.groupKey, now).run();
    await env.CORE_DB.prepare(ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL).run();
    await env.CORE_DB.prepare(
      "UPDATE zukan_book_publications SET published = 0, updated_at = ?2 WHERE group_key = ?1 AND user_id = ?3"
    ).bind(group.groupKey, now, session.userId).run();
    await env.ASSET_BUCKET.delete(ledgerKey(session.userId, group.groupKey)).catch(() => undefined);
    return redirect(`${prefix}/library`, 303);
  }

  const observationId = param("observation").slice(0, 128);
  const obs = observationId
    ? await env.OBS_DB.prepare("SELECT observation_id, owner_user_id, visibility FROM observations WHERE observation_id = ?1")
        .bind(observationId)
        .first<{ observation_id: string; owner_user_id: string; visibility: string }>()
        .catch(() => null)
    : null;
  if (!obs || obs.owner_user_id !== session.userId) return redirect(`${prefix}/library`);
  const shareable = obs.visibility === "public";

  if (isPost) {
    if (!shareable) return redirect(`${prefix}/library/link/share?observation=${encodeURIComponent(obs.observation_id)}`, 303);
    const expiry: ShareExpiry = param("expires") === "30d" ? "30d" : "none";
    const created = await handleCreateObservationShareLink(
      obs.observation_id,
      { userId: session.userId, displayName: session.displayName, banned: session.banned },
      env,
      { expiresInDays: expiry === "30d" ? 30 : null }
    );
    const body = (await created.json().catch(() => null)) as { ok?: boolean; token?: string } | null;
    if (!body?.ok || !body.token) return redirect(`${prefix}/library/link/share?observation=${encodeURIComponent(obs.observation_id)}`, 303);
    return redirect(
      `${prefix}/library/link/share?observation=${encodeURIComponent(obs.observation_id)}&token=${encodeURIComponent(body.token)}`,
      303
    );
  }

  let linkUrl: string | null = null;
  let expiresLabel: string | null = null;
  const token = url.searchParams.get("token") ?? "";
  if (shareable && /^share_[a-f0-9]{32}$/.test(token)) {
    const stored = await env.ASSET_BUCKET.get(`observation-share-links/${encodeURIComponent(token)}.json`).catch(() => null);
    const record = stored
      ? ((await new Response(stored.body).json().catch(() => null)) as { observationId?: string; createdBy?: string; expiresAt?: string | null } | null)
      : null;
    if (record && record.observationId === obs.observation_id && record.createdBy === session.userId) {
      linkUrl = `${url.origin}${prefix}/share/${token}`;
      const exp = record.expiresAt ? new Date(Date.parse(record.expiresAt) + 9 * 3600000) : null;
      expiresLabel = exp ? `${exp.getUTCMonth() + 1}月${exp.getUTCDate()}日まで見られます` : "取り消すまで見られます";
    }
  }
  return html(renderShareLinkPage({ lang, observationId: obs.observation_id, shareable, linkUrl, expiresLabel }), 200, headers);
}
