import type {
  ClusterMember,
  ClusterReviewSummary,
  ReviewStatus,
} from "../../services/audioReview.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return iso.slice(0, 19).replace("T", " ");
}

function statusLabel(status: ReviewStatus): string {
  switch (status) {
    case "ai_candidate":
      return "AI 候補";
    case "needs_review":
      return "要確認";
    case "confirmed":
      return "確認済";
    case "published":
      return "公開済 (DwC)";
    case "rejected":
      return "却下";
    default:
      return status;
  }
}

function statusBadge(status: ReviewStatus): string {
  const palette: Record<string, string> = {
    ai_candidate: "background:#fef3c7;color:#92400e;border:1px solid #fbbf24;",
    needs_review: "background:#dbeafe;color:#1e3a8a;border:1px solid #60a5fa;",
    confirmed: "background:#d1fae5;color:#065f46;border:1px solid #34d399;",
    published: "background:#e0e7ff;color:#3730a3;border:1px solid #818cf8;",
    rejected: "background:#fee2e2;color:#991b1b;border:1px solid #f87171;",
  };
  return `<span style="${palette[status] ?? "background:#f3f4f6;color:#374151;"} font-size:11px;padding:2px 8px;border-radius:9999px;">${escapeHtml(statusLabel(status))}</span>`;
}

export const SOUND_REVIEW_STYLES = `
.sr-shell { max-width: 1100px; margin: 24px auto; padding: 0 16px; font-family: -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; }
.sr-h1 { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
.sr-sub { color: #555; font-size: 13px; margin-bottom: 18px; }
.sr-tabs { display:flex; gap:6px; margin-bottom: 14px; flex-wrap: wrap; }
.sr-tab { padding:6px 12px; border:1px solid #d1d5db; border-radius: 9999px; font-size:12px; background:#fff; cursor:pointer; text-decoration:none; color:#374151; }
.sr-tab.is-active { background:#111; color:#fff; border-color:#111; }
.sr-list { display: grid; gap: 10px; }
.sr-card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; background:#fff; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.sr-card h3 { font-size:15px; margin: 0 0 6px 0; }
.sr-meta { color:#666; font-size:12px; display:flex; gap: 12px; flex-wrap: wrap; }
.sr-actions { margin-top: 12px; display:flex; gap:8px; flex-wrap: wrap; align-items: center; }
.sr-actions button { font-size:12px; padding:6px 10px; border-radius: 6px; border: 1px solid #111; background:#111; color:#fff; cursor:pointer; }
.sr-actions button.ghost { background:#fff; color:#111; }
.sr-actions button.danger { background:#dc2626; border-color:#dc2626; }
.sr-actions input[type="text"] { font-size:12px; padding:6px 10px; border:1px solid #d1d5db; border-radius:6px; min-width: 220px; }
.sr-empty { color:#777; padding: 30px; text-align:center; border: 1px dashed #d1d5db; border-radius: 10px; background:#fafafa; }
.sr-detail { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; background:#fff; margin-top: 12px; }
.sr-detail audio { display: block; width: 100%; margin: 8px 0; }
.sr-members { display: grid; gap:6px; margin-top: 8px; }
.sr-member-row { display:flex; gap:10px; align-items:center; font-size:12px; padding: 6px 8px; border-radius:6px; }
.sr-member-row:hover { background:#f9fafb; }
.sr-pill { font-size:11px; padding:1px 8px; border-radius:9999px; background:#f3f4f6; color:#444; }
.sr-toast { position: fixed; right: 16px; bottom: 16px; background:#111; color:#fff; padding: 10px 14px; border-radius:8px; font-size:13px; opacity: 0; transition: opacity 0.2s; }
.sr-toast.is-shown { opacity: 1; }
`;

export function renderSoundReviewBody(args: {
  clusters: ClusterReviewSummary[];
  status: ReviewStatus | "any";
  reviewerUserId: string;
  authVia: "session" | "write_key";
  totalCount: number;
}): string {
  const { clusters, status, reviewerUserId, totalCount } = args;
  const tabs: Array<{ key: ReviewStatus | "any"; label: string }> = [
    { key: "needs_review", label: "要確認" },
    { key: "ai_candidate", label: "AI 候補" },
    { key: "confirmed", label: "確認済" },
    { key: "rejected", label: "却下" },
    { key: "any", label: "すべて" },
  ];
  const tabsHtml = tabs
    .map(
      (t) =>
        `<a class="sr-tab${t.key === status ? " is-active" : ""}" href="/admin/sound-review?status=${encodeURIComponent(t.key)}">${escapeHtml(t.label)}</a>`,
    )
    .join("");

  const cardsHtml = clusters.length
    ? clusters
        .map((c) => clusterCard(c, reviewerUserId))
        .join("")
    : `<div class="sr-empty">該当するクラスタはまだありません。${
        status === "needs_review"
          ? "新着セグメントが Perch でクラスタ化されると、ここに並びます。"
          : ""
      }</div>`;

  return `
<div class="sr-shell" x-data="soundReview()">
  <div class="sr-h1">音声クラスタレビュー</div>
  <div class="sr-sub">
    レビュアー: <strong>${escapeHtml(reviewerUserId)}</strong> ・ 件数: ${totalCount}
    <button class="sr-tab" style="margin-left:12px;cursor:pointer;border:1px solid #111;background:#111;color:#fff;" @click="runClusterBatch()">クラスタ実行</button>
  </div>
  <div class="sr-tabs">${tabsHtml}</div>
  <div class="sr-list">${cardsHtml}</div>
  <div class="sr-toast" :class="toastShown && 'is-shown'" x-text="toastMessage"></div>
</div>
`;
}

function clusterCard(c: ClusterReviewSummary, reviewerUserId: string): string {
  const repAudio = c.representativeSegmentId
    ? `<audio controls preload="none" src="/api/v1/fieldscan/audio/segment/${encodeURIComponent(c.representativeSegmentId)}"></audio>`
    : `<div class="sr-pill">代表音未設定</div>`;
  const dominant = c.dominantTaxonGuess
    ? `<span class="sr-pill">候補: ${escapeHtml(c.dominantTaxonGuess)}${c.taxonConfidence != null ? ` (${(c.taxonConfidence * 100).toFixed(0)}%)` : ""}</span>`
    : `<span class="sr-pill">候補なし</span>`;
  const confirmed = c.confirmedLabel
    ? `<span class="sr-pill" style="background:#d1fae5;color:#065f46;">確定: ${escapeHtml(c.confirmedLabel)}</span>`
    : "";
  const reviewerInputName = `reviewer-${escapeHtml(c.clusterId)}`;
  const labelInputName = `label-${escapeHtml(c.clusterId)}`;

  return `
<div class="sr-card" x-data="{ openDetail: false, label: '', reviewer: '${escapeHtml(reviewerUserId)}' }">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
    <div style="flex:1;">
      <h3>${escapeHtml(c.clusterId.slice(0, 8))}</h3>
      <div class="sr-meta">
        ${statusBadge(c.reviewStatus)}
        <span>メンバー: ${c.memberCount}</span>
        <span>作成: ${escapeHtml(formatDate(c.createdAt))}</span>
        ${c.confirmedAt ? `<span>確定: ${escapeHtml(formatDate(c.confirmedAt))}</span>` : ""}
        ${c.gbifPublishEligible ? `<span class="sr-pill" style="background:#e0e7ff;color:#3730a3;">GBIF候補</span>` : ""}
      </div>
      <div class="sr-meta" style="margin-top:6px;">${dominant} ${confirmed}</div>
      <div style="margin-top:10px;">${repAudio}</div>
    </div>
  </div>
  <div class="sr-actions">
    <input type="text" name="${labelInputName}" x-model="label" placeholder="確定 taxon (例: ヒヨドリ)" />
    <input type="text" name="${reviewerInputName}" x-model="reviewer" placeholder="reviewerUserId" />
    <button @click="confirm('${escapeHtml(c.clusterId)}', label, reviewer, false)" :disabled="!label">確定</button>
    <button @click="confirm('${escapeHtml(c.clusterId)}', label, reviewer, true)" :disabled="!label">確定+伝播</button>
    <button class="ghost" @click="loadDetail('${escapeHtml(c.clusterId)}'); openDetail = !openDetail">${"詳細"}</button>
    <button class="ghost" @click="flag('${escapeHtml(c.clusterId)}')">要確認に上げる</button>
    <button class="danger" @click="reject('${escapeHtml(c.clusterId)}', reviewer)">却下</button>
  </div>
  <div class="sr-detail" x-show="openDetail" x-cloak>
    <div class="sr-meta">メンバー詳細 (上位 30 件)</div>
    <div class="sr-members" x-html="memberHtml['${escapeHtml(c.clusterId)}'] || '<div class=&quot;sr-pill&quot;>読み込み中...</div>'"></div>
  </div>
</div>
`;
}

export const SOUND_REVIEW_SCRIPT = `
function soundReview() {
  return {
    toastShown: false,
    toastMessage: '',
    memberHtml: {},
    showToast(message) {
      this.toastMessage = message;
      this.toastShown = true;
      setTimeout(() => { this.toastShown = false; }, 2400);
    },
    async post(url, body) {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error('HTTP ' + res.status + ': ' + text);
      }
      return res.json();
    },
    async confirm(clusterId, label, reviewer, propagate) {
      if (!label || !label.trim()) return;
      try {
        const result = await this.post('/api/v1/admin/audio/clusters/' + clusterId + '/confirm', {
          label: label.trim(),
          reviewerUserId: reviewer || undefined,
          propagate: !!propagate,
          propagateMode: 'high_conf',
          gbifPublishEligible: false,
        });
        this.showToast(propagate
          ? '確定 + 伝播 ' + (result.propagation ? result.propagation.detectionsInserted + ' 件' : '')
          : '確定しました');
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        this.showToast('失敗: ' + (e.message || e));
      }
    },
    async reject(clusterId, reviewer) {
      if (!confirm('クラスタを却下しますか?')) return;
      try {
        await this.post('/api/v1/admin/audio/clusters/' + clusterId + '/reject', {
          reviewerUserId: reviewer || undefined,
          reason: 'admin_rejected_via_ui',
        });
        this.showToast('却下しました');
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        this.showToast('失敗: ' + (e.message || e));
      }
    },
    async flag(clusterId) {
      try {
        await this.post('/api/v1/admin/audio/clusters/' + clusterId + '/flag-for-review', {});
        this.showToast('要確認に上げました');
        setTimeout(() => location.reload(), 800);
      } catch (e) {
        this.showToast('失敗: ' + (e.message || e));
      }
    },
    async runClusterBatch() {
      this.showToast('クラスタ実行中…');
      try {
        const result = await this.post('/api/v1/admin/audio/cluster-runs', { limit: 200 });
        const s = result.summary || {};
        this.showToast('処理 ' + (s.segmentsProcessed||0) + ' / 新規 ' + (s.clustersCreated||0));
        setTimeout(() => location.reload(), 1200);
      } catch (e) {
        this.showToast('失敗: ' + (e.message || e));
      }
    },
    async loadDetail(clusterId) {
      try {
        const res = await fetch('/api/v1/admin/audio/clusters/' + clusterId, { credentials: 'same-origin' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        const html = (data.members || []).map((m) => {
          const sim = (1 - (m.distanceToCentroid || 0)).toFixed(3);
          const taxonText = m.candidateTaxon ? (' / ' + m.candidateTaxon + ' (' + (m.bestConfidence != null ? (m.bestConfidence*100).toFixed(0) + '%' : '?') + ')') : '';
          return '<div class="sr-member-row">'
            + '<span class="sr-pill">sim ' + sim + '</span>'
            + '<audio controls preload="none" src="/api/v1/fieldscan/audio/segment/' + encodeURIComponent(m.segmentId) + '" style="height:32px;flex:1;"></audio>'
            + '<span style="color:#666;font-size:11px;">' + (m.recordedAt || '') + taxonText + '</span>'
            + '</div>';
        }).join('');
        this.memberHtml[clusterId] = html || '<div class="sr-pill">メンバーがありません</div>';
      } catch (e) {
        this.memberHtml[clusterId] = '<div class="sr-pill">読み込み失敗: ' + (e.message || e) + '</div>';
      }
    },
  };
}
`;
