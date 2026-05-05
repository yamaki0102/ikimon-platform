/**
 * 観察会(observation event)系画面の共通 Material 3 Expressive スタイル。
 *
 * 設計原則:
 *   - 屋外日光下で読める高コントラスト
 *   - 片手・手袋でも触れる 48px 以上のタップターゲット
 *   - stagger entry / hover elevation / focus-visible の motion 三点セット
 *   - 5 モード(Discovery/Effort/Bingo/Absence/AI Quest)の色相を accent で切り分け
 *   - 既存 siteShell の design tokens (--accent / --hero-a etc.) を継承
 *   - 既存 observationCard, mentorStrip, communityMeter のレトリックを尊重
 */

export const OBSERVATION_EVENT_STYLES = `
:root {
  --evt-accent-discovery: #10b981;
  --evt-accent-effort:    #0ea5e9;
  --evt-accent-bingo:     #f59e0b;
  --evt-accent-absence:   #6366f1;
  --evt-accent-quest:     #ec4899;
  --evt-glow-discovery:  rgba(16,185,129,.42);
  --evt-glow-effort:     rgba(14,165,233,.42);
  --evt-glow-bingo:      rgba(245,158,11,.45);
  --evt-glow-absence:    rgba(99,102,241,.42);
  --evt-glow-quest:      rgba(236,72,153,.42);
  --evt-surface:         #ffffff;
  --evt-surface-soft:    rgba(255,255,255,.92);
  --evt-surface-deep:    #0f172a;
  --evt-ink:             #0f172a;
  --evt-ink-soft:        #475569;
  --evt-line:            rgba(15,23,42,.08);
  --evt-shadow-sm:       0 2px 4px rgba(15,23,42,.06);
  --evt-shadow-md:       0 8px 24px rgba(15,23,42,.10);
  --evt-shadow-lg:       0 18px 44px rgba(15,23,42,.14);
  --evt-radius-sm:       12px;
  --evt-radius-md:       18px;
  --evt-radius-lg:       28px;
  --evt-motion-fast:     180ms cubic-bezier(0.2, 0, 0.2, 1);
  --evt-motion:          240ms cubic-bezier(0.2, 0, 0.2, 1);
  --evt-motion-slow:     360ms cubic-bezier(0.2, 0, 0.2, 1);
}

/* === stagger entry: 既存資産にない、M3 Expressive の核 === */
@keyframes evt-rise {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}
@keyframes evt-pulse {
  0%   { transform: scale(1);   box-shadow: 0 0 0 0 var(--evt-glow-discovery); }
  60%  { transform: scale(1.04); box-shadow: 0 0 0 22px transparent; }
  100% { transform: scale(1);   box-shadow: 0 0 0 0 transparent; }
}
@keyframes evt-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
@keyframes evt-fanfare {
  0%   { transform: scale(.6) translateY(8px); opacity: 0; }
  35%  { transform: scale(1.06) translateY(0); opacity: 1; }
  60%  { transform: scale(.98); }
  100% { transform: scale(1); }
}
@keyframes evt-confetti-rise {
  0%   { transform: translateY(20px) rotate(0); opacity: 0; }
  20%  { opacity: 1; }
  100% { transform: translateY(-220px) rotate(540deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .evt-stagger > * { animation: none !important; }
  .evt-pulse { animation: none !important; }
  .evt-fanfare { animation: none !important; }
}

/* === グローバル hero === */
.evt-hero {
  position: relative;
  border-radius: var(--evt-radius-lg);
  padding: clamp(28px, 4vw, 56px) clamp(20px, 4vw, 56px);
  background:
    radial-gradient(120% 80% at 20% 0%, rgba(16,185,129,.55), rgba(16,185,129,0) 60%),
    radial-gradient(110% 90% at 90% 100%, rgba(14,165,233,.55), rgba(14,165,233,0) 60%),
    linear-gradient(135deg, #064e3b 0%, #065f46 35%, #0c4a6e 100%);
  color: #ecfdf5;
  overflow: hidden;
  box-shadow: var(--evt-shadow-lg);
}
.evt-hero::before {
  content: "";
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  mix-blend-mode: screen;
}
.evt-hero > * { position: relative; }
.evt-hero .evt-hero-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 14px;
  font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase;
  color: #d1fae5;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.22);
  border-radius: 999px;
  backdrop-filter: blur(6px);
}
.evt-hero h1 {
  margin: 12px 0 8px;
  font-size: clamp(28px, 5vw, 44px);
  line-height: 1.18;
  letter-spacing: -.02em;
  font-weight: 850;
}
.evt-hero p { margin: 0; max-width: 60ch; color: rgba(236,253,245,.86); font-size: 16px; line-height: 1.6; }
.evt-hero .evt-hero-meta {
  display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 18px;
  font-size: 13px; color: #d1fae5;
}
.evt-hero .evt-hero-meta b { font-weight: 700; color: #ecfdf5; }
.evt-hero .evt-hero-actions {
  display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px;
}

/* === ボタン === */
.evt-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: 8px;
  min-height: 48px; padding: 12px 20px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 15px; font-weight: 800; letter-spacing: .02em;
  text-decoration: none;
  cursor: pointer;
  transition: transform var(--evt-motion-fast), box-shadow var(--evt-motion), background var(--evt-motion);
  -webkit-tap-highlight-color: transparent;
}
.evt-btn:active { transform: scale(.97); }
.evt-btn:focus-visible { outline: 3px solid var(--evt-accent-discovery); outline-offset: 4px; }

.evt-btn-primary {
  color: #ffffff;
  background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%);
  box-shadow: 0 12px 28px var(--evt-glow-discovery);
}
.evt-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 16px 36px var(--evt-glow-discovery); }

.evt-btn-ghost {
  color: var(--evt-ink);
  background: rgba(255,255,255,.86);
  border-color: var(--evt-line);
}
.evt-btn-ghost:hover { background: #ffffff; transform: translateY(-1px); }

.evt-btn-on-dark {
  color: #ecfdf5;
  background: rgba(255,255,255,.16);
  border-color: rgba(255,255,255,.28);
  backdrop-filter: blur(6px);
}
.evt-btn-on-dark:hover { background: rgba(255,255,255,.24); }

.evt-btn-danger {
  color: #ffffff;
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
}

/* === カードベース === */
.evt-card {
  position: relative;
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  border-radius: var(--evt-radius-md);
  box-shadow: var(--evt-shadow-sm);
  padding: 16px 18px;
  transition: transform var(--evt-motion), box-shadow var(--evt-motion), border-color var(--evt-motion);
  animation: evt-rise var(--evt-motion-slow) both;
}
.evt-card:hover { transform: translateY(-2px); box-shadow: var(--evt-shadow-md); }

.evt-stagger > * { animation: evt-rise var(--evt-motion-slow) both; }
.evt-stagger > *:nth-child(1) { animation-delay:   0ms; }
.evt-stagger > *:nth-child(2) { animation-delay:  60ms; }
.evt-stagger > *:nth-child(3) { animation-delay: 120ms; }
.evt-stagger > *:nth-child(4) { animation-delay: 180ms; }
.evt-stagger > *:nth-child(5) { animation-delay: 240ms; }
.evt-stagger > *:nth-child(6) { animation-delay: 300ms; }
.evt-stagger > *:nth-child(7) { animation-delay: 360ms; }
.evt-stagger > *:nth-child(8) { animation-delay: 420ms; }

/* === eyebrow + heading === */
.evt-eyebrow {
  display: inline-block;
  font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
  color: var(--evt-ink-soft);
}
.evt-heading {
  margin: 4px 0 6px;
  font-size: clamp(18px, 2.4vw, 22px);
  font-weight: 850; letter-spacing: -.01em;
  color: var(--evt-ink);
}
.evt-lead { margin: 0; color: var(--evt-ink-soft); font-size: 14px; line-height: 1.65; }

/* === badge === */
.evt-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border-radius: 999px;
  font-size: 12px; font-weight: 700; letter-spacing: .04em;
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  color: var(--evt-ink);
}
.evt-badge.evt-mode-discovery { background: rgba(16,185,129,.10); color: #047857; border-color: rgba(16,185,129,.32); }
.evt-badge.evt-mode-effort    { background: rgba(14,165,233,.10); color: #0369a1; border-color: rgba(14,165,233,.32); }
.evt-badge.evt-mode-bingo     { background: rgba(245,158,11,.12); color: #92400e; border-color: rgba(245,158,11,.32); }
.evt-badge.evt-mode-absence   { background: rgba(99,102,241,.10); color: #4338ca; border-color: rgba(99,102,241,.32); }
.evt-badge.evt-mode-quest     { background: rgba(236,72,153,.10); color: #9d174d; border-color: rgba(236,72,153,.32); }
.evt-badge.is-live::before {
  content: ""; width: 8px; height: 8px; border-radius: 50%;
  background: #ef4444; animation: evt-pulse 1.6s ease-in-out infinite;
  box-shadow: 0 0 0 0 rgba(239,68,68,.6);
}

/* === 5 ペインライブ画面（参加者） === */
.evt-live-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100vh;
  height: 100dvh;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
  color: var(--evt-ink);
}
.evt-live-topbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center; gap: 12px;
  padding: 10px 16px;
  background: var(--evt-surface);
  border-bottom: 1px solid var(--evt-line);
  box-shadow: var(--evt-shadow-sm);
}
.evt-live-topbar-time {
  font-variant-numeric: tabular-nums;
  font-weight: 850; font-size: 18px;
}
.evt-live-topbar-progress {
  display: flex; flex-direction: column; gap: 4px;
}
.evt-live-progress-bar {
  position: relative;
  height: 8px; border-radius: 999px;
  background: rgba(15,23,42,.08);
  overflow: hidden;
}
.evt-live-progress-bar > span {
  position: absolute; inset: 0 auto 0 0;
  background: linear-gradient(90deg, var(--evt-accent-discovery) 0%, var(--evt-accent-effort) 100%);
  border-radius: 999px;
  transition: width var(--evt-motion-slow);
}
.evt-live-topbar-mode {
  display: flex; align-items: center; gap: 6px;
}

.evt-live-main {
  display: grid;
  grid-template-rows: minmax(280px, 56%) minmax(160px, 28%) auto;
  gap: 8px;
  padding: 8px;
  overflow: hidden;
}
.evt-live-map {
  position: relative;
  border-radius: var(--evt-radius-md);
  overflow: hidden;
  background: #0f172a;
  box-shadow: var(--evt-shadow-md);
}
.evt-live-map .evt-live-map-canvas {
  position: absolute; inset: 0;
  background:
    radial-gradient(120% 80% at 30% 30%, rgba(16,185,129,.30), transparent 60%),
    radial-gradient(120% 80% at 80% 80%, rgba(14,165,233,.28), transparent 60%),
    linear-gradient(135deg, #0f172a, #1e293b);
}
.evt-live-map-overlay {
  position: absolute; left: 12px; bottom: 12px; right: 12px;
  display: flex; gap: 8px; flex-wrap: wrap; pointer-events: none;
}
.evt-live-map-overlay > * { pointer-events: auto; }

.evt-live-feed {
  display: flex; flex-direction: column;
  background: var(--evt-surface);
  border-radius: var(--evt-radius-md);
  box-shadow: var(--evt-shadow-sm);
  border: 1px solid var(--evt-line);
  overflow: hidden;
}
.evt-live-feed-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--evt-line);
  background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
}
.evt-live-feed-list {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 8px 12px 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.evt-live-feed-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px; align-items: center;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 14px;
  border: 1px solid var(--evt-line);
  font-size: 14px;
  animation: evt-rise var(--evt-motion) both;
}
.evt-live-feed-icon {
  width: 36px; height: 36px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  font-size: 18px;
}
.evt-live-feed-item.is-rare { background: linear-gradient(135deg, #fff7ed, #fef3c7); }
.evt-live-feed-item.is-target { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
.evt-live-feed-item.is-quest { background: linear-gradient(135deg, #fdf2f8, #fce7f3); }
.evt-live-feed-item.is-announce { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
.evt-live-feed-time { color: var(--evt-ink-soft); font-size: 12px; font-variant-numeric: tabular-nums; }

.evt-live-status {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  padding: 6px 4px 0;
}
.evt-live-stat-card {
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  border-radius: 14px;
  padding: 10px 12px;
  display: flex; flex-direction: column; gap: 2px;
}
.evt-live-stat-card .evt-live-stat-label { font-size: 11px; color: var(--evt-ink-soft); letter-spacing: .08em; text-transform: uppercase; }
.evt-live-stat-card .evt-live-stat-value { font-size: 20px; font-weight: 850; font-variant-numeric: tabular-nums; }

.evt-live-actions {
  display: grid;
  grid-template-columns: 1.4fr 1fr 1fr 1fr;
  gap: 8px;
  padding: 8px 8px 12px;
  background: var(--evt-surface);
  border-top: 1px solid var(--evt-line);
  box-shadow: 0 -8px 24px rgba(15,23,42,.06);
}
.evt-live-action-btn {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  min-height: 64px;
  padding: 10px 8px;
  border-radius: 18px;
  border: 1px solid var(--evt-line);
  background: var(--evt-surface);
  color: var(--evt-ink);
  font-weight: 800; font-size: 13px;
  cursor: pointer;
  transition: transform var(--evt-motion-fast), box-shadow var(--evt-motion-fast), background var(--evt-motion-fast);
  -webkit-tap-highlight-color: transparent;
}
.evt-live-action-btn:active { transform: scale(.96); }
.evt-live-action-btn .evt-live-action-icon { font-size: 22px; line-height: 1; }
.evt-live-action-btn[data-mood="record"]   { background: linear-gradient(135deg, #10b981, #0ea5e9); color: #fff; border-color: transparent; box-shadow: 0 12px 28px var(--evt-glow-effort); }
.evt-live-action-btn[data-mood="check"]    { background: rgba(99,102,241,.08); border-color: rgba(99,102,241,.28); color: #4338ca; }
.evt-live-action-btn[data-mood="absent"]   { background: rgba(15,23,42,.04); color: #1f2937; }
.evt-live-action-btn[data-mood="role"]     { background: rgba(236,72,153,.08); border-color: rgba(236,72,153,.32); color: #9d174d; }
.evt-live-action-btn:focus-visible { outline: 3px solid currentColor; outline-offset: 3px; }

/* === Quest カード（中段オーバーレイ） === */
.evt-quest-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--evt-radius-md);
  background: linear-gradient(135deg, rgba(236,72,153,.10), rgba(236,72,153,0));
  border: 1px solid rgba(236,72,153,.32);
  position: relative;
  animation: evt-fanfare var(--evt-motion-slow) both;
}
.evt-quest-card-icon {
  width: 44px; height: 44px; border-radius: 14px;
  display: grid; place-items: center;
  background: linear-gradient(135deg, #ec4899, #f97316);
  color: #fff; font-size: 22px;
  box-shadow: 0 8px 18px var(--evt-glow-quest);
}
.evt-quest-card .evt-quest-prompt {
  margin: 4px 0 8px; font-size: 14px; line-height: 1.55; color: var(--evt-ink);
  font-weight: 600;
}
.evt-quest-card .evt-quest-actions { display: flex; gap: 8px; }
.evt-quest-card .evt-quest-actions button {
  flex: 1 1 auto;
  min-height: 40px; padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--evt-line);
  background: var(--evt-surface);
  font-weight: 800; font-size: 13px;
  cursor: pointer;
}
.evt-quest-card .evt-quest-actions button.is-accept {
  background: linear-gradient(135deg, #ec4899, #f97316);
  color: #fff; border-color: transparent;
}

/* === 参加者管制塔(主催者) === */
.evt-console-shell {
  display: grid;
  grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
  min-height: calc(100vh - 60px);
  gap: 1px;
  background: var(--evt-line);
}
@media (max-width: 960px) {
  .evt-console-shell { grid-template-columns: 1fr; }
}
.evt-console-side {
  background: var(--evt-surface);
  padding: 18px;
  display: flex; flex-direction: column; gap: 14px;
}
.evt-console-main {
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 80%);
  padding: 18px;
  display: flex; flex-direction: column; gap: 18px;
}
.evt-console-grid {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}
.evt-console-meter {
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  border-radius: var(--evt-radius-md);
  padding: 14px 16px;
}
.evt-console-meter .evt-console-meter-value {
  font-size: 36px; font-weight: 850; line-height: 1.1;
  font-variant-numeric: tabular-nums;
  background: linear-gradient(135deg, #0ea5e9 0%, #10b981 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.evt-console-meter[data-mode="absence"] .evt-console-meter-value { background: linear-gradient(135deg, #6366f1, #ec4899); -webkit-background-clip: text; color: transparent; }
.evt-console-meter[data-mode="bingo"] .evt-console-meter-value { background: linear-gradient(135deg, #f59e0b, #ef4444); -webkit-background-clip: text; color: transparent; }
.evt-console-team-row {
  display: grid; grid-template-columns: auto 1fr auto auto; gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 14px;
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
}
.evt-team-color {
  width: 14px; height: 14px; border-radius: 4px;
  box-shadow: 0 0 0 2px rgba(255,255,255,.6) inset, 0 0 0 1px rgba(15,23,42,.1);
}
.evt-console-mode-switch {
  display: flex; flex-wrap: wrap; gap: 6px;
}
.evt-mode-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px; min-height: 38px;
  border-radius: 999px; border: 1px solid var(--evt-line);
  background: var(--evt-surface);
  font-size: 13px; font-weight: 700;
  cursor: pointer;
  transition: transform var(--evt-motion-fast), background var(--evt-motion-fast);
}
.evt-mode-pill:hover { transform: translateY(-1px); }
.evt-mode-pill.is-active {
  background: linear-gradient(135deg, #10b981, #0ea5e9); color: #fff; border-color: transparent;
  box-shadow: 0 8px 20px rgba(14,165,233,.35);
}

/* === Recap 画面 === */
.evt-recap-shell {
  display: grid; gap: 24px;
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 18px 64px;
}
.evt-recap-tabs {
  display: flex; gap: 6px; flex-wrap: wrap;
  padding: 6px;
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  border-radius: 999px;
  width: max-content;
}
.evt-recap-tab {
  padding: 8px 14px; min-height: 40px;
  border-radius: 999px;
  background: transparent; border: 0;
  font-weight: 700; font-size: 13px; color: var(--evt-ink-soft);
  cursor: pointer;
  transition: background var(--evt-motion-fast), color var(--evt-motion-fast);
}
.evt-recap-tab.is-active {
  background: linear-gradient(135deg, #10b981, #0ea5e9);
  color: #fff;
}
.evt-recap-section { animation: evt-rise var(--evt-motion-slow) both; }

.evt-impact-card {
  background: linear-gradient(135deg, rgba(99,102,241,.06), rgba(16,185,129,.06));
  border: 1px solid rgba(99,102,241,.18);
  border-radius: var(--evt-radius-md);
  padding: 16px 18px;
}
.evt-impact-card h3 {
  margin: 0 0 6px; font-size: 16px; font-weight: 850;
  background: linear-gradient(135deg, #6366f1, #10b981);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.evt-result-card {
  position: relative;
  padding: 22px 22px 20px;
  border-radius: var(--evt-radius-lg);
  color: #ffffff;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #064e3b 100%);
  box-shadow: var(--evt-shadow-lg);
  overflow: hidden;
}
.evt-result-card::before {
  content: ""; position: absolute; inset: 0;
  background: radial-gradient(120% 80% at 80% 0%, rgba(16,185,129,.45), transparent 55%),
              radial-gradient(120% 80% at 0% 100%, rgba(236,72,153,.32), transparent 55%);
}
.evt-result-card > * { position: relative; }
.evt-result-card .evt-result-eyebrow { color: #d1fae5; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; font-weight: 700; }
.evt-result-card h2 { margin: 6px 0 12px; font-size: clamp(22px, 3vw, 30px); line-height: 1.18; font-weight: 850; }
.evt-result-card .evt-result-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
  margin-top: 14px;
}
.evt-result-card .evt-result-stats > div {
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.14);
  border-radius: 14px; padding: 10px 12px;
  backdrop-filter: blur(4px);
}
.evt-result-card .evt-result-stats strong { display: block; font-size: 22px; font-weight: 850; font-variant-numeric: tabular-nums; }
.evt-result-card .evt-result-stats span { font-size: 11px; color: #d1fae5; letter-spacing: .08em; text-transform: uppercase; }

/* === チェックイン === */
.evt-checkin-shell {
  display: grid; gap: 18px;
  max-width: 520px; margin: 0 auto;
  padding: 24px 18px 48px;
}
.evt-checkin-form {
  display: grid; gap: 12px;
  background: var(--evt-surface);
  border: 1px solid var(--evt-line);
  border-radius: var(--evt-radius-md);
  padding: 18px;
}
.evt-checkin-form label { display: grid; gap: 6px; font-weight: 700; font-size: 14px; }
.evt-checkin-form input,
.evt-checkin-form select {
  min-height: 48px; padding: 10px 14px;
  border-radius: 14px;
  border: 1px solid var(--evt-line);
  background: #ffffff;
  font-size: 16px;
  transition: border-color var(--evt-motion-fast), box-shadow var(--evt-motion-fast);
}
.evt-checkin-form input:focus,
.evt-checkin-form select:focus {
  outline: 0;
  border-color: var(--evt-accent-discovery);
  box-shadow: 0 0 0 4px rgba(16,185,129,.18);
}
.evt-checkin-team-grid {
  display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
.evt-checkin-team-card {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 14px; min-height: 76px;
  border-radius: 14px;
  border: 1px solid var(--evt-line);
  background: var(--evt-surface);
  cursor: pointer;
  transition: transform var(--evt-motion-fast), border-color var(--evt-motion-fast);
}
.evt-checkin-team-card:hover { transform: translateY(-1px); }
.evt-checkin-team-card.is-selected {
  border-color: var(--evt-accent-discovery);
  box-shadow: 0 0 0 3px rgba(16,185,129,.18);
}

/* === 観察会作成: 開催エリア設計 === */
.evt-area-planner {
  border: 1px solid var(--evt-line);
  border-radius: 14px;
  padding: 12px 14px;
  display: grid;
  gap: 10px;
}
.evt-area-planner > legend {
  padding: 0 6px;
  font-weight: 800;
  font-size: 13px;
}
.evt-area-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: start;
}
.evt-area-toolbar,
.evt-area-modebar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.evt-area-map-shell {
  position: relative;
  height: 360px;
  min-height: 360px;
  border-radius: 16px;
  border: 1px solid var(--evt-line);
  overflow: hidden;
  background: #e2e8f0;
}
.evt-area-map {
  position: absolute;
  inset: 0;
}
.evt-area-map-shell > .evt-area-map.maplibregl-map {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.evt-area-map-fallback {
  position: absolute;
  inset: auto 10px 10px 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(15,23,42,.78);
  color: #fff;
  font-size: 12px;
  pointer-events: none;
}
.evt-area-map-shell.is-map-ready .evt-area-map-fallback {
  display: none;
}
.evt-area-status {
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(248,250,252,.9);
  border: 1px solid rgba(148,163,184,.18);
  color: var(--evt-ink-soft);
  font-size: 12px;
  font-weight: 700;
}
.evt-area-suggestions,
.evt-area-conflicts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}
.evt-area-suggestion,
.evt-area-conflict {
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 12px;
  border-radius: 14px;
  border: 1px solid var(--evt-line);
  background: #fff;
}
.evt-area-suggestion {
  cursor: pointer;
}
.evt-area-suggestion.is-selected {
  border-color: var(--evt-accent-discovery);
  box-shadow: 0 0 0 3px rgba(16,185,129,.18);
}
.evt-area-suggestion strong,
.evt-area-conflict strong {
  color: var(--evt-ink);
  font-size: 14px;
}
.evt-area-suggestion span,
.evt-area-conflict span {
  color: var(--evt-ink-soft);
  font-size: 12px;
  line-height: 1.45;
}
.evt-area-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 720px) {
  .evt-area-head { grid-template-columns: 1fr; }
  .evt-area-map-shell { height: 320px; min-height: 320px; }
  .evt-area-toolbar .evt-btn { flex: 1 1 auto; }
}

/* === コネクションステータス（オフラインバッジ） === */
.evt-conn {
  position: fixed; bottom: 16px; right: 16px;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 999px;
  font-size: 12px; font-weight: 700;
  background: rgba(15,23,42,.85); color: #ecfdf5;
  box-shadow: var(--evt-shadow-md);
  pointer-events: none;
  opacity: 0;
  transform: translateY(8px);
  transition: opacity var(--evt-motion), transform var(--evt-motion);
}
.evt-conn.is-visible { opacity: 1; transform: translateY(0); }
.evt-conn[data-state="online"] { background: rgba(16,185,129,.92); }
.evt-conn[data-state="offline"] { background: rgba(239,68,68,.92); }
.evt-conn[data-state="reconnect"] { background: rgba(245,158,11,.92); }

/* === Confetti レイヤー === */
.evt-confetti-layer {
  position: fixed; inset: 0;
  pointer-events: none;
  z-index: 80;
  overflow: hidden;
}
.evt-confetti-piece {
  position: absolute;
  width: 8px; height: 14px;
  border-radius: 2px;
  animation: evt-confetti-rise 1.6s cubic-bezier(0.2, 0, 0.2, 1) forwards;
}

/* === SR only === */
.evt-sr-only {
  position: absolute !important; clip: rect(0 0 0 0); clip-path: inset(50%);
  width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden;
  border: 0; white-space: nowrap;
}
`;

/**
 * ファンファーレ confetti / 触感 / TTS の発動を共通化するクライアント JS。
 * SSR で <script> として埋め込む(直書き、bundle 不要)。
 */
export const OBSERVATION_EVENT_BOOT_SCRIPT = String.raw`
(() => {
  if (window.__evtBoot) return;
  window.__evtBoot = true;

  const palette = ["#10b981","#0ea5e9","#ec4899","#f59e0b","#6366f1","#34d399"];

  function fanfare(label){
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let layer = document.querySelector(".evt-confetti-layer");
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "evt-confetti-layer";
      document.body.appendChild(layer);
    }
    for (let i = 0; i < 22; i++) {
      const piece = document.createElement("span");
      piece.className = "evt-confetti-piece";
      piece.style.left = (Math.random() * 100) + "vw";
      piece.style.bottom = "-20px";
      piece.style.background = palette[Math.floor(Math.random()*palette.length)];
      piece.style.animationDelay = (Math.random()*220) + "ms";
      piece.style.transform = "rotate(" + (Math.random()*180-90) + "deg)";
      layer.appendChild(piece);
      setTimeout(() => piece.remove(), 2400);
    }
    if (typeof navigator.vibrate === "function") {
      try { navigator.vibrate([30, 40, 30]); } catch (_) {}
    }
    if (label) {
      const live = document.querySelector("[data-evt-aria-live]");
      if (live) live.textContent = label;
    }
  }
  window.evtFanfare = fanfare;

  // connection status badge
  const conn = document.createElement("div");
  conn.className = "evt-conn";
  conn.dataset.state = "online";
  conn.setAttribute("role", "status");
  conn.setAttribute("aria-live", "polite");
  document.body.appendChild(conn);
  function setConn(state, label){
    conn.dataset.state = state;
    conn.textContent = label;
    conn.classList.toggle("is-visible", state !== "online");
  }
  window.evtSetConn = setConn;
  window.addEventListener("offline", () => setConn("offline", "オフライン中・送信待機"));
  window.addEventListener("online",  () => setConn("online",  "オンラインに復帰"));

  // hidden aria-live region for SR users
  if (!document.querySelector("[data-evt-aria-live]")){
    const live = document.createElement("div");
    live.className = "evt-sr-only";
    live.setAttribute("data-evt-aria-live","");
    live.setAttribute("role","status");
    live.setAttribute("aria-live","polite");
    document.body.appendChild(live);
  }
})();
`;
