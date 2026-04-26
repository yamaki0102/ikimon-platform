import type { ObservationEventRecap, RecapTeamSummary, RecapTimelineEntry } from "../services/observationEventRecap.js";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function timelineLabel(entry: RecapTimelineEntry): string {
  const p = entry.payload as Record<string, unknown>;
  switch (entry.type) {
    case "observation_added":
      return `🌿 <b>${escapeHtml(String(p.taxon_name ?? "観察"))}</b> を発見`;
    case "absence_recorded":
      return `❌ <b>${escapeHtml(String(p.searched_taxon ?? "種不明"))}</b> を確かめた`;
    case "checkin":
      return `🚪 <b>${escapeHtml(String(p.display_name ?? "参加者"))}</b> がチェックイン`;
    case "announce":
      return `📣 ${escapeHtml(String(p.message ?? ""))}`;
    case "quest_offered":
      return `✨ AI Quest <b>${escapeHtml(String(p.headline ?? ""))}</b>`;
    case "quest_accepted":
      return `✅ クエスト受諾`;
    case "quest_completed":
      return `🏁 クエスト達成`;
    case "milestone":
      return `🏆 マイルストーン`;
    case "fanfare":
      return `🎉 ${escapeHtml(String(p.message ?? "ファンファーレ"))}`;
    case "team_update":
      return `👥 班情報更新`;
    case "rare_species":
      return `🪶 希少種の記録`;
    case "mode_switch":
      return `🔁 モード切替`;
    default:
      return entry.type;
  }
}

export function renderRecapBody(recap: ObservationEventRecap): string {
  const { session, highlights, effort, teams, timeline, impacts, myContribution } = recap;
  const headerDate = formatDate(highlights.startedAt);
  const heroStats = `
    <div><strong>${highlights.observationCount}</strong><span>観察</span></div>
    <div><strong>${highlights.uniqueSpeciesCount}</strong><span>種</span></div>
    <div><strong>${highlights.absencesCount}</strong><span>不在</span></div>
  `;

  const teamCards = teams.length === 0
    ? `<div class="evt-card"><span class="evt-eyebrow">班</span><p class="evt-lead">班は作成されませんでした。</p></div>`
    : teams.map((t: RecapTeamSummary) => `
      <article class="evt-card">
        <header style="display:flex; align-items:center; gap:8px;">
          <span class="evt-team-color" style="background:${escapeHtml(t.color)};"></span>
          <strong>${escapeHtml(t.name)}</strong>
          <span class="evt-lead" style="font-size:12px;">${t.memberCount} 名</span>
        </header>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-top:10px;">
          <div><strong style="font-size:18px;">${t.observationsCount}</strong><div class="evt-eyebrow">観察</div></div>
          <div><strong style="font-size:18px;">${t.uniqueSpeciesCount}</strong><div class="evt-eyebrow">種数</div></div>
          <div><strong style="font-size:18px;">${t.absencesCount}</strong><div class="evt-eyebrow">不在</div></div>
        </div>
        <p class="evt-lead" style="margin-top:8px;">受諾クエスト: ${t.questsAccepted} 件</p>
      </article>
    `).join("");

  const topTaxa = highlights.topTaxa.length === 0
    ? `<p class="evt-lead">観察記録はまだありません。</p>`
    : highlights.topTaxa.map((t) => `
        <span class="evt-badge evt-mode-discovery">${escapeHtml(t.name)} ×${t.count}</span>
      `).join(" ");

  const personalSection = myContribution
    ? `
      <article class="evt-card evt-impact-card">
        <h3>${escapeHtml(myContribution.displayName ?? "あなた")} の貢献</h3>
        <p class="evt-lead">あなたの観察記録は、ZINB / Occupancy Model の高品質ピクセルになります。</p>
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-top:10px;">
          <div><strong style="font-size:22px;">${myContribution.observationsCount}</strong><div class="evt-eyebrow">観察</div></div>
          <div><strong style="font-size:22px;">${myContribution.uniqueSpeciesCount}</strong><div class="evt-eyebrow">種数</div></div>
          <div><strong style="font-size:22px;">${myContribution.absencesCount}</strong><div class="evt-eyebrow">不在</div></div>
        </div>
        ${myContribution.recentTaxa.length > 0
          ? `<p style="margin-top:10px;"><span class="evt-eyebrow">あなたが残した種</span><br>${myContribution.recentTaxa.map(escapeHtml).join("、")}</p>`
          : ""}
      </article>`
    : "";

  const impactSection = impacts.length === 0
    ? `<p class="evt-lead">月次バッチで、観察会の記録が地域戦略・TNFD ブリーフにどう使われたかをこの欄に追記します。</p>`
    : impacts.map((i) => `
        <article class="evt-card">
          <span class="evt-eyebrow">${escapeHtml(i.impactType)}</span>
          <p class="evt-lead" style="margin-top:6px;">${escapeHtml(i.description)}</p>
          ${i.externalRef ? `<a href="${escapeHtml(i.externalRef)}" target="_blank" rel="noopener" class="evt-eyebrow">参照リンク</a>` : ""}
        </article>`).join("");

  const timelineHtml = timeline.length === 0
    ? `<p class="evt-lead">タイムラインはまだありません。</p>`
    : timeline
        .slice(-100)
        .map((entry) => `
          <li style="display:grid; grid-template-columns:auto 1fr auto; gap:10px; padding:8px 12px; border-bottom:1px solid var(--evt-line);">
            <span class="evt-eyebrow" style="font-variant-numeric: tabular-nums;">${formatTime(entry.createdAt)}</span>
            <span style="font-size:14px;">${timelineLabel(entry)}</span>
            <span class="evt-eyebrow">${escapeHtml(entry.scope)}</span>
          </li>`).join("");

  return `
<section class="evt-recap-shell">
  <article class="evt-result-card">
    <span class="evt-result-eyebrow">${escapeHtml(headerDate)} • ${highlights.durationMinutes ?? "?"} 分</span>
    <h2>${escapeHtml(session.title || "観察会の振り返り")}</h2>
    <p style="margin:0; color:rgba(236,253,245,.86);">参加 ${highlights.participantsCount} 名・effort ${highlights.totalEffortPersonHours} 人時・カバレッジ ${highlights.meshCoveragePct}%</p>
    <div class="evt-result-stats evt-stagger">
      ${heroStats}
    </div>
  </article>

  <div class="evt-recap-tabs" role="tablist">
    <button class="evt-recap-tab is-active" data-tab="overview" type="button">全体</button>
    <button class="evt-recap-tab" data-tab="teams" type="button">班</button>
    <button class="evt-recap-tab" data-tab="me" type="button">あなた</button>
    <button class="evt-recap-tab" data-tab="timeline" type="button">タイムライン</button>
    <button class="evt-recap-tab" data-tab="impact" type="button">科学的影響</button>
  </div>

  <section class="evt-recap-section" data-tab-panel="overview">
    <h2 class="evt-heading">よく見つかった種</h2>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:10px;">${topTaxa}</div>

    <h2 class="evt-heading" style="margin-top:24px;">セッションの数字</h2>
    <div class="evt-stagger" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px,1fr)); gap:10px;">
      <div class="evt-card"><span class="evt-eyebrow">観察</span><strong style="font-size:24px;">${highlights.observationCount}</strong></div>
      <div class="evt-card"><span class="evt-eyebrow">種数</span><strong style="font-size:24px;">${highlights.uniqueSpeciesCount}</strong></div>
      <div class="evt-card"><span class="evt-eyebrow">不在</span><strong style="font-size:24px;">${highlights.absencesCount}</strong></div>
      <div class="evt-card"><span class="evt-eyebrow">クエスト達成</span><strong style="font-size:24px;">${highlights.questsCompleted}</strong></div>
      <div class="evt-card"><span class="evt-eyebrow">カバレッジ</span><strong style="font-size:24px;">${effort.coveragePct}%</strong></div>
      <div class="evt-card"><span class="evt-eyebrow">努力量</span><strong style="font-size:24px;">${effort.totalEffortPersonHours} 人時</strong></div>
    </div>
  </section>

  <section class="evt-recap-section" data-tab-panel="teams" style="display:none;">
    <h2 class="evt-heading">班ごとの達成</h2>
    <div class="evt-stagger" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px,1fr)); gap:12px;">
      ${teamCards}
    </div>
  </section>

  <section class="evt-recap-section" data-tab-panel="me" style="display:none;">
    ${personalSection || `<p class="evt-lead">参加者 URL でアクセスすると、あなたの貢献が見られます。</p>`}
  </section>

  <section class="evt-recap-section" data-tab-panel="timeline" style="display:none;">
    <h2 class="evt-heading">時系列タイムライン</h2>
    <ol style="list-style:none; margin:0; padding:0;">
      ${timelineHtml}
    </ol>
  </section>

  <section class="evt-recap-section" data-tab-panel="impact" style="display:none;">
    <h2 class="evt-heading">この観察会のその後</h2>
    ${impactSection}
  </section>
</section>
`;
}

export function recapScript(): string {
  return String.raw`
(() => {
  const tabs = document.querySelectorAll(".evt-recap-tab");
  const panels = document.querySelectorAll("[data-tab-panel]");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");
      tabs.forEach(t => t.classList.remove("is-active"));
      tab.classList.add("is-active");
      panels.forEach(p => {
        p.style.display = (p.getAttribute("data-tab-panel") === target) ? "" : "none";
      });
    });
  });
})();
`;
}
