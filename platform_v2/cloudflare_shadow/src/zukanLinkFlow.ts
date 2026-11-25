import type { Env } from "./core/env";
import { assertSameOriginRequest, escapeHtml, html } from "./core/http";
import { publicLangFromPath, readCompatibleSession } from "./core/shared";
import {
  ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL,
  ZUKAN_OBSERVATION_PUBLICATIONS_CREATE_SQL,
  loadUserLibraryData,
  type TopLibraryGroup,
} from "./zukanTopPage";

export type LinkTargetKind = "place" | "event" | "org" | "link";
export type LinkVisibility = "named" | "anonymous";

export type LinkEventCandidate = { code: string; title: string };

export type LinkLedgerRecord = {
  groupKey: string;
  target: LinkTargetKind;
  targetLabel: string;
  targetRef: string | null;
  visibility: LinkVisibility;
  photoCount: number;
  observationIds: string[];
  linkedAt: string;
};

export const LINK_TARGETS_ENABLED: LinkTargetKind[] = ["place", "event"];

export const ZUKAN_LINK_FLOW_STYLES = `
:root{--zk-g:#143f2e;--zk-ink:#17251b;--zk-muted:#5a6a60;--zk-surface:#f6f7f4;--zk-line:#e4e8e2;--zk-red:#b3261e;--zk-fast:120ms;--zk-std:240ms;--zk-slow:360ms;--zk-out:cubic-bezier(.2,0,0,1);--zk-sheet:cubic-bezier(.32,.72,0,1)}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:var(--zk-ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.6}
.lk-logo{display:inline-block;margin:14px 20px;color:var(--zk-g);font-weight:800;font-size:22px;letter-spacing:.04em;text-decoration:none}
.lk-back{display:flex;align-items:center;justify-content:center;position:relative;min-height:56px;font-weight:800;font-size:18px}
.lk-back a{position:absolute;left:8px;top:6px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--zk-ink)}
.lk-page{max-width:520px;margin:0 auto;padding:0 20px 48px}
.lk-btn,.lk-btn:visited{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;border:0;border-radius:16px;background:var(--zk-g);color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer;transition:transform var(--zk-fast) var(--zk-out)}
.lk-btn:active{transform:scale(.98)}
.lk-btn.sub,.lk-btn.sub:visited{background:#fff;color:var(--zk-g);border:1px solid var(--zk-g);margin-top:12px}
.lk-opts{border:0;margin:0;padding:0}
.lk-opt{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--zk-line);cursor:pointer;transition:opacity var(--zk-std) var(--zk-out)}
.lk-opt input{position:absolute;opacity:0;pointer-events:none}
.lk-radio{flex:none;width:24px;height:24px;margin-top:2px;border:2px solid #aab3ad;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center}
.lk-opt input:checked+.lk-radio{border-color:var(--zk-g)}
.lk-opt input:checked+.lk-radio::after{content:"";width:12px;height:12px;border-radius:50%;background:var(--zk-g)}
.lk-opt input:focus-visible+.lk-radio{outline:3px solid #8fb9a0;outline-offset:2px}
.lk-opt strong{display:block;font-size:17px}
.lk-opt span.lk-hint{display:block;color:var(--zk-muted);font-size:14px}
.lk-opts:has(input:checked) .lk-opt:not(:has(input:checked)){opacity:.55}
.lk-note{margin:18px 0;padding:16px;border-radius:16px;background:var(--zk-surface);color:#3b4a40;font-size:14px}
.lk-sum{display:flex;gap:14px;align-items:center;padding:16px 0;border-bottom:1px solid var(--zk-line)}
.lk-sum img,.lk-sum .lk-ph{width:64px;height:64px;border-radius:12px;object-fit:cover;background:var(--zk-surface);flex:none}
.lk-sum strong{display:block;font-size:18px}
.lk-sum span{color:var(--zk-muted);font-size:14px}
.lk-label{margin:22px 0 8px;font-weight:800;font-size:14px;color:#3b4a40}
.lk-dest{display:flex;gap:12px;align-items:center;padding:14px 16px;border:1.5px solid #5a6a60;border-radius:14px;font-weight:800}
.lk-done{text-align:center;padding-top:72px}
.lk-circle{width:76px;height:76px;margin:0 auto 16px;border-radius:50%;background:#e8efe9;display:flex;align-items:center;justify-content:center;color:var(--zk-g)}
.lk-done h1{margin:0 0 8px;font-size:22px}
.lk-done p{margin:0 0 20px;color:var(--zk-muted)}
.lk-done img{width:120px;height:120px;border-radius:16px;object-fit:cover;margin-bottom:20px}
.lk-backdrop{padding:0 20px 360px;opacity:.55}
.lk-backdrop h2{margin:18px 0 10px;font-size:17px}
.lk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.lk-grid img,.lk-grid .lk-ph{width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:8px;background:var(--zk-surface);display:block}
.lk-shade{position:fixed;inset:0;background:rgba(20,30,25,.45);pointer-events:none}
.lk-sheet{position:fixed;left:0;right:0;bottom:0;max-width:560px;margin:0 auto;padding:12px 20px 28px;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,.18);animation:lk-up var(--zk-std) var(--zk-sheet) both}
.lk-sheet h1{margin:10px 0 2px;font-size:20px}
.lk-sheet .lk-sub{margin:0 0 4px;color:var(--zk-muted);font-size:14px}
.lk-grab{width:40px;height:4px;border-radius:2px;background:#d4dad6;margin:0 auto}
@keyframes lk-up{from{transform:translateY(100%)}to{transform:none}}
@media(min-width:900px){.lk-sheet{bottom:auto;top:50%;transform:translateY(-50%);border-radius:24px;animation:none}.lk-backdrop{padding-bottom:40px}}
@media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important;animation-duration:.01ms!important}}
`;

const ICON_BACK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>`;
const ICON_BOOK = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M5 17a3 3 0 013-3h11"/></svg>`;
const ICON_CHECK = `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

function pageDoc(title: string, lang: string, body: string): string {
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)} — ZUKAN</title>
<style>${ZUKAN_LINK_FLOW_STYLES}</style>
</head>
<body>${body}</body>
</html>`;
}

export function groupDateLabel(groupKey: string): string {
  const m = groupKey.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}月${Number(m[3])}日` : "";
}

function groupDay(groupKey: string): string {
  const m = groupKey.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : "";
}

function photoImg(group: TopLibraryGroup, index = 0, cls = ""): string {
  const photo = group.photos[index];
  return photo?.photoUrl
    ? `<img${cls ? ` class="${cls}"` : ""} src="${escapeHtml(photo.photoUrl)}" alt="" loading="lazy">`
    : `<span class="${cls || "lk-ph"}"></span>`;
}

function targetLabel(target: LinkTargetKind, group: TopLibraryGroup, event: LinkEventCandidate | null): string {
  if (target === "event" && event) return `${event.title} のアルバム`;
  return `${group.placeName} の図鑑`;
}

export function renderLinkChooserSheet(options: {
  lang: string;
  group: TopLibraryGroup;
  event: LinkEventCandidate | null;
}): string {
  const prefix = `/${options.lang}`;
  const { group, event } = options;
  const dateLabel = groupDateLabel(group.groupKey);
  const subjectName = event?.title ?? group.placeName;
  const rows: Array<{ kind: LinkTargetKind; title: string; hint: string }> = [
    { kind: "place", title: "場所のページ", hint: `${group.placeName} の図鑑に載ります` },
  ];
  if (event) rows.push({ kind: "event", title: "イベントのページ", hint: `${event.title} のアルバムに入ります` });
  const enabled = rows.filter((row) => LINK_TARGETS_ENABLED.includes(row.kind));
  const optsHtml = enabled
    .map(
      (row, index) => `<label class="lk-opt"><input type="radio" name="target" value="${row.kind}"${index === 0 ? " checked" : ""}><span class="lk-radio"></span><span><strong>${escapeHtml(row.title)}</strong><span class="lk-hint">${escapeHtml(row.hint)}</span></span></label>`
    )
    .join("");
  const backdrop = group.photos.slice(0, 3).map((_, i) => photoImg(group, i)).join("");
  return pageDoc(
    "つなぐ先を選ぶ",
    options.lang,
    `<a class="lk-logo" href="${prefix}/library">ZUKAN</a>
<div class="lk-backdrop" aria-hidden="true"><h2>${escapeHtml(group.headerLabel)}</h2><div class="lk-grid">${backdrop}</div></div>
<div class="lk-shade"></div>
<form class="lk-sheet" method="get" action="${prefix}/library/link/confirm" data-zukan-link-sheet="j1" role="dialog" aria-labelledby="lk-title">
<div class="lk-grab"></div>
<h1 id="lk-title">つなぐ先を選ぶ</h1>
<p class="lk-sub">写真 ${group.photos.length}枚 ・ ${escapeHtml(dateLabel)} ${escapeHtml(subjectName)}</p>
<input type="hidden" name="group" value="${escapeHtml(group.groupKey)}">
<fieldset class="lk-opts">${optsHtml}</fieldset>
<button class="lk-btn" type="submit">次へ</button>
</form>`
  );
}

export function renderLinkConfirmPage(options: {
  lang: string;
  group: TopLibraryGroup;
  target: LinkTargetKind;
  event: LinkEventCandidate | null;
  fieldName: string;
}): string {
  const prefix = `/${options.lang}`;
  const { group, target } = options;
  const dateLabel = groupDateLabel(group.groupKey);
  const dest = targetLabel(target, group, options.event);
  const backHref = `${prefix}/library/link?group=${encodeURIComponent(group.groupKey)}`;
  const name = options.fieldName || "あなた";
  return pageDoc(
    "つなぐ確認",
    options.lang,
    `<div class="lk-back"><a href="${escapeHtml(backHref)}" aria-label="戻る">${ICON_BACK}</a>つなぐ確認</div>
<form class="lk-page" method="post" action="${prefix}/library/link/confirm" data-zukan-link-confirm="j2">
<input type="hidden" name="group" value="${escapeHtml(group.groupKey)}">
<input type="hidden" name="target" value="${target}">
<div class="lk-sum">${photoImg(group, 0)}<div><strong>写真 ${group.photos.length}枚</strong><span>${escapeHtml(dateLabel)} ・ ${escapeHtml(options.event?.title ?? group.placeName)}</span></div></div>
<div class="lk-label">つなぎ先</div>
<div class="lk-dest">${ICON_BOOK}<span>${escapeHtml(dest)}</span></div>
<div class="lk-label">ほかの人への見え方</div>
<fieldset class="lk-opts">
<label class="lk-opt"><input type="radio" name="visibility" value="named" checked><span class="lk-radio"></span><span><strong>名前つきで載せる</strong><span class="lk-hint">フィールドネーム「${escapeHtml(name)}」が一緒に出ます</span></span></label>
<label class="lk-opt"><input type="radio" name="visibility" value="anonymous"><span class="lk-radio"></span><span><strong>名前なしで載せる</strong><span class="lk-hint">記録は載りますが、名前は出ません</span></span></label>
</fieldset>
<p class="lk-note">図鑑に載せた記録は、誰でも見られます。載せた後も、「公開先」から取り消せます。写真の場所と日時も一緒に載ります。</p>
<button class="lk-btn" type="submit">つなぐ</button>
</form>`
  );
}

export function renderLinkDonePage(options: {
  lang: string;
  group: TopLibraryGroup;
  record: LinkLedgerRecord;
  viewHref: string;
  viewLabel: string;
}): string {
  const prefix = `/${options.lang}`;
  return pageDoc(
    "つなぎました",
    options.lang,
    `<main class="lk-page lk-done" data-zukan-link-done="j3">
<div class="lk-circle">${ICON_CHECK}</div>
<h1>つなぎました</h1>
<p>写真 ${options.record.photoCount}枚が「${escapeHtml(options.record.targetLabel)}」に載りました。</p>
${photoImg(options.group, 0)}
<a class="lk-btn" href="${escapeHtml(options.viewHref)}">${escapeHtml(options.viewLabel)}</a>
<a class="lk-btn sub" href="${prefix}/library">ライブラリへ戻る</a>
</main>`
  );
}

const ledgerKey = (userId: string, groupKey: string): string =>
  `zukan-link-ledger/${encodeURIComponent(userId)}/${encodeURIComponent(groupKey)}.json`;

async function readLedger(env: Env, userId: string, groupKey: string): Promise<LinkLedgerRecord | null> {
  const obj = await env.ASSET_BUCKET.get(ledgerKey(userId, groupKey)).catch(() => null);
  if (!obj) return null;
  return ((await new Response(obj.body).json().catch(() => null)) as LinkLedgerRecord | null) ?? null;
}

async function findEventCandidate(env: Env, userId: string, groupKey: string): Promise<LinkEventCandidate | null> {
  const day = groupDay(groupKey);
  if (!day) return null;
  try {
    const row = await env.OBS_DB.prepare(
      `SELECT s.event_code AS code, s.title AS title
         FROM observation_event_sessions s
        WHERE substr(s.started_at, 1, 10) <= ?1
          AND substr(COALESCE(s.ended_at, s.started_at), 1, 10) >= ?1
          AND (s.organizer_user_id = ?2
               OR EXISTS (SELECT 1 FROM observation_event_participants p WHERE p.session_id = s.session_id AND p.user_id = ?2))
        ORDER BY s.started_at DESC
        LIMIT 1`
    ).bind(day, userId).first<{ code: string | null; title: string | null }>();
    if (row?.code && row.title) return { code: row.code, title: row.title };
  } catch {
    // event tables may be absent in minimal fixtures
  }
  return null;
}

function parseTarget(raw: unknown): LinkTargetKind | null {
  return typeof raw === "string" && (LINK_TARGETS_ENABLED as string[]).includes(raw) ? (raw as LinkTargetKind) : null;
}

export async function handleZukanLinkFlowRoute(
  request: Request,
  env: Env,
  url: URL,
  nativePathname: string
): Promise<Response | null> {
  if (nativePathname !== "/library/link" && !nativePathname.startsWith("/library/link/")) return null;
  const lang = publicLangFromPath(url.pathname) ?? "ja";
  const prefix = `/${lang}`;
  const session = await readCompatibleSession(request, env).catch(() => null);
  if (!session || session.banned) {
    return new Response(null, {
      status: 302,
      headers: { location: `${prefix}/login?next=${encodeURIComponent(url.pathname + url.search)}`, "cache-control": "no-store" },
    });
  }
  const headers = { "cache-control": "private, no-store" };
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

  const groupKey = param("group").slice(0, 160);
  const library = groupKey ? await loadUserLibraryData(env, session.userId) : null;
  const group = library?.groups.find((g) => g.groupKey === groupKey) ?? null;
  if (!group) return new Response(null, { status: 302, headers: { location: `${prefix}/library`, "cache-control": "no-store" } });
  const event = await findEventCandidate(env, session.userId, group.groupKey);

  if (nativePathname === "/library/link" && !isPost) {
    return html(renderLinkChooserSheet({ lang, group, event }), 200, headers);
  }

  if (nativePathname === "/library/link/confirm") {
    const target = parseTarget(param("target"));
    if (!target || (target === "event" && !event)) {
      return new Response(null, { status: 302, headers: { location: `${prefix}/library/link?group=${encodeURIComponent(group.groupKey)}`, "cache-control": "no-store" } });
    }
    if (!isPost) {
      return html(renderLinkConfirmPage({ lang, group, target, event, fieldName: session.displayName ?? "" }), 200, headers);
    }
    const visibility: LinkVisibility = param("visibility") === "anonymous" ? "anonymous" : "named";
    const observationIds = group.photos.map((p) => p.observationId);
    const now = Date.now();
    if (target === "place") {
      await env.CORE_DB.prepare(ZUKAN_OBSERVATION_PUBLICATIONS_CREATE_SQL).run();
      for (const obsId of observationIds) {
        await env.CORE_DB.prepare(
          `INSERT INTO zukan_observation_publications (user_id, observation_id, place_id, legacy_group_key, published, updated_at)
           VALUES (?1, ?2, ?3, ?4, 1, ?5)
           ON CONFLICT(user_id, observation_id) DO UPDATE SET
             place_id = COALESCE(excluded.place_id, zukan_observation_publications.place_id),
             legacy_group_key = COALESCE(excluded.legacy_group_key, zukan_observation_publications.legacy_group_key),
             published = 1,
             updated_at = excluded.updated_at`
        ).bind(session.userId, obsId, group.placeId ?? null, group.groupKey, now).run();
      }
      await env.CORE_DB.prepare(ZUKAN_BOOK_PUBLICATIONS_CREATE_SQL).run();
      await env.CORE_DB.prepare(
        `INSERT INTO zukan_book_publications (group_key, user_id, place_name, observation_ids_json, published, updated_at)
         VALUES (?1, ?2, ?3, ?4, 1, ?5)
         ON CONFLICT(group_key) DO UPDATE SET
           place_name = excluded.place_name,
           observation_ids_json = excluded.observation_ids_json,
           published = 1,
           updated_at = excluded.updated_at
         WHERE zukan_book_publications.user_id = excluded.user_id`
      ).bind(group.groupKey, session.userId, group.placeName, JSON.stringify(observationIds), now).run();
    }
    const record: LinkLedgerRecord = {
      groupKey: group.groupKey,
      target,
      targetLabel: targetLabel(target, group, event),
      targetRef: target === "event" ? event?.code ?? null : group.placeId ?? null,
      visibility,
      photoCount: observationIds.length,
      observationIds,
      linkedAt: new Date(now).toISOString(),
    };
    await env.ASSET_BUCKET.put(ledgerKey(session.userId, group.groupKey), JSON.stringify(record), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });
    return new Response(null, {
      status: 303,
      headers: { location: `${prefix}/library/link/done?group=${encodeURIComponent(group.groupKey)}`, "cache-control": "no-store" },
    });
  }

  if (nativePathname === "/library/link/done" && !isPost) {
    const record = await readLedger(env, session.userId, group.groupKey);
    if (!record) return new Response(null, { status: 302, headers: { location: `${prefix}/library`, "cache-control": "no-store" } });
    const viewHref = record.target === "event" && record.targetRef
      ? `${prefix}/community/events/${encodeURIComponent(record.targetRef)}`
      : record.targetRef
        ? `${prefix}/places/${encodeURIComponent(record.targetRef)}`
        : `${prefix}/library`;
    return html(
      renderLinkDonePage({ lang, group, record, viewHref, viewLabel: record.target === "event" ? "イベントを見る" : "図鑑を見る" }),
      200,
      headers
    );
  }

  return null;
}
