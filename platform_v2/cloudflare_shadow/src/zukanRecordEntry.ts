const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type RecordCaptureLang = "ja" | "en" | "es" | "pt-br";

export type RecordCaptureCopy = {
  title: string;
  standard: string;
  closeup: string;
  video: string;
  modesLabel: string;
  pick: string;
  pickVideo: string;
  memo: string;
  shutter: string;
  deviceCamera: string;
  deviceCameraShoot: string;
  close: string;
  torch: string;
  focusing: string;
  focusLabel: string;
  focusNear: string;
  focusFar: string;
  zoomLabel: string;
  zoomMax: string;
  autoFocus: string;
  stackTitle: string;
  stackHint: string;
  stackOpen: string;
  saveN: string;
  saveVideo: string;
  saving: string;
  reviewTitle: string;
  reviewVideoTitle: string;
  reviewBack: string;
  reviewRemove: string;
  reviewNth: string;
  reviewHelp: string;
  reviewSave: string;
  reviewSaveVideo: string;
  reviewMore: string;
  reviewPrivate: string;
  savedTitle: string;
  savedSub: string;
  savedCardPhotos: string;
  savedCardVideo: string;
  savedPlaceUnset: string;
  again: string;
  view: string;
  back: string;
  savedFoot: string;
  focusSub: string;
  noEngine: string;
  retry: string;
  videoBlocked: string;
  photoBlocked: string;
  recording: string;
  memoTitle: string;
  memoPlaceholder: string;
  memoDone: string;
  discardConfirm: string;
  sideCaption: string;
  autoHint: string;
  saveFailed: string;
  dateFormat: string;
};

export function recordCaptureCopy(lang: RecordCaptureLang): RecordCaptureCopy {
  if (lang === "ja") {
    return {
      title: "撮る",
      standard: "標準",
      closeup: "接写",
      video: "動画",
      modesLabel: "撮り方",
      pick: "写真を選ぶ",
      pickVideo: "動画を選ぶ",
      memo: "メモ",
      shutter: "撮る",
      deviceCamera: "端末のカメラ",
      deviceCameraShoot: "端末のカメラで撮る",
      close: "とじる",
      torch: "ライト",
      focusing: "ピントを合わせています",
      focusLabel: "ピント",
      focusNear: "近い",
      focusFar: "遠い",
      zoomLabel: "ズーム",
      zoomMax: "最大",
      autoFocus: "オート",
      stackTitle: "{n}枚たまっています",
      stackHint: "束を押すと、確かめられます",
      stackOpen: "撮った写真を確かめる",
      saveN: "記録する（{n}枚）",
      saveVideo: "記録する（動画）",
      saving: "保存しています",
      reviewTitle: "撮った写真",
      reviewVideoTitle: "撮った動画",
      reviewBack: "撮影に戻る",
      reviewRemove: "この写真を外す",
      reviewNth: "{n}枚目",
      reviewHelp: "右上の × で、記録に入れない写真を外せます。外した写真は端末に残ります。",
      reviewSave: "{n}枚を記録する",
      reviewSaveVideo: "動画を記録する",
      reviewMore: "撮り足す",
      reviewPrivate: "保存すると、自分だけの記録になります。名前や場所は、あとから付けられます。",
      savedTitle: "自分だけに保存しました",
      savedSub: "公開先は、記録の設定でいつでも選べます。",
      savedCardPhotos: "写真 {n}枚の記録",
      savedCardVideo: "動画の記録",
      savedPlaceUnset: "場所は未設定",
      again: "続けて撮る",
      view: "記録を見る",
      back: "元の場所に戻る",
      savedFoot: "名前や場所は、記録のページであとから付けられます。",
      focusSub: "端末のカメラで撮れば、そのまま記録に使えます。ピントは端末のカメラにおまかせになります。",
      noEngine: "カメラを起動できませんでした。写真を選ぶか、端末のカメラで撮れます。",
      retry: "もう一度試す",
      videoBlocked: "写真がたまっている間は動画を撮れません。先に記録するか、束から外してください。",
      photoBlocked: "動画がたまっている間は写真を撮れません。先に記録するか、動画を外してください。",
      recording: "録画中 {t}",
      memoTitle: "メモ",
      memoPlaceholder: "気づいたことを書けます",
      memoDone: "閉じる",
      discardConfirm: "撮った写真は記録されていません。閉じますか？（この端末に下書きとして残ります）",
      sideCaption: "撮った写真は束でたまります。「記録する」でまとめて保存できます。",
      autoHint: "場所と日時は自動で付きます",
      saveFailed: "まだ保存されていません。もう一度「記録する」を押してください。",
      dateFormat: "{m}月{d}日 {h}:{mi}",
    };
  }
  return {
    title: "Capture",
    standard: "Standard",
    closeup: "Close-up",
    video: "Video",
    modesLabel: "Capture mode",
    pick: "Choose photos",
    pickVideo: "Choose video",
    memo: "Note",
    shutter: "Capture",
    deviceCamera: "Device camera",
    deviceCameraShoot: "Take with device camera",
    close: "Close",
    torch: "Light",
    focusing: "Focusing",
    focusLabel: "Focus",
    focusNear: "Near",
    focusFar: "Far",
    zoomLabel: "Zoom",
    zoomMax: "Max",
    autoFocus: "Auto",
    stackTitle: "{n} photos so far",
    stackHint: "Tap the stack to check them",
    stackOpen: "Check the photos you took",
    saveN: "Save ({n})",
    saveVideo: "Save (video)",
    saving: "Saving",
    reviewTitle: "Photos you took",
    reviewVideoTitle: "Video you took",
    reviewBack: "Back to camera",
    reviewRemove: "Remove this photo",
    reviewNth: "#{n}",
    reviewHelp: "Use the × at the top right to leave a photo out of the record. Removed photos stay on your device.",
    reviewSave: "Save {n} photos",
    reviewSaveVideo: "Save the video",
    reviewMore: "Take more",
    reviewPrivate: "Saving makes it a private record. You can add a name and place later.",
    savedTitle: "Saved privately",
    savedSub: "You can choose who sees it in the record settings.",
    savedCardPhotos: "Record of {n} photos",
    savedCardVideo: "Video record",
    savedPlaceUnset: "Place not set",
    again: "Keep shooting",
    view: "Open the record",
    back: "Back to where you came from",
    savedFoot: "You can add a name and place later on the record page.",
    focusSub: "Photos from the device camera can be used as they are. Focus is left to the device camera.",
    noEngine: "The camera could not start. You can choose a photo or use the device camera.",
    retry: "Try again",
    videoBlocked: "Video is unavailable while photos are waiting. Save them or remove them first.",
    photoBlocked: "Photos are unavailable while a video is waiting. Save it or remove it first.",
    recording: "Recording {t}",
    memoTitle: "Note",
    memoPlaceholder: "Write what you noticed",
    memoDone: "Close",
    discardConfirm: "These photos are not recorded yet. Close anyway? (They stay on this device as a draft.)",
    sideCaption: "Photos stack up. Save them together as one record.",
    autoHint: "Place and time are added automatically",
    saveFailed: "Not saved yet. Press Save again.",
    dateFormat: "{m}/{d} {h}:{mi}",
  };
}

const ICON_CLOSE = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const ICON_CAMERA = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.7l1.1-1.6A1 1 0 0 1 10.1 4h3.8a1 1 0 0 1 .8.4L15.8 6h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
const ICON_IMAGE = `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false"><rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9.2" cy="9.4" r="1.6" fill="currentColor"/><path d="M5 17l4.6-4.6a1 1 0 0 1 1.4 0L14 15.4l1.6-1.6a1 1 0 0 1 1.4 0L19 15.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_MEMO = `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" focusable="false"><path d="M7 3.5h7.2L19 8.3V19a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 12h6M9 15.5h6M9 8.5h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const ICON_BOLT = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M13.2 3L6 13.2h5.2L10.4 21 18 10.6h-5.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
const ICON_BACK = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export const ZUKAN_RECORD_ENTRY_STYLES = `
  :root{--zt-ease:cubic-bezier(0.2,0,0,1);--zt-d1:120ms;--zt-d2:240ms;--zt-d3:360ms}
  body.zt-capturing{overflow:hidden;overscroll-behavior:none;background:#0b120d}
  .zukan-app-header,.zukan-app-nav.is-bottom{transition:transform var(--zt-d2) var(--zt-ease),opacity var(--zt-d2) var(--zt-ease),visibility 0s linear var(--zt-d2)}
  body.zt-capturing .zukan-app-header{transform:translateY(-100%);opacity:0;visibility:hidden}
  body.zt-capturing .zukan-app-nav.is-bottom{transform:translateY(100%);opacity:0;visibility:hidden}
  body.zt-capturing .zukan-app-skip,body.zt-capturing .cf-record-header{display:none}
  .zt-cap{position:fixed;inset:0;z-index:60;background:#0b120d;color:#fff;overflow:hidden;font-family:var(--zukan-font-sans);line-height:1.5;-webkit-tap-highlight-color:transparent;animation:zt-cap-in var(--zt-d2) var(--zt-ease) both}
  @keyframes zt-cap-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
  .zt-cap [hidden]{display:none!important}
  :where(.zt-cap) button,:where(.zt-cap) label{font:inherit;color:inherit}
  .zt-cap :focus-visible{outline:3px solid #fff;outline-offset:2px;box-shadow:0 0 0 5px #087f7c}
  .zt-cap[data-zukan-capture-stage] .zt-cap-view{position:absolute;inset:0;overflow:hidden;background:#000;container-type:size}
  .zt-cap[data-zukan-capture-stage] .zt-cap-frame{position:absolute;left:50%;top:50%;translate:-50% -50%;width:max(100cqw,calc(100cqh*var(--zt-ar,.75)));aspect-ratio:var(--zt-ar,.75);background:#050806;overflow:hidden;touch-action:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-frame video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#050806}
  .zt-cap[data-zukan-capture-stage] .zt-cap-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-flash.is-on{animation:zt-flash var(--zt-d1) var(--zt-ease)}
  @keyframes zt-flash{0%{opacity:.85}100%{opacity:0}}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus{position:absolute;width:104px;height:104px;margin:-52px 0 0 -52px;pointer-events:none;transition:left var(--zt-d3) var(--zt-ease),top var(--zt-d3) var(--zt-ease),opacity var(--zt-d2) var(--zt-ease)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus i{position:absolute;width:26px;height:26px;border:0 solid #fff;transition:border-color var(--zt-d2) var(--zt-ease)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus.is-ok i{border-color:#4cc38a}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus i:nth-child(1){left:0;top:0;border-left-width:3px;border-top-width:3px;border-top-left-radius:6px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus i:nth-child(2){right:0;top:0;border-right-width:3px;border-top-width:3px;border-top-right-radius:6px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus i:nth-child(3){left:0;bottom:0;border-left-width:3px;border-bottom-width:3px;border-bottom-left-radius:6px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-focus i:nth-child(4){right:0;bottom:0;border-right-width:3px;border-bottom-width:3px;border-bottom-right-radius:6px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-top{position:absolute;left:0;right:0;top:0;z-index:3;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:calc(14px + env(safe-area-inset-top)) 14px 0;pointer-events:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-top>*{pointer-events:auto}
  .zt-cap[data-zukan-capture-stage] .zt-cap-top-end{display:grid;justify-items:end;gap:10px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-round,.zt-cap[data-zukan-capture-stage] .zt-cap-device,.zt-cap[data-zukan-capture-stage] .zt-cap-torch{position:relative;min-height:36px;min-width:40px;border:0;border-radius:999px;background:rgba(20,28,23,.62);color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 14px;font-weight:700;font-size:14px;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-round::after,.zt-cap[data-zukan-capture-stage] .zt-cap-device::after,.zt-cap[data-zukan-capture-stage] .zt-cap-torch::after{content:"";position:absolute;inset:-4px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-round{padding:0;width:40px;height:40px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-round svg{width:22px;height:22px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-device svg{width:20px;height:20px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-device input{position:absolute;inline-size:1px;block-size:1px;opacity:.01;pointer-events:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-torch{width:40px;height:40px;padding:0}
  .zt-cap[data-zukan-capture-stage] .zt-cap-torch svg{width:20px;height:20px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-torch[aria-pressed="true"]{background:#fff;color:#0b120d}
  .zt-cap[data-zukan-capture-stage] .zt-cap-device.is-panel{display:none!important}
  .zt-cap[data-zukan-capture-stage] [data-zt-device-video],.zt-cap[data-zukan-capture-stage] [data-zt-pick-video-label]{display:none!important}
  .zt-cap[data-mode="video"] [data-zt-device-photo],.zt-cap[data-mode="video"] [data-zt-pick-photo]{display:none!important}
  .zt-cap[data-mode="video"] [data-zt-device-video]{display:inline-flex!important}
  .zt-cap[data-mode="video"] [data-zt-pick-video-label]{display:inline-flex!important}
  .zt-cap[data-zukan-capture-stage] .zt-cap-panel{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;flex-direction:column;padding:34px 20px calc(26px + env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(8,18,12,.88) 62%,rgba(8,18,12,0))}
  .zt-cap[data-zukan-capture-stage] .zt-cap-title{display:none;margin:0;font-size:15px;font-weight:700}
  .zt-cap[data-zukan-capture-stage] .zt-cap-note{margin:0;padding:7px 14px;display:inline-flex;align-items:center;border-radius:999px;background:rgba(10,20,14,.68);font-size:13px;font-weight:700;opacity:0;transition:opacity var(--zt-d2) var(--zt-ease);pointer-events:none;position:absolute;left:50%;bottom:calc(100% - 6px);translate:-50% 0;white-space:nowrap}
  .zt-cap[data-zukan-capture-stage] .zt-cap-note.is-on{opacity:1}
  .zt-cap[data-zukan-capture-stage] .zt-cap-macro{display:flex;flex-direction:column;visibility:hidden;opacity:0;transform:translateY(14px);pointer-events:none;max-height:0;overflow:hidden;transition:transform var(--zt-d2) var(--zt-ease),opacity var(--zt-d2) var(--zt-ease),max-height var(--zt-d2) var(--zt-ease),visibility 0s linear var(--zt-d2)}
  .zt-cap[data-mode="closeup"] .zt-cap-macro{visibility:visible;opacity:1;transform:none;pointer-events:auto;max-height:140px;transition-delay:0s}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row{display:flex;align-items:center;gap:12px;padding:0 8px 16px;font-size:12.5px;font-weight:700;color:#e7ede8}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row>span:first-child{color:#c9d4cb}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row output{min-width:2.6em;font-variant-numeric:tabular-nums}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row input[type=range]{-webkit-appearance:none;appearance:none;flex:1;min-width:0;height:24px;margin:0;background:transparent}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:rgba(255,255,255,.35)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-10px;border:0;border-radius:50%;background:#fff}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:rgba(255,255,255,.35)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-row input[type=range]::-moz-range-thumb{width:24px;height:24px;border:0;border-radius:50%;background:#fff}
  .zt-cap[data-zukan-capture-stage] .zt-cap-mini{position:relative;min-height:26px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,255,255,.45);background:transparent;color:#fff;font-weight:700;font-size:12.5px;cursor:pointer}
  .zt-cap[data-zukan-capture-stage] .zt-cap-mini::after{content:"";position:absolute;inset:-9px -4px}
  .zt-cap [data-global-record-camera-focus-auto]{display:none!important}
  .zt-cap[data-zukan-capture-stage] .zt-cap-bundle{display:flex;align-items:center;gap:12px;margin-bottom:16px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-stack{position:relative;width:52px;height:52px;flex:none;padding:0;border:0;background:transparent;cursor:pointer}
  .zt-cap[data-zukan-capture-stage] .zt-cap-stack::before{content:"";position:absolute;left:8px;top:-6px;width:46px;height:46px;border-radius:9px;background:#5b7263;transform:rotate(-8deg)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-stack-thumb{position:absolute;inset:0;border:2px solid #fff;border-radius:9px;overflow:hidden;background:#222}
  .zt-cap[data-zukan-capture-stage] .zt-cap-stack-thumb img,.zt-cap[data-zukan-capture-stage] .zt-cap-stack-thumb video{width:100%;height:100%;object-fit:cover;object-position:bottom;display:block}
  .zt-cap[data-zukan-capture-stage] .zt-cap-badge{position:absolute;right:-7px;top:-9px;min-width:23px;height:23px;padding:0 5px;border-radius:999px;background:#b4492b;color:#fff;font-size:12.5px;font-weight:800;display:grid;place-items:center;z-index:3}
  .zt-cap[data-zukan-capture-stage] .zt-cap-bundle-text{flex:1;min-width:0;font-size:13.5px;font-weight:700;line-height:1.5;color:#fff}
  .zt-cap[data-zukan-capture-stage] .zt-cap-bundle-text strong{display:block;font-weight:700;white-space:nowrap}
  .zt-cap[data-zukan-capture-stage] .zt-cap-bundle-text span{display:block;font-size:12px;font-weight:600;color:#c9d4cb}
  .zt-cap[data-zukan-capture-stage] .zt-cap-save,.zt-cap[data-zukan-capture-stage] .zt-btn{min-height:48px;padding:13px 16px;white-space:nowrap;border:0;border-radius:999px;background:#143f2e;color:#fff;font-weight:800;font-size:15px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-save[disabled]{opacity:.7;cursor:progress}
  .zt-cap[data-zukan-capture-stage] .zt-cap-err{margin:0 0 10px;color:#fecaca;font-weight:700;font-size:13px;text-align:center}
  .zt-cap[data-zukan-capture-stage] .zt-cap-modes{position:relative;align-self:center;display:flex;padding:3px;border-radius:999px;background:rgba(10,20,14,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-pill{position:relative;z-index:1;min-height:34px;padding:0 18px;border:0;border-radius:999px;background:transparent;color:#e7ede8;font-weight:700;font-size:14px;cursor:pointer;transition:color var(--zt-d2) var(--zt-ease)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-pill::after{content:"";position:absolute;inset:-5px -2px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-pill[aria-pressed="true"]{color:#17211b}
  .zt-cap[data-zukan-capture-stage] .zt-cap-pill-thumb{position:absolute;top:3px;bottom:3px;left:0;width:0;border-radius:999px;background:#fff;transition:transform var(--zt-d2) var(--zt-ease),width var(--zt-d2) var(--zt-ease)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-controls{display:grid;grid-template-columns:72px 1fr 72px;align-items:end;margin-top:18px;padding:0 6px;grid-template-areas:"pick shutter memo"}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side{position:relative;min-height:44px;width:72px;padding:0;border:0;background:transparent;color:#fff;display:inline-flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:5px;font-weight:600;font-size:11.5px;line-height:1.4;cursor:pointer;text-align:center}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side svg{width:24px;height:24px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side input{position:absolute;inline-size:1px;block-size:1px;opacity:.01;pointer-events:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side.is-pick{grid-area:pick}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side.is-memo{grid-area:memo}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side.is-video-pick{display:none}
  .zt-cap[data-mode="video"] .zt-cap-side.is-photo-pick{display:none}
  .zt-cap[data-mode="video"] .zt-cap-side.is-video-pick{display:inline-flex}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side.is-photo-pick,.zt-cap[data-zukan-capture-stage] .zt-cap-side.is-video-pick{grid-area:pick}
  .zt-cap[data-zukan-capture-stage] .zt-cap-memo-dot{position:absolute;right:16px;top:0;width:10px;height:10px;border-radius:50%;background:#4ade80}
  .zt-cap[data-zukan-capture-stage] .zt-cap-shutter{grid-area:shutter;justify-self:center;width:74px;height:74px;border-radius:50%;border:4px solid #fff;background:transparent;padding:0;display:grid;place-items:center;cursor:pointer;transition:transform var(--zt-d1) var(--zt-ease)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-shutter:active{transform:scale(.94)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-shutter-dot{width:58px;height:58px;border-radius:50%;background:#fff;transition:transform var(--zt-d1) var(--zt-ease),border-radius var(--zt-d1) var(--zt-ease),background-color var(--zt-d1) var(--zt-ease)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-shutter:active .zt-cap-shutter-dot{transform:scale(.9)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-shutter[aria-pressed="true"] .zt-cap-shutter-dot{background:#dc2626;border-radius:14px;transform:scale(.62)}
  .zt-cap[data-live="false"] .zt-cap-shutter{opacity:.8}
  .zt-cap[data-zukan-capture-stage] .zt-cap-auto-hint{order:10;margin:14px 0 0;font-size:12px;line-height:1.6;color:#b8c9bc;text-align:center}
  .zt-cap[data-zukan-capture-stage] .zt-cap-side-caption{display:none;margin:0;font-size:12px;line-height:1.6;color:#b8c9bc}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card{position:absolute;left:21px;right:21px;top:50%;z-index:4;max-width:420px;margin:0 auto;transform:translateY(-58%);padding:22px;border-radius:20px;background:#fff;color:#17211b;display:flex;flex-direction:column;box-shadow:0 12px 40px rgba(0,0,0,.4)}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card-main{margin:0 0 10px;font-size:19px;line-height:1.45;font-weight:800}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card-sub{margin:0 0 22px;font-size:14px;line-height:1.75;color:#55615a}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card-actions{display:grid;gap:12px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card-main+.zt-cap-card-actions{margin-top:12px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card .zt-btn{width:100%;min-height:54px;padding:15px;border-radius:14px;background:#143f2e;color:#fff;font-size:16px;white-space:normal;position:relative}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card .zt-btn.is-ghost{min-height:52px;padding:13.5px;background:#fff;color:#143f2e;border:1.5px solid #143f2e;font-size:15.5px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card :focus-visible{outline-color:#087f7c;box-shadow:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-card .zt-btn input{position:absolute;inline-size:1px;block-size:1px;opacity:.01;pointer-events:none}
  .zt-cap[data-zukan-capture-stage] .zt-cap-review,.zt-cap[data-zukan-capture-stage] .zt-cap-saved{position:absolute;inset:0;z-index:7;background:#fff;color:#17211b;overflow:auto;display:flex;flex-direction:column}
  .zt-cap[data-zukan-capture-stage] .zt-cap-review :focus-visible,.zt-cap[data-zukan-capture-stage] .zt-cap-saved :focus-visible{outline-color:#087f7c;box-shadow:none}
  .zt-cap[data-zukan-capture-stage] .zt-rv-head{display:flex;align-items:center;gap:10px;padding:calc(14px + env(safe-area-inset-top)) 16px 14px;border-bottom:1px solid #dde2dc}
  .zt-cap[data-zukan-capture-stage] .zt-rv-head h2{margin:0;font-size:16.5px;font-weight:800}
  .zt-cap[data-zukan-capture-stage] .zt-rv-back{position:relative;min-height:28px;min-width:28px;border:0;background:transparent;color:#17211b;cursor:pointer;display:inline-grid;place-items:center;padding:0}
  .zt-cap[data-zukan-capture-stage] .zt-rv-back::after{content:"";position:absolute;inset:-8px}
  .zt-cap[data-zukan-capture-stage] .zt-rv-back svg{width:22px;height:22px}
  .zt-cap[data-zukan-capture-stage] .zt-rv-main{position:relative;background:#000;height:min(388px,46dvh);width:100%;max-width:640px;margin:0 auto;display:block;overflow:hidden;flex:none}
  .zt-cap[data-zukan-capture-stage] .zt-rv-main img,.zt-cap[data-zukan-capture-stage] .zt-rv-main video{width:100%;height:100%;object-fit:cover;display:block;transform-origin:0 0}
  .zt-cap[data-zukan-capture-stage] .zt-rv-count{position:absolute;right:12px;bottom:12px;padding:5px 11px;border-radius:999px;background:rgba(10,20,14,.68);color:#fff;font-weight:700;font-size:12.5px;line-height:1.4}
  .zt-cap[data-zukan-capture-stage] .zt-rv-body{display:flex;flex-direction:column;padding:18px 16px 28px;width:100%;max-width:640px;margin:0 auto}
  .zt-cap[data-zukan-capture-stage] .zt-rv-thumbs{display:flex;gap:12px;overflow-x:auto;padding:0}
  .zt-cap[data-zukan-capture-stage] .zt-rv-thumb{position:relative;flex:0 0 auto;display:grid;gap:5px;justify-items:center;font-size:12px;color:#55615a}
  .zt-cap[data-zukan-capture-stage] .zt-rv-thumb-img{position:relative;width:104px;height:104px;border:0;border-radius:12px;overflow:hidden;padding:0;background:#222;cursor:pointer;display:block}
  .zt-cap[data-zukan-capture-stage] .zt-rv-thumb-img img,.zt-cap[data-zukan-capture-stage] .zt-rv-thumb-img video{width:100%;height:100%;object-fit:cover;display:block}
  .zt-cap[data-zukan-capture-stage] .zt-rv-x{position:absolute;right:6px;top:6px;width:26px;height:26px;min-width:0;min-height:0;border:0;border-radius:50%;background:rgba(10,20,14,.72);color:#fff;display:grid;place-items:center;cursor:pointer;z-index:2;padding:0;font-size:15px;line-height:1}
  .zt-cap[data-zukan-capture-stage] .zt-rv-x::after{content:"";position:absolute;inset:-9px}
  .zt-cap[data-zukan-capture-stage] .zt-rv-help{margin:14px 0 0;font-size:13px;line-height:1.7;color:#55615a}
  .zt-cap[data-zukan-capture-stage] .zt-rv-foot{margin:14px 0 0;font-size:13.5px;line-height:1.7;color:#55615a;text-align:center}
  .zt-cap[data-zukan-capture-stage] .zt-rv-more{align-self:center;min-height:44px;margin-top:2px;padding:0 16px;border:0;background:transparent;color:#0055ad;font-weight:700;font-size:15px;cursor:pointer}
  .zt-cap[data-zukan-capture-stage] .zt-cap-review .zt-btn,.zt-cap[data-zukan-capture-stage] .zt-cap-saved .zt-btn{width:100%;min-height:54px;padding:15px;border-radius:14px;background:#143f2e;color:#fff;font-size:16px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-review .zt-btn{margin-top:16px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-review .zt-btn[disabled]{opacity:.7}
  .zt-cap[data-zukan-capture-stage] .zt-sv{display:flex;flex-direction:column;align-items:center;width:100%;max-width:560px;margin:0 auto;padding:calc(64px + env(safe-area-inset-top)) 16px 32px;text-align:center}
  .zt-cap[data-zukan-capture-stage] .zt-sv-check{width:74px;height:74px}
  .zt-cap[data-zukan-capture-stage] .zt-sv-check circle{fill:#146c43;transform-origin:center;transform:scale(1)}
  .zt-cap[data-zukan-capture-stage] .zt-sv-check path{fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:60;stroke-dashoffset:0}
  .zt-cap[data-zukan-capture-stage] .zt-cap-saved.is-anim .zt-sv-check circle{animation:zt-circle var(--zt-d3) var(--zt-ease) both}
  .zt-cap[data-zukan-capture-stage] .zt-cap-saved.is-anim .zt-sv-check path{animation:zt-check var(--zt-d3) var(--zt-ease) var(--zt-d1) both}
  @keyframes zt-circle{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
  @keyframes zt-check{from{stroke-dashoffset:60}to{stroke-dashoffset:0}}
  .zt-cap[data-zukan-capture-stage] .zt-sv h2{margin:22px 0 0;font-size:21px;line-height:1.4;font-weight:800}
  .zt-cap[data-zukan-capture-stage] .zt-sv-sub{margin:10px 0 0;font-size:14px;line-height:1.75;color:#55615a}
  .zt-cap[data-zukan-capture-stage] .zt-sv-card{display:flex;align-items:center;gap:12px;width:100%;margin-top:26px;padding:12px;border:1px solid #dde2dc;border-radius:16px;text-align:left}
  .zt-cap[data-zukan-capture-stage] .zt-sv-card img,.zt-cap[data-zukan-capture-stage] .zt-sv-card video{width:64px;height:64px;border-radius:10px;object-fit:cover;flex:0 0 auto;background:#222;display:block}
  .zt-cap[data-zukan-capture-stage] .zt-sv-card strong{display:block;font-size:15.5px;font-weight:800}
  .zt-cap[data-zukan-capture-stage] .zt-sv-card span{color:#55615a;font-size:13px;line-height:1.6}
  .zt-cap[data-zukan-capture-stage] .zt-sv-card strong+span{display:block;margin-top:3px}
  .zt-cap[data-zukan-capture-stage] .zt-sv-actions{display:grid;gap:12px;width:100%;margin-top:26px}
  .zt-cap[data-zukan-capture-stage] .zt-sv-actions .zt-btn.is-ghost,.zt-cap[data-zukan-capture-stage] .zt-sv-actions a.zt-btn.is-ghost,.zt-cap[data-zukan-capture-stage] .zt-sv-actions a.zt-btn.is-ghost:visited{min-height:52px;padding:13.5px;background:#fff;color:#143f2e;border:1.5px solid #143f2e;font-size:15.5px}
  .zt-cap[data-zukan-capture-stage] .zt-sv-actions a.zt-btn,.zt-cap[data-zukan-capture-stage] .zt-sv-actions a.zt-btn:visited{color:#fff}
  .zt-cap[data-zukan-capture-stage] .zt-sv-actions a.zt-btn.is-ghost,.zt-cap[data-zukan-capture-stage] .zt-sv-actions a.zt-btn.is-ghost:visited{color:#143f2e}
  .zt-cap[data-zukan-capture-stage] .zt-sv-foot{margin:18px 0 0;font-size:13.5px;line-height:1.7;color:#55615a}
  .zt-cap[data-zukan-capture-stage] .zt-memo{margin:max(16px,env(safe-area-inset-top)) auto auto;max-height:calc(100dvh - 32px);overflow:auto;width:min(92vw,520px);max-width:none;padding:20px;border:0;border-radius:20px;color:#17251b;background:#fff}
  .zt-cap[data-zukan-capture-stage] .zt-memo::backdrop{background:rgba(0,0,0,.6)}
  .zt-cap[data-zukan-capture-stage] .zt-memo h2{margin:0 0 10px;font-size:20px}
  .zt-cap[data-zukan-capture-stage] .zt-memo textarea{width:100%;min-height:140px;padding:12px;border:1px solid #52685a;border-radius:12px;font:inherit;font-size:16px;color:#17251b;background:#fff;resize:vertical}
  .zt-cap[data-zukan-capture-stage] .zt-memo-row{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-top:12px;flex-wrap:wrap}
  .zt-cap[data-zukan-capture-stage] .zt-memo .zt-voice-mic-btn{min-height:48px}
  .zt-cap[data-zukan-capture-stage] .zt-memo-done{min-height:48px;padding:0 22px;border:0;border-radius:999px;background:#143f2e;color:#fff;font-weight:800;font-size:16px;cursor:pointer}
  .zt-cap[data-zukan-capture-stage] .zt-memo :focus-visible{outline:3px solid #087f7c;outline-offset:2px}
  .zt-cap[data-zukan-capture-stage] .zt-cap-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .zt-cap[data-zukan-capture-stage] .zt-cap-inputs{position:absolute;width:1px;height:1px;overflow:hidden;opacity:.01;pointer-events:none}
  [data-otayori-fab],.otayori-fab{display:none!important}
  .zt-cap[data-zukan-capture-stage] .zt-cap-link,.zt-cap[data-zukan-capture-stage] .zt-cap-link:visited{color:inherit}
  @media (min-width:960px){
    .zt-cap{display:grid;grid-template-columns:minmax(0,1fr) 320px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-view{position:relative;inset:auto;min-height:0;height:100%}
    .zt-cap[data-zukan-capture-stage] .zt-cap-panel{position:relative;left:auto;right:auto;bottom:auto;padding:24px 22px 34px;background:#0b120d;display:flex;flex-direction:column;overflow:auto}
    .zt-cap[data-zukan-capture-stage] .zt-cap-title{display:block;order:1;margin-bottom:20px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-modes{order:2;align-self:center;margin-bottom:18px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-device.is-top{display:none!important}
    .zt-cap[data-zukan-capture-stage] .zt-cap-device.is-panel{display:inline-flex!important;order:3;align-self:center;min-height:36px;padding:0 16px;border:1px solid rgba(255,255,255,.4);background:transparent;font-size:13.5px}
    .zt-cap[data-mode="video"] .zt-cap-device.is-panel[data-zt-device-photo],.zt-cap:not([data-mode="video"]) .zt-cap-device.is-panel[data-zt-device-video]{display:none!important}
    .zt-cap[data-zukan-capture-stage] .zt-cap-note{position:relative;left:auto;bottom:auto;translate:none;order:4;align-self:center;opacity:0;height:0;padding:0 14px;overflow:hidden;margin-top:14px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-note.is-on{height:auto;padding:7px 14px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-macro{order:5;margin-top:14px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-err{order:6}
    .zt-cap[data-zukan-capture-stage] .zt-cap-bundle{order:7;flex-wrap:wrap;margin-top:auto;margin-bottom:22px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-bundle .zt-cap-save{flex:1 0 100%}
    .zt-cap[data-zukan-capture-stage] .zt-cap-controls{order:8;grid-template-columns:1fr 1fr;grid-template-areas:"shutter shutter" "pick memo";row-gap:24px;margin-top:0;padding:0}
    .zt-cap[data-zukan-capture-stage] .zt-cap-bundle[hidden]~.zt-cap-controls{margin-top:auto}
    .zt-cap[data-zukan-capture-stage] .zt-cap-side{justify-self:center}
    .zt-cap[data-zukan-capture-stage] .zt-cap-side-caption{display:block;order:9;margin-top:24px}
    .zt-cap[data-zukan-capture-stage] .zt-cap-auto-hint{display:none}
    .zt-cap[data-zukan-capture-stage] .zt-cap-top{padding-right:14px}
  }
  @media (prefers-reduced-motion:reduce){
    .zt-cap,.zt-cap *,.zukan-app-header,.zukan-app-nav.is-bottom{transition:none!important;animation:none!important}
  }
`;

export function renderRecordEntryStageHtml(options: {
  lang: RecordCaptureLang;
  prefix: string;
  copy: RecordCaptureCopy;
  engineCopy: {
    errorTitle: string;
    errorBody: string;
    focusUnsupported: string;
    focusFallbackDevice: string;
    focusFallbackStandard: string;
    retry: string;
    gallery: string;
    native: string;
  };
  startMode: "photo" | "video";
  voiceButtonHtml: string;
  memoDefault?: string;
}): string {
  const c = options.copy;
  const e = (value: string) => escapeHtml(value);
  const startMode = options.startMode === "video" ? "video" : "standard";
  const deviceLabel = (cls: string) => `<label class="zt-cap-device ${cls}" data-zt-device-photo>${ICON_CAMERA}<span>${e(cls === "is-top" ? c.deviceCamera : c.deviceCameraShoot)}</span><input id="${cls === "is-top" ? "record-media-camera" : "record-media-camera-panel"}" type="file" accept="image/*" capture="environment"></label><label class="zt-cap-device ${cls}" data-zt-device-video for="record-media-video-camera">${ICON_CAMERA}<span>${e(cls === "is-top" ? c.deviceCamera : c.deviceCameraShoot)}</span></label>`;
  return `<section class="zt-cap" data-zukan-capture-stage data-record-stage="capture-v2" data-mode="${startMode}" data-phase="boot" data-live="false" aria-label="${e(c.title)}">
    <div class="zt-cap-view">
      <div class="zt-cap-frame" data-global-record-camera-preview>
        <video data-global-record-camera-video playsinline muted autoplay></video>
        <div class="zt-cap-focus" data-zt-focus-frame hidden aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="zt-cap-flash" data-zt-flash aria-hidden="true"></div>
      </div>
      <div class="zt-cap-top">
        <button type="button" class="zt-cap-round" data-zt-close aria-label="${e(c.close)}">${ICON_CLOSE}</button>
        <div class="zt-cap-top-end">
          ${deviceLabel("is-top")}
          <button type="button" class="zt-cap-torch" data-zt-torch hidden aria-pressed="false" aria-label="${e(c.torch)}">${ICON_BOLT}</button>
        </div>
      </div>
      <div class="zt-cap-card" data-global-record-camera-error data-zt-card role="alert" hidden>
        <p class="zt-cap-card-main" data-global-record-camera-error-body>${e(options.engineCopy.errorBody)}</p>
        <p class="zt-cap-card-sub" data-zt-card-sub hidden>${e(c.focusSub)}</p>
        <div class="zt-cap-card-actions" data-global-record-camera-focus-fallback hidden>
          <label class="zt-btn" data-zt-device-photo for="record-media-camera">${e(c.deviceCameraShoot)}</label>
          <label class="zt-btn" data-zt-device-video for="record-media-video-camera">${e(c.deviceCameraShoot)}</label>
          <button type="button" class="zt-btn is-ghost" data-zt-standard>${e(options.engineCopy.focusFallbackStandard)}</button>
        </div>
        <div class="zt-cap-card-actions" data-global-record-camera-error-actions>
          <button type="button" class="zt-btn" data-zt-retry>${e(c.retry)}</button>
          <label class="zt-btn is-ghost" data-zt-device-photo for="record-media-camera">${e(c.deviceCameraShoot)}</label>
          <label class="zt-btn is-ghost" data-zt-device-video for="record-media-video-camera">${e(c.deviceCameraShoot)}</label>
          <label class="zt-btn is-ghost" data-zt-pick-photo for="record-media-photo">${e(c.pick)}</label>
          <label class="zt-btn is-ghost" data-zt-pick-video-label for="record-media-video">${e(c.pickVideo)}</label>
        </div>
      </div>
    </div>
    <div class="zt-cap-panel">
      <p class="zt-cap-title" aria-hidden="true">${e(c.title)}</p>
      ${deviceLabel("is-panel")}
      <p class="zt-cap-note" data-zt-note role="status" aria-live="polite">${e(c.focusing)}</p>
      <div class="zt-cap-macro" data-zt-macro>
        <div class="zt-cap-row zt-cap-row-zoom global-record-camera-zoom" data-zt-zoom-row hidden>
          <span>${e(c.zoomLabel)}</span><output data-global-record-camera-zoom-value>1.0x</output>
          <input data-global-record-camera-zoom-range type="range" min="1" max="1" step="0.1" value="1" aria-label="${e(c.zoomLabel)}">
          <button type="button" class="zt-cap-mini" data-global-record-camera-zoom-max>${e(c.zoomMax)}</button>
        </div>
        <div class="zt-cap-row global-record-camera-zoom" data-global-record-camera-focus hidden>
          <span>${e(c.focusLabel)}</span><span aria-hidden="true">${e(c.focusNear)}</span>
          <input data-global-record-camera-focus-range type="range" min="0" max="1" step="0.01" value="0" aria-label="${e(c.focusLabel)}">
          <span aria-hidden="true">${e(c.focusFar)}</span>
          <button type="button" class="zt-cap-mini" data-global-record-camera-focus-auto hidden>${e(c.autoFocus)}</button>
        </div>
        <span class="zt-cap-sr"><output data-global-record-camera-focus-value></output></span>
      </div>
      <p class="zt-cap-err" data-zt-error role="alert" hidden></p>
      <div class="zt-cap-bundle" data-zt-bundle hidden>
        <button type="button" class="zt-cap-stack" data-zt-stack aria-label="${e(c.stackOpen)}"><span data-zt-stack-thumbs></span><span class="zt-cap-badge" data-zt-count>0</span></button>
        <div class="zt-cap-bundle-text"><strong data-zt-stack-title></strong><span>${e(c.stackHint)}</span></div>
        <button type="button" class="zt-cap-save" data-zt-save></button>
      </div>
      <div class="zt-cap-modes" role="group" aria-label="${e(c.modesLabel)}" data-zt-modes>
        <span class="zt-cap-pill-thumb" data-zt-pill-thumb aria-hidden="true"></span>
        <button type="button" class="zt-cap-pill" data-zt-mode="standard" aria-pressed="${startMode === "standard" ? "true" : "false"}">${e(c.standard)}</button>
        <button type="button" class="zt-cap-pill" data-zt-mode="closeup" aria-pressed="false">${e(c.closeup)}</button>
        <button type="button" class="zt-cap-pill" data-zt-mode="video" aria-pressed="${startMode === "video" ? "true" : "false"}">${e(c.video)}</button>
      </div>
      <div class="zt-cap-controls">
        <label class="zt-cap-side is-pick is-photo-pick" data-zt-pick>${ICON_IMAGE}<span>${e(c.pick)}</span><input id="record-media-photo" type="file" accept="image/*" multiple></label>
        <label class="zt-cap-side is-video-pick" data-zt-pick-video>${ICON_IMAGE}<span>${e(c.pickVideo)}</span><input id="record-media-video" type="file" accept="video/*"></label>
        <button type="button" class="zt-cap-shutter" data-zt-shutter aria-label="${e(c.shutter)}"><span class="zt-cap-shutter-dot" aria-hidden="true"></span></button>
        <button type="button" class="zt-cap-side is-memo" data-zt-memo-open>${ICON_MEMO}<span>${e(c.memo)}</span><span class="zt-cap-memo-dot" data-zt-memo-dot hidden></span></button>
      </div>
      <p class="zt-cap-side-caption">${e(c.sideCaption)}</p>
      <p class="zt-cap-auto-hint" data-zt-auto-hint>${e(c.autoHint)}</p>
      <label class="zt-cap-inputs" aria-hidden="true"><input id="record-media-video-camera" type="file" accept="video/*" capture="environment" tabindex="-1"></label>
    </div>
    <div class="zt-cap-review" data-zt-review hidden>
      <div class="zt-rv-head"><button type="button" class="zt-rv-back" data-zt-review-back aria-label="${e(c.reviewBack)}">${ICON_BACK}</button><h2 data-zt-review-title>${e(c.reviewTitle)}</h2></div>
      <div class="zt-rv-main" data-zt-review-main><span class="zt-rv-count" data-zt-review-count></span></div>
      <div class="zt-rv-body">
        <div class="zt-rv-thumbs" data-zt-review-thumbs></div>
        <p class="zt-rv-help">${e(c.reviewHelp)}</p>
        <button type="button" class="zt-btn" data-zt-review-save></button>
        <button type="button" class="zt-rv-more" data-zt-review-more>${e(c.reviewMore)}</button>
        <p class="zt-rv-foot">${e(c.reviewPrivate)}</p>
      </div>
    </div>
    <div class="zt-cap-saved" data-zt-saved hidden>
      <div class="zt-sv">
        <svg class="zt-sv-check" viewBox="0 0 144 144" aria-hidden="true" focusable="false"><circle cx="72" cy="72" r="70"/><path d="M46 74l19 19 35-38"/></svg>
        <h2 data-zt-saved-title tabindex="-1">${e(c.savedTitle)}</h2>
        <p class="zt-sv-sub">${e(c.savedSub)}</p>
        <div class="zt-sv-card"><span data-zt-saved-thumb></span><div><strong data-zt-saved-card-title></strong><span data-zt-saved-card-meta></span></div></div>
        <div class="zt-sv-actions">
          <button type="button" class="zt-btn" data-zt-again>${e(c.again)}</button>
          <a class="zt-btn is-ghost" data-zt-view href="${e(options.prefix)}/records?view=mine">${e(c.view)}</a>
          <a class="zt-btn is-ghost" data-zt-back-to href="${e(options.prefix)}/" hidden>${e(c.back)}</a>
        </div>
        <p class="zt-sv-foot">${e(c.savedFoot)}</p>
      </div>
    </div>
    <dialog class="zt-memo" data-zt-memo aria-labelledby="zt-memo-title">
      <h2 id="zt-memo-title">${e(c.memoTitle)}</h2>
      <textarea name="note" form="record-form" data-zt-memo-text rows="5" placeholder="${e(c.memoPlaceholder)}">${e(options.memoDefault ?? "")}</textarea>
      <div class="zt-memo-row">${options.voiceButtonHtml}<button type="button" class="zt-memo-done" data-zt-memo-close>${e(c.memoDone)}</button></div>
      <p id="record-voice-status" class="zt-voice-status" aria-live="polite"></p>
    </dialog>
    <span class="zt-cap-sr" data-global-record-camera-status aria-live="polite"></span>
  </section>`;
}

export const ZUKAN_RECORD_CAPTURE_SCRIPT = String.raw`
    const ztStage = document.querySelector("[data-zukan-capture-stage]");
    const ztCopy = ztCopyData;
    const ztEase = "cubic-bezier(0.2, 0, 0, 1)";
    const ztQ = (selector) => ztStage ? ztStage.querySelector(selector) : null;
    const ztQA = (selector) => ztStage ? Array.from(ztStage.querySelectorAll(selector)) : [];
    const ztEngine = () => window.ikimonCaptureEngine || null;
    const ztReduced = () => Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const ztFmt = (template, values) => String(template).replace(/\{(\w+)\}/g, (_m, key) => String(values[key] === undefined ? "" : values[key]));
    let ztMode = ztStage ? (ztStage.getAttribute("data-mode") || "standard") : "standard";
    let ztPhase = "boot";
    let ztReviewIndex = 0;
    let ztReviewOpen = false;
    let ztThumbUrls = [];
    const ztTimes = new WeakMap();
    let ztVideoTimer = 0;
    let ztPendingFly = null;
    let ztFocusTimer = 0;
    let ztLastShutterAt = 0;
    let ztObjectUrl = new Map();
    let ztSavedInfo = null;
    let ztBooted = false;
    function ztUrlFor(file) {
      let url = ztObjectUrl.get(file);
      if (!url) { url = URL.createObjectURL(file); ztObjectUrl.set(file, url); }
      return url;
    }
    function ztReleaseUrls(keep) {
      for (const [file, url] of Array.from(ztObjectUrl.entries())) {
        if (keep && keep.indexOf(file) >= 0) continue;
        URL.revokeObjectURL(url);
        ztObjectUrl.delete(file);
      }
    }
    function ztItems() {
      if (mediaKind === "video") return selectedFiles().map((file) => ({ file, kind: "video" }));
      return selectedPhotos.map((file) => ({ file, kind: "photo" }));
    }
    function ztLockInputs(locked) {
      for (const id of ["record-media-photo", "record-media-camera", "record-media-camera-panel", "record-media-video", "record-media-video-camera"]) {
        const input = document.getElementById(id);
        if (input) input.disabled = locked;
      }
    }
    function ztSetPhase(phase) {
      ztPhase = phase;
      if (ztStage) ztStage.setAttribute("data-phase", phase);
    }
    function ztEl(tag, className, attrs) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (attrs) for (const key of Object.keys(attrs)) node.setAttribute(key, attrs[key]);
      return node;
    }
    function ztMedia(item, className) {
      if (item.kind === "video") {
        const video = ztEl("video", className || "");
        video.muted = true; video.playsInline = true; video.preload = "metadata";
        video.src = ztUrlFor(item.file);
        return video;
      }
      const image = ztEl("img", className || "");
      image.alt = ""; image.src = ztUrlFor(item.file);
      return image;
    }
    function ztPillLayout() {
      const thumb = ztQ("[data-zt-pill-thumb]");
      const active = ztQ('[data-zt-mode][aria-pressed="true"]');
      if (!thumb || !active) return;
      const first = !thumb.hasAttribute("data-ready");
      if (first) thumb.style.transition = "none";
      thumb.style.width = active.offsetWidth + "px";
      thumb.style.transform = "translateX(" + active.offsetLeft + "px)";
      if (first) { void thumb.offsetWidth; thumb.style.transition = ""; thumb.setAttribute("data-ready", ""); }
    }
    function ztSetMode(mode) {
      ztMode = mode;
      if (ztStage) ztStage.setAttribute("data-mode", mode);
      for (const pill of ztQA("[data-zt-mode]")) pill.setAttribute("aria-pressed", pill.getAttribute("data-zt-mode") === mode ? "true" : "false");
      ztPillLayout();
      const torch = ztQ("[data-zt-torch]");
      if (torch && mode !== "closeup") { torch.hidden = true; torch.setAttribute("aria-pressed", "false"); }
    }
    function ztHint(text) {
      const error = ztQ("[data-zt-error]");
      if (!error) return;
      error.textContent = text || "";
      error.hidden = !text;
    }
    function ztSyncCaps() {
      const engine = ztEngine();
      if (!engine) return;
      const state = engine.state();
      const caps = state.caps || {};
      const zoomRow = ztQ("[data-zt-zoom-row]");
      if (zoomRow) zoomRow.hidden = !(ztMode === "closeup" && caps.zoom);
      const torch = ztQ("[data-zt-torch]");
      if (torch) torch.hidden = !(ztMode === "closeup" && caps.torch);
      const live = Boolean(state.live);
      if (ztStage) ztStage.setAttribute("data-live", live ? "true" : "false");
    }
    function ztFrameRatio() {
      const video = ztQ("video");
      if (!video || !video.videoWidth || !video.videoHeight) return;
      ztStage.style.setProperty("--zt-ar", String(video.videoWidth / video.videoHeight));
    }
    function stageSync() {
      if (!ztStage) return;
      const items = ztItems();
      const count = items.length;
      const bundle = ztQ("[data-zt-bundle]");
      if (bundle) bundle.hidden = count === 0;
      const badge = ztQ("[data-zt-count]");
      if (badge) badge.textContent = String(count);
      const title = ztQ("[data-zt-stack-title]");
      const isVideo = count > 0 && items[0].kind === "video";
      if (title) title.textContent = isVideo ? ztCopy.reviewVideoTitle : ztFmt(ztCopy.stackTitle, { n: count });
      const saveButton = ztQ("[data-zt-save]");
      if (saveButton && ztPhase !== "saving") saveButton.textContent = isVideo ? ztCopy.saveVideo : ztFmt(ztCopy.saveN, { n: count });
      const thumbs = ztQ("[data-zt-stack-thumbs]");
      if (thumbs) {
        thumbs.replaceChildren();
        const last = items[items.length - 1];
        if (last) {
          const wrap = ztEl("span", "zt-cap-stack-thumb");
          wrap.appendChild(ztMedia(last, ""));
          thumbs.appendChild(wrap);
        }
      }
      ztReleaseUrls(items.map((item) => item.file).concat(ztSavedInfo ? ztSavedInfo.keep : []));
      if (ztReviewOpen) ztRenderReview();
      if (ztPendingFly) {
        const fly = ztPendingFly;
        ztPendingFly = null;
        ztFlyToStack(fly);
      }
    }
    function ztFlyToStack(fly) {
      const target = ztQ("[data-zt-stack]");
      const badge = ztQ("[data-zt-count]");
      if (badge && !ztReduced() && badge.animate) badge.animate([{ transform: "scale(1)" }, { transform: "scale(1.3)" }, { transform: "scale(1)" }], { duration: 240, easing: ztEase });
      if (ztReduced() || !target || !fly.rect || !fly.url || !target.getBoundingClientRect) return;
      const to = target.getBoundingClientRect();
      const from = fly.rect;
      const ghost = ztEl("img", "");
      ghost.alt = ""; ghost.src = fly.url;
      ghost.style.cssText = "position:fixed;z-index:20;pointer-events:none;object-fit:cover;border-radius:12px;left:" + from.left + "px;top:" + from.top + "px;width:" + from.width + "px;height:" + from.height + "px;transform-origin:0 0;";
      document.body.appendChild(ghost);
      const scale = Math.max(0.05, to.width / from.width);
      const dx = to.left - from.left;
      const dy = to.top - from.top;
      if (!ghost.animate) { ghost.remove(); return; }
      const animation = ghost.animate([
        { transform: "translate(0,0) scale(1)", opacity: 1 },
        { transform: "translate(" + dx + "px," + dy + "px) scale(" + scale + ")", opacity: 0.85 }
      ], { duration: 360, easing: ztEase });
      animation.onfinish = () => ghost.remove();
      animation.oncancel = () => ghost.remove();
    }
    function ztOpenReview() {
      if (ztItems().length === 0) return;
      ztReviewIndex = Math.min(ztReviewIndex, ztItems().length - 1);
      const review = ztQ("[data-zt-review]");
      if (!review) return;
      const stack = ztQ("[data-zt-stack]");
      review.hidden = false;
      ztReviewOpen = true;
      ztRenderReview();
      const main = ztQ("[data-zt-review-main]");
      if (!ztReduced() && main && main.animate && stack && stack.getBoundingClientRect) {
        const from = stack.getBoundingClientRect();
        const to = main.getBoundingClientRect();
        if (to.width && to.height) {
          main.animate([
            { transform: "translate(" + (from.left - to.left) + "px," + (from.top - to.top) + "px) scale(" + (from.width / to.width) + "," + (from.height / to.height) + ")", opacity: 0.4, transformOrigin: "0 0" },
            { transform: "none", opacity: 1, transformOrigin: "0 0" }
          ], { duration: 360, easing: ztEase });
        }
      }
      setTimeout(() => { const back = ztQ("[data-zt-review-back]"); if (back) back.focus(); }, 0);
    }
    function ztCloseReview() {
      const review = ztQ("[data-zt-review]");
      const main = ztQ("[data-zt-review-main]");
      const stack = ztQ("[data-zt-stack]");
      const finish = () => {
        ztReviewOpen = false;
        if (review) review.hidden = true;
        const opener = ztQ("[data-zt-stack]");
        if (opener && !opener.closest("[hidden]")) opener.focus();
      };
      if (!ztReduced() && review && !review.hidden && main && main.animate && stack && stack.getBoundingClientRect && ztItems().length > 0) {
        const from = main.getBoundingClientRect();
        const to = stack.getBoundingClientRect();
        if (from.width && from.height) {
          const animation = main.animate([
            { transform: "none", opacity: 1, transformOrigin: "0 0" },
            { transform: "translate(" + (to.left - from.left) + "px," + (to.top - from.top) + "px) scale(" + (to.width / from.width) + "," + (to.height / from.height) + ")", opacity: 0.4, transformOrigin: "0 0" }
          ], { duration: 360, easing: ztEase });
          animation.onfinish = finish;
          animation.oncancel = finish;
          return;
        }
      }
      finish();
    }
    function ztRenderReview() {
      const items = ztItems();
      if (items.length === 0) { ztCloseReview(); return; }
      ztReviewIndex = Math.max(0, Math.min(ztReviewIndex, items.length - 1));
      const current = items[ztReviewIndex];
      const isVideo = current.kind === "video";
      const title = ztQ("[data-zt-review-title]");
      if (title) title.textContent = isVideo ? ztCopy.reviewVideoTitle : ztCopy.reviewTitle;
      const main = ztQ("[data-zt-review-main]");
      const count = ztQ("[data-zt-review-count]");
      if (main) {
        for (const child of Array.from(main.children)) if (child !== count) child.remove();
        const media = ztMedia(current, "");
        if (isVideo) { media.controls = true; media.muted = false; }
        main.insertBefore(media, count);
      }
      if (count) { count.textContent = (ztReviewIndex + 1) + " / " + items.length; count.hidden = items.length < 2; }
      const thumbs = ztQ("[data-zt-review-thumbs]");
      if (thumbs) {
        thumbs.replaceChildren();
        items.forEach((item, index) => {
          const cell = ztEl("div", "zt-rv-thumb");
          const pick = ztEl("button", "zt-rv-thumb-img", { type: "button", "aria-label": ztFmt(ztCopy.reviewNth, { n: index + 1 }) });
          if (index === ztReviewIndex) pick.setAttribute("aria-current", "true");
          pick.appendChild(ztMedia(item, ""));
          pick.addEventListener("click", () => { ztReviewIndex = index; ztRenderReview(); });
          const remove = ztEl("button", "zt-rv-x", { type: "button", "aria-label": ztCopy.reviewRemove + ": " + ztFmt(ztCopy.reviewNth, { n: index + 1 }) });
          remove.textContent = "×";
          remove.addEventListener("click", (event) => { event.stopPropagation(); ztRemove(index); });
          const label = ztEl("span", "");
          label.textContent = ztFmt(ztCopy.reviewNth, { n: index + 1 });
          const frame = ztEl("div", "");
          frame.style.position = "relative";
          frame.append(pick, remove);
          cell.append(frame, label);
          thumbs.appendChild(cell);
        });
      }
      const save = ztQ("[data-zt-review-save]");
      if (save && ztPhase !== "saving") save.textContent = isVideo ? ztCopy.reviewSaveVideo : ztFmt(ztCopy.reviewSave, { n: items.length });
    }
    function ztRemove(index) {
      if (mediaKind === "video") {
        capturedVideoFile = null;
        if (videoInput) videoInput.value = "";
        pendingVideoIdempotencyKey = "";
        mediaKind = "photo";
        stageSync();
        return;
      }
      removePhotoAt(index);
      if (ztReviewIndex >= selectedPhotos.length) ztReviewIndex = Math.max(0, selectedPhotos.length - 1);
      stageSync();
    }
    function ztNoteFocus(phase, detail) {
      const note = ztQ("[data-zt-note]");
      const frame = ztQ(".zt-cap-frame");
      const marker = ztQ("[data-zt-focus-frame]");
      if (!note || !frame || !marker) return;
      clearTimeout(ztFocusTimer);
      if (phase === "start") {
        const rect = frame.getBoundingClientRect();
        marker.hidden = false;
        marker.classList.remove("is-ok");
        marker.style.left = Math.max(0, Math.min(rect.width, detail.clientX - rect.left)) + "px";
        marker.style.top = Math.max(0, Math.min(rect.height, detail.clientY - rect.top)) + "px";
        marker.style.opacity = "1";
        note.classList.add("is-on");
        return;
      }
      if (phase === "done") {
        marker.classList.add("is-ok");
        note.classList.remove("is-on");
        ztFocusTimer = setTimeout(() => { marker.style.opacity = "0"; setTimeout(() => { marker.hidden = true; }, 240); }, 700);
        return;
      }
      note.classList.remove("is-on");
      marker.hidden = true;
    }
    function ztShowCard(reason) {
      const card = ztQ("[data-zt-card]");
      if (!card) return;
      const focusGroup = ztQ("[data-global-record-camera-focus-fallback]");
      const errorGroup = ztQ("[data-global-record-camera-error-actions]");
      const sub = ztQ("[data-zt-card-sub]");
      const focusMode = reason === "focus_unsupported";
      if (focusGroup) focusGroup.hidden = !focusMode;
      if (errorGroup) errorGroup.hidden = focusMode;
      if (sub) sub.hidden = !focusMode;
      card.hidden = false;
    }
    async function ztBeginCamera() {
      const engine = ztEngine();
      if (!engine) return;
      ztSetPhase("boot");
      const kind = ztMode === "video" ? "video" : "photo";
      const state = await engine.begin(kind, ztMode === "closeup");
      ztFrameRatio();
      ztSyncCaps();
      if (ztPhase === "error") return;
      ztSetPhase(state && state.live ? "live" : "idle");
    }
    function ztWaitEngine(done) {
      if (ztEngine()) { done(true); return; }
      let finished = false;
      const finish = (ok) => { if (finished) return; finished = true; document.removeEventListener("ikimon-capture-engine-ready", onReady); done(ok); };
      const onReady = () => finish(true);
      document.addEventListener("ikimon-capture-engine-ready", onReady);
      setTimeout(() => finish(Boolean(ztEngine())), 6000);
    }
    function ztBoot() {
      if (ztBooted || !ztStage) return;
      ztBooted = true;
      ztSetMode(ztMode);
      ztWaitEngine((ok) => {
        if (!ok) { ztSetPhase("error"); const body = ztQ("[data-global-record-camera-error-body]"); if (body) body.textContent = ztCopy.noEngine; ztShowCard("engine_missing"); return; }
        void ztBeginCamera();
      });
    }
    function ztResume() {
      if (!ztStage || document.visibilityState === "hidden") return;
      if (ztPhase === "saved" || ztPhase === "saving" || ztPhase === "boot") return;
      const engine = ztEngine();
      if (!engine) return;
      const state = engine.state();
      if (state.live) return;
      if (ztPhase === "error" && ztQ("[data-zt-card]") && !ztQ("[data-zt-card]").hidden) return;
      void ztBeginCamera();
    }
    function ztStopCameraForPicker() {
      const engine = ztEngine();
      if (engine) engine.stop();
      ztSyncCaps();
    }
    function ztOnShutter() {
      const now = Date.now();
      if (now - ztLastShutterAt < 140) return;
      ztLastShutterAt = now;
      if (ztPhase === "boot" || ztPhase === "saving" || ztPhase === "saved") return;
      const engine = ztEngine();
      const state = engine ? engine.state() : null;
      const held = ztItems();
      if (state && state.live && held.length > 0) {
        if (ztMode === "video" && held[0].kind === "photo") { ztHint(ztCopy.videoBlocked); return; }
        if (ztMode !== "video" && held[0].kind === "video") { ztHint(ztCopy.photoBlocked); return; }
      }
      ztHint("");
      ztStartLocation();
      if (!state || !state.live) {
        const input = ztMode === "video" ? document.getElementById("record-media-video-camera") : document.getElementById("record-media-camera");
        if (input) { ztStopCameraForPicker(); input.click(); }
        return;
      }
      if (ztMode === "video") {
        ztQ("[data-zt-shutter]").setAttribute("aria-pressed", state.recording ? "false" : "true");
        engine.shutter();
        return;
      }
      const flash = ztQ("[data-zt-flash]");
      if (flash && !ztReduced()) { flash.classList.remove("is-on"); void flash.offsetWidth; flash.classList.add("is-on"); }
      engine.shutter();
    }
    function ztAfterAdded(file, fromShutter) {
      const frame = ztQ(".zt-cap-view");
      if (fromShutter && frame) {
        const rect = frame.getBoundingClientRect();
        ztPendingFly = { rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, url: ztUrlFor(file) };
      }
    }
    document.addEventListener("ikimon-capture-photo", (event) => {
      const detail = event.detail || {};
      const file = detail.file;
      if (!(file instanceof File)) return;
      if (ztPhase === "saving" || ztPhase === "saved") return;
      if (mediaKind === "video" && selectedFiles().length) return;
      ztTimes.set(file, detail.capturedAt || Date.now());
      ztAfterAdded(file, true);
      addPhotoFiles({ files: [file], value: "" });
    });
    document.addEventListener("ikimon-capture-video", (event) => {
      const detail = event.detail || {};
      const file = detail.file;
      if (!(file instanceof File)) return;
      if (ztPhase === "saving" || ztPhase === "saved") return;
      ztQ("[data-zt-shutter]").setAttribute("aria-pressed", "false");
      clearInterval(ztVideoTimer);
      ztTimes.set(file, detail.capturedAt || Date.now());
      capturedVideoFile = file;
      pendingVideoUid = "";
      pendingVideoUploadUrl = "";
      pendingVideoBodyUploaded = false;
      pendingVideoIdempotencyKey = newVideoUploadKey();
      reveal("video");
    });
    document.addEventListener("ikimon-capture-recording", (event) => {
      const detail = event.detail || {};
      const note = ztQ("[data-zt-note]");
      if (!note) return;
      if (detail.recording) {
        const seconds = Number(detail.seconds || 0);
        note.textContent = ztFmt(ztCopy.recording, { t: Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0") });
        note.classList.add("is-on");
      } else {
        note.classList.remove("is-on");
        note.textContent = ztCopy.focusing;
      }
    });
    document.addEventListener("ikimon-capture-focus", (event) => {
      const detail = event.detail || {};
      ztNoteFocus(detail.phase, detail);
    });
    document.addEventListener("ikimon-capture-start-failed", (event) => {
      const detail = event.detail || {};
      ztSetPhase("error");
      ztSyncCaps();
      ztShowCard(detail.reason);
    });
    document.addEventListener("ikimon-capture-closeup", (event) => {
      const detail = event.detail || {};
      if (detail.ok) { ztSetPhase("live"); ztSyncCaps(); return; }
      ztSetPhase("error");
      ztShowCard(detail.reason);
    });
    function ztResetCloseup() {
      const engine = ztEngine();
      const zoom = ztQ("[data-global-record-camera-zoom-range]");
      if (zoom && !ztQ("[data-zt-zoom-row]").hidden) {
        zoom.value = zoom.min || "1";
        zoom.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const focus = ztQ("[data-global-record-camera-focus-range]");
      const auto = ztQ("[data-global-record-camera-focus-auto]");
      if (focus && !ztQ("[data-global-record-camera-focus]").hidden) {
        if (auto && !auto.disabled) auto.click();
        focus.value = focus.min || "0";
      }
      const torch = ztQ("[data-zt-torch]");
      if (torch && torch.getAttribute("aria-pressed") === "true") {
        torch.setAttribute("aria-pressed", "false");
        if (engine) void engine.torch(false);
      }
    }
    function ztChooseMode(mode) {
      if (!ztStage || mode === ztMode || ztPhase === "saving") return;
      ztHint("");
      const engine = ztEngine();
      const previous = ztMode;
      if (previous === "closeup" && mode !== "closeup") ztResetCloseup();
      ztSetMode(mode);
      const card = ztQ("[data-zt-card]");
      if (card && !card.hidden && mode !== "closeup") { card.hidden = true; if (engine) engine.clearError(); }
      if (!engine) return;
      if (mode === "video" || previous === "video") { ztSetPhase("boot"); void ztBeginCamera(); return; }
      void engine.setCloseup(mode === "closeup").then(() => { const state = engine.state(); if (state && state.live && ztPhase === "error") ztSetPhase("live"); ztSyncCaps(); });
    }
    function ztClose() {
      if (ztItems().length > 0 && !window.confirm(ztCopy.discardConfirm)) return;
      const engine = ztEngine();
      if (engine) engine.stop();
      document.body.classList.remove("zt-capturing");
      const back = () => {
        const sameOrigin = document.referrer && document.referrer.indexOf(location.origin) === 0;
        if (sameOrigin && history.length > 1) history.back(); else location.assign(recordPrefix + "/");
      };
      if (ztReduced()) back(); else setTimeout(back, 240);
    }
    function ztDateLabel(ms) {
      const d = new Date(ms);
      return ztFmt(ztCopy.dateFormat, { m: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: String(d.getMinutes()).padStart(2, "0") });
    }
    function ztLocalInput(ms) {
      const d = new Date(ms);
      const p = (n) => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    }
    const ztExif = [];
    let ztLocPromise = null;
    let ztLocValue = null;
    function ztStartLocation() {
      if (ztLocPromise) return;
      const engine = ztEngine();
      if (!engine || typeof engine.location !== "function") return;
      ztLocPromise = Promise.resolve(engine.location(false)).then((found) => { ztLocValue = found || null; return ztLocValue; }, () => null);
    }
    async function ztExifTime(file) {
      try {
        if (!file || !/jpe?g/i.test((file.type || "") + " " + (file.name || ""))) return 0;
        const view = new DataView(await file.slice(0, 262144).arrayBuffer());
        if (view.getUint16(0) !== 0xffd8) return 0;
        let pos = 2;
        while (pos + 4 < view.byteLength) {
          const marker = view.getUint16(pos);
          const size = view.getUint16(pos + 2);
          if (marker === 0xffe1 && view.getUint32(pos + 4) === 0x45786966) {
            const base = pos + 10;
            const little = view.getUint16(base) === 0x4949;
            const u16 = (offset) => view.getUint16(base + offset, little);
            const u32 = (offset) => view.getUint32(base + offset, little);
            const readIfd = (offset) => {
              const out = {};
              const count = u16(offset);
              for (let index = 0; index < count; index += 1) {
                const entry = offset + 2 + index * 12;
                out[u16(entry)] = { count: u32(entry + 4), at: entry + 8 };
              }
              return out;
            };
            const root = readIfd(u32(4));
            const exif = root[0x8769] ? readIfd(u32(root[0x8769].at)) : null;
            const tag = exif && (exif[0x9003] || exif[0x9004]);
            if (!tag || tag.count < 19) return 0;
            const from = base + u32(tag.at);
            let text = "";
            for (let index = 0; index < 19; index += 1) text += String.fromCharCode(view.getUint8(from + index));
            const m = text.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)$/);
            if (!m) return 0;
            const ms = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])).getTime();
            return Number.isFinite(ms) && ms > Date.UTC(1990, 0, 1) && ms <= Date.now() ? ms : 0;
          }
          if ((marker & 0xff00) !== 0xff00 || size < 2) return 0;
          pos += 2 + size;
        }
      } catch (_) {}
      return 0;
    }
    function ztReadTimes(list) {
      for (const file of Array.from(list || [])) ztExif.push(ztExifTime(file).then((ms) => { if (ms) ztTimes.set(file, ms); }));
    }
    async function ztResolveSaveInputs() {
      const waiting = Promise.all(ztExif.splice(0));
      const place = ztLocPromise
        ? Promise.race([ztLocPromise, new Promise((resolve) => setTimeout(() => resolve(null), 1500))])
        : Promise.resolve(null);
      await Promise.all([waiting, place]);
      const found = ztLocValue;
      if (form && form.elements) {
        if (found && Number.isFinite(Number(found.latitude)) && Number.isFinite(Number(found.longitude))) {
          if (form.elements.latitude) form.elements.latitude.value = String(found.latitude);
          if (form.elements.longitude) form.elements.longitude.value = String(found.longitude);
        }
        if (form.elements.observedAtLocal) form.elements.observedAtLocal.value = ztLocalInput(ztEarliest());
      }
    }
    function ztEarliest() {
      const times = [];
      for (const file of selectedFiles()) {
        const stamped = ztTimes.get(file) || file.lastModified;
        if (stamped && stamped <= Date.now()) times.push(stamped);
      }
      return times.length ? Math.min.apply(null, times) : Date.now();
    }
    async function ztSave() {
      if (ztPhase === "saving" || submitting || serverSaved) return;
      const files = selectedFiles();
      if (!files.length) return;
      if (mediaKind === "photo" && !selectedPhotos.length) return;
      const observed = form && form.elements ? form.elements.observedAtLocal : null;
      if (observed) observed.value = ztLocalInput(ztEarliest());
      ztSavedInfo = { keep: files.slice(), count: files.length, video: mediaKind === "video", observedAt: ztEarliest(), first: files[0] };
      ztSetPhase("saving");
      ztLockInputs(true);
      for (const button of ztQA("[data-zt-save],[data-zt-review-save]")) { button.disabled = true; button.textContent = ztCopy.saving; }
      ztHint("");
      await ztResolveSaveInputs();
      if (ztPhase !== "saving" || !ztSavedInfo) return;
      ztSavedInfo.observedAt = ztEarliest();
      form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }
    function stageStatus(message, error) {
      if (!ztStage) return;
      if (error && ztPhase !== "saving") { ztHint(String(message || "")); return; }
      if (ztPhase === "saving") {
        if (error) {
          ztSetPhase("live");
          ztLockInputs(false);
          for (const button of ztQA("[data-zt-save],[data-zt-review-save]")) button.disabled = false;
          ztSavedInfo = null;
          stageSync();
          ztHint(String(message || ztCopy.saveFailed));
          return;
        }
        const progress = String(message || "").match(/(\d+\/\d+)\s*$/);
        if (progress) for (const button of ztQA("[data-zt-save],[data-zt-review-save]")) button.textContent = ztCopy.saving + " " + progress[1];
      }
    }
    function stageSaved(visitId, resolvedPlaceId) {
      if (!ztStage) return;
      ztSetPhase("saved");
      const engine = ztEngine();
      if (engine) engine.stop();
      const info = ztSavedInfo || { count: 0, video: false, observedAt: Date.now(), first: null, keep: [] };
      ztReviewOpen = false;
      const review = ztQ("[data-zt-review]");
      if (review) review.hidden = true;
      const holder = ztQ("[data-zt-saved-thumb]");
      if (holder) {
        holder.replaceChildren();
        if (info.first) holder.appendChild(ztMedia({ file: info.first, kind: info.video ? "video" : "photo" }, ""));
      }
      const title = ztQ("[data-zt-saved-card-title]");
      if (title) title.textContent = info.video ? ztCopy.savedCardVideo : ztFmt(ztCopy.savedCardPhotos, { n: info.count });
      const meta = ztQ("[data-zt-saved-card-meta]");
      const placed = Boolean(form && form.elements && form.elements.latitude && form.elements.longitude && String(form.elements.latitude.value || "").trim() && String(form.elements.longitude.value || "").trim());
      if (meta) meta.textContent = ztDateLabel(info.observedAt) + (placed ? "" : " ・ " + ztCopy.savedPlaceUnset);
      const view = ztQ("[data-zt-view]");
      if (view) view.setAttribute("href", recordPrefix + "/observations/" + encodeURIComponent(visitId));
      const back = ztQ("[data-zt-back-to]");
      if (back) {
        let href = "";
        if (eventContext.eventSessionId) href = recordPrefix + "/events/" + encodeURIComponent(eventContext.eventSessionId) + "/live";
        else if (resolvedPlaceId && initialPlaceId) href = recordPrefix + "/places/" + encodeURIComponent(resolvedPlaceId);
        if (href) back.setAttribute("href", href);
        back.hidden = !href;
      }
      const saved = ztQ("[data-zt-saved]");
      if (saved) {
        saved.hidden = false;
        saved.classList.remove("is-anim");
        void saved.offsetWidth;
        if (!ztReduced()) saved.classList.add("is-anim");
        const heading = ztQ("[data-zt-saved-title]");
        if (heading) heading.focus();
      }
    }
    function ztAgain() {
      selectedPhotos.length = 0;
      preparedPhotoUploads.length = 0;
      completedPhotoIndexes = new Set();
      recoverySubmissionId = "";
      recoveryObservedAt = "";
      pendingVideoUid = "";
      pendingVideoUploadUrl = "";
      pendingVideoBodyUploaded = false;
      pendingVideoIdempotencyKey = "";
      capturedVideoFile = null;
      if (videoInput) videoInput.value = "";
      draftClaimed = false;
      draftClaimDeclined = false;
      draftRevision += 1;
      clearTimeout(draftTimer);
      draftTimer = null;
      submitting = false;
      submitRequested = false;
      serverSaved = false;
      volatileDraft = false;
      mediaKind = "photo";
      ztSavedInfo = null;
      ztReviewIndex = 0;
      if (form && form.elements) {
        if (form.elements.note) form.elements.note.value = "";
        if (form.elements.observedAtLocal) form.elements.observedAtLocal.value = "";
        if (form.elements.latitude) form.elements.latitude.value = "";
        if (form.elements.longitude) form.elements.longitude.value = "";
      }
      ztLocPromise = null;
      ztLocValue = null;
      const dot = ztQ("[data-zt-memo-dot]");
      if (dot) dot.hidden = true;
      document.querySelectorAll("#record-form input, #record-form textarea, #record-use-location").forEach((el) => { el.disabled = false; });
      ztLockInputs(false);
      for (const button of ztQA("[data-zt-save],[data-zt-review-save]")) button.disabled = false;
      ztReleaseUrls([]);
      const saved = ztQ("[data-zt-saved]");
      if (saved) { saved.hidden = true; saved.classList.remove("is-anim"); }
      ztHint("");
      ztSetPhase("boot");
      if (ztMode === "video") ztSetMode("standard");
      stageSync();
      void ztBeginCamera();
    }
    function ztOpenMemo() {
      const dialog = ztQ("[data-zt-memo]");
      if (!dialog || typeof dialog.showModal !== "function") return;
      if (!dialog.open) dialog.showModal();
      const text = ztQ("[data-zt-memo-text]");
      if (text) text.focus();
    }
    function ztBind() {
      if (!ztStage) return;
      for (const pill of ztQA("[data-zt-mode]")) pill.addEventListener("click", () => ztChooseMode(pill.getAttribute("data-zt-mode")));
      const shutter = ztQ("[data-zt-shutter]");
      if (shutter) shutter.addEventListener("click", ztOnShutter);
      const close = ztQ("[data-zt-close]");
      if (close) close.addEventListener("click", ztClose);
      const stack = ztQ("[data-zt-stack]");
      if (stack) stack.addEventListener("click", ztOpenReview);
      const save = ztQ("[data-zt-save]");
      if (save) save.addEventListener("click", ztSave);
      const reviewSave = ztQ("[data-zt-review-save]");
      if (reviewSave) reviewSave.addEventListener("click", ztSave);
      const back = ztQ("[data-zt-review-back]");
      if (back) back.addEventListener("click", ztCloseReview);
      const more = ztQ("[data-zt-review-more]");
      if (more) more.addEventListener("click", ztCloseReview);
      const again = ztQ("[data-zt-again]");
      if (again) again.addEventListener("click", ztAgain);
      const retry = ztQ("[data-zt-retry]");
      if (retry) retry.addEventListener("click", () => { const card = ztQ("[data-zt-card]"); if (card) card.hidden = true; ztSetPhase("boot"); if (ztEngine()) { ztEngine().clearError(); void ztBeginCamera(); } else { ztBooted = false; ztBoot(); } });
      const standard = ztQ("[data-zt-standard]");
      if (standard) standard.addEventListener("click", () => { const card = ztQ("[data-zt-card]"); if (card) card.hidden = true; if (ztEngine()) ztEngine().clearError(); ztChooseMode("standard"); });
      const torch = ztQ("[data-zt-torch]");
      if (torch) torch.addEventListener("click", async () => {
        const engine = ztEngine();
        if (!engine) return;
        const next = torch.getAttribute("aria-pressed") !== "true";
        if (await engine.torch(next)) torch.setAttribute("aria-pressed", next ? "true" : "false");
      });
      for (const label of ztQA("[data-zt-device-photo]")) label.addEventListener("click", ztStopCameraForPicker);
      for (const id of ["record-media-photo", "record-media-camera", "record-media-camera-panel", "record-media-video", "record-media-video-camera"]) {
        const input = document.getElementById(id);
        if (!input) continue;
        input.addEventListener("click", () => { if (id !== "record-media-photo" && id !== "record-media-video") ztStopCameraForPicker(); });
        input.addEventListener("cancel", () => setTimeout(ztResume, 0));
        if (id !== "record-media-video" && id !== "record-media-video-camera") input.addEventListener("change", () => ztReadTimes(input.files), true);
      }
      const panelCamera = document.getElementById("record-media-camera-panel");
      if (panelCamera) panelCamera.addEventListener("change", () => {
        if (panelCamera.files && panelCamera.files.length) { ztAfterAdded(panelCamera.files[0], false); addPhotoFiles(panelCamera); }
      });
      const videoCamera = document.getElementById("record-media-video-camera");
      if (videoCamera) videoCamera.addEventListener("change", () => {
        const file = videoCamera.files && videoCamera.files[0];
        if (!file) return;
        ztTimes.set(file, file.lastModified || Date.now());
        capturedVideoFile = file;
        videoCamera.value = "";
        pendingVideoUid = "";
        pendingVideoUploadUrl = "";
        pendingVideoBodyUploaded = false;
        pendingVideoIdempotencyKey = newVideoUploadKey();
        reveal("video");
      });
      const memoOpen = ztQ("[data-zt-memo-open]");
      if (memoOpen) memoOpen.addEventListener("click", ztOpenMemo);
      const memoClose = ztQ("[data-zt-memo-close]");
      const memo = ztQ("[data-zt-memo]");
      if (memoClose && memo) memoClose.addEventListener("click", () => memo.close());
      const memoText = ztQ("[data-zt-memo-text]");
      if (memoText) memoText.addEventListener("input", () => {
        const dot = ztQ("[data-zt-memo-dot]");
        if (dot) dot.hidden = !memoText.value.trim();
        queueDraftSave();
      });
      if (memo) memo.addEventListener("close", () => setTimeout(ztResume, 0));
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ztResume(); });
      window.addEventListener("focus", () => setTimeout(ztResume, 200));
      window.addEventListener("resize", ztPillLayout);
      const video = ztQ("video");
      if (video) { video.addEventListener("loadedmetadata", ztFrameRatio); video.addEventListener("resize", ztFrameRatio); }
      const pendingMemoMode = window.__ztMemoOpenMode;
      if (pendingMemoMode) setTimeout(ztOpenMemo, 0);
      ztPillLayout();
      setTimeout(ztPillLayout, 120);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(ztPillLayout);
      stageSync();
      ztBoot();
    }
    ztBind();
`;
