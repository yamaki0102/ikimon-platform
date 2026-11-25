import type { Env } from "./core/env";
import { escapeHtml } from "./core/http";
import {
  destinationKey,
  findActiveGuestPass,
  isGuestPostingEnabled,
  normalizeGuestDestination,
} from "./guestPosting";

const IN_APP_BROWSER_RE = /(Line\/|Instagram|FBAN|FBAV|Twitter|MicroMessenger|YJApp|TikTok)/i;

export function isInAppBrowserUserAgent(userAgent: string): boolean {
  return IN_APP_BROWSER_RE.test(userAgent);
}

async function loadGuestDestinationTitle(
  db: Env["OBS_DB"],
  kind: "place" | "event",
  id: string
): Promise<string | null> {
  if (kind === "place") {
    const row = await db.prepare(
      "SELECT name FROM places WHERE place_id = ? AND visibility = 'public' LIMIT 1"
    ).bind(id).first<{ name: string }>();
    return row?.name ?? null;
  }
  const row = await db.prepare(
    "SELECT title FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(id).first<{ title: string }>();
  return row?.title ?? null;
}

/**
 * Render the single-destination QR guest entry page (`/:lang/guest/:kind/:id`).
 * Never issues a guest pass on GET; only clicking "ここで投稿する" calls `POST /api/v1/guest/pass/issue`.
 */
export async function handleGuestEntryPageRoute(
  kindRaw: string,
  idRaw: string,
  lang: "ja" | "en" | "es" | "pt-br",
  request: Request,
  env: Env
): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }
  const dest = normalizeGuestDestination(kindRaw, idRaw);
  if (!dest) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const destTitle = await loadGuestDestinationTitle(env.OBS_DB, dest.kind, dest.id);
  if (!destTitle) {
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  }

  const key = destinationKey(dest);
  const quota = await env.OBS_DB.prepare(
    "SELECT qr_stopped FROM guest_destination_quotas WHERE destination_key = ? LIMIT 1"
  ).bind(key).first<{ qr_stopped: number }>();
  const qrStopped = quota?.qr_stopped === 1;

  const activePass = await findActiveGuestPass(env.OBS_DB, request);
  const isEn = lang === "en";
  const inAppWarning = isInAppBrowserUserAgent(request.headers.get("user-agent") ?? "")
    ? `<aside class="zg-warn" data-guest-inapp-warning="1" role="status">
        <strong>${isEn ? "Open in Safari / Chrome" : "外部ブラウザで開くことをおすすめします"}</strong>
        <p>${
          isEn
            ? "In-app browsers (LINE / Instagram / X) may clear your guest pass cookie. Open this page in Safari or Chrome from the menu."
            : "LINEやSNSのアプリ内ブラウザでは、参加証（Cookie）が消えることがあります。右上のメニューから「Safari / Chromeで開く」をおすすめします。"
        }</p>
      </aside>`
    : "";

  const stoppedBanner = qrStopped
    ? `<section class="zg-card zg-stopped" data-guest-qr-stopped="1">
        <h2>${isEn ? "Guest posting is paused" : "ただいまQRからの投稿を停止しています"}</h2>
        <p>${isEn ? "Please check with the organizer or sign in to post." : "主催者または管理者により受付が停止されています。"}</p>
      </section>`
    : "";

  const actionSection = qrStopped
    ? ""
    : activePass
      ? `<section class="zg-card" data-guest-active-pass="1">
          <p class="zg-badge">${isEn ? "Guest pass active on this device" : "この端末で参加証が有効です（自分だけ保存・後で会へ共有可能）"}</p>
          <form class="zg-form" data-guest-post-form="1" id="guest-post-form">
            <label for="zg-taxon">${isEn ? "Species / title (optional)" : "生きもの名・タイトル（任意）"}</label>
            <input id="zg-taxon" name="taxonLabel" type="text" maxlength="120" placeholder="${isEn ? "e.g. Kingfisher" : "例：カワセミ"}">
            <label for="zg-note">${isEn ? "Note (optional)" : "メモ（任意）"}</label>
            <textarea id="zg-note" name="note" rows="3" maxlength="2000"></textarea>
            <button type="submit" class="zg-btn-primary">${isEn ? "Save record" : "記録を保存する"}</button>
            <p class="zg-status" id="guest-post-status" aria-live="polite"></p>
          </form>
        </section>
        <section class="zg-card" data-guest-handoff-panel="1">
          <h2>${isEn ? "Handoff code (keep your records)" : "引き継ぎコード（機種変更・アカウント登録用）"}</h2>
          <p>${
            isEn
              ? "Issue a one-time handoff code to recover this pass or move records to an account later."
              : "端末を変えたりアカウント登録したあとに記録を引き継ぐためのコードを発行できます（1回限り表示）。"
          }</p>
          <button type="button" class="zg-btn-outline" id="guest-handoff-btn">${isEn ? "Issue handoff code" : "引き継ぎコードを発行・表示"}</button>
          <output id="guest-handoff-code" class="zg-code" aria-live="polite"></output>
          <button type="button" class="zg-btn-text" id="guest-discard-btn">${isEn ? "Discard pass on this device" : "この端末の参加証を捨てる"}</button>
        </section>`
      : `<section class="zg-card" data-guest-start-panel="1">
          <p>${
            isEn
              ? "Post observations here without registering. Records stay private to this device unless you share them."
              : "アカウント登録なしで、この場所・会に記録を残せます。最初は「自分だけ」に保存されます。"
          }</p>
          <button type="button" class="zg-btn-primary" id="guest-start-btn" data-guest-start-btn="1">${isEn ? "Post here" : "ここで投稿する"}</button>
          <p class="zg-status" id="guest-start-status" aria-live="polite"></p>
        </section>
        <section class="zg-card" data-guest-recover-form="1">
          <h2>${isEn ? "Recover with handoff code" : "引き継ぎコードで復旧する"}</h2>
          <form class="zg-form" id="guest-recover-form">
            <label for="zg-recover-code">${isEn ? "Handoff code" : "引き継ぎコード"}</label>
            <input id="zg-recover-code" name="handoffCode" type="text" placeholder="ZKN-XXXX-XXXX-XXXX" required>
            <button type="submit" class="zg-btn-outline">${isEn ? "Recover pass" : "参加証を復旧する"}</button>
            <p class="zg-status" id="guest-recover-status" aria-live="polite"></p>
          </form>
        </section>`;

  const script = `<script>
(() => {
  const destKind = ${JSON.stringify(dest.kind)};
  const destId = ${JSON.stringify(dest.id)};
  const startBtn = document.getElementById("guest-start-btn");
  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      startBtn.disabled = true;
      const res = await fetch("/api/v1/guest/pass/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destinationKind: destKind, destinationId: destId }),
      });
      if (res.ok) {
        location.reload();
      } else {
        document.getElementById("guest-start-status").textContent = "開始できませんでした";
        startBtn.disabled = false;
      }
    });
  }
  const postForm = document.getElementById("guest-post-form");
  if (postForm) {
    postForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(postForm);
      const res = await fetch("/api/v1/guest/observations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          destinationKind: destKind,
          destinationId: destId,
          taxonLabel: fd.get("taxonLabel") || undefined,
          note: fd.get("note") || undefined,
        }),
      });
      const out = document.getElementById("guest-post-status");
      if (res.ok) {
        postForm.reset();
        out.textContent = "「自分だけ」として保存しました。";
      } else {
        out.textContent = "保存に失敗しました (" + res.status + ")";
      }
    });
  }
  const handoffBtn = document.getElementById("guest-handoff-btn");
  if (handoffBtn) {
    handoffBtn.addEventListener("click", async () => {
      const res = await fetch("/api/v1/guest/handoff-code", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      document.getElementById("guest-handoff-code").textContent = data.code || "発行できませんでした";
    });
  }
  const discardBtn = document.getElementById("guest-discard-btn");
  if (discardBtn) {
    discardBtn.addEventListener("click", async () => {
      const res = await fetch("/api/v1/guest/pass/discard", { method: "POST" });
      if (res.ok) location.reload();
    });
  }
  const recoverForm = document.getElementById("guest-recover-form");
  if (recoverForm) {
    recoverForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const code = new FormData(recoverForm).get("handoffCode");
      const res = await fetch("/api/v1/guest/handoff/recover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoffCode: code }),
      });
      if (res.ok) {
        location.reload();
      } else {
        document.getElementById("guest-recover-status").textContent = "コードが見つからないか使用済みです。";
      }
    });
  }
})();
</script>`;

  const html = `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(destTitle)} — ZUKAN</title>
  <style>
    :root{color-scheme:light;--bg:#ffffff;--surface:#f6f7f6;--ink:#17251b;--muted:#485a4e;--green:#245c3a;--capture:#b94f18;--line:#dce3dd}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.5}
    .zg-main{max-width:600px;margin:0 auto;padding:20px 16px 48px;display:grid;gap:16px}
    .zg-card{padding:18px;border:1px solid var(--line);border-radius:14px;background:var(--surface);display:grid;gap:12px}
    .zg-warn{padding:14px 16px;border:1px solid #d97706;border-radius:12px;background:#fffbeb;color:#78350f;display:grid;gap:4px;font-size:14px}
    .zg-warn p{margin:0}
    .zg-badge{margin:0;padding:6px 10px;border-radius:8px;background:#e8f2ec;color:var(--green);font-weight:700;font-size:14px}
    .zg-form{display:grid;gap:10px}
    .zg-form input,.zg-form textarea{width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit}
    .zg-btn-primary{min-height:48px;padding:10px 18px;border:0;border-radius:10px;background:var(--capture);color:#fff;font:inherit;font-weight:800;cursor:pointer}
    .zg-btn-outline{min-height:44px;padding:8px 16px;border:1px solid var(--green);border-radius:10px;background:#fff;color:var(--green);font:inherit;font-weight:800;cursor:pointer}
    .zg-btn-text{min-height:44px;padding:8px;border:0;background:transparent;color:var(--muted);font:inherit;text-decoration:underline;cursor:pointer;justify-self:start}
    .zg-code{font-family:ui-monospace,monospace;font-size:18px;font-weight:800;letter-spacing:.06em;color:var(--green)}
    .zg-status{margin:0;font-size:14px;color:var(--muted)}
  </style>
</head>
<body>
  <main class="zg-main" data-guest-entry-page="1" data-guest-dest="${escapeHtml(key)}">
    <header>
      <p style="margin:0;color:var(--muted);font-size:14px;">${dest.kind === "event" ? (isEn ? "Observation Event" : "観察会") : (isEn ? "Place" : "場所")}</p>
      <h1 style="margin:4px 0 0;font-size:24px;">${escapeHtml(destTitle)}</h1>
    </header>
    ${inAppWarning}
    ${stoppedBanner}
    ${actionSection}
  </main>
  ${script}
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
