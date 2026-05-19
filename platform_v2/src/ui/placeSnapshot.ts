import type { PlaceSnapshot, PlaceSnapshotNextAction, PlaceSnapshotStewardshipComparison } from "../services/placeSnapshot.js";
import type { AreaObservationGalleryItem, AreaPlaceSnapshot } from "../services/areaPlaceSnapshot.js";
import type { PlaceManagementPolicy } from "../services/placeManagementPolicy.js";
import type { PlaceVegetationTrend } from "../services/placeVegetationTrend.js";
import type { RelationshipAxis } from "../services/relationshipScore.js";
import { escapeHtml } from "./siteShell.js";

function fmtNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function fmtPct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function isAreaSnapshot(snapshot: PlaceSnapshot): snapshot is AreaPlaceSnapshot {
  return Array.isArray((snapshot as Partial<AreaPlaceSnapshot>).observationGallery);
}

function seasonBadge(item: AreaObservationGalleryItem): string {
  if (!item.seasonLabel) return "";
  const label = item.isCurrentSeason ? `今の季節・${item.seasonLabel}` : item.seasonLabel;
  return `<span class="ps-album-season${item.isCurrentSeason ? " is-current" : ""}">${escapeHtml(label)}</span>`;
}

function albumCard(item: AreaObservationGalleryItem): string {
  const href = `/observations/${encodeURIComponent(item.occurrenceId)}`;
  const meta = [
    `${fmtNumber(item.observationCount)}件`,
    item.observedAt ? item.observedAt.slice(0, 10) : "",
    item.localityLabel ?? "",
  ].filter(Boolean).join(" / ");
  const photo = item.photoUrl
    ? `<img src="${escapeHtml(item.photoUrl)}" alt="" loading="lazy" decoding="async" />`
    : `<span class="ps-album-placeholder" aria-hidden="true">✦</span>`;
  return `<article class="ps-album-card">
    <a class="ps-album-card-main" href="${escapeHtml(href)}">
      ${photo}
      ${seasonBadge(item)}
      <strong>${escapeHtml(item.displayName || "同定待ち")}</strong>
      <small>${escapeHtml(meta)}</small>
    </a>
    <div class="ps-album-actions" data-occurrence-id="${escapeHtml(item.occurrenceId)}">
      <button type="button" class="ps-album-like obs-reaction" data-reaction-type="like" aria-label="${escapeHtml(item.displayName || "この記録")}にいいね">
        <span aria-hidden="true">💚</span>
        <span class="obs-reaction-label">いいね</span>
        <span class="obs-reaction-count">${fmtNumber(item.likeCount)}</span>
      </button>
    </div>
  </article>`;
}

function renderAreaAlbum(snapshot: PlaceSnapshot): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const gallery = snapshot.observationGallery.slice(0, 12);
  const currentSeason = gallery.filter((item) => item.isCurrentSeason).slice(0, 6);
  const recent = gallery.slice()
    .sort((a, b) => b.recentObservationCount - a.recentObservationCount || b.observationCount - a.observationCount)
    .filter((item) => item.recentObservationCount > 0)
    .slice(0, 6);
  const missing = snapshot.seasonalCoverage.filter((row) => row.observations <= 0);
  const missingText = missing.length > 0
    ? missing.map((row) => row.label).join("・")
    : "四季の入口あり";
  const galleryHtml = gallery.length > 0
    ? gallery.map(albumCard).join("")
    : `<article class="ps-card"><span class="ps-badge">最初の発見</span><h3>まだ観察カードはありません</h3><p>この場所で最初の写真を残すと、地域の生きものアルバムが始まります。</p></article>`;
  const currentHtml = currentSeason.length > 0
    ? currentSeason.map(albumCard).join("")
    : `<article class="ps-card"><span class="ps-badge">今の季節</span><h3>今の季節の記録を足す</h3><p>春夏秋冬の同じ時期を比べられると、この場所の顔が見えやすくなります。</p></article>`;
  const recentHtml = recent.length > 0
    ? recent.map(albumCard).join("")
    : `<article class="ps-card"><span class="ps-badge">最近増えた記録</span><h3>直近90日の増加はまだ薄い</h3><p>次の観察で新しい写真を足すと、地図からこの場所を選ぶ理由が強くなります。</p></article>`;
  return `<section class="ps-section ps-album" aria-label="地域の生きものアルバム">
    <div class="ps-section-head">
      <div>
        <div class="ps-eyebrow">Area Album</div>
        <h2>地域の生きものアルバム</h2>
      </div>
      <span class="ps-source">未記録季節: ${escapeHtml(missingText)}</span>
    </div>
    <p class="ps-section-lead">公園や水辺をクリックした人が、この場所で何が観察されているかを写真から眺められる公開図鑑です。</p>
    <div class="ps-album-grid">${galleryHtml}</div>
    <div class="ps-album-tabs">
      <section><h3>今の季節に見えるもの</h3><div class="ps-album-grid ps-album-grid-compact">${currentHtml}</div></section>
      <section><h3>最近増えた記録</h3><div class="ps-album-grid ps-album-grid-compact">${recentHtml}</div></section>
    </div>
  </section>`;
}

function areaWatchStatusClass(status: string): string {
  return status === "well_watched" || status === "watched" || status === "growing" || status === "sprout"
    ? status
    : "sprout";
}

function renderAreaWatch(snapshot: PlaceSnapshot): string {
  if (!isAreaSnapshot(snapshot)) return "";
  const watch = snapshot.areaWatch;
  if (!watch) return "";
  const dimensions = watch.dimensions.map((item) => `<article class="ps-watch-dim is-${escapeHtml(areaWatchStatusClass(item.status))}">
    <div class="ps-watch-dim-head">
      <span>${escapeHtml(item.label)}</span>
      <strong>${item.score}</strong>
    </div>
    <div class="ps-watch-bar"><i style="width:${Math.max(0, Math.min(100, item.score))}%"></i></div>
    <p>${escapeHtml(item.childText)}</p>
    <small>${escapeHtml(item.nextAction)}</small>
  </article>`).join("");
  const celebrations = watch.celebrations.slice(0, 3).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const gaps = watch.gaps.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<section class="ps-section ps-watch" aria-label="エリアの見守りメーター">
    <div class="ps-watch-hero is-${escapeHtml(areaWatchStatusClass(watch.status))}">
      <div>
        <div class="ps-eyebrow">Area Watch</div>
        <h2>エリアの見守りメーター</h2>
        <p>${escapeHtml(watch.childSummary)}</p>
      </div>
      <div class="ps-watch-score">
        <span>${escapeHtml(watch.label)}</span>
        <strong>${watch.score}</strong>
        <small>見守り材料</small>
      </div>
    </div>
    <p class="ps-section-lead">${escapeHtml(watch.stewardSummary)}</p>
    <div class="ps-watch-next">
      <span class="ps-badge">次の一手</span>
      <strong>${escapeHtml(watch.nextAction.title)}</strong>
      <p>${escapeHtml(watch.nextAction.body)}</p>
    </div>
    <div class="ps-watch-community">
      <strong>参加したエリアをフォローすると、あとから誰かが写真・effort・季節の記録を足した時に通知で戻ってこられます。</strong>
      <span>見守りは個人の宿題ではなく、同じ場所を見ている仲間の共同作業として育ちます。</span>
    </div>
    <div class="ps-watch-grid">${dimensions}</div>
    <div class="ps-watch-notes">
      <div>
        <h3>育っているところ</h3>
        <ul>${celebrations}</ul>
      </div>
      <div>
        <h3>次に足すと強いところ</h3>
        <ul>${gaps || "<li>大きな不足はありません。次は同じ場所を続けて見ます。</li>"}</ul>
      </div>
    </div>
    <p class="ps-watch-researcher">${escapeHtml(watch.researcherNote)}</p>
  </section>`;
}

const AXIS_LABEL: Record<RelationshipAxis, string> = {
  access: "触れられる",
  engagement: "続いている",
  learning: "学んでいる",
  stewardship: "手入れしている",
  evidence: "検証できる",
};

const ACTION_BADGE: Record<PlaceSnapshotNextAction["kind"], string> = {
  revisit: "再訪",
  evidence: "証拠",
  event: "観察会",
  stewardship: "手入れ",
  review: "レビュー",
};

function metric(label: string, value: string, note = ""): string {
  return `<div class="ps-metric">
    <strong>${escapeHtml(value)}</strong>
    <span>${escapeHtml(label)}</span>
    ${note ? `<small>${escapeHtml(note)}</small>` : ""}
  </div>`;
}

function progress(label: string, value: number, note: string): string {
  const width = Math.max(0, Math.min(100, value));
  return `<div class="ps-axis">
    <div class="ps-axis-head"><span>${escapeHtml(label)}</span><strong>${width}/20</strong></div>
    <div class="ps-bar"><i style="width:${width * 5}%"></i></div>
    <p>${escapeHtml(note)}</p>
  </div>`;
}

function actionCard(action: PlaceSnapshotNextAction): string {
  const inner = `<span class="ps-badge">${escapeHtml(ACTION_BADGE[action.kind])}</span>
    <h3>${escapeHtml(action.title)}</h3>
    <p>${escapeHtml(action.body)}</p>`;
  if (!action.href) {
    return `<article class="ps-card">${inner}</article>`;
  }
  return `<a class="ps-card ps-card-link" href="${escapeHtml(action.href)}">${inner}</a>`;
}

function actionKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    cleanup: "清掃",
    mowing: "草刈り",
    invasive_removal: "撹乱種対応",
    patrol: "巡回",
    signage: "看板",
    monitoring: "モニタリング",
    external_program: "外部連携",
    restoration: "修復",
    community_engagement: "参加促進",
    other: "その他",
  };
  return labels[kind] ?? kind;
}

function limitationLabel(key: string): string {
  const labels: Record<string, string> = {
    baseline_missing: "事前観察が不足",
    followup_missing: "事後観察が不足",
    effort_not_aligned: "effort 未整列",
    small_sample: "サンプル小",
  };
  return labels[key] ?? key;
}

function signalLabel(key: string): string {
  const labels: Record<string, string> = {
    after_window_observed: "事後観察あり",
    before_after_comparable: "前後比較可能",
    taxa_seen_after_action: "事後に分類群記録あり",
    effort_recorded_after_action: "事後 effort あり",
    explicit_non_detection_after_action: "事後の非検出あり",
  };
  return labels[key] ?? key;
}

function observationMethodLabel(key: string): string {
  const labels: Record<string, string> = {
    passive_audio: "passive audio",
    passive_audio_ingest: "passive audio",
    camera_trap: "camera trap",
    ias_route_camera: "外来種ルート撮影",
    field_scan: "field scan",
    edna_reference: "eDNA reference",
    machine_observation: "機械観測",
  };
  return labels[key] ?? key;
}

function machineReviewLabel(status: string): string {
  const labels: Record<string, string> = {
    ai_candidate: "AI候補",
    ai_audio_candidate: "AI候補",
    reviewer_verified: "reviewer検証済み",
    reviewer_rejected: "却下",
    rejected: "却下",
  };
  return labels[status] ?? status;
}

function stewardshipComparisonCard(comparison: PlaceSnapshotStewardshipComparison): string {
  const date = new Date(comparison.occurredAt);
  const dateText = Number.isNaN(date.getTime())
    ? comparison.occurredAt
    : date.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
  const signals = comparison.signals.length > 0
    ? comparison.signals.map((item) => `<span class="ps-chip">${escapeHtml(signalLabel(item))}</span>`).join("")
    : `<span class="ps-chip">観察待ち</span>`;
  const limitations = comparison.limitations.length > 0
    ? comparison.limitations.map((item) => `<span class="ps-chip ps-chip-muted">${escapeHtml(limitationLabel(item))}</span>`).join("")
    : `<span class="ps-chip">比較条件あり</span>`;
  return `<article class="ps-steward-card">
    <header>
      <span class="ps-badge">${escapeHtml(actionKindLabel(comparison.actionKind))}</span>
      <small>${escapeHtml(dateText)}</small>
    </header>
    <p>${escapeHtml(comparison.description ?? "活動メモは未入力です。")}</p>
    <div class="ps-before-after">
      <div><span>前30日</span><strong>${fmtNumber(comparison.before.visits)}</strong><small>訪問 / ${fmtNumber(comparison.before.uniqueTaxa)}分類群</small></div>
      <div><span>後30日</span><strong>${fmtNumber(comparison.after.visits)}</strong><small>訪問 / ${fmtNumber(comparison.after.uniqueTaxa)}分類群</small></div>
    </div>
    <div class="ps-chip-row">${signals}${limitations}</div>
  </article>`;
}

function selectOption(value: string, current: string, label: string): string {
  return `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
}

function managementPolicySummary(policy: PlaceManagementPolicy | null): string {
  if (!policy) return "方針未設定";
  const goal: Record<PlaceManagementPolicy["managementGoal"], string> = {
    balanced: "安全と景観を部分管理",
    keep_clear: "通路・排水はすっきり",
    native_patch: "在来草地を残す",
    flowering_allowed: "花の時期は一部残す",
    invasive_watch: "外来種候補を早めに確認",
  };
  const tolerance: Record<PlaceManagementPolicy["weedTolerance"], string> = {
    low: "草は少なめ",
    medium: "必要部分だけ抑える",
    high: "草花を多めに残す",
  };
  return `${goal[policy.managementGoal]} / ${tolerance[policy.weedTolerance]}`;
}

function renderManagementPolicyForm(policy: PlaceManagementPolicy | null, options: {
  canEditPolicy: boolean;
  placeId: string | null;
  basePath: string;
}): string {
  if (!options.canEditPolicy || !options.placeId) return "";
  const current = policy ?? {
    managementGoal: "balanced",
    weedTolerance: "medium",
    invasiveResponse: "ask_first",
    mowingFrequency: "as_needed",
    notes: "",
  };
  const endpoint = `${options.basePath}/api/v1/places/${encodeURIComponent(options.placeId)}/management-policy`;
  return `<form class="ps-management-policy" data-care-policy-form data-endpoint="${escapeHtml(endpoint)}">
    <strong>会社敷地の管理方針</strong>
    <div class="ps-management-policy-grid">
      <label>方針
        <select name="managementGoal">
          ${selectOption("balanced", current.managementGoal, "安全と景観を部分管理")}
          ${selectOption("keep_clear", current.managementGoal, "通路・排水はすっきり")}
          ${selectOption("native_patch", current.managementGoal, "在来草地を残す")}
          ${selectOption("flowering_allowed", current.managementGoal, "花の時期は一部残す")}
          ${selectOption("invasive_watch", current.managementGoal, "外来種候補を早めに確認")}
        </select>
      </label>
      <label>草の許容
        <select name="weedTolerance">
          ${selectOption("low", current.weedTolerance, "少なめ")}
          ${selectOption("medium", current.weedTolerance, "必要部分だけ抑える")}
          ${selectOption("high", current.weedTolerance, "草花を多めに残す")}
        </select>
      </label>
      <label>外来種候補
        <select name="invasiveResponse">
          ${selectOption("ask_first", current.invasiveResponse, "確認してから作業")}
          ${selectOption("controlled_removal", current.invasiveResponse, "計画的に除去")}
          ${selectOption("observe", current.invasiveResponse, "まず観察")}
        </select>
      </label>
      <label>草刈り頻度
        <select name="mowingFrequency">
          ${selectOption("as_needed", current.mowingFrequency, "必要時")}
          ${selectOption("monthly", current.mowingFrequency, "月1目安")}
          ${selectOption("seasonal", current.mowingFrequency, "季節ごと")}
          ${selectOption("rare", current.mowingFrequency, "なるべく少なく")}
        </select>
      </label>
    </div>
    <label>メモ
      <textarea name="notes" maxlength="600" placeholder="例: 正面通路は短く、花壇脇は花が終わるまで残す">${escapeHtml(current.notes)}</textarea>
    </label>
    <div class="ps-management-policy-actions">
      <button type="submit">方針を保存</button>
      <span data-care-policy-status aria-live="polite">${policy ? "保存済み" : ""}</span>
    </div>
  </form>`;
}

function renderManagementPolicyScript(canEditPolicy: boolean): string {
  if (!canEditPolicy) return "";
  return `<script>(function(){
    if (window.__ikimonCarePolicyBound) return;
    window.__ikimonCarePolicyBound = true;
    document.addEventListener('submit', function(event) {
      var form = event.target && event.target.closest ? event.target.closest('[data-care-policy-form]') : null;
      if (!form) return;
      event.preventDefault();
      var status = form.querySelector('[data-care-policy-status]');
      var button = form.querySelector('button[type="submit"]');
      var endpoint = form.getAttribute('data-endpoint') || '';
      var data = new FormData(form);
      var payload = {
        managementGoal: String(data.get('managementGoal') || ''),
        weedTolerance: String(data.get('weedTolerance') || ''),
        invasiveResponse: String(data.get('invasiveResponse') || ''),
        mowingFrequency: String(data.get('mowingFrequency') || ''),
        notes: String(data.get('notes') || '')
      };
      if (button) button.disabled = true;
      if (status) { status.textContent = '保存中...'; status.classList.remove('is-error'); }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload)
      }).then(function(response) {
        return response.json().catch(function(){ return {}; }).then(function(json) {
          if (!response.ok || !json || json.ok === false) throw new Error(String((json && json.error) || response.status || 'save_failed'));
          if (status) status.textContent = '保存しました';
        });
      }).catch(function(error) {
        if (status) { status.textContent = '保存できませんでした: ' + String(error && error.message || 'network'); status.classList.add('is-error'); }
      }).finally(function(){ if (button) button.disabled = false; });
    });
  })();</script>`;
}

function renderVegetationPrioritySection(snapshot: PlaceSnapshot, options: {
  managementPolicy?: PlaceManagementPolicy | null;
  vegetationTrend?: PlaceVegetationTrend | null;
  canEditPolicy?: boolean;
  basePath?: string;
} = {}): string {
  const placeId = snapshot.relationshipScore.placeId ?? null;
  const policy = options.managementPolicy ?? null;
  const trend = options.vegetationTrend ?? null;
  if (!trend && !options.canEditPolicy) return "";
  const priorityLabel = trend?.priority === "high" ? "優先度 高" : trend?.priority === "medium" ? "優先度 中" : "優先度 低";
  const tasks = trend?.nextActions.length
    ? trend.nextActions
    : ["同じ場所で次回も記録", "作業前後を分けて撮る", "敷地の方針を先に保存"];
  const evidence = trend?.evidence.length
    ? trend.evidence
    : ["同じ場所の連続記録が増えると、増えているか抑えられているかを判定できます。"];
  return `<section class="ps-section ps-management">
    <div class="ps-section-head">
      <div>
        <div class="ps-eyebrow">Field Advice</div>
        <h2>草管理の優先順位</h2>
      </div>
      <span class="ps-priority is-${escapeHtml(trend?.priority ?? "low")}">${escapeHtml(priorityLabel)}</span>
    </div>
    <p class="ps-section-lead">${escapeHtml(trend?.headline ?? "この場所の管理方針を保存して、次の観察から優先順位を出します。")}</p>
    <div class="ps-grid ps-grid-3">
      <article class="ps-card ps-management-main">
        <span class="ps-badge">判定</span>
        <h3>${escapeHtml(trend?.summary ?? "まだ連続記録が薄いため、現場判断は仮置きです。")}</h3>
        <p>保存方針: ${escapeHtml(managementPolicySummary(policy))}</p>
      </article>
      ${tasks.slice(0, 3).map((task, index) => `<article class="ps-card">
        <span class="ps-badge">作業 ${index + 1}</span>
        <h3>${escapeHtml(task)}</h3>
        <p>${escapeHtml(index === 0 ? "優先して見る場所を決め、全面作業ではなく比較できる形で残します。" : "次の記録と比べられるよう、同じ範囲で確認します。")}</p>
      </article>`).join("")}
    </div>
    <div class="ps-management-evidence">${evidence.slice(0, 4).map((item) => `<span class="ps-chip">${escapeHtml(item)}</span>`).join("")}</div>
    ${renderManagementPolicyForm(policy, {
      canEditPolicy: Boolean(options.canEditPolicy),
      placeId,
      basePath: options.basePath ?? "",
    })}
    ${renderManagementPolicyScript(Boolean(options.canEditPolicy))}
  </section>`;
}

function renderStewardshipImpact(snapshot: PlaceSnapshot): string {
  const impact = snapshot.stewardshipImpact;
  const cards = impact.comparisons.length === 0
    ? `<article class="ps-card"><span class="ps-badge">施策評価</span><h3>手入れ記録を観察と結ぶ</h3><p>${escapeHtml(impact.summary)}</p></article>`
    : impact.comparisons.map(stewardshipComparisonCard).join("");
  return `<section class="ps-section">
    <div class="ps-section-head">
      <div>
        <div class="ps-eyebrow">Stewardship Impact</div>
        <h2>施策後の変化の兆し</h2>
      </div>
      <span class="ps-source">前後 ${impact.windowDays} 日</span>
    </div>
    <p class="ps-section-lead">${escapeHtml(impact.summary)}</p>
    <div class="ps-grid ps-grid-3">${cards}</div>
  </section>`;
}

function renderSchoolAlbumProfiles(snapshot: PlaceSnapshot): string {
  const profiles = snapshot.field.schoolAlbumProfiles ?? [];
  if (profiles.length === 0) return "";
  return `<section class="ps-section ps-school-albums">
    <div class="ps-section-head">
      <div>
        <div class="ps-eyebrow">School Albums</div>
        <h2>学校の図鑑を育てる</h2>
      </div>
      <span class="ps-source">教育機関向け</span>
    </div>
    <div class="ps-grid ps-grid-3">
      ${profiles.map((profile) => `<a class="ps-school-album-card" href="${escapeHtml(profile.href)}">
        <span>${escapeHtml(profile.kind)}</span>
        <h3>${escapeHtml(profile.title)}</h3>
        <p>${escapeHtml(profile.lead)}</p>
      </a>`).join("")}
    </div>
  </section>`;
}

function renderAccessGuidance(snapshot: PlaceSnapshot): string {
  const guidance = snapshot.field.accessGuidance;
  if (!guidance) return "";
  return `<section class="ps-access-guidance ps-access-${escapeHtml(guidance.status)}">
    <span>${escapeHtml(guidance.label)}</span>
    <p>${escapeHtml(guidance.body)}</p>
  </section>`;
}

export function renderPlaceSnapshotBody(snapshot: PlaceSnapshot, options: {
  managementPolicy?: PlaceManagementPolicy | null;
  vegetationTrend?: PlaceVegetationTrend | null;
  canEditPolicy?: boolean;
  basePath?: string;
} = {}): string {
  const s = snapshot.observationSummary;
  const m = snapshot.machineObservationSummary;
  const seasonText = s.seasonLabels.length > 0 ? s.seasonLabels.join("・") : "これから";
  const areaText = snapshot.field.areaHa
    ? `${snapshot.field.areaHa.toFixed(2)} ha`
    : `半径 ${fmtNumber(snapshot.field.radiusM)} m`;
  const relationship = snapshot.relationshipScore.score;
  const hypotheses = snapshot.hypotheses.length === 0
    ? `<article class="ps-card"><span class="ps-badge">仮説</span><h3>まだ仮説は薄い</h3><p>まずは同じ範囲で観察を重ね、effort と季節をそろえる段階です。</p></article>`
    : snapshot.hypotheses.slice(0, 3).map((hypothesis) => `<article class="ps-card">
        <span class="ps-badge">${escapeHtml(hypothesis.claimType)}</span>
        <h3>${escapeHtml(hypothesis.hypothesisText)}</h3>
        <p>${escapeHtml(hypothesis.whatWeCanSay)}</p>
      </article>`).join("");

  const topTaxa = s.topTaxa.length === 0
    ? `<span class="ps-chip">観察待ち</span>`
    : s.topTaxa.slice(0, 8).map((taxon) => `<span class="ps-chip">${escapeHtml(taxon.name)} ×${fmtNumber(taxon.count)}</span>`).join("");
  const latestMachineObservation = m.latestObservedAt ? m.latestObservedAt.slice(0, 10) : "未記録";
  const topMachineTaxa = m.topMachineTaxa.length === 0
    ? `<span class="ps-chip ps-chip-muted">AI候補待ち</span>`
    : m.topMachineTaxa.slice(0, 8).map((taxon) => `<span class="ps-chip">${escapeHtml(taxon.name)} ×${fmtNumber(taxon.count)} / ${escapeHtml(machineReviewLabel(taxon.reviewStatus))}</span>`).join("");
  const machineMethods = m.methodCounts.length === 0
    ? `<span class="ps-chip ps-chip-muted">method 未記録</span>`
    : m.methodCounts.slice(0, 6).map((item) => `<span class="ps-chip">${escapeHtml(observationMethodLabel(item.method))} ×${fmtNumber(item.count)}</span>`).join("");

  return `<main class="ps-shell">
    <section class="ps-hero">
      <div>
        <div class="ps-eyebrow">${escapeHtml(snapshot.framing.publicLabel)} / ${escapeHtml(snapshot.field.sourceLabel)}</div>
        <h1>${escapeHtml(snapshot.field.name)}</h1>
        <p>${escapeHtml(snapshot.field.locationLabel)}。観察データ、季節、仮説、次の一手を1枚で読む場所のスナップショットです。</p>
      </div>
      <div class="ps-hero-side">
        <span>${escapeHtml(areaText)}</span>
        <strong>${relationship.totalScore}/100</strong>
        <small>${escapeHtml(snapshot.framing.monitoringLabel)}</small>
      </div>
    </section>

    <section class="ps-grid ps-grid-4" aria-label="summary metrics">
      ${metric("観察", fmtNumber(s.totalObservations))}
      ${metric("訪問・観察会", fmtNumber(s.totalVisits), `${fmtNumber(s.totalEvents)} events`)}
      ${metric("分類群", fmtNumber(s.uniqueTaxa))}
      ${metric("季節", seasonText)}
    </section>

    ${renderAreaWatch(snapshot)}
    ${renderAreaAlbum(snapshot)}
    ${renderAccessGuidance(snapshot)}
    ${renderSchoolAlbumProfiles(snapshot)}

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Relationship Score</div>
          <h2>人と自然の関係を見る</h2>
        </div>
        <span class="ps-source">${snapshot.relationshipScore.source === "relationship_score_snapshot" ? "live score" : "field fallback"}</span>
      </div>
      <div class="ps-grid ps-grid-5">
        ${(Object.keys(relationship.axes) as RelationshipAxis[]).map((axis) => progress(
          AXIS_LABEL[axis],
          relationship.axes[axis].score,
          relationship.axes[axis].reasons.join(" / "),
        )).join("")}
      </div>
    </section>

    ${renderStewardshipImpact(snapshot)}

    ${renderVegetationPrioritySection(snapshot, options)}

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Monitoring Brief</div>
          <h2>団体運用で見るべき数字</h2>
        </div>
      </div>
      <div class="ps-grid ps-grid-4">
        ${metric("effort 充足", fmtPct(s.effortCompletionRate))}
        ${metric("レビュー受理", fmtPct(s.reviewAcceptedRate))}
        ${metric("在来 / 外来 / 不明", `${fmtNumber(s.nativeCount)} / ${fmtNumber(s.exoticCount)} / ${fmtNumber(s.unknownOriginCount)}`)}
        ${metric("非検出記録", fmtNumber(s.absentRecords))}
      </div>
      <div class="ps-chip-row">${topTaxa}</div>
      <div class="ps-section-subhead">
        <h3>機械観測 evidence layer</h3>
        <p>AI候補は活動指標として扱い、reviewer検証済み記録とは分けて表示します。</p>
      </div>
      <div class="ps-grid ps-grid-4">
        ${metric("機械観測", fmtNumber(m.totalMachineObservations), `latest ${latestMachineObservation}`)}
        ${metric("AI候補", fmtNumber(m.aiCandidateCount), "未確定")}
        ${metric("reviewer検証済み", fmtNumber(m.reviewerVerifiedCount), "確定記録候補")}
        ${metric("却下 / passive audio", `${fmtNumber(m.rejectedCount)} / ${fmtNumber(m.passiveAudioCount)}`)}
      </div>
      <div class="ps-chip-row">${topMachineTaxa}</div>
      <div class="ps-chip-row">${machineMethods}</div>
    </section>

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Hypotheses</div>
          <h2>次に確認する仮説</h2>
        </div>
      </div>
      <div class="ps-grid ps-grid-3">${hypotheses}</div>
    </section>

    <section class="ps-section">
      <div class="ps-section-head">
        <div>
          <div class="ps-eyebrow">Next Actions</div>
          <h2>次に見ると面白いこと</h2>
        </div>
      </div>
      <div class="ps-grid ps-grid-4">${snapshot.nextActions.map(actionCard).join("")}</div>
    </section>

    <section class="ps-section ps-boundary">
      <div>
        <div class="ps-eyebrow">言えること</div>
        <ul>${snapshot.claimBoundary.canSay.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div>
        <div class="ps-eyebrow">まだ言い切れないこと</div>
        <ul>${snapshot.claimBoundary.cannotSayYet.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
    </section>

    <section class="ps-footnote">
      <p>${escapeHtml(snapshot.framing.advancedLabel)}としての深部ビューです。表の入口は、これまで通り自然を楽しみ、また歩きたくなる体験に置きます。</p>
    </section>
  </main>`;
}

export function renderPlaceSnapshotTeaser(snapshot: PlaceSnapshot): string {
  const s = snapshot.observationSummary;
  const seasons = s.seasonLabels.length > 0 ? s.seasonLabels.join("・") : "これから";
  return `<section class="evt-card ps-teaser">
    <div>
      <span class="evt-eyebrow">この場所のいま</span>
      <h2 class="evt-heading">場所の状態を1枚で見る</h2>
      <p class="evt-lead">観察、季節、仮説、手入れ後の変化の兆しをまとめたスナップショットです。</p>
    </div>
    <div class="ps-teaser-metrics">
      <div><strong>${fmtNumber(s.totalObservations)}</strong><span>観察</span></div>
      <div><strong>${escapeHtml(seasons)}</strong><span>季節</span></div>
      <div><strong>${snapshot.relationshipScore.score.totalScore}</strong><span>関係指標</span></div>
    </div>
    <a class="evt-btn evt-btn-primary" href="/places/${encodeURIComponent(snapshot.field.fieldId)}/snapshot">この場所のいまを見る</a>
  </section>`;
}

export const PLACE_SNAPSHOT_STYLES = `
.ps-shell {
  max-width: var(--ikimon-content-max);
  margin: 0 auto;
  padding: 28px 16px 64px;
  color: #0f172a;
}
.ps-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  gap: 20px;
  align-items: stretch;
  padding: clamp(24px, 4vw, 42px);
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(240,253,244,.96), rgba(240,249,255,.96)),
    #fff;
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 18px 42px rgba(15,23,42,.10);
}
.ps-eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #047857;
}
.ps-hero h1 {
  margin: 8px 0 10px;
  font-size: clamp(28px, 5vw, 48px);
  line-height: 1.12;
}
.ps-hero p {
  margin: 0;
  max-width: 64ch;
  color: #475569;
  line-height: 1.75;
}
.ps-hero-side {
  display: grid;
  align-content: center;
  gap: 6px;
  min-height: 160px;
  padding: 18px;
  border-radius: 18px;
  background: #0f172a;
  color: #ecfdf5;
}
.ps-hero-side span,
.ps-hero-side small {
  color: rgba(236,253,245,.78);
  font-size: 13px;
}
.ps-hero-side strong {
  font-size: clamp(34px, 5vw, 56px);
  line-height: 1;
}
.ps-access-guidance {
  margin: 16px 0 0;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(255,251,235,.92);
  border: 1px solid rgba(245,158,11,.26);
  color: #78350f;
}
.ps-access-guidance span {
  display: inline-flex;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 900;
}
.ps-access-guidance p {
  margin: 0;
  line-height: 1.7;
  font-size: 13px;
}
.ps-access-public_access {
  background: rgba(236,253,245,.92);
  border-color: rgba(16,185,129,.24);
  color: #064e3b;
}
.ps-section {
  margin-top: 28px;
}
.ps-section-lead {
  margin: -4px 0 12px;
  color: #64748b;
  line-height: 1.7;
}
.ps-section-head {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 16px;
  margin-bottom: 12px;
}
.ps-section h2 {
  margin: 4px 0 0;
  font-size: clamp(20px, 3vw, 28px);
}
.ps-source {
  border: 1px solid rgba(15,23,42,.10);
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  color: #475569;
}
.ps-grid {
  display: grid;
  gap: 12px;
}
.ps-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.ps-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.ps-grid-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.ps-watch {
  border-color: rgba(16,185,129,.22);
  background: linear-gradient(135deg, rgba(236,253,245,.82), rgba(255,255,255,.96) 48%, rgba(239,246,255,.7));
}
.ps-watch-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 16px;
  align-items: center;
}
.ps-watch-hero h2 { margin: 0; }
.ps-watch-hero p {
  margin: 8px 0 0;
  color: #334155;
}
.ps-watch-score {
  min-height: 132px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(15,23,42,.1);
  display: grid;
  place-items: center;
  padding: 14px;
  text-align: center;
}
.ps-watch-score span,
.ps-watch-score small {
  color: #64748b;
  font-size: 12px;
  font-weight: 800;
}
.ps-watch-score strong {
  color: #064e3b;
  font-size: clamp(38px, 5vw, 58px);
  line-height: 1;
}
.ps-watch-next {
  margin: 16px 0;
  padding: 14px;
  border-radius: 8px;
  background: rgba(255,255,255,.84);
  border: 1px solid rgba(15,23,42,.08);
}
.ps-watch-next strong {
  display: block;
  margin: 8px 0 4px;
  color: #0f172a;
}
.ps-watch-next p {
  margin: 0;
  color: #475569;
}
.ps-watch-community {
  display: grid;
  gap: 4px;
  margin: -2px 0 16px;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid rgba(20,184,166,.20);
  background: rgba(240,253,250,.82);
}
.ps-watch-community strong {
  color: #0f172a;
  font-size: 14px;
  line-height: 1.5;
}
.ps-watch-community span {
  color: #475569;
  font-size: 13px;
  line-height: 1.55;
}
.ps-watch-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.ps-watch-dim {
  border-radius: 8px;
  background: #fff;
  border: 1px solid rgba(15,23,42,.09);
  padding: 12px;
  min-height: 148px;
}
.ps-watch-dim-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: baseline;
  font-weight: 900;
}
.ps-watch-dim-head span { color: #0f172a; }
.ps-watch-dim-head strong { color: #047857; }
.ps-watch-bar {
  height: 8px;
  border-radius: 99px;
  background: #e2e8f0;
  overflow: hidden;
  margin: 10px 0;
}
.ps-watch-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #0ea5e9);
}
.ps-watch-dim p {
  margin: 0;
  color: #334155;
  font-size: 14px;
  line-height: 1.55;
}
.ps-watch-dim small {
  display: block;
  margin-top: 8px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.45;
}
.ps-watch-notes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 14px;
}
.ps-watch-notes > div {
  background: rgba(255,255,255,.72);
  border: 1px solid rgba(15,23,42,.08);
  border-radius: 8px;
  padding: 12px;
}
.ps-watch-notes h3 {
  margin: 0 0 8px;
  font-size: 15px;
}
.ps-watch-notes ul {
  margin: 0;
  padding-left: 18px;
  color: #475569;
  line-height: 1.7;
}
.ps-watch-researcher {
  margin: 14px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.65;
}
.ps-metric,
.ps-card,
.ps-axis {
  border: 1px solid rgba(15,23,42,.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15,23,42,.06);
}
.ps-metric {
  padding: 16px;
  min-height: 104px;
}
.ps-metric strong {
  display: block;
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.1;
}
.ps-metric span,
.ps-metric small {
  display: block;
  color: #64748b;
  margin-top: 4px;
}
.ps-axis {
  padding: 14px;
}
.ps-axis-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-weight: 800;
}
.ps-bar {
  height: 8px;
  background: #e2e8f0;
  border-radius: 999px;
  overflow: hidden;
  margin: 10px 0;
}
.ps-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #10b981, #0ea5e9);
}
.ps-axis p,
.ps-card p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.ps-card {
  display: block;
  padding: 16px;
  min-height: 150px;
  text-decoration: none;
  color: inherit;
}
.ps-card-link:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 30px rgba(15,23,42,.10);
}
.ps-card h3 {
  margin: 8px 0 8px;
  font-size: 16px;
  line-height: 1.45;
}
.ps-section-subhead {
  margin: 20px 0 12px;
}
.ps-section-subhead h3 {
  margin: 0 0 4px;
  font-size: 16px;
  line-height: 1.4;
}
.ps-section-subhead p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}
.ps-school-album-card {
  display: block;
  min-height: 160px;
  padding: 18px;
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255,251,235,.96), rgba(240,249,255,.96));
  border: 1px solid rgba(245,158,11,.24);
  text-decoration: none;
  color: #0f172a;
  box-shadow: 0 10px 24px rgba(15,23,42,.06);
}
.ps-school-album-card:hover {
  border-color: rgba(14,165,233,.36);
  transform: translateY(-1px);
}
.ps-school-album-card span {
  display: inline-flex;
  margin-bottom: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(245,158,11,.14);
  color: #92400e;
  font-size: 11px;
  font-weight: 850;
}
.ps-school-album-card h3 {
  margin: 0 0 8px;
  font-size: 17px;
  line-height: 1.35;
}
.ps-school-album-card p {
  margin: 0;
  color: #475569;
  line-height: 1.65;
  font-size: 13px;
}
.ps-badge,
.ps-chip {
  display: inline-flex;
  border-radius: 999px;
  background: rgba(16,185,129,.10);
  border: 1px solid rgba(16,185,129,.20);
  color: #047857;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
}
.ps-chip-muted {
  color: #475569;
  background: #f1f5f9;
  border-color: rgba(100,116,139,.20);
}
.ps-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.ps-management {
  padding: 18px;
  border-radius: 18px;
  background: rgba(240,253,244,.72);
  border: 1px solid rgba(16,185,129,.18);
}
.ps-priority {
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 900;
  background: #ecfdf5;
  color: #065f46;
  border: 1px solid rgba(16,185,129,.22);
}
.ps-priority.is-high {
  background: #fef2f2;
  color: #991b1b;
  border-color: rgba(239,68,68,.22);
}
.ps-priority.is-medium {
  background: #fffbeb;
  color: #92400e;
  border-color: rgba(245,158,11,.25);
}
.ps-management-main h3 {
  font-size: 18px;
}
.ps-management-evidence {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.ps-management-policy {
  margin-top: 14px;
  padding: 14px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(15,23,42,.10);
}
.ps-management-policy > strong {
  display: block;
  margin-bottom: 10px;
}
.ps-management-policy-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.ps-management-policy label {
  display: grid;
  gap: 5px;
  font-size: 12px;
  font-weight: 800;
  color: #475569;
}
.ps-management-policy select,
.ps-management-policy textarea {
  width: 100%;
  border: 1px solid rgba(15,23,42,.14);
  border-radius: 10px;
  padding: 9px 10px;
  font: inherit;
  color: #0f172a;
  background: #fff;
}
.ps-management-policy textarea {
  min-height: 72px;
  resize: vertical;
}
.ps-management-policy-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.ps-management-policy-actions button {
  min-height: 42px;
  border: 0;
  border-radius: 999px;
  padding: 0 16px;
  font-weight: 900;
  color: #fff;
  background: #047857;
}
.ps-management-policy-actions button:disabled {
  opacity: .65;
}
.ps-management-policy-actions span {
  font-size: 13px;
  color: #047857;
  font-weight: 800;
}
.ps-management-policy-actions span.is-error {
  color: #b91c1c;
}
.ps-album-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.ps-album-grid-compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.ps-album-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  background: #fff;
  border: 1px solid rgba(15,23,42,.08);
  box-shadow: 0 8px 22px rgba(15,23,42,.06);
  color: #0f172a;
}
.ps-album-card-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-decoration: none;
  color: inherit;
}
.ps-album-card img,
.ps-album-placeholder {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 11px;
  object-fit: cover;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #e0f2fe, #dcfce7);
  color: #0f766e;
  font-size: 26px;
}
.ps-album-card strong {
  font-size: 13px;
  line-height: 1.35;
  font-weight: 900;
  overflow-wrap: anywhere;
}
.ps-album-card small {
  color: #64748b;
  font-size: 11px;
  line-height: 1.35;
  font-weight: 760;
}
.ps-album-actions {
  display: flex;
  justify-content: flex-start;
  min-height: 34px;
}
.ps-album-like {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 5px 9px;
  border-radius: 999px;
  border: 1px solid rgba(15,23,42,.10);
  background: #f8fafc;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
  font-weight: 850;
}
.ps-album-like:hover {
  background: #ecfdf5;
  border-color: rgba(16,185,129,.24);
}
.ps-album-like.is-reacted {
  background: rgba(16,185,129,.14);
  border-color: rgba(16,185,129,.34);
  color: #047857;
}
.ps-album-season {
  width: fit-content;
  max-width: 100%;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(14,165,233,.10);
  color: #0369a1;
  font-size: 11px;
  font-weight: 900;
}
.ps-album-season.is-current {
  background: rgba(20,184,166,.14);
  color: #0f766e;
}
.ps-album-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.ps-album-tabs h3 {
  margin: 0 0 10px;
  font-size: 17px;
}
.ps-steward-card {
  border: 1px solid rgba(15,23,42,.08);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 22px rgba(15,23,42,.06);
  padding: 16px;
}
.ps-steward-card header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.ps-steward-card p {
  min-height: 42px;
  margin: 10px 0 12px;
  color: #475569;
  line-height: 1.6;
  font-size: 13px;
}
.ps-before-after {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.ps-before-after > div {
  border-radius: 12px;
  background: #f8fafc;
  padding: 10px;
}
.ps-before-after span,
.ps-before-after small {
  display: block;
  color: #64748b;
  font-size: 11px;
}
.ps-before-after strong {
  display: block;
  font-size: 24px;
}
.ps-teaser {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px) auto;
  align-items: center;
  gap: 14px;
  margin: 18px 0;
}
.ps-teaser-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.ps-teaser-metrics > div {
  border-radius: 12px;
  background: rgba(16,185,129,.08);
  padding: 10px;
}
.ps-teaser-metrics strong,
.ps-teaser-metrics span {
  display: block;
}
.ps-teaser-metrics strong {
  font-size: 20px;
  line-height: 1.2;
}
.ps-teaser-metrics span {
  color: #64748b;
  font-size: 11px;
}
.ps-boundary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.ps-boundary > div,
.ps-footnote {
  border-radius: 16px;
  padding: 18px;
  background: #f8fafc;
  border: 1px solid rgba(15,23,42,.08);
}
.ps-boundary ul {
  margin: 10px 0 0;
  padding-left: 18px;
  color: #475569;
  line-height: 1.75;
}
.ps-footnote {
  margin-top: 18px;
  color: #475569;
  line-height: 1.7;
}
.ps-footnote p { margin: 0; }
@media (max-width: 920px) {
  .ps-hero,
  .ps-boundary {
    grid-template-columns: 1fr;
  }
  .ps-grid-3,
  .ps-grid-4,
  .ps-grid-5,
  .ps-watch-grid,
  .ps-album-grid,
  .ps-album-grid-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ps-watch-hero,
  .ps-watch-notes {
    grid-template-columns: 1fr;
  }
  .ps-album-tabs {
    grid-template-columns: 1fr;
  }
  .ps-management-policy-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .ps-teaser {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  .ps-shell { padding: 12px 12px 48px; }
  .ps-hero {
    padding: 20px;
    border-radius: 14px;
  }
  .ps-hero-side {
    min-height: 112px;
    border-radius: 12px;
  }
  .ps-grid-3,
  .ps-grid-4,
  .ps-grid-5,
  .ps-watch-grid,
  .ps-watch-notes {
    grid-template-columns: 1fr;
  }
  .ps-album-grid,
  .ps-album-grid-compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .ps-album-card {
    padding: 7px;
    border-radius: 10px;
  }
  .ps-album-card img,
  .ps-album-placeholder {
    border-radius: 8px;
  }
  .ps-section-head {
    display: block;
  }
  .ps-management-policy-grid {
    grid-template-columns: 1fr;
  }
  .ps-source { display: inline-flex; margin-top: 8px; }
}
`;
