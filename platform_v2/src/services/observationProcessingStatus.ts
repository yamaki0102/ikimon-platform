import type { FastifyInstance } from "fastify";

export type ObservationMediaProcessingState = "none" | "processing" | "ready" | "retry_required";
export type ObservationAiProcessingState =
  | "not_requested"
  | "queued"
  | "processing"
  | "candidate_ready"
  | "completed"
  | "failed_retryable"
  | "unavailable";

export type ObservationProcessingFacts = {
  occurrenceId: string;
  visitId: string;
  originalPhotoCount: number;
  displayPhotoCount: number;
  latestMediaJobStatus: string | null;
  latestMediaJobError: string | null;
  aiAssessmentStatus: string | null;
  candidateCount: number;
  identificationCount: number;
  providerAvailable: boolean;
  updatedAt: string | null;
};

export type ObservationProcessingStatus = {
  occurrenceId: string;
  visitId: string;
  recordState: "saved";
  mediaState: ObservationMediaProcessingState;
  aiState: ObservationAiProcessingState;
  updatedAt: string | null;
  message: string;
  action: { href: string; label: string } | null;
};

export type ObservationProcessingStatusLoader = (
  observationId: string,
  cookieHeader: string | undefined,
) => Promise<ObservationProcessingStatus | null>;

type ObservationProcessingStatusPatchOptions = {
  loadStatus: ObservationProcessingStatusLoader;
};

function normalizedStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function isFailedStatus(value: string | null | undefined): boolean {
  return ["failed", "error", "cancelled", "failed_retryable", "failed_terminal"].includes(normalizedStatus(value));
}

function isRunningStatus(value: string | null | undefined): boolean {
  return ["running", "processing", "analyzing", "analysing"].includes(normalizedStatus(value));
}

function isCompletedStatus(value: string | null | undefined): boolean {
  return ["completed", "identified", "accepted", "reviewed"].includes(normalizedStatus(value));
}

function safeObservationHref(id: string, suffix = ""): string {
  return `/observations/${encodeURIComponent(id)}${suffix}`;
}

export function deriveObservationProcessingStatus(facts: ObservationProcessingFacts): ObservationProcessingStatus {
  const latestJob = normalizedStatus(facts.latestMediaJobStatus);
  const assessment = normalizedStatus(facts.aiAssessmentStatus);

  let mediaState: ObservationMediaProcessingState;
  if (facts.displayPhotoCount > 0) {
    mediaState = "ready";
  } else if (facts.originalPhotoCount > 0 && isFailedStatus(latestJob)) {
    mediaState = "retry_required";
  } else if (facts.originalPhotoCount > 0) {
    mediaState = "processing";
  } else {
    mediaState = "none";
  }

  let aiState: ObservationAiProcessingState;
  if (facts.candidateCount > 0 || assessment === "ai_judgement" || assessment === "candidate_ready") {
    aiState = "candidate_ready";
  } else if (facts.identificationCount > 0 || isCompletedStatus(assessment)) {
    aiState = "completed";
  } else if (isFailedStatus(latestJob) || isFailedStatus(assessment)) {
    aiState = "failed_retryable";
  } else if (isRunningStatus(latestJob) || isRunningStatus(assessment)) {
    aiState = "processing";
  } else if (latestJob === "pending" || assessment === "queued" || assessment === "pending") {
    aiState = facts.providerAvailable ? "queued" : "unavailable";
  } else if (!facts.providerAvailable) {
    aiState = "unavailable";
  } else {
    aiState = "not_requested";
  }

  let message = "記録は保存されています。";
  let action: ObservationProcessingStatus["action"] = null;
  if (mediaState === "retry_required") {
    message = "記録本体は保存されていますが、写真の処理を完了できませんでした。写真を選び直して同じ記録へ再送できます。";
    action = { href: `/record?retry=media&source=media_retry&observationId=${encodeURIComponent(facts.visitId)}`, label: "写真を再送" };
  } else if (mediaState === "processing") {
    message = "写真は保存されています。表示できる状態へ整えています。";
  } else if (mediaState === "none") {
    message = "記録は保存されています。写真はまだ追加されていません。";
    action = { href: "/record?start=photo", label: "写真を追加" };
  } else if (aiState === "candidate_ready") {
    message = "写真と記録は保存されています。AIが見つけた候補を確認できます。";
    action = { href: `${safeObservationHref(facts.occurrenceId)}#identify`, label: "候補を確認" };
  } else if (aiState === "unavailable") {
    message = "写真と記録は保存されています。AI確認は現在利用できません。";
  } else if (aiState === "failed_retryable") {
    message = "写真と記録は保存されています。AI確認は完了していません。";
  } else if (aiState === "queued" || aiState === "processing") {
    message = "写真と記録は保存されています。AIが候補を確認しています。";
  }

  return {
    occurrenceId: facts.occurrenceId,
    visitId: facts.visitId,
    recordState: "saved",
    mediaState,
    aiState,
    updatedAt: facts.updatedAt,
    message,
    action,
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mediaStateLabel(state: ObservationMediaProcessingState): string {
  if (state === "ready") return "保存済み";
  if (state === "processing") return "表示準備中";
  if (state === "retry_required") return "再送が必要";
  return "写真なし";
}

function aiStateLabel(state: ObservationAiProcessingState): string {
  if (state === "queued") return "受付済み";
  if (state === "processing") return "確認中";
  if (state === "candidate_ready") return "候補あり";
  if (state === "completed") return "確認済み";
  if (state === "failed_retryable") return "確認できませんでした";
  if (state === "unavailable") return "現在利用不可";
  return "未受付";
}

function formattedUpdatedAt(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Tokyo",
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export function renderObservationProcessingStatusPanel(status: ObservationProcessingStatus): string {
  const updatedAt = formattedUpdatedAt(status.updatedAt);
  const action = status.action
    ? `<a class="obs-processing-status-action" href="${escapeHtml(status.action.href)}">${escapeHtml(status.action.label)}</a>`
    : "";
  return `<style data-observation-processing-status-style>
    .obs-processing-status{margin:0 0 16px;padding:16px;border:1px solid rgba(15,23,42,.1);border-radius:18px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.06);display:grid;gap:12px}
    .obs-processing-status-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .obs-processing-status-head h2{margin:0;font-size:17px;line-height:1.45;color:#0f172a}
    .obs-processing-status-updated{font-size:11px;line-height:1.5;color:#64748b;font-weight:700;text-align:right}
    .obs-processing-status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .obs-processing-status-item{min-height:68px;padding:10px 12px;border-radius:13px;background:#f8fafc;display:grid;align-content:center;gap:2px}
    .obs-processing-status-item span{font-size:11px;color:#64748b;font-weight:800}
    .obs-processing-status-item strong{font-size:14px;line-height:1.35;color:#0f172a}
    .obs-processing-status-message{margin:0;color:#334155;font-size:13px;line-height:1.7;font-weight:650}
    .obs-processing-status-action{min-height:48px;padding:11px 16px;border-radius:999px;background:#0f3d2e;color:#fff;text-decoration:none;font-weight:900;display:inline-flex;align-items:center;justify-content:center;justify-self:start}
    .obs-processing-status-action:focus-visible{outline:3px solid rgba(14,165,233,.5);outline-offset:3px}
    @media(max-width:560px){.obs-processing-status{padding:14px}.obs-processing-status-grid{grid-template-columns:1fr}.obs-processing-status-item{min-height:54px;grid-template-columns:72px 1fr;align-items:center}.obs-processing-status-head{display:grid}.obs-processing-status-updated{text-align:left}.obs-processing-status-action{width:100%;justify-self:stretch}}
  </style><section class="obs-processing-status" data-observation-processing-status aria-labelledby="obs-processing-status-title">
    <div class="obs-processing-status-head"><h2 id="obs-processing-status-title">この記録の状態</h2>${updatedAt ? `<span class="obs-processing-status-updated">最終更新 ${escapeHtml(updatedAt)}</span>` : ""}</div>
    <div class="obs-processing-status-grid">
      <div class="obs-processing-status-item"><span>記録</span><strong>保存済み</strong></div>
      <div class="obs-processing-status-item"><span>写真</span><strong>${escapeHtml(mediaStateLabel(status.mediaState))}</strong></div>
      <div class="obs-processing-status-item"><span>AI</span><strong>${escapeHtml(aiStateLabel(status.aiState))}</strong></div>
    </div>
    <p class="obs-processing-status-message">${escapeHtml(status.message)}</p>
    ${action}
  </section>`;
}

export function patchObservationProcessingStatusHtml(html: string, status: ObservationProcessingStatus | null): string {
  if (!status || html.includes("data-observation-processing-status")) return html;
  const panel = renderObservationProcessingStatusPanel(status);
  const readingPanel = /(<(?:main|section|div|article)\b[^>]*class="[^"]*\bobs-reading-panel\b[^"]*"[^>]*>)/i;
  if (readingPanel.test(html)) {
    return html.replace(readingPanel, `$1${panel}`);
  }
  const main = /(<main\b[^>]*>)/i;
  return main.test(html) ? html.replace(main, `$1${panel}`) : html;
}

function observationIdFromUrl(rawUrl: string): string | null {
  const pathname = rawUrl.split("?", 1)[0] ?? "";
  const match = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?observations\/([^/?#]+)\/?$/i.exec(pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export function registerObservationProcessingStatusHtmlPatch(
  app: FastifyInstance,
  options: ObservationProcessingStatusPatchOptions,
): void {
  app.addHook("onSend", async (request, reply, payload) => {
    if (request.method !== "GET" && request.method !== "HEAD") return payload;
    const contentType = String(reply.getHeader("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html")) return payload;
    const observationId = observationIdFromUrl(request.url);
    if (!observationId) return payload;
    const html = typeof payload === "string"
      ? payload
      : Buffer.isBuffer(payload)
        ? payload.toString("utf8")
        : null;
    if (html == null) return payload;
    try {
      const status = await options.loadStatus(observationId, request.headers.cookie);
      return patchObservationProcessingStatusHtml(html, status);
    } catch (error) {
      request.log.warn({ err: error, observationId }, "observation processing status patch failed");
      return payload;
    }
  });
}
