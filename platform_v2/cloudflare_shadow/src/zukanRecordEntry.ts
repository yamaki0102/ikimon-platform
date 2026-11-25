const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export const ZUKAN_RECORD_ENTRY_STYLES = `
  .zt-capture-stage{position:relative;display:grid;gap:14px;padding:14px;border-radius:16px;background:#0e1611;color:#fff;overflow:hidden;min-width:0}
  .zt-capture-stage-head{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0}
  .zt-capture-close,.zt-capture-close:visited{min-height:44px;min-width:44px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;text-decoration:none;font-weight:700;font-size:14px}
  .zt-capture-badge{font-size:13px;font-weight:700;color:#d6e4da;overflow-wrap:anywhere}
  .zt-capture-viewfinder{position:relative;min-height:min(46dvh,360px);border-radius:12px;background:radial-gradient(circle at 50% 42%,#1f3326 0%,#0b120d 78%);display:grid;place-items:center;padding:18px;text-align:center;overflow:hidden}
  .zt-capture-viewfinder-copy{display:grid;gap:6px;max-width:34ch}
  .zt-capture-viewfinder-copy strong{font-size:18px;font-weight:800;color:#fff}
  .zt-capture-viewfinder-copy span{font-size:14px;color:#cfe0d4}
  .zt-capture-controls{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px}
  .zt-shutter-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;width:68px;height:68px;border-radius:999px;border:4px solid #fff;background:transparent;color:#fff;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35)}
  .zt-shutter-wrap input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
  .zt-shutter-dot{width:52px;height:52px;border-radius:999px;background:#fff;border:0}
  .zt-capture-side-btn{position:relative;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.1);color:#fff;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:14px;cursor:pointer;min-width:0}
  .zt-capture-side-btn span{font-size:12px;color:#d6e4da;font-weight:500}
  .zt-capture-side-btn input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
  .zt-capture-macro{min-height:48px;width:100%;padding:8px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.1);color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer}
  .zt-capture-macro{min-height:48px;width:100%;padding:8px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.1);color:#fff;font:inherit;font-weight:700;font-size:15px;cursor:pointer}
  .zt-capture-privacy{margin:0;font-size:13px;color:#cfe0d4;text-align:center}
  [data-otayori-fab],.otayori-fab{display:none!important}
  @media (min-width:960px){
    .zt-capture-stage{padding:20px}
    .zt-capture-viewfinder{min-height:380px}
  }
  @media (prefers-reduced-motion:reduce){
    .zt-capture-stage,.zt-capture-stage *{transition:none!important;animation:none!important}
  }
`;

export function renderRecordEntryStageHtml(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  prefix: string;
  title: string;
  cameraLabel: string;
  cameraHint: string;
  photoLabel: string;
  photoHint: string;
  videoLabel: string;
  videoHint: string;
  prompt: string;
  privateBoundary: string;
  macroLabel?: string;
}): string {
  const isEn = options.lang === "en";
  const closeLabel = isEn ? "Close" : "とじる";
  const captureAria = isEn ? "Take photo with camera" : "カメラで撮影";
  return `<section class="zt-capture-stage" data-record-stage="c1-c2" aria-label="${escapeHtml(options.title)}">
    <div class="zt-capture-stage-head">
      <a class="zt-capture-close" href="${escapeHtml(`${options.prefix}/`)}">${escapeHtml(closeLabel)}</a>
      <span class="zt-capture-badge">${escapeHtml(options.title)}</span>
    </div>
    <div class="zt-capture-viewfinder">
      <div class="zt-capture-viewfinder-copy">
        <strong>${escapeHtml(options.cameraLabel)}</strong>
        <span>${escapeHtml(options.prompt)}</span>
      </div>
    </div>
    <div class="cf-record-picker zt-capture-controls" aria-label="${escapeHtml(options.title)}">
      <label class="cf-record-pick zt-capture-side-btn">${escapeHtml(options.photoLabel)}<span>${escapeHtml(options.photoHint)}</span><input id="record-media-photo" type="file" accept="image/*" multiple></label>
      <label class="cf-record-pick is-primary zt-shutter-wrap" aria-label="${escapeHtml(captureAria)}" title="${escapeHtml(options.cameraHint)}"><span class="zt-shutter-dot" aria-hidden="true"></span><input id="record-media-camera" type="file" accept="image/*" capture="environment"></label>
      <label class="cf-record-pick zt-capture-side-btn">${escapeHtml(options.videoLabel)}<span>${escapeHtml(options.videoHint)}</span><input id="record-media-video" type="file" accept="video/*"></label>
    </div>
    ${options.macroLabel ? `<button type="button" class="zt-capture-macro" data-global-record-macro-open>${escapeHtml(options.macroLabel)}</button>` : ""}
    <p class="zt-capture-privacy">${escapeHtml(options.privateBoundary)}</p>
  </section>`;
}
