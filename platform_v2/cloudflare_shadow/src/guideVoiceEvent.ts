import {
  APP_EXPERIENCE_STYLES,
  renderAppExperienceHeader,
  renderAppExperienceNavigation,
  renderAppExperienceQuickCamera
} from "../../src/ui/appExperience";
import type { Env } from "./core/env";

export type ParsedGuideVoiceUtterance = {
  badgeNumber: number | null;
  subject: string;
  count: number;
  detail: string;
};

export type GuideBadgeDiscoveryRow = {
  discovery_id: string;
  session_id: string;
  badge_number: number;
  client_entry_id: string;
  utterance: string;
  subject: string;
  count: number;
  detail: string;
  ai_comment: string;
  recorder_label: string;
  latitude: number | null;
  longitude: number | null;
  area_label: string;
  face_privacy_status: string;
  observed_at: string;
  created_at: number;
};

export const GUIDE_BADGE_DISCOVERIES_CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS guide_badge_discoveries (
  discovery_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  badge_number INTEGER NOT NULL,
  client_entry_id TEXT NOT NULL,
  utterance TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  detail TEXT NOT NULL DEFAULT '',
  ai_comment TEXT NOT NULL DEFAULT '',
  recorder_label TEXT NOT NULL DEFAULT 'guide-1',
  latitude REAL,
  longitude REAL,
  area_label TEXT NOT NULL DEFAULT '',
  face_privacy_status TEXT NOT NULL DEFAULT 'verified_no_faces',
  observed_at TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(session_id, client_entry_id)
)
`.trim();

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const VERIFIED_FACE_STATUSES = new Set(["verified_no_faces"]);

function facePrivacyLabel(status: string): string {
  return VERIFIED_FACE_STATUSES.has(status) ? "顔の確認済み（顔0件）" : "顔の確認なし（未確認）";
}

function toAsciiDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

export function parseGuideVoiceUtterance(rawUtterance: string): ParsedGuideVoiceUtterance {
  const normalized = toAsciiDigits(String(rawUtterance ?? "")).trim();
  if (!normalized) {
    return { badgeNumber: null, subject: "", count: 1, detail: "" };
  }

  let badgeNumber: number | null = null;
  let remainder = normalized;

  const badgeMatch = normalized.match(/^(\d{1,4})\s*(?:番|ばん|号)?[\s、,・:：-]*(.*)$/u);
  if (badgeMatch) {
    const parsedBadge = Number(badgeMatch[1]);
    if (Number.isInteger(parsedBadge) && parsedBadge >= 1 && parsedBadge <= 9999) {
      badgeNumber = parsedBadge;
      remainder = (badgeMatch[2] ?? "").trim();
    }
  }

  const segments = remainder
    .split(/[、,・\n]+/u)
    .map((part) => part.trim())
    .filter(Boolean);

  let subject = segments[0] ?? remainder;
  let detail = segments.slice(1).join(" / ");
  let count = 1;

  const countSource = detail || subject;
  const countMatch = countSource.match(/(\d{1,4})\s*(?:匹|ひき|びき|ぴき|羽|わ|ば|ぱ|頭|とう|本|ほん|ぼん|ぽん|枚|まい|株|かぶ|個|こ|つ|件)?\s*$/u);
  if (countMatch) {
    const parsedCount = Number(countMatch[1]);
    if (Number.isInteger(parsedCount) && parsedCount >= 0 && parsedCount <= 9999) {
      count = parsedCount;
    }
    if (!detail && subject.includes(" ")) {
      const spaceIdx = subject.lastIndexOf(" ");
      detail = subject.slice(spaceIdx + 1).trim();
      subject = subject.slice(0, spaceIdx).trim();
    }
  }

  if (!subject) subject = remainder || "観察記録";

  return {
    badgeNumber,
    subject: subject.slice(0, 120),
    count,
    detail: detail.slice(0, 240)
  };
}

export function buildGuideDiscoveryAiComment(input: {
  badgeNumber: number;
  subject: string;
  count: number;
  detail?: string;
}): string {
  const detailSuffix = input.detail ? `（${input.detail}）` : "";
  return `${input.badgeNumber}番さんの発見「${input.subject}」${detailSuffix}（数: ${input.count}）を記録しました。次の観察会では、同じ場所の季節ごとの変化も比べてみましょう。`;
}

export type GuideSyncEntryInput = {
  clientEntryId?: unknown;
  utterance?: unknown;
  badgeNumber?: unknown;
  subject?: unknown;
  count?: unknown;
  detail?: unknown;
  recorderLabel?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  areaLabel?: unknown;
  facePrivacyStatus?: unknown;
  faceDetected?: unknown;
  faceBlurred?: unknown;
  observedAt?: unknown;
};

export async function listGuideBadgeDiscoveries(
  env: Env,
  sessionId: string,
  badgeNumber?: number | null
): Promise<GuideBadgeDiscoveryRow[]> {
  await env.CORE_DB.prepare(GUIDE_BADGE_DISCOVERIES_CREATE_TABLE_SQL).run();
  const stmt = typeof badgeNumber === "number" && Number.isInteger(badgeNumber)
    ? env.CORE_DB.prepare(
        `SELECT discovery_id, session_id, badge_number, client_entry_id, utterance, subject, count, detail, ai_comment, recorder_label, latitude, longitude, area_label, face_privacy_status, observed_at, created_at
         FROM guide_badge_discoveries
         WHERE session_id = ?1 AND badge_number = ?2
         ORDER BY created_at ASC`
      ).bind(sessionId, badgeNumber)
    : env.CORE_DB.prepare(
        `SELECT discovery_id, session_id, badge_number, client_entry_id, utterance, subject, count, detail, ai_comment, recorder_label, latitude, longitude, area_label, face_privacy_status, observed_at, created_at
         FROM guide_badge_discoveries
         WHERE session_id = ?1
         ORDER BY created_at DESC`
      ).bind(sessionId);
  const res = await stmt.all<GuideBadgeDiscoveryRow>();
  return res.results ?? [];
}

export function toBadgeOnlyDiscovery(row: GuideBadgeDiscoveryRow) {
  const observedDate = String(row.observed_at ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  const createdDate = Number.isFinite(row.created_at) ? new Date(row.created_at).toISOString().slice(0, 10) : "";
  return {
    discovery_id: row.discovery_id,
    session_id: row.session_id,
    badge_number: row.badge_number,
    client_entry_id: row.client_entry_id,
    utterance: row.utterance,
    subject: row.subject,
    count: row.count,
    detail: row.detail,
    ai_comment: row.ai_comment,
    recorder_label: row.recorder_label,
    area_label: row.area_label,
    face_privacy_status: row.face_privacy_status,
    observed_at: observedDate,
    created_at: createdDate
  };
}

export async function insertGuideBadgeDiscoveries(
  env: Env,
  sessionId: string,
  rawEntries: GuideSyncEntryInput[],
  defaultRecorderLabel = "guide-1"
): Promise<{ syncedCount: number; rejected: Array<{ clientEntryId: string; error: string }> }> {
  await env.CORE_DB.prepare(GUIDE_BADGE_DISCOVERIES_CREATE_TABLE_SQL).run();
  let syncedCount = 0;
  const rejected: Array<{ clientEntryId: string; error: string }> = [];

  for (const raw of rawEntries.slice(0, 100)) {
    const clientEntryId = typeof raw.clientEntryId === "string" && raw.clientEntryId.trim()
      ? raw.clientEntryId.trim().slice(0, 120)
      : `gv_${crypto.randomUUID()}`;

    const faceStatus = typeof raw.facePrivacyStatus === "string" && raw.facePrivacyStatus.trim() ? raw.facePrivacyStatus.trim() : "unverified";
    if (faceStatus === "faces_present_unblurred" || (raw.faceDetected === true && raw.faceBlurred !== true)) {
      rejected.push({ clientEntryId, error: "face_blur_required" });
      continue;
    }

    const utterance = typeof raw.utterance === "string" ? raw.utterance.trim().slice(0, 400) : "";
    const parsed = utterance ? parseGuideVoiceUtterance(utterance) : { badgeNumber: null, subject: "", count: 1, detail: "" };

    const badgeNumber = typeof raw.badgeNumber === "number" && Number.isInteger(raw.badgeNumber)
      ? raw.badgeNumber
      : parsed.badgeNumber;
    if (!badgeNumber || badgeNumber < 1 || badgeNumber > 9999) {
      rejected.push({ clientEntryId, error: "badge_number_required" });
      continue;
    }

    const subject = (typeof raw.subject === "string" && raw.subject.trim() ? raw.subject.trim() : parsed.subject).slice(0, 120);
    if (!subject) {
      rejected.push({ clientEntryId, error: "subject_required" });
      continue;
    }

    const count = typeof raw.count === "number" && Number.isFinite(raw.count) && raw.count >= 0
      ? Math.round(raw.count)
      : parsed.count;
    const detail = (typeof raw.detail === "string" ? raw.detail.trim() : parsed.detail).slice(0, 240);
    const recorderLabel = (typeof raw.recorderLabel === "string" && raw.recorderLabel.trim()
      ? raw.recorderLabel.trim()
      : defaultRecorderLabel).slice(0, 40);
    const latitude = typeof raw.latitude === "number" && Number.isFinite(raw.latitude) ? raw.latitude : null;
    const longitude = typeof raw.longitude === "number" && Number.isFinite(raw.longitude) ? raw.longitude : null;
    const areaLabel = typeof raw.areaLabel === "string" ? raw.areaLabel.trim().slice(0, 120) : "";
    const observedAt = typeof raw.observedAt === "string" && raw.observedAt.trim()
      ? raw.observedAt.trim().slice(0, 64)
      : new Date().toISOString();
    const aiComment = buildGuideDiscoveryAiComment({ badgeNumber, subject, count, detail });

    const res = await env.CORE_DB.prepare(
      `INSERT OR IGNORE INTO guide_badge_discoveries (
        discovery_id, session_id, badge_number, client_entry_id, utterance, subject, count, detail, ai_comment,
        recorder_label, latitude, longitude, area_label, face_privacy_status, observed_at, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
    ).bind(
      `gvd_${crypto.randomUUID()}`,
      sessionId,
      badgeNumber,
      clientEntryId,
      utterance,
      subject,
      count,
      detail,
      aiComment,
      recorderLabel,
      latitude,
      longitude,
      areaLabel,
      faceStatus,
      observedAt,
      Date.now()
    ).run();

    const changes = Number((res as { meta?: { changes?: number } } | null)?.meta?.changes ?? 1);
    if (changes > 0) syncedCount += 1;
  }

  return { syncedCount, rejected };
}

export function renderGuideVoiceConsolePage(input: {
  sessionId: string;
  title: string;
  eventCode: string;
  lang: string;
  cspNonce?: string;
  initialDiscoveries: GuideBadgeDiscoveryRow[];
  canViewDiscoveries?: boolean;
}): string {
  const lang = input.lang === "en" || input.lang === "es" || input.lang === "pt-br" ? input.lang : "ja";
  const prefix = `/${lang}`;
  const cspNonce = input.cspNonce ?? "";
  const badgeNumbers = [...new Set(input.initialDiscoveries.map((d) => d.badge_number))].sort((a, b) => a - b);

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(input.title)} — 案内人音声記録 | ZUKAN</title>
  <style nonce="${escapeHtml(cspNonce)}">
    ${APP_EXPERIENCE_STYLES}
    .gv-shell{max-width:720px;margin:18px auto 104px;padding:0 16px;display:grid;gap:16px}
    .gv-card{background:#fff;border:1px solid #d8e1d9;border-radius:18px;padding:20px;display:grid;gap:12px}
    .gv-eyebrow{display:inline-block;width:max-content;padding:4px 10px;border-radius:999px;background:#eaf4ee;color:#1e6f4c;font-size:12px;font-weight:700}
    .gv-card h1,.gv-card h2{margin:0;line-height:1.35}
    .gv-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .gv-btn{min-height:44px;padding:10px 16px;border-radius:12px;border:0;background:#1e6f4c;color:#fff;font:inherit;font-weight:700;cursor:pointer}
    .gv-btn.is-secondary{background:#eef4ef;color:#1e6f4c;border:1px solid #c5d6cb}
    .gv-input{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid #c8d3ca;font:inherit}
    .gv-list{margin:0;padding:0;list-style:none;display:grid;gap:8px}
    .gv-item{padding:12px;border-radius:12px;background:#f7faf7;border:1px solid #e1e9e2;display:grid;gap:4px}
    .gv-badges{display:flex;flex-wrap:wrap;gap:8px}
    .gv-badge-link{display:inline-flex;align-items:center;min-height:40px;padding:6px 14px;border-radius:999px;background:#fff;border:1px solid #1e6f4c;color:#1e6f4c;font-weight:700;text-decoration:none}
    .gv-status{font-size:14px;font-weight:600;color:#1e6f4c}
  </style>
</head>
<body>
  ${renderAppExperienceHeader(lang, 4, true, "guide-voice-main", { currentPath: `${prefix}/events/${input.sessionId}/guide-voice` })}
  <main id="guide-voice-main" class="gv-shell" data-guide-voice-console data-session-id="${escapeHtml(input.sessionId)}">
    <section class="gv-card">
      <span class="gv-eyebrow">案内人1台・声と番号名札記録</span>
      <h1>${escapeHtml(input.title)}</h1>
      <p>参加者の番号と発見を声で話すだけで記録します（例: 「3番、ヤツデの花、ハチ2匹」）。圏外でも端末に保存し、電波が戻ると自動同期します。</p>
      <div class="gv-row">
        ${input.eventCode
          ? `<span>行事コード（2台目連携用）: <strong>${escapeHtml(input.eventCode)}</strong></span><input id="gv-event-code" type="hidden" value="${escapeHtml(input.eventCode)}">`
          : `<label>行事コード（主催者から受け取った番号）: <input id="gv-event-code" class="gv-input" type="text" autocomplete="off" style="width:auto"></label>`}
        <label>端末役割:
          <select id="gv-recorder-label" class="gv-input" style="width:auto">
            <option value="guide-1">案内人（1台目）</option>
            <option value="recorder-2">記録係（2台目）</option>
          </select>
        </label>
      </div>
      <form id="gv-voice-form" class="gv-card" style="padding:14px;background:#f9fbf9">
        <div class="gv-row">
          <button type="button" id="gv-mic-btn" class="gv-btn">音声入力を開始</button>
          <button type="button" id="gv-sync-btn" class="gv-btn is-secondary">今すぐ同期 (<span id="gv-pending-count">0</span>)</button>
        </div>
        <label>発話内容（音声入力または手入力）
          <input id="gv-utterance" class="gv-input" type="text" placeholder="3番、ヤツデの花、ハチ2匹" required>
        </label>
        <button type="submit" class="gv-btn">この内容で記録</button>
        <div id="gv-status" class="gv-status" role="status" aria-live="polite"></div>
      </form>
    </section>

    ${input.canViewDiscoveries === false ? "" : `<section class="gv-card">
      <h2>番号別・持ち帰りページ（登録不要QR先）</h2>
      <div id="gv-badge-links" class="gv-badges">
        ${badgeNumbers.length > 0
          ? badgeNumbers.map((n) => `<a class="gv-badge-link" href="${escapeHtml(`${prefix}/events/${encodeURIComponent(input.sessionId)}/takeaway/${n}`)}">${n}番の持ち帰りページ</a>`).join("")
          : `<span>まだ番号付きの記録はありません。</span>`}
      </div>
    </section>`}

    <section class="gv-card" id="gv-discovery-section"${input.canViewDiscoveries === false ? " hidden" : ""}>
      <h2>記録一覧</h2>
      <ul id="gv-discovery-list" class="gv-list">
        ${input.canViewDiscoveries === false ? "" : input.initialDiscoveries.map((d) => `<li class="gv-item"><strong>${d.badge_number}番・${escapeHtml(d.subject)}（${d.count}）</strong><span>${escapeHtml(d.detail || d.utterance)}</span><small>${escapeHtml(d.recorder_label)} / ${escapeHtml(d.observed_at)} / ${escapeHtml(facePrivacyLabel(d.face_privacy_status))}</small></li>`).join("")}
      </ul>
    </section>
  </main>
  ${renderAppExperienceNavigation(lang, 4, "bottom", true)}${renderAppExperienceQuickCamera(lang, { nonce: cspNonce })}
  <script nonce="${escapeHtml(cspNonce)}">
    (function () {
      var sessionId = ${JSON.stringify(input.sessionId)};
      var queueKey = "zukan_guide_queue_" + sessionId;
      var form = document.getElementById("gv-voice-form");
      var input = document.getElementById("gv-utterance");
      var statusEl = document.getElementById("gv-status");
      var pendingEl = document.getElementById("gv-pending-count");
      var syncBtn = document.getElementById("gv-sync-btn");
      var micBtn = document.getElementById("gv-mic-btn");
      var recorderSelect = document.getElementById("gv-recorder-label");
      var eventCodeEl = document.getElementById("gv-event-code");
      if (!form || !input) return;

      function readQueue() {
        try { return JSON.parse(localStorage.getItem(queueKey) || "[]"); } catch { return []; }
      }
      function writeQueue(items) {
        try { localStorage.setItem(queueKey, JSON.stringify(items)); } catch {}
        if (pendingEl) pendingEl.textContent = String(items.length);
      }
      writeQueue(readQueue());

      var sectionEl = document.getElementById("gv-discovery-section");
      var listEl = document.getElementById("gv-discovery-list");
      function renderEntries(entries) {
        if (!listEl || !Array.isArray(entries)) return;
        if (sectionEl) sectionEl.hidden = false;
        listEl.textContent = "";
        entries.forEach(function (d) {
          var li = document.createElement("li");
          li.className = "gv-item";
          var head = document.createElement("strong");
          head.textContent = d.badge_number + "番・" + d.subject + "（" + d.count + "）";
          var body = document.createElement("span");
          body.textContent = d.detail || d.utterance || "";
          var meta = document.createElement("small");
          meta.textContent = (d.recorder_label || "") + " / " + (d.observed_at || "");
          li.appendChild(head);
          li.appendChild(body);
          li.appendChild(meta);
          listEl.appendChild(li);
        });
      }

      async function flushQueue() {
        var queue = readQueue();
        if (!queue.length) return;
        try {
          var res = await fetch("/api/v1/observation-events/" + encodeURIComponent(sessionId) + "/guide-discoveries/sync", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              eventCode: eventCodeEl ? eventCodeEl.value : "",
              recorderLabel: recorderSelect ? recorderSelect.value : "guide-1",
              entries: queue
            })
          });
          if (res.ok) {
            writeQueue([]);
            if (statusEl) statusEl.textContent = "同期しました（" + queue.length + "件）。";
            res.json().then(function (data) { renderEntries(data && data.entries); }).catch(function () {});
          } else if (res.status === 403 && statusEl) {
            statusEl.textContent = "行事コードが違うため同期できません。";
          }
        } catch {
          if (statusEl) statusEl.textContent = "圏外のため端末に保存しました（オンライン時に同期します）。";
        }
      }

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var text = String(input.value || "").trim();
        if (!text) return;
        var queue = readQueue();
        queue.push({
          clientEntryId: "gv_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          utterance: text,
          observedAt: new Date().toISOString(),
          recorderLabel: recorderSelect ? recorderSelect.value : "guide-1",
          facePrivacyStatus: "unverified"
        });
        writeQueue(queue);
        input.value = "";
        if (statusEl) statusEl.textContent = "端末に記録しました。同期を試行中...";
        void flushQueue();
      });

      if (syncBtn) syncBtn.addEventListener("click", function () { void flushQueue(); });
      window.addEventListener("online", function () { void flushQueue(); });

      var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (micBtn && SpeechRec) {
        var rec = new SpeechRec();
        rec.lang = "ja-JP";
        rec.continuous = false;
        rec.onresult = function (ev) {
          var transcript = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : "";
          if (transcript) {
            input.value = transcript;
            form.requestSubmit();
          }
        };
        micBtn.addEventListener("click", function () {
          try { rec.start(); if (statusEl) statusEl.textContent = "音声を聞いています…"; } catch {}
        });
      } else if (micBtn) {
        micBtn.disabled = true;
        micBtn.textContent = "音声入力非対応ブラウザ（手入力可）";
      }
    })();
  </script>
</body>
</html>`;
}

export function renderGuideBadgeTakeawayPage(input: {
  sessionId: string;
  eventTitle: string;
  badgeNumber: number;
  nextEventNote: string;
  lang: string;
  cspNonce?: string;
  discoveries: GuideBadgeDiscoveryRow[];
  publicPlace?: { placeId: string; name: string } | null;
}): string {
  const lang = input.lang === "en" || input.lang === "es" || input.lang === "pt-br" ? input.lang : "ja";
  const prefix = `/${lang}`;
  const cspNonce = input.cspNonce ?? "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${input.badgeNumber}番さんの持ち帰り — ${escapeHtml(input.eventTitle)} | ZUKAN</title>
  <style nonce="${escapeHtml(cspNonce)}">
    ${APP_EXPERIENCE_STYLES}
    .gt-shell{max-width:640px;margin:20px auto 104px;padding:0 16px;display:grid;gap:16px}
    .gt-card{background:#fff;border:1px solid #d8e1d9;border-radius:18px;padding:22px;display:grid;gap:10px}
    .gt-eyebrow{display:inline-block;width:max-content;padding:4px 10px;border-radius:999px;background:#eaf4ee;color:#1e6f4c;font-size:12px;font-weight:700}
    .gt-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}
    .gt-item{padding:14px;border-radius:14px;background:#f7faf7;border:1px solid #e1e9e2;display:grid;gap:6px}
    .gt-ai{margin:0;font-size:14px;color:#33473c;line-height:1.55}
    .gt-ai-note{margin:4px 0 0;font-size:13px;color:#5f6b63}
  </style>
</head>
<body>
  ${renderAppExperienceHeader(lang, 4, false, "guide-takeaway-main", { currentPath: `${prefix}/events/${input.sessionId}/takeaway/${input.badgeNumber}` })}
  <main id="guide-takeaway-main" class="gt-shell" data-guide-badge-takeaway data-badge-number="${input.badgeNumber}">
    <section class="gt-card">
      <span class="gt-eyebrow">名札 ${input.badgeNumber}番・登録不要の持ち帰り</span>
      <h1>${escapeHtml(input.eventTitle)}</h1>
      <p>観察会で見つけた記録を登録なしでそのまま見返せます${input.discoveries.length > 0 && input.discoveries.every((d) => VERIFIED_FACE_STATUSES.has(d.face_privacy_status)) ? "（人物の顔は含まれません / 顔0件）" : "（顔の確認が済んでいない記録が含まれます）"}。</p>
      <p><strong>記録件数:</strong> ${input.discoveries.length}件</p>
    </section>

    <section class="gt-card">
      <h2>見つけたもの</h2>
      ${input.discoveries.length > 0
        ? `<ul class="gt-list">${input.discoveries.map((d) => `<li class="gt-item">
            <strong>${escapeHtml(d.subject)}（${d.count}）</strong>
            ${d.detail ? `<span>${escapeHtml(d.detail)}</span>` : ""}
            <p class="gt-ai">${escapeHtml(d.ai_comment || buildGuideDiscoveryAiComment({ badgeNumber: d.badge_number, subject: d.subject, count: d.count, detail: d.detail }))}</p>
            <p class="gt-ai-note">この説明はAIが作成しました</p>
            <small>${escapeHtml(d.area_label ? `${d.area_label} · ` : "")}${escapeHtml(d.observed_at)}</small>
          </li>`).join("")}</ul>`
        : `<p>この番号の記録はまだ登録されていません。</p>`}
    </section>

    <section class="gt-card">
      <h2>次回の予定</h2>
      <p>${escapeHtml(input.nextEventNote || "次回の観察会の予定は主催者の案内をご確認ください。")}</p>
      ${input.publicPlace ? `<div><a href="${escapeHtml(`${prefix}/places/${encodeURIComponent(input.publicPlace.placeId)}`)}">この場所の記録を見る</a></div>` : ""}
      <div><a href="${escapeHtml(`${prefix}/map?tab=places`)}">公開マップを見る</a></div>
    </section>
  </main>
  ${renderAppExperienceNavigation(lang, 4, "bottom", false)}${renderAppExperienceQuickCamera(lang, { nonce: cspNonce })}
</body>
</html>`;
}
