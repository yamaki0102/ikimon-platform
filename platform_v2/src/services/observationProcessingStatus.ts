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
  aiRequestStatus: string | null;
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
  originalPhotoCount: number;
  displayPhotoCount: number;
  updatedAt: string | null;
  message: string;
  action: { href: string; label: string; method?: "post" } | null;
};

function normalizedStatus(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isObsoleteInteractiveGeminiResult(sourcePayloadJson: string | null | undefined): boolean {
  if (!sourcePayloadJson) return false;
  try {
    const payload = JSON.parse(sourcePayloadJson) as Record<string, unknown>;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.providerMode !== "direct_generate_content") return false;
    const plan = payload.modelPlan && typeof payload.modelPlan === "object" && !Array.isArray(payload.modelPlan)
      ? payload.modelPlan as Record<string, unknown>
      : {};
    const models = Array.isArray(payload.models) ? payload.models : [];
    return [plan.primary, plan.census, plan.environment, plan.summary, ...models]
      .some((model) => model === "gemini-3.1-flash-lite");
  } catch {
    return false;
  }
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
  const requestStatus = normalizedStatus(facts.aiRequestStatus);
  const assessment = normalizedStatus(facts.aiAssessmentStatus);

  let mediaState: ObservationMediaProcessingState;
  if (facts.originalPhotoCount > 0 && facts.displayPhotoCount >= facts.originalPhotoCount) {
    mediaState = "ready";
  } else if (facts.originalPhotoCount > 0 && isFailedStatus(latestJob)) {
    mediaState = "retry_required";
  } else if (facts.originalPhotoCount > 0) {
    mediaState = "processing";
  } else {
    mediaState = "none";
  }

  let aiState: ObservationAiProcessingState;
  if (facts.identificationCount > 0 || isCompletedStatus(assessment)) {
    aiState = "completed";
  } else if (facts.candidateCount > 0 || assessment === "ai_judgement" || assessment === "candidate_ready") {
    aiState = "candidate_ready";
  } else if (isFailedStatus(requestStatus) || isFailedStatus(assessment)) {
    aiState = "failed_retryable";
  } else if (isRunningStatus(requestStatus) || isRunningStatus(assessment)) {
    aiState = "processing";
  } else if (requestStatus === "pending" || assessment === "queued" || assessment === "pending") {
    aiState = facts.providerAvailable ? "queued" : "unavailable";
  } else if (!facts.providerAvailable) {
    aiState = "unavailable";
  } else {
    aiState = "not_requested";
  }

  let message = "記録は保存されています。";
  let action: ObservationProcessingStatus["action"] = null;
  if (mediaState === "retry_required") {
    message = `写真${facts.originalPhotoCount}枚は保存済みです。${facts.displayPhotoCount}枚は表示済みですが、残り${Math.max(0, facts.originalPhotoCount - facts.displayPhotoCount)}枚の表示処理を完了できませんでした。`;
    action = { href: `/record?retry=media&source=media_retry&observationId=${encodeURIComponent(facts.visitId)}`, label: "写真を再送" };
  } else if (mediaState === "processing") {
    message = `写真${facts.originalPhotoCount}枚は保存済みです。${facts.displayPhotoCount}枚を表示でき、残り${Math.max(0, facts.originalPhotoCount - facts.displayPhotoCount)}枚を整えています。`;
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
    action = {
      href: `/api/v1/observations/${encodeURIComponent(facts.visitId)}/reassess`,
      label: "AIで再確認",
      method: "post",
    };
  } else if (aiState === "queued" || aiState === "processing") {
    message = "写真からわかることを調べています。写真と記録は保存されています。";
  }

  return {
    occurrenceId: facts.occurrenceId,
    visitId: facts.visitId,
    recordState: "saved",
    mediaState,
    aiState,
    originalPhotoCount: facts.originalPhotoCount,
    displayPhotoCount: facts.displayPhotoCount,
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

function mediaCountLabel(status: ObservationProcessingStatus): string {
  if (status.originalPhotoCount <= 0) return mediaStateLabel(status.mediaState);
  if (status.mediaState === "ready") return `${status.originalPhotoCount}枚保存済み`;
  return `${status.originalPhotoCount}枚保存・${status.displayPhotoCount}枚表示`;
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

export function renderObservationProcessingStatusPanel(status: ObservationProcessingStatus, cspNonce: string): string {
  const normalizedNonce = cspNonce.trim();
  if (!normalizedNonce || /["'<>\s]/u.test(normalizedNonce)) {
    throw new Error("observation_processing_status_csp_nonce_required");
  }
  const updatedAt = formattedUpdatedAt(status.updatedAt);
  const action = status.action?.method === "post"
    ? `<button type="button" class="obs-processing-status-action" data-observation-reassess data-endpoint="${escapeHtml(status.action.href)}">${escapeHtml(status.action.label)}</button><span class="obs-processing-status-action-result" aria-live="polite"></span>`
    : status.action
      ? `<a class="obs-processing-status-action" href="${escapeHtml(status.action.href)}">${escapeHtml(status.action.label)}</a>`
      : "";
  const actionScript = status.action?.method === "post"
    ? `<script nonce="${escapeHtml(normalizedNonce)}" data-observation-reassess-script>(()=>{const button=document.querySelector('[data-observation-reassess]');if(!(button instanceof HTMLButtonElement))return;const result=button.nextElementSibling;button.addEventListener('click',async()=>{if(button.disabled)return;button.disabled=true;button.textContent='受付中…';try{const response=await fetch(button.dataset.endpoint||'',{method:'POST',credentials:'same-origin',headers:{accept:'application/json'}});if(!response.ok)throw new Error('request_failed');button.textContent='受付済み';if(result)result.textContent='AIで再確認を受け付けました。';window.setTimeout(()=>window.location.reload(),800);}catch{button.disabled=false;button.textContent='AIで再確認';if(result)result.textContent='受付できませんでした。少し待ってからもう一度お試しください。';}});})();</script>`
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
    .obs-processing-status-action{min-height:48px;padding:11px 16px;border:0;border-radius:999px;background:#0f3d2e;color:#fff;text-decoration:none;font:inherit;font-weight:900;display:inline-flex;align-items:center;justify-content:center;justify-self:start;cursor:pointer}
    .obs-processing-status-action:disabled{cursor:wait;opacity:.72}
    .obs-processing-status-action:focus-visible{outline:3px solid rgba(14,165,233,.5);outline-offset:3px}
    .obs-processing-status-action-result{font-size:12px;line-height:1.6;color:#475569;font-weight:700}
    @media(max-width:560px){.obs-processing-status{padding:14px}.obs-processing-status-grid{grid-template-columns:1fr}.obs-processing-status-item{min-height:54px;grid-template-columns:72px 1fr;align-items:center}.obs-processing-status-head{display:grid}.obs-processing-status-updated{text-align:left}.obs-processing-status-action{width:100%;justify-self:stretch}}
  </style><section class="obs-processing-status" data-observation-processing-status aria-labelledby="obs-processing-status-title">
    <div class="obs-processing-status-head"><h2 id="obs-processing-status-title">この記録の状態</h2>${updatedAt ? `<span class="obs-processing-status-updated">最終更新 ${escapeHtml(updatedAt)}</span>` : ""}</div>
    <div class="obs-processing-status-grid">
      <div class="obs-processing-status-item"><span>記録</span><strong>保存済み</strong></div>
      <div class="obs-processing-status-item"><span>写真</span><strong>${escapeHtml(mediaCountLabel(status))}</strong></div>
      <div class="obs-processing-status-item"><span>AI</span><strong>${escapeHtml(aiStateLabel(status.aiState))}</strong></div>
    </div>
    <p class="obs-processing-status-message">${escapeHtml(status.message)}</p>
    ${action}
  </section>${actionScript}`;
}
