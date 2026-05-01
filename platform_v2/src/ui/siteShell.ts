import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, supportedLanguages, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { appInstallCopy } from "../appInstall.js";
import { listPagesByLane, listPagesByVisibility, sitePageLabel, type RouteLane, type SitePageDefinition } from "../siteMap.js";
import { FACE_PRIVACY_CLIENT_SCRIPT } from "./facePrivacyScript.js";

export type SiteAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

export type SiteHero = {
  eyebrow: string;
  heading: string;
  headingHtml?: string;
  lead: string;
  actions?: SiteAction[];
  mediaHtml?: string;
  supplementHtml?: string;
  afterActionsHtml?: string;
  tone?: "dark" | "light";
  align?: "left" | "center";
};

export type SiteShellOptions = {
  basePath: string;
  title: string;
  description?: string;
  body: string;
  hero?: SiteHero;
  /** HTML slot rendered inside <main> between the hero and body (e.g. quick nav chips). */
  belowHeroHtml?: string;
  /** CSS appended after the base shell styles (scoped via class names). */
  extraStyles?: string;
  activeNav?: string;
  footerNote?: string;
  lang?: SiteLang;
  currentPath?: string;
  canonicalPath?: string;
  alternateLangs?: SiteLang[];
  noindex?: boolean;
  shellClassName?: string;
};

type ShellCopy = {
  brandTagline: string;
  skipToContent: string;
  searchPlaceholder: string;
  searchLabel: string;
  menu: string;
  nav: Record<string, string>;
  record: string;
  footer: {
    tagline: string;
    start: string;
    startLinks: {
      discover: string;
      record: string;
      places: string;
    };
    learn: string;
    learnLinks: {
      guides: string;
      about: string;
      faq: string;
      updates: string;
    };
    trust: string;
    trustLinks: {
      business: string;
      contact: string;
      terms: string;
      privacy: string;
    };
    copyright: string;
    revisit: string;
  };
};

function shellCopyFor(lang: SiteLang): ShellCopy {
  return getShortCopy<ShellCopy>(lang, "shared", "shell");
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildNavLinks(basePath: string, lang: SiteLang, activeNav?: string): string {
  return listPagesByVisibility("header")
    .map((page) => {
      const label = sitePageLabel(page, lang);
      const activeClass = activeNav === label ? " is-active" : "";
      const href = withBasePath(basePath, page.path);
      return `<a class="site-nav-link${activeClass}" href="${escapeHtml(appendLangToHref(href, lang))}">${escapeHtml(label)}</a>`;
    })
    .join("");
}

function renderSearchForm(basePath: string, lang: SiteLang, copy: ShellCopy, className = ""): string {
  const classes = ["site-search"];
  if (className) {
    classes.push(className);
  }

  return `<form class="${classes.join(" ")}" role="search" action="${escapeHtml(appendLangToHref(withBasePath(basePath, "/explore"), lang))}" method="get" aria-label="${escapeHtml(copy.searchLabel)}">
    <span class="site-search-icon" aria-hidden="true">🔍</span>
    <input class="site-search-input" type="search" name="q" placeholder="${escapeHtml(copy.searchPlaceholder)}" aria-label="${escapeHtml(copy.searchLabel)}" />
  </form>`;
}

function renderLangSwitch(currentPath: string, lang: SiteLang, availableLangs: SiteLang[], className = ""): string {
  const classes = ["lang-switch"];
  if (className) {
    classes.push(className);
  }
  const available = new Set(availableLangs);

  return `<div class="${classes.join(" ")}" aria-label="Language switcher">${supportedLanguages
    .map((language) => {
      const activeClass = language.code === lang ? " is-active" : "";
      const targetPath = available.has(language.code) ? currentPath : "/";
      return `<a class="lang-switch-link${activeClass}" href="${escapeHtml(appendLangToHref(targetPath, language.code))}" hreflang="${escapeHtml(language.code)}" lang="${escapeHtml(language.code)}">${escapeHtml(language.shortLabel)}</a>`;
    })
    .join("")}</div>`;
}

function nav(basePath: string, lang: SiteLang, currentPath: string, activeNav: string | undefined, availableLangs: SiteLang[]): string {
  const copy = shellCopyFor(lang);
  const brandMarkSrc = "/assets/img/icon-192.png";
  const navLinks = buildNavLinks(basePath, lang, activeNav);
  const desktopSearch = renderSearchForm(basePath, lang, copy, "site-search-desktop");
  const mobileSearch = renderSearchForm(basePath, lang, copy, "site-search-mobile");
  const desktopLangSwitch = renderLangSwitch(currentPath, lang, availableLangs, "lang-switch-desktop");
  const mobileLangSwitch = renderLangSwitch(currentPath, lang, availableLangs, "lang-switch-mobile");
  const recordHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang));
  const loginHref = escapeHtml(appendLangToHref(withBasePath(basePath, "/login?redirect=/profile"), lang));

  return `<header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/"), lang))}">
        <span class="brand-mark"><img src="${escapeHtml(brandMarkSrc)}" alt="ikimon icon" /></span>
        <span>
          <strong>ikimon</strong>
          <small>${escapeHtml(copy.brandTagline)}</small>
        </span>
      </a>
      <nav class="site-nav site-nav-desktop">${navLinks}</nav>
      ${desktopSearch}
      <div class="site-header-actions site-header-actions-desktop">
        ${desktopLangSwitch}
        <a class="btn btn-ghost site-login-link" href="${loginHref}">ログイン</a>
        <a class="btn btn-solid site-record-link" href="${recordHref}">${escapeHtml(copy.record)}</a>
      </div>
      <div class="site-header-actions site-header-actions-mobile">
        <a class="btn btn-ghost site-login-link" href="${loginHref}">ログイン</a>
        <a class="btn btn-solid site-record-link" href="${recordHref}">${escapeHtml(copy.record)}</a>
        <details class="site-mobile-menu">
          <summary class="site-mobile-menu-toggle">
            <span class="site-mobile-menu-icon" aria-hidden="true"></span>
            <span>${escapeHtml(copy.menu)}</span>
          </summary>
          <div class="site-mobile-menu-panel">
            ${mobileSearch}
            <nav class="site-nav site-nav-mobile">${navLinks}</nav>
            <div class="site-mobile-menu-meta">
              ${mobileLangSwitch}
            </div>
          </div>
        </details>
      </div>
    </div>
  </header>`;
}

function hero(basePath: string, content?: SiteHero): string {
  if (!content) {
    return "";
  }

  const actions = (content.actions ?? []).map((action) => {
    const className = action.variant === "secondary" ? "btn btn-ghost-on-dark" : "btn btn-solid";
    return `<a class="${className}" href="${escapeHtml(withBasePath(basePath, action.href))}">${escapeHtml(action.label)}</a>`;
  }).join("");

  return `<section class="hero-panel${content.mediaHtml ? " has-media" : ""}${content.tone === "light" ? " is-light" : ""}${content.align === "center" ? " is-center" : ""}">
    <div class="hero-copy">
      <div class="hero-badge"><span class="hero-badge-dot"></span>${escapeHtml(content.eyebrow)}</div>
      <h1>${content.headingHtml ?? escapeHtml(content.heading)}</h1>
      <p>${escapeHtml(content.lead)}</p>
      ${content.supplementHtml ? `<div class="hero-supplement">${content.supplementHtml}</div>` : ""}
      ${actions ? `<div class="actions">${actions}</div>` : ""}
      ${content.afterActionsHtml ? `<div class="hero-after-actions">${content.afterActionsHtml}</div>` : ""}
    </div>
    ${content.mediaHtml ? `<div class="hero-media">${content.mediaHtml}</div>` : ""}
  </section>`;
}

function footerGroupPages(lanes: RouteLane[], limit: number): SitePageDefinition[] {
  return lanes.flatMap((lane) => listPagesByLane(lane, "footer")).slice(0, limit);
}

function renderFooterLinks(basePath: string, lang: SiteLang, pages: SitePageDefinition[]): string {
  return pages
    .map((page) => {
      const href = appendLangToHref(withBasePath(basePath, page.path), lang);
      return `<a href="${escapeHtml(href)}">${escapeHtml(sitePageLabel(page, lang))}</a>`;
    })
    .join("");
}

function footer(basePath: string, lang: SiteLang, _footerNote?: string): string {
  const copy = shellCopyFor(lang);
  const startPages = footerGroupPages(["start"], 5);
  const learnPages = footerGroupPages(["learn"], 5);
  const areaPages = footerGroupPages(["group", "business", "research"], 5);
  const trustPages = footerGroupPages(["trust"], 5);
  return `<footer class="site-footer">
    <div class="footer-inner">
      <section class="footer-hero" aria-label="フッター案内">
        <div class="footer-brand-panel">
          <div>
          <div class="brand brand-footer">
            <span class="brand-mark"><img src="/assets/img/icon-192.png" alt="ikimon icon" /></span>
            <span>
              <strong>ikimon</strong>
              <small>${escapeHtml(copy.footer.tagline)}</small>
            </span>
          </div>
            <div class="footer-kicker">見つける、確かめる、残す、また歩く。</div>
            <h2>足もとの一枚を、<br>世界につながる自然記録へ。</h2>
            <p>身近な自然を見つけ、確かめ、残し、また歩くための自然観察基盤。個人の発見を、地域と世界の記録につなげる。</p>
            <div class="footer-actions">
              <a class="btn btn-solid" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/record"), lang))}">${escapeHtml(copy.record)}</a>
              <a class="btn btn-ghost-on-dark" href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn"), lang))}">読み物を見る</a>
            </div>
          </div>
          <div class="footer-chip-row" aria-label="ikimon の価値">
            <span>名前が分からなくても残せる</span>
            <span>公開範囲を安全側で制御</span>
            <span>学校・研究・地域活動へ接続</span>
          </div>
        </div>
        <div class="footer-mini-map" aria-label="観察ルートのイメージ">
          <div class="footer-route"></div>
          <span class="footer-pin one"></span>
          <span class="footer-pin two"></span>
          <span class="footer-pin three"></span>
          <span class="footer-pin four"></span>
          <div class="footer-map-copy">
            <span>次の一歩</span>
            <strong>いつもの道が、観察ルートになる。</strong>
            <p>散歩、通学路、旅先、庭先。どこから始めても、記録はあとから育てられる。</p>
          </div>
        </div>
      </section>

      <section class="footer-directory" aria-label="サイト内リンク">
        <div class="footer-group">
          <strong><i>REC</i>使う</strong>
          <nav class="footer-links" aria-label="使う">
            ${renderFooterLinks(basePath, lang, startPages)}
          </nav>
        </div>
        <div class="footer-group">
          <strong><i>READ</i>${escapeHtml(copy.footer.learn)}</strong>
          <nav class="footer-links" aria-label="${escapeHtml(copy.footer.learn)}">
            ${renderFooterLinks(basePath, lang, learnPages)}
          </nav>
        </div>
        <div class="footer-group">
          <strong><i>AREA</i>広げる</strong>
          <nav class="footer-links" aria-label="広げる">
            ${renderFooterLinks(basePath, lang, areaPages)}
          </nav>
        </div>
        <div class="footer-group">
          <strong><i>SAFE</i>確認する</strong>
          <nav class="footer-links" aria-label="確認する">
            ${renderFooterLinks(basePath, lang, trustPages)}
          </nav>
        </div>
      </section>

      <div class="footer-bottom">
        <span>ikimon.life｜自然を見つけ、確かめ、残し、また歩く。</span>
        <span><a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/learn/updates"), lang))}">${escapeHtml(copy.footer.learnLinks.updates)}</a>・<a href="${escapeHtml(appendLangToHref(withBasePath(basePath, "/contact"), lang))}">${escapeHtml(copy.footer.trustLinks.contact)}</a></span>
      </div>
    </div>
  </footer>`;
}

function normalizePathname(path: string): string {
  try {
    return new URL(path, "https://ikimon.local").pathname;
  } catch {
    return path.split("?")[0] || "/";
  }
}

function shouldRenderGlobalRecordEntry(currentPath: string): boolean {
  const pathname = normalizePathname(currentPath);
  return !(
    pathname === "/record" ||
    pathname.startsWith("/record/") ||
    pathname === "/guide" ||
    (pathname.startsWith("/guide/") && pathname !== "/guide/outcomes") ||
    pathname === "/notes" ||
    pathname.startsWith("/notes/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/debug" ||
    pathname.startsWith("/debug/") ||
    pathname === "/login" ||
    pathname === "/register"
  );
}

function isReadingSurface(currentPath: string): boolean {
  const pathname = normalizePathname(currentPath);
  return pathname === "/notes" || pathname.startsWith("/notes/") || pathname === "/profile" || pathname.startsWith("/profile/");
}

function globalRecordEntry(basePath: string, lang: SiteLang, currentPath: string): string {
  if (!shouldRenderGlobalRecordEntry(currentPath)) {
    return "";
  }
  const photoHref = appendLangToHref(withBasePath(basePath, "/record?start=photo"), lang);
  const videoHref = appendLangToHref(withBasePath(basePath, "/record?start=video"), lang);
  const galleryHref = appendLangToHref(withBasePath(basePath, "/record?start=gallery"), lang);
  const guideHref = appendLangToHref(withBasePath(basePath, "/guide"), lang);
  return `<nav class="global-record-launcher" aria-label="すぐ記録する">
    <input class="global-record-input" data-global-record-input="photo" type="file" accept="image/*" capture="environment" multiple hidden />
    <input class="global-record-input" data-global-record-input="video" type="file" accept="video/*" capture="environment" hidden />
    <input class="global-record-input" data-global-record-input="gallery" type="file" accept="image/*,video/*" multiple hidden />
    <button type="button" class="global-record-choice is-primary" data-global-record-trigger="photo" data-record-target="${escapeHtml(photoHref)}" data-kpi-action="global_record_photo">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
      <span>写真</span>
    </button>
    <button type="button" class="global-record-choice" data-global-record-trigger="video" data-record-target="${escapeHtml(videoHref)}" data-kpi-action="global_record_video">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
      <span>動画</span>
    </button>
    <button type="button" class="global-record-choice" data-global-record-trigger="gallery" data-record-target="${escapeHtml(galleryHref)}" data-kpi-action="global_record_gallery">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
      <span>選ぶ</span>
    </button>
    <a class="global-record-choice" href="${escapeHtml(guideHref)}" data-kpi-action="global_record_guide">
      <span class="global-record-choice-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M12 4v4"/><path d="M6.3 6.3 9 9"/><path d="M17.7 6.3 15 9"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="M9 17h6"/><path d="M10 21h4"/></svg></span>
      <span>ガイド</span>
    </a>
  </nav>
  <div class="global-record-camera-backdrop" data-global-record-camera-close hidden></div>
  <section class="global-record-camera-sheet" data-global-record-camera-sheet hidden aria-label="撮影して記録する">
    <div class="global-record-camera-head">
      <div>
        <strong data-global-record-camera-title>撮影して記録</strong>
        <p data-global-record-camera-help>主役を1つ決めて、周囲の様子も手がかりとして残せます。</p>
      </div>
      <button type="button" class="global-record-camera-close" data-global-record-camera-close aria-label="閉じる">×</button>
    </div>
    <div class="global-record-camera-preview">
      <video data-global-record-camera-video playsinline muted></video>
      <img data-global-record-camera-image alt="撮影プレビュー" hidden />
      <div class="global-record-camera-empty" data-global-record-camera-empty>カメラを起動すると、ここにプレビューが出ます。</div>
    </div>
    <div class="global-record-photo-tray" data-global-record-photo-tray hidden>
      <div class="global-record-photo-tray-head">
        <strong data-global-record-photo-tray-count>写真0枚</strong>
        <span>最大6枚まで同じ観察にまとめます</span>
      </div>
      <div class="global-record-photo-grid" data-global-record-photo-grid></div>
    </div>
    <div class="global-record-camera-actions" aria-label="撮影操作">
      <button type="button" class="global-record-camera-action is-primary" data-global-record-camera-start>カメラを起動</button>
      <button type="button" class="global-record-camera-action" data-global-record-camera-capture hidden>撮影する</button>
    </div>
    <div class="global-record-camera-status" data-global-record-camera-status aria-live="polite"></div>
    <div class="global-record-inline-edit" data-global-record-inline-edit hidden>
      <div class="global-record-inline-edit-head">
        <strong>ここで少し整える</strong>
        <span data-global-record-data-estimate>送信量を確認中</span>
      </div>
      <div class="global-record-media-meaning">
        <strong>主役と周囲</strong>
        <span>投稿では主役を1つ選べばOK。周囲に写る生きものや環境も、AIが手がかりとして見ます。</span>
      </div>
      <label>
        <span>このメディアの役割</span>
        <select data-global-record-edit-role>
          <option value="primary_subject">主役</option>
          <option value="context">周囲</option>
          <option value="sound_motion">音・動き</option>
          <option value="secondary_candidate">別対象候補</option>
        </select>
      </label>
      <label>
        <span>名前が分かれば</span>
        <input data-global-record-edit-name type="text" maxlength="120" placeholder="例: スズメ / セミ / 名前は不明" />
      </label>
      <label>
        <span>メモ</span>
        <textarea data-global-record-edit-note rows="2" maxlength="240" placeholder="例: 水辺の柵の近く。鳴き声が聞こえた。"></textarea>
      </label>
    </div>
    <div class="global-record-video-trim" data-global-record-video-trim hidden>
      <div class="global-record-video-trim-head">
        <strong>投稿する最大60秒を選ぶ</strong>
        <span data-global-record-video-trim-duration>0.0秒</span>
      </div>
      <div class="global-record-video-trim-controls">
        <label>
          <span>開始 <output data-global-record-video-trim-start-label>0.0秒</output></span>
          <input data-global-record-video-trim-start type="range" min="0" max="0" step="0.1" value="0" />
        </label>
        <label>
          <span>終了 <output data-global-record-video-trim-end-label>0.0秒</output></span>
          <input data-global-record-video-trim-end type="range" min="0" max="0" step="0.1" value="0" />
        </label>
      </div>
    </div>
  </section>`;
}

function globalRecordEntryScript(basePath: string): string {
  return `<script>
window.ikimonFacePrivacyAssetBase = ${JSON.stringify(withBasePath(basePath, "/assets/face-privacy"))};
${FACE_PRIVACY_CLIENT_SCRIPT}
(function () {
  const BASE_PATH = ${JSON.stringify(basePath.replace(/\/$/, ""))};
  const DB_NAME = 'ikimon-record-draft';
  const STORE_NAME = 'drafts';
  const DRAFT_KEY = 'latest';
  const MAX_PHOTO_DRAFT_FILES = 6;
  const PHOTO_UPLOAD_MAX_EDGE = 2560;
  const PHOTO_UPLOAD_JPEG_QUALITY = 0.88;
  const VIDEO_MAX_SECONDS = 60;
  let activeKind = '';
  let activeStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let discardRecording = false;
  let recordingStartedAt = 0;
  let recordingTimer = null;
  let directPostInFlight = false;
  let photoDraftRetryDetailId = '';
  let photoDraftRetryHasUploadedPhoto = false;
  let cameraStartInFlight = false;
  let cameraRequestId = 0;
  let capturedReviewFile = null;
  let capturedPhotoFiles = [];
  let capturedPhotoObjectUrls = [];
  let capturedReviewMeta = null;
  let reviewObjectUrl = '';
  let sheetVideoTrimState = null;
  const sheet = document.querySelector('[data-global-record-camera-sheet]');
  const backdrop = document.querySelector('[data-global-record-camera-close].global-record-camera-backdrop');
  const cameraVideo = document.querySelector('[data-global-record-camera-video]');
  const cameraImage = document.querySelector('[data-global-record-camera-image]');
  const empty = document.querySelector('[data-global-record-camera-empty]');
  const title = document.querySelector('[data-global-record-camera-title]');
  const help = document.querySelector('[data-global-record-camera-help]');
  const status = document.querySelector('[data-global-record-camera-status]');
  const photoTray = document.querySelector('[data-global-record-photo-tray]');
  const photoTrayCount = document.querySelector('[data-global-record-photo-tray-count]');
  const photoGrid = document.querySelector('[data-global-record-photo-grid]');
  const startButton = document.querySelector('[data-global-record-camera-start]');
  const captureButton = document.querySelector('[data-global-record-camera-capture]');
  const inlineEdit = document.querySelector('[data-global-record-inline-edit]');
  const editRoleInput = document.querySelector('[data-global-record-edit-role]');
  const editNameInput = document.querySelector('[data-global-record-edit-name]');
  const editNoteInput = document.querySelector('[data-global-record-edit-note]');
  const dataEstimate = document.querySelector('[data-global-record-data-estimate]');
  const trimWrap = document.querySelector('[data-global-record-video-trim]');
  const trimStart = document.querySelector('[data-global-record-video-trim-start]');
  const trimEnd = document.querySelector('[data-global-record-video-trim-end]');
  const trimStartLabel = document.querySelector('[data-global-record-video-trim-start-label]');
  const trimEndLabel = document.querySelector('[data-global-record-video-trim-end-label]');
  const trimDurationLabel = document.querySelector('[data-global-record-video-trim-duration]');
  const labels = {
    photo: {
      title: '写真を撮る',
      help: '主役を1つ決めて撮ります。周囲の様子も、あとでAIと人が見る手がかりになります。',
      start: 'カメラを起動',
      capture: '写真を撮る',
    },
    video: {
      title: '動画を撮る',
      help: '動画投稿は最大60秒です。主役の動きや鳴き声と、周囲の様子を一緒に残せます。',
      start: 'カメラを起動',
      capture: '録画開始',
    },
  };
  const apiPath = (path) => BASE_PATH + path;
  const openDraftDb = () => new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('indexeddb_unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
  });
  const saveDraft = async (draft) => {
    const db = await openDraftDb();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error || new Error('indexeddb_write_failed'));
      });
      if (window.ikimonAppOutbox && typeof window.ikimonAppOutbox.enqueue === 'function') {
        window.ikimonAppOutbox.enqueue({
          id: 'record:' + DRAFT_KEY,
          source: 'record',
          kind: 'draft',
          sourceId: DRAFT_KEY,
          status: 'queued',
          payloadMeta: {
            kind: draft && draft.kind || null,
            fileCount: draft && Array.isArray(draft.files) ? draft.files.length : (draft && draft.file ? 1 : 0),
            savedAt: draft && draft.savedAt || Date.now()
          }
        }).catch(() => undefined);
      }
    } finally {
      db.close();
    }
  };
  const setStatus = (message) => {
    if (status) status.textContent = message || '';
  };
  const formatDataSize = (bytes) => {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 MB';
    const mb = value / (1024 * 1024);
    if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
    return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + ' MB';
  };
  const formatEstimateMinutes = (bytes) => {
    const mb = Number(bytes) / (1024 * 1024);
    if (!Number.isFinite(mb) || mb <= 0) return '約0分';
    const minutes = mb / 10;
    if (minutes < 1) return '約' + Math.max(1, Math.round(minutes * 60)) + '秒';
    return '約' + (minutes >= 10 ? Math.round(minutes) : minutes.toFixed(1)) + '分';
  };
  const updateDataEstimate = (file, selectedSeconds) => {
    if (!dataEstimate) return;
    if (!file) {
      dataEstimate.textContent = '送信量を確認中';
      return;
    }
    let bytes = Array.isArray(file)
      ? file.reduce((sum, item) => sum + Number(item && item.size || 0), 0)
      : Number(file.size || 0);
    if (sheetVideoTrimState && Number.isFinite(selectedSeconds) && Number(sheetVideoTrimState.duration || 0) > 0) {
      bytes = bytes * Math.min(1, Number(selectedSeconds) / Number(sheetVideoTrimState.duration || 1));
    }
    dataEstimate.textContent = '送信目安 ' + formatDataSize(bytes) + ' / YouTube標準画質なら' + formatEstimateMinutes(bytes) + 'ぶん';
  };
  const readInlineEdit = () => ({
    mediaRole: editRoleInput ? String(editRoleInput.value || '').trim() : '',
    vernacularName: editNameInput ? String(editNameInput.value || '').trim() : '',
    localityNote: editNoteInput ? String(editNoteInput.value || '').trim() : '',
  });
  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
    reader.readAsDataURL(file);
  });
  const sha256Hex = async (value) => {
    if (!(window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined')) return '';
    const bytes = new TextEncoder().encode(String(value || ''));
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };
  const loadImageForUpload = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('photo_decode_failed'));
    };
    image.src = url;
  });
  const preparePhotoUpload = async (file) => {
    const originalType = String(file && file.type || 'image/jpeg').toLowerCase();
    if (originalType === 'image/gif') {
      return {
        filename: file.name || 'upload.gif',
        mimeType: originalType,
        base64Data: await readFileAsDataUrl(file),
      };
    }
    try {
      const image = await loadImageForUpload(file);
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('photo_decode_failed');
      const scale = Math.min(1, PHOTO_UPLOAD_MAX_EDGE / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('photo_canvas_unavailable');
      context.drawImage(image, 0, 0, targetWidth, targetHeight);
      const privacyResult = window.ikimonFacePrivacy && typeof window.ikimonFacePrivacy.redactCanvasFaces === 'function'
        ? await window.ikimonFacePrivacy.redactCanvasFaces(canvas)
        : { available: false, redacted: false, faceCount: 0, error: 'face_privacy_unavailable' };
      const base64Data = canvas.toDataURL('image/jpeg', PHOTO_UPLOAD_JPEG_QUALITY);
      const safeName = String(file.name || 'upload.jpg').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
      return {
        filename: safeName + '.jpg',
        mimeType: 'image/jpeg',
        base64Data,
        facePrivacy: window.ikimonFacePrivacy && typeof window.ikimonFacePrivacy.summarizeFacePrivacy === 'function'
          ? window.ikimonFacePrivacy.summarizeFacePrivacy(privacyResult)
          : null,
      };
    } catch (_) {
      return {
        filename: file.name || 'upload.jpg',
        mimeType: file.type || 'image/jpeg',
        base64Data: await readFileAsDataUrl(file),
      };
    }
  };
  const getCurrentSessionUserId = async () => {
    const response = await fetch(apiPath('/api/v1/auth/session'), {
      method: 'GET',
      headers: { accept: 'application/json' },
      credentials: 'include',
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json.ok || !json.session || !json.session.userId) {
      throw new Error('session_required');
    }
    return String(json.session.userId);
  };
  const withInlineEditParams = (href, kind) => {
    let target = String(href || '/record?start=' + encodeURIComponent(kind || 'gallery'));
    try {
      const url = new URL(target, window.location.origin);
      const values = readInlineEdit();
      url.searchParams.set('draft', '1');
      if (values.vernacularName) url.searchParams.set('vernacularName', values.vernacularName);
      if (values.localityNote) url.searchParams.set('localityNote', values.localityNote);
      return url.pathname + url.search + url.hash;
    } catch (_) {
      const separator = target.indexOf('?') >= 0 ? '&' : '?';
      return target + separator + 'draft=1';
    }
  };
  const stopRecordingTimer = () => {
    if (recordingTimer) window.clearInterval(recordingTimer);
    recordingTimer = null;
  };
  const formatVideoSeconds = (seconds) => {
    const value = Number(seconds);
    if (!Number.isFinite(value) || value < 0) return '0.0秒';
    return value.toFixed(1) + '秒';
  };
  const resetSheetVideoTrim = () => {
    sheetVideoTrimState = null;
    if (trimWrap) trimWrap.hidden = true;
    if (trimStart) {
      trimStart.max = '0';
      trimStart.value = '0';
    }
    if (trimEnd) {
      trimEnd.max = '0';
      trimEnd.value = '0';
    }
    if (trimStartLabel) trimStartLabel.textContent = '0.0秒';
    if (trimEndLabel) trimEndLabel.textContent = '0.0秒';
    if (trimDurationLabel) trimDurationLabel.textContent = '0.0秒';
  };
  const syncSheetVideoTrim = (changed) => {
    if (!sheetVideoTrimState || !trimStart || !trimEnd) return;
    const duration = Number(sheetVideoTrimState.duration || 0);
    let start = Number(trimStart.value);
    let end = Number(trimEnd.value);
    if (!Number.isFinite(start)) start = 0;
    if (!Number.isFinite(end)) end = Math.min(duration, VIDEO_MAX_SECONDS);
    start = Math.max(0, Math.min(start, Math.max(0, duration - 0.1)));
    end = Math.max(0.1, Math.min(end, duration));
    if (end <= start + 0.2) {
      if (changed === 'start') end = Math.min(duration, start + 0.2);
      else start = Math.max(0, end - 0.2);
    }
    if (end - start > VIDEO_MAX_SECONDS) {
      if (changed === 'start') end = Math.min(duration, start + VIDEO_MAX_SECONDS);
      else start = Math.max(0, end - VIDEO_MAX_SECONDS);
    }
    sheetVideoTrimState.start = start;
    sheetVideoTrimState.end = end;
    trimStart.value = String(start);
    trimEnd.value = String(end);
    if (trimStartLabel) trimStartLabel.textContent = formatVideoSeconds(start);
    if (trimEndLabel) trimEndLabel.textContent = formatVideoSeconds(end);
    if (trimDurationLabel) trimDurationLabel.textContent = formatVideoSeconds(end - start);
    if (cameraVideo && Math.abs(Number(cameraVideo.currentTime || 0) - start) > 0.4) {
      cameraVideo.currentTime = start;
    }
    updateDataEstimate(sheetVideoTrimState.sourceFile, end - start);
  };
  const setPhotoDraftLayout = (enabled) => {
    if (!sheet) return;
    if (enabled) sheet.setAttribute('data-photo-draft', 'true');
    else sheet.removeAttribute('data-photo-draft');
  };
  const setSheetKind = (kind) => {
    if (!sheet) return;
    if (kind) sheet.setAttribute('data-active-kind', kind);
    else sheet.removeAttribute('data-active-kind');
  };
  const setPrimaryAction = (button, enabled) => {
    if (!button) return;
    if (enabled) button.classList.add('is-primary');
    else button.classList.remove('is-primary');
  };
  const setFooterActionMode = (mode) => {
    if (mode === 'submit') {
      setPrimaryAction(startButton, false);
      setPrimaryAction(captureButton, true);
      return;
    }
    if (mode === 'capture') {
      setPrimaryAction(startButton, false);
      setPrimaryAction(captureButton, true);
      return;
    }
    setPrimaryAction(startButton, true);
    setPrimaryAction(captureButton, false);
  };
  const clearReview = () => {
    setPhotoDraftLayout(false);
    capturedReviewFile = null;
    capturedPhotoFiles = [];
    capturedPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    capturedPhotoObjectUrls = [];
    photoDraftRetryDetailId = '';
    photoDraftRetryHasUploadedPhoto = false;
    capturedReviewMeta = null;
    resetSheetVideoTrim();
    if (inlineEdit) inlineEdit.hidden = true;
    if (editRoleInput) editRoleInput.value = 'primary_subject';
    if (editNameInput) editNameInput.value = '';
    if (editNoteInput) editNoteInput.value = '';
    if (dataEstimate) dataEstimate.textContent = '送信量を確認中';
    if (photoTray) photoTray.hidden = true;
    if (photoGrid) photoGrid.innerHTML = '';
    if (photoTrayCount) photoTrayCount.textContent = '写真0枚';
    if (reviewObjectUrl) {
      URL.revokeObjectURL(reviewObjectUrl);
      reviewObjectUrl = '';
    }
    if (cameraImage) {
      cameraImage.hidden = true;
      cameraImage.removeAttribute('src');
    }
    if (cameraVideo) {
      cameraVideo.removeAttribute('src');
      cameraVideo.controls = false;
      cameraVideo.muted = true;
      cameraVideo.loop = false;
      cameraVideo.load();
    }
  };
  const stopActiveStream = () => {
    stopRecordingTimer();
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      discardRecording = true;
      try { mediaRecorder.stop(); } catch (_) {}
    }
    mediaRecorder = null;
    recordedChunks = [];
    if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
    activeStream = null;
    if (cameraVideo) {
      cameraVideo.pause();
      cameraVideo.srcObject = null;
    }
    if (empty) empty.hidden = false;
    if (captureButton) captureButton.hidden = true;
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
    }
  };
  const normalizeDraftFiles = (files) => (Array.isArray(files) ? files : [files]).filter((file) => file instanceof File);
  const selectedPhotoDraftFiles = () => capturedPhotoFiles.filter((file) => file instanceof File);
  const renderPhotoTray = () => {
    const files = selectedPhotoDraftFiles();
    if (photoTray) photoTray.hidden = files.length === 0;
    if (photoTrayCount) photoTrayCount.textContent = '写真' + String(files.length) + '枚';
    if (photoGrid) {
      photoGrid.innerHTML = '';
      files.forEach((file, index) => {
        const cell = document.createElement('div');
        cell.className = 'global-record-photo-cell';
        const img = document.createElement('img');
        const url = capturedPhotoObjectUrls[index] || URL.createObjectURL(file);
        capturedPhotoObjectUrls[index] = url;
        img.src = url;
        img.alt = '撮影写真 ' + String(index + 1);
        const badge = document.createElement('span');
        badge.textContent = String(index + 1);
        const controls = document.createElement('div');
        controls.className = 'global-record-photo-cell-actions';
        const left = document.createElement('button');
        left.type = 'button';
        left.textContent = '←';
        left.setAttribute('aria-label', '前へ移動');
        left.setAttribute('data-global-record-photo-move', String(index));
        left.setAttribute('data-direction', '-1');
        left.disabled = index === 0;
        const right = document.createElement('button');
        right.type = 'button';
        right.textContent = '→';
        right.setAttribute('aria-label', '後ろへ移動');
        right.setAttribute('data-global-record-photo-move', String(index));
        right.setAttribute('data-direction', '1');
        right.disabled = index === files.length - 1;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '×';
        remove.setAttribute('aria-label', '写真を外す');
        remove.setAttribute('data-global-record-photo-remove', String(index));
        controls.appendChild(left);
        controls.appendChild(right);
        controls.appendChild(remove);
        cell.appendChild(img);
        cell.appendChild(badge);
        cell.appendChild(controls);
        photoGrid.appendChild(cell);
      });
    }
    updateDataEstimate(files);
  };
  const syncPhotoDraftControls = (message) => {
    const files = selectedPhotoDraftFiles();
    const [primaryFile] = files;
    capturedReviewFile = primaryFile || null;
    renderPhotoTray();
    setPhotoDraftLayout(files.length > 0 && activeKind === 'photo' && !activeStream);
    if (inlineEdit) inlineEdit.hidden = files.length === 0;
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = files.length >= MAX_PHOTO_DRAFT_FILES;
      startButton.textContent = files.length >= MAX_PHOTO_DRAFT_FILES ? '最大6枚です' : (files.length > 0 ? 'もう1枚撮る' : 'カメラを起動');
    }
    if (captureButton) {
      captureButton.hidden = files.length === 0;
      captureButton.disabled = false;
      captureButton.textContent = files.length > 0 ? 'この' + String(files.length) + '枚を投稿' : '写真を撮る';
    }
    setFooterActionMode(files.length > 0 ? 'submit' : 'start');
    if (files.length === 0) {
      if (cameraImage) {
        cameraImage.hidden = true;
        cameraImage.removeAttribute('src');
      }
      if (empty) {
        empty.textContent = '写真を追加すると、ここにプレビューが出ます。';
        empty.hidden = false;
      }
      if (dataEstimate) dataEstimate.textContent = '送信量を確認中';
    }
    if (message) setStatus(message);
  };
  const movePhotoDraft = (index, direction) => {
    const from = Number(index);
    const to = from + Number(direction);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= capturedPhotoFiles.length || to >= capturedPhotoFiles.length) return;
    const [file] = capturedPhotoFiles.splice(from, 1);
    capturedPhotoFiles.splice(to, 0, file);
    const [url] = capturedPhotoObjectUrls.splice(from, 1);
    capturedPhotoObjectUrls.splice(to, 0, url);
    syncPhotoDraftControls('写真の順番を変更しました。AIは全体を見て主役と周囲を判断します。');
  };
  const removePhotoDraft = (index) => {
    const target = Number(index);
    if (!Number.isInteger(target) || target < 0 || target >= capturedPhotoFiles.length) return;
    capturedPhotoFiles.splice(target, 1);
    const [url] = capturedPhotoObjectUrls.splice(target, 1);
    if (url) URL.revokeObjectURL(url);
    if (capturedPhotoFiles.length === 0) {
      photoDraftRetryDetailId = '';
      photoDraftRetryHasUploadedPhoto = false;
    }
    syncPhotoDraftControls(capturedPhotoFiles.length > 0 ? '写真を外しました。' : '写真をすべて外しました。');
  };
  const keepOnlyPhotoDraftIndexes = (indexes) => {
    const keep = new Set(indexes.map((index) => Number(index)).filter((index) => Number.isInteger(index) && index >= 0));
    const nextFiles = [];
    const nextUrls = [];
    capturedPhotoFiles.forEach((file, index) => {
      const url = capturedPhotoObjectUrls[index] || '';
      if (keep.has(index)) {
        nextFiles.push(file);
        nextUrls.push(url);
      } else if (url) {
        URL.revokeObjectURL(url);
      }
    });
    capturedPhotoFiles = nextFiles;
    capturedPhotoObjectUrls = nextUrls;
    capturedReviewFile = nextFiles[0] || null;
  };
  const resetPhotoDraftAfterDirectPost = (message) => {
    capturedReviewFile = null;
    capturedPhotoFiles = [];
    capturedPhotoObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    capturedPhotoObjectUrls = [];
    photoDraftRetryDetailId = '';
    photoDraftRetryHasUploadedPhoto = false;
    capturedReviewMeta = null;
    renderPhotoTray();
    setPhotoDraftLayout(false);
    if (inlineEdit) inlineEdit.hidden = true;
    if (cameraImage) {
      cameraImage.hidden = true;
      cameraImage.removeAttribute('src');
    }
    if (cameraVideo) cameraVideo.hidden = true;
    if (empty) {
      empty.textContent = '続けて写真を撮れます。';
      empty.hidden = false;
    }
    if (dataEstimate) dataEstimate.textContent = '送信量を確認中';
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = '次の写真を撮る';
    }
    if (captureButton) {
      captureButton.hidden = true;
      captureButton.disabled = false;
      captureButton.textContent = '写真を撮る';
    }
    setFooterActionMode('start');
    setStatus(message);
  };
  const directPostPhotoDraft = async () => {
    if (directPostInFlight) return;
    const files = selectedPhotoDraftFiles();
    if (!files.length) return;
    directPostInFlight = true;
    if (captureButton) {
      captureButton.disabled = true;
      captureButton.textContent = '投稿中...';
    }
    if (startButton) startButton.disabled = true;
    const metadata = capturedReviewMeta || {};
    try {
      setStatus('写真を投稿用に整えています...');
      const uploads = [];
      const uploadHashes = [];
      for (let index = 0; index < files.length; index += 1) {
        const upload = await preparePhotoUpload(files[index]);
        const hash = await sha256Hex(upload.base64Data);
        uploads.push(upload);
        uploadHashes.push(hash || [upload.filename, upload.mimeType, String(files[index] && files[index].size || 0)].join(':'));
      }
      let detailId = photoDraftRetryDetailId;
      if (!detailId) {
        let location = metadata.location || null;
        if (!location) {
          setStatus('投稿に使う地点を確認しています...');
          location = await readCaptureLocation();
        }
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
          throw new Error('location_required');
        }
        const userId = await getCurrentSessionUserId();
        const observedAt = String(metadata.capturedAt || new Date().toISOString());
        const submissionSeed = [
          userId,
          observedAt,
          Number(location.latitude).toFixed(6),
          Number(location.longitude).toFixed(6),
          uploadHashes.join(','),
        ].join('|');
        const clientSubmissionId = 'global-photo:' + ((await sha256Hex(submissionSeed)) || String(Date.now()));
        const observationId = 'record-' + Date.now();
        setStatus('観察を保存しています...');
        const observationResponse = await fetch(apiPath('/api/v1/observations/upsert'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            observationId,
            legacyObservationId: observationId,
            clientSubmissionId,
            userId,
            observedAt,
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
            prefecture: 'Shizuoka',
            municipality: '',
            localityNote: '',
            note: '',
            visitMode: 'manual',
            completeChecklistFlag: false,
            sourcePayload: {
              source: 'global_photo_tray',
              record_mode: 'quick',
              quick_capture_state: 'present',
              media_count: files.length,
              subject_inference: 'ai',
              client_submission_id: clientSubmissionId,
              client_photo_sha256s: uploadHashes,
            },
            taxon: null,
          }),
        });
        const observationJson = await observationResponse.json().catch(() => ({}));
        if (!observationResponse.ok || !observationJson.ok) {
          throw new Error(observationJson.error || 'observation_upsert_failed');
        }
        detailId = String(observationJson.occurrenceId || observationId);
        photoDraftRetryDetailId = detailId;
      }
      const failedUploads = [];
      const uploadedIndexes = [];
      for (let index = 0; index < uploads.length; index += 1) {
        const upload = uploads[index];
        setStatus('写真を保存しています... ' + String(index + 1) + '/' + String(uploads.length));
        const photoResponse = await fetch(apiPath('/api/v1/observations/' + encodeURIComponent(detailId) + '/photos/upload'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            filename: upload.filename,
            mimeType: upload.mimeType,
            base64Data: upload.base64Data,
            mediaRole: !photoDraftRetryHasUploadedPhoto && uploadedIndexes.length === 0 ? 'primary_subject' : 'context',
            facePrivacy: upload.facePrivacy || null,
          }),
        });
        const photoJson = await photoResponse.json().catch(() => ({}));
        if (!photoResponse.ok || !photoJson.ok) {
          failedUploads.push({
            index,
            error: String(photoJson.error || photoResponse.status || 'photo_upload_failed'),
          });
          continue;
        }
        uploadedIndexes.push(index);
        photoDraftRetryHasUploadedPhoto = true;
      }
      if (failedUploads.length > 0) {
        keepOnlyPhotoDraftIndexes(failedUploads.map((item) => item.index));
        syncPhotoDraftControls();
        const saved = uploadedIndexes.length;
        const failed = failedUploads.length;
        const reason = failedUploads[0] && failedUploads[0].error ? ' 理由: ' + failedUploads[0].error : '';
        if (captureButton) captureButton.textContent = '失敗した' + String(failed) + '枚を再送';
        setStatus(String(uploads.length) + '枚中' + String(saved) + '枚を保存しました。失敗した写真は残しています。もう一度押すと同じ観察に再送します。' + reason);
        return;
      }
      resetPhotoDraftAfterDirectPost('投稿しました。AIが写真を見て主役と周囲を整理します。続けて撮れます。');
    } finally {
      directPostInFlight = false;
      if (startButton) startButton.disabled = false;
      if (captureButton && selectedPhotoDraftFiles().length > 0 && captureButton.textContent === '投稿中...') {
        captureButton.textContent = 'この' + String(selectedPhotoDraftFiles().length) + '枚を投稿';
      }
    }
  };
  const addPhotoDraftFiles = (files, metadata) => {
    const incoming = normalizeDraftFiles(files).filter((file) => file.type && file.type.indexOf('image/') === 0);
    if (!incoming.length) return;
    const available = Math.max(0, MAX_PHOTO_DRAFT_FILES - capturedPhotoFiles.length);
    const accepted = incoming.slice(0, available);
    capturedPhotoFiles = capturedPhotoFiles.concat(accepted);
    const [primaryFile] = capturedPhotoFiles;
    capturedReviewFile = primaryFile || null;
    if (!capturedReviewMeta && metadata) capturedReviewMeta = metadata;
    renderPhotoTray();
    if (reviewObjectUrl) {
      URL.revokeObjectURL(reviewObjectUrl);
      reviewObjectUrl = '';
    }
    if (cameraImage) {
      cameraImage.hidden = true;
      cameraImage.removeAttribute('src');
    }
    if (cameraVideo) cameraVideo.hidden = true;
    if (empty) empty.hidden = true;
    syncPhotoDraftControls();
    const dropped = incoming.length - accepted.length;
    setStatus((metadata && metadata.location ? '撮影地点も保存しました。' : '位置は投稿画面で指定できます。') + ' 写真' + String(capturedPhotoFiles.length) + '枚をまとめています。' + (dropped > 0 ? ' 上限を超えた分は外しました。' : ''));
  };
  const navigateWithDraft = async (files, kind, metadata) => {
    const target = document.querySelector('[data-global-record-trigger="' + kind + '"]');
    const href = target ? target.getAttribute('data-record-target') : '/record?start=' + encodeURIComponent(kind);
    const inlineValues = readInlineEdit();
    const draftFiles = normalizeDraftFiles(files);
    const metadataWithRole = Object.assign({}, metadata || {}, {
      mediaRole: inlineValues.mediaRole || (kind === 'video' ? 'sound_motion' : 'primary_subject'),
    });
    try {
      const [primaryDraftFile = null] = draftFiles;
      await saveDraft({ file: primaryDraftFile, files: draftFiles, kind, savedAt: Date.now(), metadata: metadataWithRole });
      window.location.href = withInlineEditParams(href || '/record', kind);
    } catch (_) {
      window.location.href = href || '/record?start=' + encodeURIComponent(kind);
    }
  };
  const clickFallbackInput = (kind) => {
    const input = document.querySelector('[data-global-record-input="' + kind + '"]');
    if (input && typeof input.click === 'function') input.click();
    else {
      const target = document.querySelector('[data-global-record-trigger="' + kind + '"]');
      window.location.href = (target && target.getAttribute('data-record-target')) || '/record';
    }
  };
  const closeSheet = () => {
    cameraRequestId += 1;
    cameraStartInFlight = false;
    stopActiveStream();
    clearReview();
    if (sheet) sheet.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.documentElement.classList.remove('global-record-camera-open');
    activeKind = '';
    setSheetKind('');
    setStatus('');
  };
  const openSheet = (kind, options) => {
    if (!(options && options.keepReview)) clearReview();
    activeKind = kind;
    setSheetKind(kind);
    setPhotoDraftLayout(kind === 'photo' && selectedPhotoDraftFiles().length > 0 && !activeStream);
    if (editRoleInput) editRoleInput.value = kind === 'video' ? 'sound_motion' : 'primary_subject';
    const label = labels[kind] || labels.photo;
    if (title) title.textContent = label.title;
    if (help) help.textContent = label.help;
    if (startButton) {
      startButton.textContent = label.start;
      startButton.hidden = false;
    }
    if (captureButton) {
      captureButton.textContent = label.capture;
      captureButton.hidden = true;
    }
    setFooterActionMode('start');
    if (empty) {
      empty.textContent = 'カメラを起動すると、ここにプレビューが出ます。';
      empty.hidden = false;
    }
    if (sheet) sheet.hidden = false;
    if (backdrop) backdrop.hidden = false;
    document.documentElement.classList.add('global-record-camera-open');
    setStatus(kind === 'photo' && options && options.reviewOnly ? '写真を確認しています。追加撮影してから投稿へ進めます。' : 'カメラを起動しています...');
    if (!(options && options.reviewOnly)) void startCamera();
  };
  const startCamera = async () => {
    if (!activeKind) return;
    if (cameraStartInFlight) return;
    setPhotoDraftLayout(false);
    if (!(activeKind === 'photo' && selectedPhotoDraftFiles().length > 0)) clearReview();
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      setStatus('このブラウザでは撮影を開始できません。ブラウザのカメラ許可を確認してください。');
      return;
    }
    const requestId = cameraRequestId + 1;
    cameraRequestId = requestId;
    cameraStartInFlight = true;
    if (startButton) {
      startButton.disabled = true;
      startButton.textContent = '起動中...';
    }
    try {
      stopActiveStream();
      if (startButton) {
        startButton.disabled = true;
        startButton.textContent = '起動中...';
      }
      if (cameraVideo) cameraVideo.hidden = false;
      if (cameraImage) cameraImage.hidden = true;
      const constraints = {
        video: { facingMode: { ideal: 'environment' } },
        audio: activeKind === 'video',
      };
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (requestId !== cameraRequestId || !activeKind || (sheet && sheet.hidden)) {
        activeStream.getTracks().forEach((track) => track.stop());
        activeStream = null;
        return;
      }
      if (cameraVideo) {
        cameraVideo.srcObject = activeStream;
        cameraVideo.muted = true;
        cameraVideo.playsInline = true;
        await cameraVideo.play().catch(() => undefined);
      }
      if (empty) empty.hidden = true;
      if (captureButton) {
        captureButton.hidden = false;
        captureButton.textContent = activeKind === 'video' ? '録画開始' : '写真を撮る';
      }
      if (startButton) startButton.hidden = true;
      setFooterActionMode('capture');
      setStatus(activeKind === 'video' ? '動画投稿は最大60秒。録画後に見せたい区間を選べます。' : '構図を確認してから撮影できます。');
    } catch (_) {
      setStatus('カメラを起動できませんでした。ブラウザのカメラ許可を確認してください。');
      if (startButton) {
        startButton.hidden = false;
        startButton.disabled = false;
        startButton.textContent = (labels[activeKind] || labels.photo).start;
      }
      setFooterActionMode('start');
    } finally {
      if (requestId === cameraRequestId) cameraStartInFlight = false;
    }
  };
  const readCaptureLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date().toISOString(),
      }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 7000 },
    );
  });
  const buildCaptureMetadata = async () => {
    const capturedAt = new Date().toISOString();
    setStatus('撮影地点を確認しています...');
    const location = await readCaptureLocation();
    return { capturedAt, location };
  };
  const prepareSheetVideoTrim = (file) => {
    resetSheetVideoTrim();
    if (!file || !trimWrap || !trimStart || !trimEnd || !cameraVideo) return;
    const setup = () => {
      const duration = Number(cameraVideo.duration || 0);
      if (!Number.isFinite(duration) || duration <= 0) return;
      sheetVideoTrimState = { sourceFile: file, duration, start: 0, end: Math.min(duration, VIDEO_MAX_SECONDS) };
      trimStart.max = String(duration);
      trimEnd.max = String(duration);
      trimStart.value = '0';
      trimEnd.value = String(Math.min(duration, VIDEO_MAX_SECONDS));
      trimWrap.hidden = false;
      syncSheetVideoTrim();
    };
    if (cameraVideo.readyState >= 1) setup();
    else cameraVideo.addEventListener('loadedmetadata', setup, { once: true });
  };
  const createSheetTrimmedVideoFile = () => new Promise((resolve, reject) => {
    if (!sheetVideoTrimState || !sheetVideoTrimState.sourceFile) {
      reject(new Error('video_trim_source_missing'));
      return;
    }
    const start = Number(sheetVideoTrimState.start || 0);
    const end = Number(sheetVideoTrimState.end || 0);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > VIDEO_MAX_SECONDS + 0.5) {
      reject(new Error('video_trim_range_invalid'));
      return;
    }
    const sourceFile = sheetVideoTrimState.sourceFile;
    const sourceUrl = URL.createObjectURL(sourceFile);
    const sourceVideo = document.createElement('video');
    const cleanup = () => {
      URL.revokeObjectURL(sourceUrl);
      sourceVideo.pause();
      sourceVideo.removeAttribute('src');
      sourceVideo.load();
    };
    const captureStream = () => {
      const capture = sourceVideo.captureStream || sourceVideo.mozCaptureStream;
      return capture ? capture.call(sourceVideo) : null;
    };
    sourceVideo.preload = 'auto';
    sourceVideo.playsInline = true;
    sourceVideo.src = sourceUrl;
    sourceVideo.onerror = () => {
      cleanup();
      reject(new Error('video_trim_failed'));
    };
    sourceVideo.onloadedmetadata = async () => {
      try {
        sourceVideo.currentTime = start;
        await new Promise((seekResolve, seekReject) => {
          if (Math.abs(Number(sourceVideo.currentTime || 0) - start) < 0.05) {
            seekResolve(true);
            return;
          }
          const timer = window.setTimeout(() => seekReject(new Error('video_trim_seek_failed')), 8000);
          sourceVideo.onseeked = () => {
            window.clearTimeout(timer);
            seekResolve(true);
          };
        });
        const stream = captureStream();
        if (!stream || typeof MediaRecorder === 'undefined') {
          cleanup();
          reject(new Error('video_trim_unsupported'));
          return;
        }
        const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')
            ? 'video/webm'
            : '';
        const chunks = [];
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        let settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          stream.getTracks().forEach((track) => track.stop());
          cleanup();
          if (error) {
            reject(error);
            return;
          }
          const type = chunks[0] ? chunks[0].type || 'video/webm' : 'video/webm';
          const blob = new Blob(chunks, { type });
          resolve(new File([blob], 'ikimon-video-trim-' + Date.now() + '.webm', { type, lastModified: Date.now() }));
        };
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => finish(new Error('video_trim_failed'));
        recorder.onstop = () => finish(null);
        recorder.start(1000);
        await sourceVideo.play();
        const safetyTimer = window.setTimeout(() => {
          if (recorder.state === 'recording') recorder.stop();
        }, Math.ceil((end - start + 2) * 1000));
        const timer = window.setInterval(() => {
          if (sourceVideo.currentTime >= end || sourceVideo.ended) {
            window.clearInterval(timer);
            window.clearTimeout(safetyTimer);
            if (recorder.state === 'recording') recorder.stop();
          }
        }, 100);
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error('video_trim_failed'));
      }
    };
  });
  const buildVideoDraftFromSheet = async () => {
    if (!capturedReviewFile || !sheetVideoTrimState) return capturedReviewFile;
    const duration = Number(sheetVideoTrimState.duration || 0);
    const start = Number(sheetVideoTrimState.start || 0);
    const end = Number(sheetVideoTrimState.end || 0);
    const needsClip = duration > VIDEO_MAX_SECONDS + 0.5 || start > 0.15 || end < duration - 0.15;
    if (!needsClip) return capturedReviewFile;
    setStatus('選んだ最大60秒の動画を作成中です...');
    return await createSheetTrimmedVideoFile();
  };
  const showCapturedReview = (file, kind, metadata) => {
    stopActiveStream();
    if (kind === 'photo') {
      if (cameraImage) {
        const latestUrl = URL.createObjectURL(file);
        if (reviewObjectUrl) URL.revokeObjectURL(reviewObjectUrl);
        reviewObjectUrl = latestUrl;
        cameraImage.src = latestUrl;
        cameraImage.hidden = false;
      }
      if (cameraVideo) cameraVideo.hidden = true;
      if (empty) empty.hidden = true;
      if (!capturedReviewMeta && metadata) capturedReviewMeta = metadata || {};
      addPhotoDraftFiles([file], metadata);
      return;
    }
    capturedReviewFile = file;
    capturedReviewMeta = metadata || {};
    reviewObjectUrl = URL.createObjectURL(file);
    if (empty) empty.hidden = true;
    if (kind === 'video') {
      if (cameraImage) cameraImage.hidden = true;
      if (cameraVideo) {
        cameraVideo.srcObject = null;
        cameraVideo.src = reviewObjectUrl;
        cameraVideo.controls = true;
        cameraVideo.muted = true;
        cameraVideo.loop = true;
        cameraVideo.play().catch(() => undefined);
      }
      prepareSheetVideoTrim(file);
      setStatus(metadata && metadata.location ? '撮影地点も保存しました。下で区間、名前、メモを整えられます。' : '下で区間、名前、メモを整えられます。位置は投稿画面で指定できます。');
      if (captureButton) captureButton.textContent = 'この内容で投稿画面へ';
    } else {
      if (cameraVideo) cameraVideo.hidden = true;
      if (cameraImage) {
        cameraImage.src = reviewObjectUrl;
        cameraImage.hidden = false;
      }
      updateDataEstimate(file);
      setStatus(metadata && metadata.location ? '撮影地点も保存しました。名前とメモをここで整えられます。' : '名前とメモをここで整えられます。位置は投稿画面で指定できます。');
      if (captureButton) captureButton.textContent = 'この内容で投稿画面へ';
    }
    if (inlineEdit) inlineEdit.hidden = false;
    if (startButton) {
      startButton.hidden = false;
      startButton.disabled = false;
      startButton.textContent = '撮り直す';
    }
    if (captureButton) {
      captureButton.hidden = false;
      captureButton.disabled = false;
    }
    setFooterActionMode('submit');
  };
  const retakeCapture = () => {
    const kind = activeKind || (capturedReviewFile && capturedReviewFile.type && capturedReviewFile.type.indexOf('video/') === 0 ? 'video' : 'photo');
    if (kind !== 'photo') clearReview();
    activeKind = kind;
    if (cameraVideo) cameraVideo.hidden = false;
    startCamera();
  };
  const capturePhoto = () => {
    if (!cameraVideo || !activeStream) return;
    const width = cameraVideo.videoWidth || 1280;
    const height = cameraVideo.videoHeight || 960;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(cameraVideo, 0, 0, width, height);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setStatus('写真を保存できませんでした。');
        return;
      }
      const file = new File([blob], 'ikimon-photo-' + Date.now() + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
      stopActiveStream();
      const metadata = await buildCaptureMetadata();
      showCapturedReview(file, 'photo', metadata);
    }, 'image/jpeg', 0.9);
  };
  const stopVideoRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      discardRecording = false;
      mediaRecorder.stop();
      if (captureButton) captureButton.disabled = true;
    }
  };
  const startVideoRecording = () => {
    if (!activeStream || typeof MediaRecorder === 'undefined') {
      setStatus('このブラウザでは録画を開始できません。ブラウザのカメラ許可を確認してください。');
      return;
    }
    const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';
    recordedChunks = [];
    discardRecording = false;
    mediaRecorder = new MediaRecorder(activeStream, mimeType ? { mimeType } : undefined);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.onstop = async () => {
      stopRecordingTimer();
      if (discardRecording) {
        discardRecording = false;
        return;
      }
      const type = recordedChunks[0] ? recordedChunks[0].type || 'video/webm' : 'video/webm';
      const blob = new Blob(recordedChunks, { type });
      const file = new File([blob], 'ikimon-video-' + Date.now() + '.webm', { type, lastModified: Date.now() });
      if (captureButton) {
        captureButton.disabled = false;
        captureButton.textContent = '録画開始';
      }
      stopActiveStream();
      const metadata = await buildCaptureMetadata();
      showCapturedReview(file, 'video', metadata);
    };
    recordingStartedAt = Date.now();
    mediaRecorder.start(1000);
    if (captureButton) captureButton.textContent = '録画停止';
    setFooterActionMode('capture');
    setStatus('録画中 0秒 / 投稿は最大60秒。あとで区間を選べます');
    recordingTimer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAt) / 1000);
      setStatus('録画中 ' + String(elapsed) + '秒 / 投稿は最大60秒。あとで区間を選べます');
    }, 500);
  };
  const captureFromSheet = async () => {
    if (activeKind === 'photo' && activeStream) {
      capturePhoto();
      return;
    }
    if (activeKind === 'photo' && selectedPhotoDraftFiles().length > 0 && !activeStream) {
      if (directPostInFlight) return;
      if (captureButton) captureButton.disabled = true;
      try {
        await directPostPhotoDraft();
      } catch (error) {
        if (captureButton) captureButton.disabled = false;
        const message = error && error.message ? String(error.message) : '';
        if (message === 'session_required') setStatus('投稿するにはログインが必要です。ログイン後にもう一度試してください。');
        else if (message === 'location_required') setStatus('直接投稿には地点が必要です。位置情報を許可してからもう一度試してください。');
        else if (message.startsWith('photo_upload_failed_at_')) setStatus('写真の保存に失敗しました。通信状態を確認してもう一度試してください。');
        else setStatus('投稿に失敗しました。通信状態を確認してもう一度試してください。');
      }
      return;
    }
    if (capturedReviewFile) {
      if (captureButton) captureButton.disabled = true;
      try {
        const file = activeKind === 'video' ? await buildVideoDraftFromSheet() : capturedReviewFile;
        await navigateWithDraft(file, activeKind || 'photo', capturedReviewMeta || {});
      } catch (error) {
        if (captureButton) captureButton.disabled = false;
        const message = error && error.message ? String(error.message) : '';
        setStatus(message === 'video_trim_unsupported'
          ? 'このブラウザではシート内カットに対応していません。60秒以内で撮り直すか、編集画面で選んでください。'
          : '動画のカットに失敗しました。区間を変えるか、撮り直してください。');
      }
      return;
    }
    if (activeKind === 'video') {
      if (mediaRecorder && mediaRecorder.state === 'recording') stopVideoRecording();
      else startVideoRecording();
      return;
    }
    capturePhoto();
  };
  document.querySelectorAll('[data-global-record-trigger]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.getAttribute('data-global-record-trigger') || 'gallery';
      if (kind === 'gallery') clickFallbackInput(kind);
      else openSheet(kind);
    });
  });
  document.querySelectorAll('[data-global-record-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const files = input.files ? Array.from(input.files) : [];
      const kind = input.getAttribute('data-global-record-input') || 'gallery';
      if (!files.length) return;
      if (kind === 'photo') {
        openSheet('photo', { reviewOnly: true, keepReview: true });
        const metadata = await buildCaptureMetadata();
        addPhotoDraftFiles(files, metadata);
        input.value = '';
        return;
      }
      await navigateWithDraft(files, kind);
    });
  });
  document.querySelectorAll('[data-global-record-camera-close]').forEach((button) => {
    button.addEventListener('click', closeSheet);
  });
  if (startButton) startButton.addEventListener('click', () => {
    if (capturedReviewFile) retakeCapture();
    else startCamera();
  });
  if (captureButton) captureButton.addEventListener('click', captureFromSheet);
  if (photoGrid) {
    photoGrid.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const removeIndex = target.getAttribute('data-global-record-photo-remove');
      if (removeIndex !== null) {
        removePhotoDraft(removeIndex);
        return;
      }
      const moveIndex = target.getAttribute('data-global-record-photo-move');
      if (moveIndex !== null) {
        movePhotoDraft(moveIndex, target.getAttribute('data-direction') || '0');
      }
    });
  }
  if (trimStart) trimStart.addEventListener('input', () => syncSheetVideoTrim('start'));
  if (trimEnd) trimEnd.addEventListener('input', () => syncSheetVideoTrim('end'));
  if (cameraVideo) {
    cameraVideo.addEventListener('timeupdate', () => {
      if (!sheetVideoTrimState || activeKind !== 'video' || !capturedReviewFile) return;
      const end = Number(sheetVideoTrimState.end || 0);
      if (Number(cameraVideo.currentTime || 0) > end) {
        cameraVideo.pause();
        cameraVideo.currentTime = Number(sheetVideoTrimState.start || 0);
      }
    });
  }
})();
</script>`;
}

function authNavHydrationScript(basePath: string, lang: SiteLang): string {
  const sessionEndpoint = withBasePath(basePath, "/api/v1/auth/session");
  const profileHref = appendLangToHref(withBasePath(basePath, "/profile"), lang);
  return `<script>
(function () {
  const endpoint = ${JSON.stringify(sessionEndpoint)};
  const profileHref = ${JSON.stringify(profileHref)};
  const applySignedInState = (session) => {
    if (!session || !session.userId) return;
    document.documentElement.dataset.auth = 'signed-in';
    document.querySelectorAll('.site-login-link').forEach((link) => {
      link.textContent = 'マイページ';
      link.setAttribute('href', profileHref);
      link.setAttribute('aria-label', (session.displayName || 'マイページ') + ' のマイページ');
      link.classList.add('is-authenticated');
    });
  };
  fetch(endpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    credentials: 'same-origin'
  })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => applySignedInState(payload && payload.ok ? payload.session : null))
    .catch(() => undefined);
})();
</script>`;
}

const PUBLIC_ORIGIN = "https://ikimon.life";

function stripFragment(path: string): string {
  const hashIndex = path.indexOf("#");
  return hashIndex >= 0 ? path.slice(0, hashIndex) : path;
}

function absolutePublicUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const rooted = path.startsWith("/") ? path : `/${path}`;
  return `${PUBLIC_ORIGIN}${rooted}`;
}

function ogLocale(lang: SiteLang): string {
  const map: Record<SiteLang, string> = {
    ja: "ja_JP",
    en: "en_US",
    es: "es_ES",
    "pt-BR": "pt_BR",
  };
  return map[lang];
}

export function renderSiteDocument(options: SiteShellOptions): string {
  const lang = options.lang ?? "ja";
  const currentPath = options.currentPath ?? withBasePath(options.basePath, "/");
  const alternateLangs = options.alternateLangs?.length ? options.alternateLangs : supportedLanguages.map((language) => language.code);
  const description = options.description ?? options.hero?.lead ?? options.footerNote ?? shellCopyFor(lang).brandTagline;
  const canonicalPath = stripFragment(options.canonicalPath ?? appendLangToHref(currentPath, lang));
  const canonicalUrl = absolutePublicUrl(canonicalPath);
  const alternateLinks = alternateLangs
    .map((alternateLang) => {
      const href = absolutePublicUrl(stripFragment(appendLangToHref(canonicalPath, alternateLang)));
      return `  <link rel="alternate" hreflang="${escapeHtml(alternateLang)}" href="${escapeHtml(href)}" />`;
    })
    .join("\n");
  const xDefaultHref = absolutePublicUrl(stripFragment(appendLangToHref(canonicalPath, "ja")));
  const robotsMeta = options.noindex ? `\n  <meta name="robots" content="noindex,follow" />` : "";
  const uiKpiEndpoint = withBasePath(options.basePath, "/api/v1/ui-kpi/events");
  const skipLabel = shellCopyFor(lang).skipToContent;
  const globalRecordNav = globalRecordEntry(options.basePath, lang, currentPath);
  const installCopy = appInstallCopy[lang];
  const manifestHref = `/manifest.webmanifest?lang=${encodeURIComponent(lang)}`;
  const installPromptHtml = `<div class="app-install-prompt" data-app-install-prompt hidden>
    <div class="app-install-prompt-copy">
      <strong>${escapeHtml(installCopy.installTitle)}</strong>
      <span>${escapeHtml(installCopy.installBody)}</span>
    </div>
    <div class="app-install-prompt-actions">
      <button type="button" class="app-install-primary" data-app-install-action>${escapeHtml(installCopy.installAction)}</button>
      <button type="button" class="app-install-dismiss" data-app-install-dismiss aria-label="${escapeHtml(installCopy.dismissAction)}">${escapeHtml(installCopy.dismissAction)}</button>
    </div>
  </div>`;
  const siteShellClassName = `site-shell${globalRecordNav ? " has-global-record-launcher" : ""}${isReadingSurface(currentPath) ? " is-reading-surface" : ""}`;
  const appOutboxHeadScript = `<script>
(function () {
  if (window.ikimonAppOutbox) return;
  const DB_NAME = 'ikimon-app-outbox-v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'items';
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('indexeddb_unavailable'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('source', 'source', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('app_outbox_open_failed'));
    });
  }
  function emitChange(detail) {
    try { window.dispatchEvent(new CustomEvent('ikimon-app-outbox-change', { detail })); } catch (_) {}
  }
  async function put(input) {
    const now = Date.now();
    const id = String(input && input.id || (String(input && input.source || 'app') + ':' + now));
    const item = {
      id,
      source: String(input && input.source || 'app'),
      kind: String(input && input.kind || 'item'),
      sourceId: String(input && input.sourceId || id),
      route: String(input && input.route || location.pathname + location.search),
      status: String(input && input.status || 'queued'),
      attempts: Number(input && input.attempts || 0),
      payloadMeta: input && input.payloadMeta ? input.payloadMeta : null,
      createdAt: Number(input && input.createdAt || now),
      updatedAt: now
    };
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('app_outbox_put_failed'));
      });
      emitChange({ action: 'put', item });
      return item;
    } finally {
      db.close();
    }
  }
  async function remove(id) {
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(String(id));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error || new Error('app_outbox_delete_failed'));
      });
      emitChange({ action: 'delete', id: String(id) });
    } finally {
      db.close();
    }
  }
  async function all() {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
        req.onerror = () => reject(req.error || new Error('app_outbox_read_failed'));
      });
    } finally {
      db.close();
    }
  }
  async function count() {
    return (await all()).length;
  }
  window.ikimonAppOutbox = { put, enqueue: put, delete: remove, remove, all, count };
})();
</script>`;
  const legacyServiceWorkerCleanupScript = `<script>
(function () {
  if (!('serviceWorker' in navigator)) return;
  const legacyCachePrefixes = ['ikimon-pwa-', 'ikimon-offline-', 'ikimon-static-'];
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => {
        const scriptUrl = registration.active && registration.active.scriptURL ? registration.active.scriptURL : '';
        if (scriptUrl && !/\\/sw\\.(php|js)(?:$|[?#])/.test(scriptUrl)) return Promise.resolve(false);
        return registration.unregister();
      })))
      .then(() => {
        if (!('caches' in window)) return undefined;
        return caches.keys().then((keys) => Promise.all(keys
          .filter((key) => legacyCachePrefixes.some((prefix) => key.startsWith(prefix)))
          .map((key) => caches.delete(key))));
      })
      .catch(() => undefined);
  }, { once: true });
})();
</script>`;
  const appRuntimeScript = `<script>
(function () {
  const currentLang = ${JSON.stringify(lang)};
  const supported = { ja: 'ja', en: 'en', es: 'es', pt: 'pt-BR', 'pt-br': 'pt-BR' };
  const storageKeys = {
    lang: 'ikimon:app-lang',
    localeRedirect: 'ikimon:locale-redirect-v1',
    installDismissed: 'ikimon:install-dismissed-v1'
  };
  function normalizeLocale(locale) {
    const value = String(locale || '').trim().toLowerCase();
    if (!value) return 'ja';
    if (value === 'pt' || value.indexOf('pt-') === 0) return 'pt-BR';
    if (value.indexOf('en') === 0) return 'en';
    if (value.indexOf('es') === 0) return 'es';
    return 'ja';
  }
  function segmentFor(lang) {
    return lang === 'pt-BR' ? 'pt-br' : lang;
  }
  function isLanguagePrefixed(pathname) {
    return /^\\/(ja|en|es|pt-br)(?:\\/|$)/.test(pathname);
  }
  try {
    const deviceLang = normalizeLocale((navigator.languages && navigator.languages[0]) || navigator.language || '');
    document.documentElement.dataset.deviceLang = deviceLang;
    if (isLanguagePrefixed(location.pathname)) {
      localStorage.setItem(storageKeys.lang, currentLang);
    } else if (!localStorage.getItem(storageKeys.lang)) {
      localStorage.setItem(storageKeys.lang, deviceLang);
    }
    const explicitLang = new URLSearchParams(location.search).has('lang');
    const alreadyRedirected = sessionStorage.getItem(storageKeys.localeRedirect) === '1';
    if (!explicitLang && !alreadyRedirected && location.pathname === '/' && deviceLang !== 'ja') {
      sessionStorage.setItem(storageKeys.localeRedirect, '1');
      location.replace('/' + segmentFor(deviceLang) + '/' + (location.search ? location.search + '&source=device_locale' : '?source=device_locale'));
      return;
    }
  } catch (_) {}

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/app-sw.js', { scope: '/' }).catch(() => undefined);
      requestAppOutboxSync('startup');
    }, { once: true });
  }

  function dispatchAppOutboxSync(reason) {
    try {
      window.dispatchEvent(new CustomEvent('ikimon-app-outbox-sync', { detail: { reason: reason || 'manual' } }));
    } catch (_) {
      window.dispatchEvent(new Event('ikimon-app-outbox-sync'));
    }
  }
  function requestAppOutboxSync(reason) {
    if (!navigator.onLine) return Promise.resolve(false);
    if (!('serviceWorker' in navigator)) {
      dispatchAppOutboxSync(reason || 'fallback');
      return Promise.resolve(false);
    }
    return navigator.serviceWorker.ready.then((registration) => {
      if (registration && 'sync' in registration && registration.sync && typeof registration.sync.register === 'function') {
        return registration.sync.register('ikimon-app-outbox-sync').then(() => true);
      }
      dispatchAppOutboxSync(reason || 'startup-fallback');
      return false;
    }).catch(() => {
      dispatchAppOutboxSync(reason || 'startup-fallback');
      return false;
    });
  }
  window.ikimonRequestAppOutboxSync = requestAppOutboxSync;
  window.addEventListener('online', () => {
    void requestAppOutboxSync('online');
  });
  window.addEventListener('ikimon-app-outbox-change', () => {
    void requestAppOutboxSync('outbox-change');
  });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'ikimon:app-outbox-sync') {
        dispatchAppOutboxSync(event.data.reason || 'background-sync');
      }
    });
  }

  const promptEl = document.querySelector('[data-app-install-prompt]');
  const actionEl = document.querySelector('[data-app-install-action]');
  const dismissEl = document.querySelector('[data-app-install-dismiss]');
  let deferredPrompt = null;
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function showInstallPrompt() {
    if (!promptEl || isStandalone()) return;
    try {
      if (localStorage.getItem(storageKeys.installDismissed) === '1') return;
    } catch (_) {}
    promptEl.hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallPrompt();
  });
  if (dismissEl) dismissEl.addEventListener('click', () => {
    if (promptEl) promptEl.hidden = true;
    try { localStorage.setItem(storageKeys.installDismissed, '1'); } catch (_) {}
  });
  if (actionEl) actionEl.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch (_) {}
    deferredPrompt = null;
    if (promptEl) promptEl.hidden = true;
  });
})();
</script>`;
  const uiKpiScript = `<script>
(function () {
  const endpoint = ${JSON.stringify(uiKpiEndpoint)};
  const pagePath = location.pathname + location.search;
  let sent = false;
  try {
    const key = 'ikimon:v2:first_action:' + pagePath;
    if (sessionStorage.getItem(key) === '1') {
      sent = true;
    }
    const send = (actionKey, routeKey) => {
      if (sent) return;
      sent = true;
      try { sessionStorage.setItem(key, '1'); } catch (_) {}
      const payload = {
        eventName: 'first_action',
        pagePath,
        actionKey,
        routeKey,
        metadata: {
          lang: document.documentElement.lang || 'ja',
          ts: new Date().toISOString(),
        },
      };
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'same-origin',
      }).catch(() => undefined);
    };

    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      const tag = target.tagName.toLowerCase();
      const text = (target.textContent || '').trim().slice(0, 80);
      const href = tag === 'a' ? target.getAttribute('href') || '' : '';
      const routeKey = href && href.startsWith('/') ? href : '';
      const actionKey = target.getAttribute('data-kpi-action') || (text ? text : tag);
      send(actionKey, routeKey);
    }, { capture: true, passive: true });
  } catch (_) {}
})();
</script>`;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#10b981" />
  <meta name="application-name" content="ikimon.life" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="ikimon" />
  <link rel="manifest" href="${escapeHtml(manifestHref)}" />
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png" />
  <link rel="icon" type="image/png" sizes="192x192" href="/assets/img/icon-192.png" />
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${robotsMeta}
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
${alternateLinks}
  <link rel="alternate" hreflang="x-default" href="${escapeHtml(xDefaultHref)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="ikimon.life" />
  <meta property="og:locale" content="${escapeHtml(ogLocale(lang))}" />
  <meta property="og:title" content="${escapeHtml(options.title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${escapeHtml(options.title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${appOutboxHeadScript}
  <style>
    :root {
      color-scheme: light;
      --bg: #f9fffe;
      --surface: rgba(255,255,255,.92);
      --surface-strong: #ffffff;
      --border: rgba(0,0,0,.06);
      --ink: #1a2e1f;
      --muted: #64748b;
      --hero-a: #059669;
      --hero-b: #10b981;
      --hero-c: #0ea5e9;
      --accent: #10b981;
      --accent-hover: #059669;
      --accent-soft: #ecfdf5;
      --shadow: 0 18px 44px rgba(15, 23, 42, .07);
      --shadow-strong: 0 26px 64px rgba(15, 23, 42, .12);
      --color-warn: #ea580c;
      --color-warn-soft: rgba(234,88,12,.08);
      --color-danger: #dc2626;
      --color-danger-soft: rgba(220,38,38,.08);
      --color-novelty: #a855f7;
      --color-novelty-soft: rgba(168,85,247,.08);
      --color-info: #3b82f6;
      --color-info-soft: rgba(59,130,246,.08);
      --radius-card: 14px;
      --radius-pill: 999px;
      --shadow-card: 0 8px 24px rgba(15,23,42,.06);
      --space-card: clamp(16px, 2vw, 24px);
    }
    .detail-card { background: var(--surface-strong); border: 1px solid var(--border); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-card); }
    .detail-card + .detail-card { margin-top: 14px; }
    .detail-card-title { margin: 0 0 8px; font-size: 16px; font-weight: 800; color: var(--ink); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .detail-card-body { color: var(--ink); line-height: 1.65; }
    .detail-card-meta { margin-top: 8px; color: var(--muted); font-size: 13px; }
    .detail-card-hedge { margin-top: 10px; padding: 8px 10px; border-radius: 10px; background: rgba(15,23,42,.04); color: var(--muted); font-size: 12.5px; }
    .detail-card--lens-size { border-left: 4px solid var(--color-info); }
    .detail-card--lens-novelty { border-left: 4px solid var(--color-novelty); background: linear-gradient(180deg, var(--color-novelty-soft), transparent 70%); }
    .detail-card--lens-invasive { border-left: 4px solid var(--color-danger); background: var(--color-danger-soft); }
    .detail-pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: var(--radius-pill); font-size: 12px; font-weight: 800; }
    .detail-pill--iaspecified { background: var(--color-danger); color: #fff; }
    .detail-pill--priority { background: var(--color-warn); color: #fff; }
    .detail-pill--industrial { background: #ca8a04; color: #fff; }
    .detail-pill--prevention { background: #6b7280; color: #fff; }
    .detail-pill--native { background: #16a34a; color: #fff; }
    .detail-pill--exceptional { background: var(--color-info); color: #fff; }
    .detail-pill--novelty { background: var(--color-novelty); color: #fff; }
    .detail-action-row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .detail-action-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: var(--radius-pill); border: 1px solid var(--border); background: var(--surface-strong); color: var(--ink); font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; }
    .detail-action-btn:hover { background: var(--accent-soft); }
    .detail-action-btn--danger { background: var(--color-danger); color: #fff; border-color: transparent; }
    .detail-action-btn--danger:hover { background: #b91c1c; }
    .detail-warning-box { margin-top: 10px; padding: 10px 12px; border-radius: 10px; background: rgba(220,38,38,.08); border: 1px solid rgba(220,38,38,.18); color: #7f1d1d; font-size: 13.5px; font-weight: 600; }
    .detail-evidence-list { margin: 6px 0 0; padding-left: 20px; }
    .detail-evidence-list li { margin: 4px 0; }
    .detail-evidence-list li.is-positive::marker { content: "\\2713  "; color: var(--accent); }
    .detail-evidence-list li.is-negative::marker { content: "\\2717  "; color: var(--color-warn); }
    /* 折りたたみ全面禁止の保険 (.detail-card 配下) */
    .detail-card details, .detail-card summary { display: revert; }
    .detail-card details { all: unset; }
    .detail-card summary { all: unset; }
    /* 同定パネル */
    .ident-panel { background: var(--surface-strong); border: 1px solid var(--border); border-radius: var(--radius-card); box-shadow: var(--shadow-card); padding: var(--space-card); }
    .ident-panel-header { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .ident-panel-name { margin: 0; font-size: 22px; font-weight: 900; color: var(--ink); }
    .ident-panel-sci { color: var(--muted); font-style: italic; font-size: 15px; }
    .ident-panel-band { display: inline-flex; align-items: center; padding: 4px 12px; border-radius: var(--radius-pill); font-size: 12.5px; font-weight: 800; background: var(--accent-soft); color: var(--accent-hover); }
    .ident-panel-band.is-low { background: rgba(234,88,12,.10); color: #9a3412; }
    .ident-panel-band.is-medium { background: rgba(59,130,246,.10); color: #1e3a8a; }
    .ident-panel-section { margin-top: 14px; }
    .ident-panel-section h4 { margin: 0 0 6px; font-size: 14px; font-weight: 800; color: var(--ink); }
    .ident-panel-similar { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
    .ident-panel-similar-card { padding: 10px 12px; border-radius: 10px; background: rgba(15,23,42,.03); border: 1px solid var(--border); font-size: 13.5px; }
    .ident-panel-similar-card strong { display: block; font-weight: 800; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", "Noto Sans JP", "Hiragino Sans", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.07), transparent 36%),
        radial-gradient(circle at top right, rgba(14,165,233,.05), transparent 30%),
        linear-gradient(180deg, #f9fffe 0%, var(--bg) 100%);
    }
    a { color: inherit; text-decoration: none; }
    .site-shell { min-height: 100vh; }
    .shell { max-width: 1140px; margin: 0 auto; padding: 28px 24px 24px; }
    .shell.shell-bleed {
      max-width: none;
      width: 100%;
      padding: 22px clamp(16px, 2.4vw, 36px) 24px;
    }
    .shell.shell-map {
      padding-top: 18px;
    }
    .md-hidden { display: none; }
    .site-header { position: sticky; top: 0; z-index: 20; backdrop-filter: blur(18px); background: rgba(249,255,254,.92); border-bottom: 1px solid rgba(15,23,42,.05); }
    .site-header-inner { max-width: 1240px; margin: 0 auto; padding: 10px 24px; display: flex; align-items: center; gap: 14px; justify-content: space-between; flex-wrap: nowrap; }
    .brand { display: inline-flex; align-items: center; gap: 10px; min-width: 0; max-width: 300px; flex: 1 1 260px; }
    .brand-mark { width: 38px; height: 38px; flex: 0 0 38px; aspect-ratio: 1 / 1; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 8px 18px rgba(15,23,42,.07); background: white; }
    .brand-mark img { width: 100%; height: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block; }
    .brand > span:last-child { min-width: 0; }
    .brand strong { display: block; font-size: 15px; font-weight: 900; }
    .brand small { display: block; max-width: 100%; margin-top: 2px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .site-nav { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; flex-wrap: nowrap; }
    .site-nav-link { display: inline-flex; align-items: center; min-height: 40px; padding: 9px 9px; border-radius: 999px; background: transparent; border: 0; font-weight: 750; font-size: 13.5px; color: #475569; white-space: nowrap; }
    .site-nav-link:hover { background: rgba(15,23,42,.04); }
    .site-nav-link.is-active { color: #047857; background: #ecfdf5; }
    .site-header-actions { display: flex; gap: 8px; flex: 0 0 auto; flex-wrap: nowrap; align-items: center; }
    .site-header-actions-mobile { display: none; }
    .site-login-link.is-authenticated { color: #047857; background: #ecfdf5; border-color: rgba(16,185,129,.18); }
    .site-record-link { white-space: nowrap; }
    .is-reading-surface .site-record-link { display: none; }
    .site-search {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 4px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.92);
      border: 1px solid rgba(148,163,184,.32);
      box-shadow: 0 5px 12px rgba(15,23,42,.035);
      flex: 1 1 170px;
      min-width: 150px;
      max-width: 280px;
    }
    .site-search-icon { font-size: 14px; opacity: .7; }
    .site-search-input {
      flex: 1 1 auto;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      padding: 4px 0;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
    }
    .site-search-input::placeholder { color: #94a3b8; }
    @media (max-width: 720px) { .site-search { flex: 1 1 100%; max-width: 100%; order: 3; } }
    .lang-switch {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,.88);
      border: 1px solid rgba(148,163,184,.24);
      box-shadow: 0 8px 20px rgba(15,23,42,.05);
    }
    .lang-switch-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 36px;
      min-height: 40px;
      padding: 0 9px;
      border-radius: 999px;
      color: #475569;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .04em;
    }
    .lang-switch-link.is-active {
      background: linear-gradient(135deg, rgba(16,185,129,.14), rgba(14,165,233,.14));
      color: #0f172a;
    }
    .site-mobile-menu { display: none; }
    .site-mobile-menu-toggle { list-style: none; }
    .site-mobile-menu-toggle::-webkit-details-marker { display: none; }
    .site-mobile-menu-toggle {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 40px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.28);
      background: rgba(255,255,255,.94);
      color: #0f172a;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 8px 18px rgba(15,23,42,.06);
    }
    .site-mobile-menu-icon,
    .site-mobile-menu-icon::before,
    .site-mobile-menu-icon::after {
      display: block;
      width: 14px;
      height: 2px;
      border-radius: 999px;
      background: currentColor;
      transition: transform .16s ease, opacity .16s ease;
    }
    .site-mobile-menu-icon { position: relative; }
    .site-mobile-menu-icon::before,
    .site-mobile-menu-icon::after {
      content: "";
      position: absolute;
      left: 0;
    }
    .site-mobile-menu-icon::before { top: -5px; }
    .site-mobile-menu-icon::after { top: 5px; }
    .site-mobile-menu[open] .site-mobile-menu-toggle {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }
    .site-mobile-menu[open] .site-mobile-menu-icon { transform: rotate(45deg); }
    .site-mobile-menu[open] .site-mobile-menu-icon::before {
      transform: rotate(90deg);
      top: 0;
    }
    .site-mobile-menu[open] .site-mobile-menu-icon::after { opacity: 0; }
    .site-mobile-menu-panel {
      position: absolute;
      top: calc(100% + 9px);
      right: 0;
      width: min(340px, calc(100vw - 28px));
      padding: 12px;
      border-radius: 20px;
      border: 1px solid rgba(148,163,184,.22);
      background: rgba(255,255,255,.98);
      box-shadow: 0 20px 42px rgba(15,23,42,.16);
      display: grid;
      gap: 12px;
    }
    .site-search-mobile {
      display: inline-flex;
      width: 100%;
      max-width: none;
      min-height: 42px;
      padding: 4px 12px;
    }
    .site-nav-mobile {
      display: grid;
      gap: 6px;
    }
    .site-nav-mobile .site-nav-link {
      justify-content: flex-start;
      width: 100%;
      min-height: 42px;
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(15,23,42,.04);
    }
    .site-mobile-menu-meta {
      display: flex;
      justify-content: flex-start;
    }
    .lang-switch-mobile {
      max-width: 100%;
      overflow-x: auto;
    }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; padding: 10px 15px; border-radius: 999px; font-weight: 850; border: 1px solid transparent; }
    .btn-solid { background: #059669; color: white; box-shadow: 0 9px 20px rgba(5,150,105,.18); }
    .btn-solid-on-light { background: #059669; color: white; box-shadow: 0 10px 22px rgba(5,150,105,.18); }
    .btn-ghost { background: rgba(255,255,255,.86); border-color: var(--border); color: var(--ink); }
    .btn-ghost-on-dark { background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.32); color: white; backdrop-filter: blur(4px); }
    .btn.secondary { background: rgba(255,255,255,.88); border-color: var(--border); color: var(--ink); }
    .skip-link {
      position: absolute;
      left: 12px;
      top: -48px;
      z-index: 100;
      padding: 10px 14px;
      border-radius: 10px;
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      transition: top .15s ease;
    }
    .skip-link:focus-visible { top: 10px; }
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    textarea:focus-visible,
    select:focus-visible,
    .btn:focus-visible,
    .site-nav-link:focus-visible,
    .lang-switch-link:focus-visible {
      outline: 3px solid #0284c7;
      outline-offset: 2px;
      border-radius: 10px;
    }
    .site-nav-link:focus-visible,
    .lang-switch-link:focus-visible {
      border-radius: 999px;
    }
    .hero-panel {
      position: relative;
      margin-top: 8px;
      padding: 56px 48px;
      border-radius: 32px;
      background:
        radial-gradient(ellipse at 18% 82%, rgba(255,255,255,.1), transparent 50%),
        radial-gradient(ellipse at 84% 16%, rgba(255,255,255,.14), transparent 42%),
        linear-gradient(135deg, #059669 0%, #10b981 42%, #34d399 64%, #0ea5e9 100%);
      color: white;
      box-shadow: var(--shadow-strong);
      overflow: hidden;
    }
    .hero-panel::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
    }
    .hero-panel::after {
      content: "";
      position: absolute;
      inset: auto -6% -22% auto;
      width: 360px;
      height: 360px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14,165,233,.24), transparent 64%);
      pointer-events: none;
    }
    .hero-panel.has-media {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr);
      gap: 28px;
      align-items: stretch;
    }
    .hero-copy { position: relative; z-index: 1; max-width: 960px; }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.16);
      color: rgba(255,255,255,.88);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: none;
      box-shadow: 0 10px 24px rgba(15,23,42,.08);
    }
    .hero-badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #34d399;
      box-shadow: 0 0 0 4px rgba(52,211,153,.16);
      flex-shrink: 0;
    }
    .hero-panel h1 {
      margin: 18px 0 0;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: clamp(30px, 4vw, 50px);
      line-height: 1.34;
      letter-spacing: -.03em;
      font-weight: 900;
      max-width: 24ch;
      text-wrap: pretty;
    }
    .hero-emphasis { white-space: nowrap; }
    .hero-emphasis { color: #10b981; }
    .hero-panel p {
      margin: 22px 0 0;
      max-width: 48ch;
      color: rgba(255,255,255,.9);
      line-height: 1.95;
      font-size: 18px;
      letter-spacing: -.01em;
      text-wrap: pretty;
    }
    .hero-supplement { margin-top: 22px; }
    .hero-panel .actions { margin-top: 30px; gap: 12px; }
    .hero-metric-strip {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 14px;
      padding: 8px 18px;
      border-radius: 999px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      color: rgba(255,255,255,.88);
      font-size: 14px;
      font-weight: 600;
    }
    .hero-metric strong { font-weight: 800; color: white; font-size: 15px; }
    .hero-metric-dot { width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,.4); flex-shrink: 0; }
    .hero-panel.is-center .hero-copy { text-align: center; margin-inline: auto; max-width: 1040px; }
    .hero-panel.is-center .hero-copy h1,
    .hero-panel.is-center .hero-copy p { margin-inline: auto; }
    .hero-panel.is-center .hero-badge { margin-inline: auto; }
    .hero-panel.is-center .actions { justify-content: center; }
    .hero-panel.is-light {
      background:
        radial-gradient(circle at top left, rgba(16,185,129,.12), transparent 38%),
        radial-gradient(circle at top right, rgba(14,165,233,.08), transparent 28%),
        linear-gradient(180deg, #f8fbff 0%, #ffffff 62%, #f8fbf8 100%);
      color: #0f172a;
      box-shadow: none;
      border: 0;
      border-radius: 0 0 36px 36px;
      padding: 68px 24px 52px;
    }
    .hero-panel.is-light::after { display: none; }
    .hero-panel.is-light::before { display: none; }
    .hero-panel.is-light p { color: #475569; }
    .hero-panel.is-light .eyebrow { color: #475569; opacity: 1; }
    .hero-panel.is-light .hero-badge {
      background: rgba(255,255,255,.92);
      border-color: rgba(15,23,42,.08);
      color: #475569;
    }
    .hero-panel.is-light .btn-solid-on-light { background: linear-gradient(135deg, #10b981, #0ea5e9); color: white; box-shadow: 0 12px 24px rgba(14,165,233,.16); }
    .hero-panel.is-light .btn-ghost-on-dark { background: rgba(255,255,255,.92); border-color: rgba(148,163,184,.45); color: #334155; }
    .hero-panel.is-light.has-media { display: block; }
    .hero-panel.is-light .hero-media {
      max-width: 540px;
      margin: 22px auto 0;
    }
    .hero-panel.is-light .hero-metric-strip {
      background: rgba(255,255,255,.92);
      border-color: rgba(15,23,42,.08);
      color: #475569;
      box-shadow: 0 10px 24px rgba(15,23,42,.06);
    }
    .hero-panel.is-light .hero-metric strong { color: #0f172a; }
    .hero-panel.is-light .hero-metric-dot { background: rgba(100,116,139,.38); }
    .hero-panel.is-light .hero-chip {
      background: rgba(255,255,255,.92);
      border-color: rgba(15,23,42,.08);
      color: #334155;
      box-shadow: 0 8px 18px rgba(15,23,42,.04);
    }
    .hero-after-actions {
      margin-top: 16px;
      display: flex;
      justify-content: center;
    }
    .hero-panel.is-center .hero-after-actions { justify-content: center; }
    .hero-panel.is-light .field-note-mini {
      background: linear-gradient(180deg, rgba(14,165,233,.08), rgba(16,185,129,.08));
      border-color: rgba(14,165,233,.12);
      color: #0f172a;
      box-shadow: 0 14px 28px rgba(15,23,42,.08);
    }
    .hero-panel.is-light .field-note-mini-label { color: #0ea5e9; }
    .hero-chip-row { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    .hero-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 999px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.18);
      backdrop-filter: blur(6px);
      color: rgba(255,255,255,.92);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: .01em;
    }
    .hero-media {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      min-height: 100%;
    }
    .field-note-preview { display: grid; gap: 10px; align-content: start; }
    .field-note-card {
      position: relative;
      padding: 22px 22px 20px 26px;
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(255,255,255,.97), rgba(248,250,252,.94));
      border: 1px solid rgba(255,255,255,.34);
      box-shadow: 0 24px 54px rgba(15,23,42,.16);
      color: #0f172a;
      overflow: hidden;
    }
    .field-note-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(
          180deg,
          transparent 0,
          transparent 30px,
          rgba(14,165,233,.08) 31px,
          transparent 32px
        );
      pointer-events: none;
    }
    .field-note-card::after {
      content: "";
      position: absolute;
      inset: 0 auto 0 18px;
      width: 2px;
      background: linear-gradient(180deg, rgba(239,68,68,.28), rgba(239,68,68,.18));
      pointer-events: none;
    }
    .field-note-topline,
    .field-note-card h3,
    .field-note-card p,
    .field-note-meta,
    .field-note-tags { position: relative; z-index: 1; }
    .field-note-topline {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: .12em;
      font-weight: 800;
    }
    .field-note-kicker { color: #059669; }
    .field-note-date { color: #0ea5e9; }
    .field-note-card h3 {
      margin: 16px 0 10px;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: 24px;
      line-height: 1.35;
      letter-spacing: -.02em;
    }
    .field-note-card p {
      margin: 0;
      color: #334155;
      font-size: 14px;
      line-height: 1.8;
    }
    .field-note-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px 14px;
      margin-top: 16px;
      color: #475569;
      font-size: 13px;
      font-weight: 700;
    }
    .field-note-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    .field-note-tags span {
      display: inline-flex;
      align-items: center;
      padding: 7px 12px;
      border-radius: 999px;
      background: rgba(16,185,129,.08);
      border: 1px solid rgba(16,185,129,.12);
      color: #047857;
      font-size: 12px;
      font-weight: 700;
    }
    .field-note-mini {
      padding: 14px 16px;
      border-radius: 20px;
      background: rgba(255,255,255,.94);
      border: 1px solid rgba(15,23,42,.08);
      color: #0f172a;
      backdrop-filter: blur(8px);
      box-shadow: 0 12px 28px rgba(15,23,42,.08);
    }
    .field-note-mini-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: rgba(255,255,255,.72);
    }
    .field-note-mini strong {
      display: block;
      margin-top: 6px;
      font-size: 15px;
      line-height: 1.45;
      letter-spacing: -.01em;
    }
    .field-note-mini span {
      display: block;
      margin-top: 8px;
      color: #475569;
      font-size: 13px;
      line-height: 1.7;
    }
    .hero-panel .btn-solid {
      background: #0f172a;
      color: white;
      box-shadow: 0 12px 28px rgba(15,23,42,.18);
    }
    .hero-panel .btn-solid:hover { background: #1e293b; }
    .hero-panel .btn-ghost-on-dark {
      background: rgba(255,255,255,.92);
      color: #334155;
      border-color: rgba(255,255,255,.42);
    }
    .hero-photo {
      position: relative;
      min-height: 220px;
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 18px 38px rgba(5, 20, 11, .18);
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(255,255,255,.12);
    }
    .hero-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      filter: saturate(1.05) contrast(1.02);
    }
    .hero-photo::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(4,16,9,0) 34%, rgba(4,16,9,.44) 100%);
      pointer-events: none;
    }
    .hero-photo-label {
      position: absolute;
      left: 14px;
      bottom: 14px;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,.14);
      border: 1px solid rgba(255,255,255,.22);
      color: white;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      backdrop-filter: blur(10px);
    }
    .hero-photo.tall { grid-row: span 2; min-height: 100%; }
    .hero-photo.small { min-height: 148px; }
    .hero { padding: 26px; border-radius: 28px; background: linear-gradient(135deg, var(--hero-a), var(--hero-b)); color: white; box-shadow: 0 20px 46px rgba(18,61,37,.16); }
    .hero .muted, .hero .meta, .hero p { color: rgba(255,255,255,.88); }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--accent); opacity: .9; }
    .section { margin-top: 24px; }
    .section-header { display: flex; flex-direction: column; justify-content: flex-start; gap: 8px; align-items: flex-start; }
    .section-header h2 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
    .section-header p { margin: 8px 0 0; color: var(--muted); }
    .grid { display: grid; grid-template-columns: 1fr; gap: 14px; margin-top: 12px; }
    .actions { display: flex; flex-wrap: wrap; gap: 14px; }
    .card {
      padding: 22px;
      border-radius: 28px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: 0 12px 28px rgba(15,23,42,.05);
      overflow: hidden;
      transition: transform .22s ease, box-shadow .22s ease, border-color .22s ease;
    }
    .card:hover { transform: translateY(-2px); box-shadow: 0 18px 34px rgba(15,23,42,.08); border-color: rgba(14,165,233,.14); }
    .card.has-accent { border-left: 3px solid #10b981; }
    .card.is-soft {
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(248,250,252,.92));
      box-shadow: 0 10px 24px rgba(15,23,42,.05);
    }
    .card-body { padding: 18px; }
    .card-step {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12));
      color: #059669;
      font-size: 14px;
      font-weight: 800;
      margin-bottom: 6px;
    }
    .card h2, .title {
      margin: 8px 0 0;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: 19px;
      line-height: 1.32;
      font-weight: 800;
      letter-spacing: -.01em;
    }
    .card p, .meta, .muted { color: var(--muted); line-height: 1.7; }
    .meta { font-size: 13px; margin-top: 6px; }
    .inline-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #047857;
      font-size: 14px;
      font-weight: 800;
    }
    .inline-link::after {
      content: "→";
      font-size: 14px;
    }
    .mentor-inline {
      padding: 22px 24px;
      background: linear-gradient(180deg, rgba(16,185,129,.05), rgba(14,165,233,.04));
      border-color: rgba(16,185,129,.12);
      box-shadow: 0 10px 24px rgba(15,23,42,.05);
    }
    .mentor-inline h2 {
      margin: 10px 0 8px;
      font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
      font-size: 24px;
      line-height: 1.3;
      letter-spacing: -.02em;
      color: #0f172a;
      max-width: 760px;
    }
    .mentor-inline p {
      margin: 0;
      max-width: 760px;
      color: #475569;
      line-height: 1.8;
      font-size: 15px;
    }
    .list { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255,255,255,.86);
      border: 1px solid #dfeadf;
    }
    .row strong { display: block; margin-bottom: 4px; }
    .pill { display: inline-flex; align-items: center; padding: 6px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; }
    .thumb { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; background: #e6eee7; }
    .visual-band {
      position: relative;
      padding: 20px;
      border-radius: 30px;
      background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(239,246,239,.92));
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
    }
    .photo-grid {
      display: grid;
      grid-template-columns: 1.25fr .95fr .95fr;
      gap: 14px;
      margin-top: 18px;
    }
    .photo-card {
      position: relative;
      min-height: 240px;
      border-radius: 26px;
      overflow: hidden;
      box-shadow: 0 20px 38px rgba(10,42,24,.12);
      background: rgba(255,255,255,.74);
    }
    .photo-card img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .photo-card::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(17,31,21,0) 26%, rgba(17,31,21,.52) 100%);
      pointer-events: none;
    }
    .photo-card .caption {
      position: absolute;
      left: 16px;
      right: 16px;
      bottom: 16px;
      z-index: 1;
      color: white;
    }
    .photo-card .caption strong {
      display: block;
      font-family: "Shippori Mincho", "Yu Mincho", serif;
      font-size: 24px;
      line-height: 1.15;
    }
    .photo-card .caption span {
      display: block;
      margin-top: 8px;
      color: rgba(255,255,255,.84);
      line-height: 1.55;
      font-size: 13px;
    }
    .photo-card.tall { min-height: 320px; }
    .stack { display: flex; flex-direction: column; gap: 12px; }
    input, textarea, select {
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid var(--border);
      background: rgba(255,255,255,.96);
      color: var(--ink);
      font: inherit;
    }
    code { font-family: ui-monospace, monospace; font-size: 13px; }
    .onboarding-empty { padding: 48px 32px; text-align: center; border-radius: 28px; background: linear-gradient(180deg, #f8fffc, #effaf4); border: 1px solid rgba(16,185,129,.16); }
    .onboarding-empty .eyebrow { display: inline-block; margin-bottom: 12px; }
    .onboarding-empty h3 { margin: 0 0 12px; font-size: 22px; font-weight: 800; }
    .onboarding-empty p { margin: 0 0 20px; color: #475569; max-width: 44ch; margin-inline: auto; }
    .ver-tag { font-size: 11px; font-weight: 700; color: #94a3b8; margin-right: 6px; font-family: ui-monospace, monospace; }
    .site-footer {
      position: relative;
      overflow: hidden;
      margin-top: 42px;
      border-top: 1px solid rgba(255,255,255,.1);
      background:
        linear-gradient(90deg, rgba(255,255,255,.06) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,.05) 1px, transparent 1px),
        linear-gradient(116deg, rgba(16,185,129,.28) 0%, rgba(16,185,129,0) 34%),
        linear-gradient(244deg, rgba(14,165,233,.2) 0%, rgba(14,165,233,0) 30%),
        linear-gradient(135deg, #052e24 0%, #064e3b 48%, #075985 100%);
      background-size: 46px 46px, 46px 46px, auto, auto, auto;
      color: #ecfdf5;
    }
    .site-footer::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,0) 34%, rgba(0,0,0,.14));
      pointer-events: none;
    }
    .footer-inner {
      position: relative;
      z-index: 1;
      width: min(1480px, calc(100% - 32px));
      margin: 0 auto;
      display: grid;
      gap: 18px;
      padding: clamp(36px, 6vw, 72px) 0 26px;
    }
    .footer-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(360px, .62fr);
      gap: 18px;
      align-items: stretch;
    }
    .footer-brand-panel,
    .footer-mini-map,
    .footer-directory,
    .footer-bottom {
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.08);
      box-shadow: 0 24px 70px rgba(0,0,0,.18);
      backdrop-filter: blur(18px);
      border-radius: 8px;
    }
    .footer-brand-panel {
      min-height: 340px;
      padding: clamp(24px, 4vw, 44px);
      display: grid;
      align-content: space-between;
      gap: 26px;
    }
    .site-footer .brand { color: #ffffff; }
    .site-footer .brand-mark {
      background: #ecfdf5;
      box-shadow: 0 12px 30px rgba(0,0,0,.16);
    }
    .site-footer .brand small { color: rgba(236,253,245,.76); }
    .footer-kicker {
      width: fit-content;
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 20px;
      padding: 6px 10px;
      border: 1px solid rgba(167,243,208,.28);
      border-radius: 999px;
      background: rgba(16,185,129,.13);
      color: #a7f3d0;
      font-size: 12px;
      font-weight: 950;
    }
    .footer-brand-panel h2 {
      margin: 18px 0 0;
      max-width: 16ch;
      color: #ffffff;
      font-size: clamp(34px, 4.2vw, 58px);
      line-height: 1.08;
      letter-spacing: 0;
      font-weight: 950;
    }
    .footer-brand-panel p {
      margin: 14px 0 0;
      max-width: 50em;
      color: rgba(236,253,245,.74);
      font-size: 14px;
      font-weight: 650;
    }
    .footer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 22px;
    }
    .site-footer .btn-solid {
      background: #ffffff;
      color: #064e3b;
      box-shadow: 0 18px 42px rgba(0,0,0,.18);
    }
    .site-footer .btn-ghost-on-dark {
      background: rgba(255,255,255,.08);
      color: #ffffff;
      border-color: rgba(255,255,255,.24);
    }
    .global-record-launcher {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: max(10px, env(safe-area-inset-bottom));
      z-index: 36;
      display: none;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      padding: 8px;
      gap: 8px;
      border-radius: 24px;
      background: rgba(255,255,255,.96);
      border: 1px solid rgba(15,23,42,.08);
      box-shadow: 0 20px 44px rgba(15,23,42,.20);
      backdrop-filter: blur(18px);
    }
    .global-record-choice {
      min-height: 58px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      padding: 7px 6px;
      border-radius: 17px;
      background: rgba(248,250,252,.92);
      color: #0f172a;
      font-size: 11px;
      font-weight: 950;
      line-height: 1.2;
      text-decoration: none;
      border: 0;
      font-family: inherit;
      cursor: pointer;
    }
    .global-record-choice.is-primary {
      background: #ecfdf5;
      color: #065f46;
    }
    .global-record-choice-icon {
      width: 30px;
      height: 30px;
      flex: 0 0 30px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(15,23,42,.06);
    }
    .global-record-choice.is-primary .global-record-choice-icon {
      background: rgba(16,185,129,.14);
    }
    .global-record-choice svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .global-record-camera-backdrop {
      position: fixed;
      inset: 0;
      z-index: 37;
      background: rgba(15,23,42,.22);
      backdrop-filter: blur(3px);
    }
    .global-record-camera-backdrop[hidden],
    .global-record-camera-sheet[hidden] {
      display: none;
    }
    .global-record-camera-open .global-record-launcher {
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
    }
    .global-record-camera-sheet {
      position: fixed;
      left: 12px;
      right: 12px;
      top: max(12px, env(safe-area-inset-top));
      bottom: max(12px, calc(env(safe-area-inset-bottom) + 12px));
      z-index: 38;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;
      gap: 10px;
      padding: 10px;
      overflow-y: auto;
      overscroll-behavior: contain;
      border-radius: 18px;
      background: rgba(255,255,255,.98);
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: 0 24px 70px rgba(15,23,42,.28);
    }
    .global-record-camera-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .global-record-camera-head strong {
      display: block;
      color: #0f172a;
      font-size: 16px;
      line-height: 1.35;
    }
    .global-record-camera-head p {
      margin: 2px 0 0;
      color: #64748b;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 750;
    }
    .global-record-camera-close {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      display: grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      background: rgba(15,23,42,.06);
      color: #0f172a;
      font: inherit;
      font-size: 22px;
      line-height: 1;
      cursor: pointer;
    }
    .global-record-camera-preview {
      position: relative;
      min-height: 0;
      height: min(72dvh, calc(100dvh - 178px));
      overflow: hidden;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.92));
      border: 1px solid rgba(15,23,42,.08);
    }
    .global-record-camera-preview video,
    .global-record-camera-preview img {
      width: 100%;
      height: 100%;
      min-height: 0;
      display: block;
      object-fit: contain;
      background: #020617;
    }
    .global-record-camera-preview video[hidden],
    .global-record-camera-preview img[hidden] {
      display: none;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-camera-preview {
      order: 1;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-photo-tray {
      order: 2;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-camera-status {
      order: 3;
    }
    .global-record-camera-sheet[data-active-kind="photo"] .global-record-inline-edit {
      order: 4;
    }
    .global-record-camera-sheet[data-photo-draft="true"] .global-record-camera-preview {
      display: none;
    }
    .global-record-camera-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      padding: 22px;
      text-align: center;
      color: #475569;
      font-size: 13px;
      line-height: 1.65;
      font-weight: 850;
    }
    .global-record-camera-empty[hidden] {
      display: none;
    }
    .global-record-photo-tray {
      display: grid;
      gap: 9px;
      padding: 10px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid rgba(15,23,42,.08);
    }
    .global-record-photo-tray[hidden] {
      display: none;
    }
    .global-record-photo-tray-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #475569;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 850;
    }
    .global-record-photo-tray-head strong {
      color: #0f172a;
      font-size: 13px;
      font-weight: 950;
    }
    .global-record-photo-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 7px;
    }
    .global-record-photo-cell {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      border-radius: 8px;
      background: #e2e8f0;
      border: 1px solid rgba(15,23,42,.08);
    }
    .global-record-photo-cell img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .global-record-photo-cell span {
      position: absolute;
      left: 4px;
      top: 4px;
      min-width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: rgba(15,23,42,.82);
      color: #fff;
      font-size: 10px;
      font-weight: 950;
    }
    .global-record-photo-cell-actions {
      position: absolute;
      left: 4px;
      right: 4px;
      bottom: 4px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3px;
    }
    .global-record-photo-cell-actions button {
      min-width: 0;
      min-height: 24px;
      border: 0;
      border-radius: 7px;
      background: rgba(255,255,255,.92);
      color: #0f172a;
      font: inherit;
      font-size: 11px;
      line-height: 1;
      font-weight: 950;
      cursor: pointer;
    }
    .global-record-photo-cell-actions button:disabled {
      opacity: .42;
      cursor: default;
    }
    .global-record-camera-status {
      min-height: 18px;
      color: #0f766e;
      font-size: 12px;
      line-height: 1.5;
      font-weight: 850;
    }
    .global-record-inline-edit {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(255,255,255,.88);
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
    }
    .global-record-inline-edit[hidden] {
      display: none;
    }
    .global-record-inline-edit-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
    }
    .global-record-inline-edit-head strong {
      color: #0f172a;
      font-size: 13px;
      line-height: 1.4;
      font-weight: 950;
    }
    .global-record-inline-edit-head span {
      max-width: 58%;
      color: #047857;
      font-size: 11px;
      line-height: 1.45;
      font-weight: 900;
      text-align: right;
    }
    .global-record-inline-edit label {
      display: grid;
      gap: 6px;
      color: #334155;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 900;
    }
    .global-record-media-meaning {
      display: grid;
      gap: 4px;
      padding: 10px 11px;
      border-radius: 14px;
      background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(239,246,255,.9));
      border: 1px solid rgba(16,185,129,.2);
    }
    .global-record-media-meaning strong {
      color: #064e3b;
      font-size: 12px;
      line-height: 1.35;
      font-weight: 950;
    }
    .global-record-media-meaning span {
      color: #475569;
      font-size: 11px;
      line-height: 1.55;
      font-weight: 800;
    }
    .global-record-inline-edit input,
    .global-record-inline-edit textarea,
    .global-record-inline-edit select {
      width: 100%;
      box-sizing: border-box;
      border: 1px solid rgba(15,23,42,.14);
      border-radius: 12px;
      background: #fff;
      color: #0f172a;
      font: inherit;
      font-size: 13px;
      line-height: 1.5;
      padding: 10px 11px;
      resize: vertical;
    }
    .global-record-video-trim {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-radius: 16px;
      background: rgba(236,253,245,.86);
      border: 1px solid rgba(16,185,129,.22);
    }
    .global-record-video-trim[hidden] {
      display: none;
    }
    .global-record-video-trim-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: #064e3b;
      font-size: 12px;
      font-weight: 950;
      line-height: 1.4;
    }
    .global-record-video-trim-head span {
      flex: 0 0 auto;
      padding: 5px 9px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid rgba(16,185,129,.2);
      color: #047857;
    }
    .global-record-video-trim-controls {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .global-record-video-trim-controls label {
      display: grid;
      gap: 6px;
      color: #0f172a;
      font-size: 11px;
      font-weight: 900;
      line-height: 1.3;
    }
    .global-record-video-trim-controls label span {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .global-record-video-trim-controls input {
      width: 100%;
      accent-color: #047857;
    }
    .global-record-camera-actions {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: max(10px, env(safe-area-inset-bottom));
      z-index: 39;
      display: flex;
      gap: 10px;
      padding: 10px;
      border-radius: 24px;
      background: rgba(255,255,255,.98);
      border: 1px solid rgba(15,23,42,.1);
      box-shadow: 0 20px 44px rgba(15,23,42,.22);
      backdrop-filter: blur(18px);
    }
    .global-record-camera-action {
      flex: 1 1 0;
      min-width: 0;
      min-height: 68px;
      border: 0;
      border-radius: 16px;
      background: rgba(248,250,252,.96);
      color: #0f172a;
      font: inherit;
      font-size: 15px;
      font-weight: 950;
      line-height: 1.2;
      cursor: pointer;
    }
    .global-record-camera-action.is-primary {
      background: #064e3b;
      color: #fff;
    }
    .global-record-camera-action[hidden] {
      display: none;
    }
    .global-record-camera-action:disabled {
      opacity: .64;
      cursor: wait;
    }
    @media (max-width: 520px) {
      .global-record-camera-sheet {
        left: 8px;
        right: 8px;
        top: max(8px, env(safe-area-inset-top));
        bottom: max(8px, calc(env(safe-area-inset-bottom) + 8px));
        gap: 10px;
        padding: 10px;
      }
      .global-record-camera-preview {
        height: min(70dvh, calc(100dvh - 176px));
      }
      .global-record-camera-actions {
        left: 8px;
        right: 8px;
        padding: 8px;
        gap: 8px;
      }
      .global-record-camera-action {
        min-height: 70px;
        font-size: 15px;
      }
      .global-record-photo-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .global-record-video-trim-controls {
        grid-template-columns: 1fr;
      }
    }
    .footer-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .footer-chip-row span {
      min-height: 32px;
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 999px;
      background: rgba(255,255,255,.07);
      color: rgba(236,253,245,.78);
      font-size: 12px;
      font-weight: 820;
    }
    .footer-mini-map {
      min-height: 340px;
      position: relative;
      overflow: hidden;
      padding: 22px;
      display: grid;
      align-content: end;
      background:
        linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px),
        linear-gradient(0deg, rgba(255,255,255,.08) 1px, transparent 1px),
        linear-gradient(135deg, rgba(6,78,59,.58), rgba(14,165,233,.42));
      background-size: 38px 38px, 38px 38px, auto;
    }
    .footer-route {
      position: absolute;
      inset: 42px 44px 72px 42px;
      border: 2px solid rgba(167,243,208,.5);
      border-left-color: transparent;
      border-bottom-color: rgba(125,211,252,.52);
      border-radius: 45% 55% 58% 42%;
      transform: rotate(-9deg);
    }
    .footer-pin {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 4px solid #fff;
      border-radius: 999px;
      background: #10b981;
      box-shadow: 0 10px 24px rgba(0,0,0,.22);
    }
    .footer-pin.one { left: 18%; top: 32%; }
    .footer-pin.two { left: 57%; top: 24%; background: #0ea5e9; }
    .footer-pin.three { left: 73%; top: 63%; background: #f59e0b; }
    .footer-pin.four { left: 36%; top: 70%; background: #34d399; }
    .footer-map-copy {
      position: relative;
      z-index: 2;
      padding: 16px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      background: rgba(5,46,36,.52);
      backdrop-filter: blur(14px);
    }
    .footer-map-copy span {
      color: #a7f3d0;
      font-size: 12px;
      font-weight: 950;
    }
    .footer-map-copy strong {
      display: block;
      margin-top: 5px;
      color: #fff;
      font-size: 22px;
      line-height: 1.25;
      font-weight: 950;
    }
    .footer-map-copy p {
      margin: 8px 0 0;
      color: rgba(236,253,245,.7);
      font-size: 12px;
      font-weight: 650;
    }
    .footer-directory {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 1px;
      overflow: hidden;
      background: rgba(255,255,255,.12);
    }
    .footer-group {
      min-height: 220px;
      padding: 22px;
      background: rgba(5,46,36,.42);
    }
    .footer-group strong {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ffffff;
      font-size: 13px;
      font-weight: 950;
      margin-bottom: 14px;
    }
    .footer-group strong i {
      min-width: 26px;
      height: 26px;
      display: inline-grid;
      place-items: center;
      padding: 0 6px;
      border-radius: 8px;
      background: rgba(167,243,208,.14);
      color: #a7f3d0;
      font-size: 9px;
      font-style: normal;
      font-weight: 950;
    }
    .footer-links {
      display: grid;
      gap: 8px;
    }
    .footer-links a {
      min-height: 34px;
      display: inline-flex;
      align-items: center;
      width: fit-content;
      color: rgba(236,253,245,.76);
      font-weight: 760;
      transition: color .18s ease, transform .18s ease;
    }
    .footer-links a:hover {
      color: #ffffff;
      transform: translateX(2px);
    }
    .footer-bottom {
      min-height: 62px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 14px 18px;
      color: rgba(236,253,245,.7);
      font-size: 12px;
      font-weight: 700;
    }
    .footer-bottom a {
      color: #ffffff;
      font-weight: 900;
    }
    @media (max-width: 1160px) {
      .site-header-inner {
        padding: 10px 18px;
        gap: 10px;
      }
      .brand {
        max-width: 270px;
        flex-basis: 220px;
      }
      .site-search-desktop {
        max-width: 240px;
      }
      .site-header-actions-desktop {
        display: none;
      }
      .site-header-actions-mobile {
        display: flex;
        align-items: center;
        gap: 7px;
      }
      .site-record-link {
        min-height: 40px;
        padding: 10px 13px;
        font-size: 13px;
        box-shadow: 0 8px 18px rgba(5,150,105,.14);
      }
      .site-mobile-menu {
        position: relative;
        display: block;
      }
    }
    @media (max-width: 1120px) {
      .footer-hero,
      .footer-directory { grid-template-columns: 1fr 1fr; }
      .footer-brand-panel,
      .footer-mini-map { min-height: 300px; }
    }
    @media (max-width: 960px) {
      .brand {
        max-width: none;
      }
      .site-nav-desktop,
      .site-search-desktop {
        display: none;
      }
    }
    @media (max-width: 720px) {
      .md-hidden { display: inline; }
      .shell { padding: 16px 16px 18px; }
      .shell.shell-bleed,
      .shell.shell-map { padding: 14px 12px 18px; }
      .site-header-inner {
        padding: 9px 12px;
        gap: 8px;
        flex-wrap: nowrap;
        align-items: center;
      }
      .brand {
        min-width: 0;
        flex: 1 1 auto;
        gap: 8px;
      }
      .brand-mark {
        width: 36px;
        height: 36px;
        flex-basis: 36px;
        border-radius: 11px;
      }
      .brand strong { font-size: 14px; }
      .brand small { display: none; }
      .site-nav-desktop,
      .site-search-desktop,
      .site-header-actions-desktop { display: none; }
      .site-header-actions-mobile {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 7px;
      }
      .site-record-link {
        min-height: 40px;
        padding: 10px 12px;
        font-size: 13px;
        box-shadow: 0 8px 18px rgba(5,150,105,.14);
      }
      .has-global-record-launcher .site-header-actions-mobile .site-record-link { display: none; }
      .is-reading-surface .site-header-actions-mobile .site-record-link { display: none; }
      .site-shell.has-global-record-launcher { padding-bottom: 88px; }
      .hero-panel { padding: 48px 24px 36px; border-radius: 26px; }
      .hero-panel h1 { font-size: clamp(28px, 9vw, 40px); line-height: 1.24; max-width: 18ch; }
      .hero-panel p { font-size: 16px; line-height: 1.85; max-width: 32ch; margin-top: 18px; }
      .hero-emphasis { white-space: normal; }
      .hero-panel.has-media { grid-template-columns: 1fr; }
      .hero-media { grid-template-columns: 1fr; }
      .hero-panel.is-light .hero-media { margin-top: 20px; }
      .hero-photo.tall { grid-row: auto; min-height: 220px; }
      .photo-grid { grid-template-columns: 1fr; }
      .footer-inner { width: min(100% - 24px, 1480px); padding: 30px 0 22px; }
      .footer-hero,
      .footer-directory { grid-template-columns: 1fr; }
      .footer-brand-panel,
      .footer-mini-map { min-height: 0; }
      .footer-brand-panel { padding: 22px; }
      .footer-mini-map { min-height: 280px; }
      .footer-group { min-height: 0; padding: 18px; }
      .footer-bottom { flex-direction: column; align-items: flex-start; }
      .row { flex-direction: column; }
      .field-note-card { padding: 18px 18px 18px 20px; }
      .field-note-card h3 { font-size: 20px; }
      .mentor-inline { padding: 20px 20px; }
      .mentor-inline h2 { font-size: 21px; }
      .global-record-launcher {
        display: grid;
      }
    }
    .app-install-prompt {
      position: fixed;
      left: max(14px, env(safe-area-inset-left));
      right: max(14px, env(safe-area-inset-right));
      bottom: max(14px, env(safe-area-inset-bottom));
      z-index: 70;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      max-width: 520px;
      margin: 0 auto;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid rgba(15,23,42,.1);
      background: rgba(255,255,255,.96);
      box-shadow: 0 18px 48px rgba(15,23,42,.18);
      color: #0f172a;
    }
    .app-install-prompt[hidden] { display: none; }
    .app-install-prompt-copy { display: grid; gap: 2px; min-width: 0; }
    .app-install-prompt-copy strong { font-size: 13px; line-height: 1.35; font-weight: 950; }
    .app-install-prompt-copy span { color: #475569; font-size: 12px; line-height: 1.45; font-weight: 750; }
    .app-install-prompt-actions { display: flex; align-items: center; gap: 8px; }
    .app-install-primary,
    .app-install-dismiss {
      min-height: 38px;
      border-radius: 8px;
      border: 0;
      padding: 0 12px;
      font: inherit;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
    }
    .app-install-primary { background: #10b981; color: #fff; }
    .app-install-dismiss { background: rgba(15,23,42,.06); color: #334155; }
    @media (min-width: 768px) {
      .app-install-prompt {
        left: auto;
        right: 22px;
        bottom: 22px;
      }
    }
    ${options.extraStyles ?? ""}
  </style>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(skipLabel)}</a>
  ${installPromptHtml}
  <div class="${siteShellClassName}">
    ${nav(options.basePath, lang, currentPath, options.activeNav, alternateLangs)}
    <main id="main-content" class="shell${options.shellClassName ? ` ${escapeHtml(options.shellClassName)}` : ""}" tabindex="-1">
      ${hero(options.basePath, options.hero)}
      ${options.belowHeroHtml ?? ""}
      ${options.body}
    </main>
    ${footer(options.basePath, lang, options.footerNote)}
    ${globalRecordNav}
  </div>
  ${legacyServiceWorkerCleanupScript}
  ${appRuntimeScript}
  ${authNavHydrationScript(options.basePath, lang)}
  ${globalRecordNav ? globalRecordEntryScript(options.basePath) : ""}
  ${uiKpiScript}
</body>
</html>`;
}
