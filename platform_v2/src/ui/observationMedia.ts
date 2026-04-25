import type { ObservationDetailSnapshot } from "../services/readModels.js";
import type { ObservationVisitSubject, SubjectMediaRegionView } from "../services/observationVisitBundle.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml } from "./siteShell.js";

type PhotoAsset = ObservationDetailSnapshot["photoAssets"][number];
type VideoAsset = ObservationDetailSnapshot["videoAssets"][number];
type RegionSwitchMap = Record<string, Array<{
  assetId: string;
  rect: SubjectMediaRegionView["rect"];
  note: string | null;
  confidenceScore: number | null;
}>>;

export const REGION_DISPLAY_CONF_MIN = 0.5;
export const OBSERVATION_REGION_SUMMARY_TEXT = "AI が対象位置の参考矩形を重ねています。";

export const OBSERVATION_MEDIA_STYLES = `
  .obs-hero-gallery { display: grid; gap: 10px; border-radius: 20px; background: #ffffff; border: 1px solid rgba(15,23,42,.08); padding: 8px; box-shadow: 0 18px 42px rgba(15,23,42,.07); }
  .obs-hero-preview { position: relative; display: flex; align-items: center; justify-content: center; min-height: clamp(420px, 68vh, 680px); border-radius: 16px; overflow: hidden; background: #f8fafc; cursor: zoom-in; }
  .obs-hero-image-frame { position: relative; display: inline-block; max-width: 100%; max-height: min(68vh, 680px); }
  .obs-hero-image-frame img { width: auto; height: auto; max-width: 100%; max-height: min(68vh, 680px); object-fit: contain; display: block; }
  .obs-hero-preview .obs-region-layer { position: absolute; inset: 0; pointer-events: none; }
  .obs-hero-zoom { position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%; background: rgba(15,23,42,.78); color: #fff; border: 0; display: grid; place-items: center; cursor: pointer; transition: transform .18s ease, background .18s ease; box-shadow: 0 6px 16px rgba(0,0,0,.28); }
  .obs-hero-zoom:hover { background: #0f172a; transform: scale(1.06); }
  .obs-hero-zoom svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .obs-hero-thumbs { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
  .obs-hero-thumb { border: 0; padding: 0; aspect-ratio: 1/1; border-radius: 10px; overflow: hidden; cursor: pointer; position: relative; background: none; opacity: .78; transition: opacity .18s ease, transform .18s ease, box-shadow .18s ease; box-shadow: 0 0 0 1px rgba(15,23,42,.08); }
  .obs-hero-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .22s ease; }
  .obs-hero-thumb:hover { opacity: 1; transform: translateY(-2px); }
  .obs-hero-thumb:hover img { transform: scale(1.06); }
  .obs-hero-thumb:focus-visible { outline: none; opacity: 1; box-shadow: 0 0 0 3px rgba(16,185,129,.75); }
  .obs-hero-thumb.is-active { opacity: 1; box-shadow: 0 0 0 3px #10b981, 0 6px 14px rgba(16,185,129,.3); cursor: default; }
  .obs-hero-thumb-ring { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
  .obs-hero-thumb-active-label { position: absolute; left: 6px; right: 6px; bottom: 6px; padding: 3px 4px; border-radius: 6px; background: #10b981; color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .06em; text-align: center; opacity: 0; transition: opacity .18s ease; pointer-events: none; }
  .obs-hero-thumb.is-active .obs-hero-thumb-active-label { opacity: 1; }

  .obs-lightbox { position: fixed; inset: 0; z-index: 9999; background: rgba(8,12,20,.94); display: none; overflow: auto; padding: 72px 16px 56px; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .obs-lightbox.is-open { display: block; }
  .obs-lightbox-inner { min-height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; }
  .obs-lightbox-img { display: block; border-radius: 8px; box-shadow: 0 24px 60px rgba(0,0,0,.6); user-select: none; cursor: zoom-in; transition: transform .15s ease; }
  .obs-lightbox-img.is-fit { max-width: calc(100vw - 32px); max-height: calc(100vh - 160px); width: auto; height: auto; }
  .obs-lightbox-img.is-actual { max-width: none; max-height: none; cursor: zoom-out; }
  .obs-lightbox-img.is-dragging { cursor: grabbing; transition: none; }
  .obs-lightbox-close { position: fixed; top: 16px; right: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 999px; background: #fff; color: #0f172a; font-weight: 900; font-size: 15px; border: 0; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.5); z-index: 10010; transition: transform .18s ease, background .18s ease; }
  .obs-lightbox-close:hover { background: #f1f5f9; transform: scale(1.05); }
  .obs-lightbox-close svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 3; stroke-linecap: round; }
  .obs-lightbox-toggle { position: fixed; top: 16px; left: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px; background: rgba(15,23,42,.75); color: #fff; font-weight: 800; font-size: 13px; border: 0; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,.35); z-index: 10010; transition: background .18s ease, transform .18s ease; }
  .obs-lightbox-toggle:hover { background: #0f172a; transform: scale(1.04); }
  .obs-lightbox-toggle svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .obs-lightbox-hint { position: fixed; left: 0; right: 0; bottom: 16px; text-align: center; color: rgba(255,255,255,.8); font-size: 12px; font-weight: 700; letter-spacing: .04em; pointer-events: none; z-index: 10010; padding: 0 16px; }
  .obs-hero-media-stack { display: grid; gap: 10px; }
  .obs-hero-photo-stack { display: grid; gap: 10px; }
  .obs-hero-video { display: grid; gap: 8px; }
  .obs-hero-video-frame { position: relative; width: 100%; padding-top: 56.25%; border-radius: 20px; overflow: hidden; background: #020617; }
  .obs-hero-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
  .obs-hero-video-meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; color: #334155; font-weight: 700; }
  .obs-hero-video-meta a { color: #0369a1; text-decoration: underline; text-underline-offset: 2px; }
  .obs-region-video-note { color: #0369a1; font-size: 11px; font-weight: 800; }
  .obs-region-layer { position: absolute; inset: 0; pointer-events: none; }
  .obs-region-box { position: absolute; border: 1.5px dashed rgba(14,165,233,.92); border-radius: 12px; background: rgba(14,165,233,.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,.65); }
  .obs-region-box-label { position: absolute; left: 8px; top: 8px; display: inline-flex; padding: 4px 8px; border-radius: 999px; background: rgba(15,23,42,.82); color: #fff; font-size: 10px; font-weight: 800; white-space: nowrap; max-width: calc(100% - 16px); overflow: hidden; text-overflow: ellipsis; }
  .obs-region-summary { margin: 0; color: #0369a1; font-size: 12px; font-weight: 800; }
`;

export function isDisplayableRegion(region: Pick<SubjectMediaRegionView, "rect" | "confidenceScore">): boolean {
  return Boolean(region.rect) && (region.confidenceScore ?? 1) >= REGION_DISPLAY_CONF_MIN;
}

export function displayableRegionsForAsset(
  subject: Pick<ObservationVisitSubject, "regions">,
  assetId: string,
): SubjectMediaRegionView[] {
  return subject.regions.filter((region) => region.assetId === assetId && isDisplayableRegion(region));
}

export function renderObservationRegionBoxes(
  subject: Pick<ObservationVisitSubject, "regions">,
  assetId: string,
): string {
  return displayableRegionsForAsset(subject, assetId)
    .map((region) => {
      const rect = region.rect;
      if (!rect) return "";
      return `<span class="obs-region-box"
        style="left:${(rect.x * 100).toFixed(2)}%;top:${(rect.y * 100).toFixed(2)}%;width:${(rect.width * 100).toFixed(2)}%;height:${(rect.height * 100).toFixed(2)}%;">
        ${region.note ? `<span class="obs-region-box-label">${escapeHtml(region.note)}</span>` : ""}
      </span>`;
    })
    .join("");
}

export function toSubjectRegionMap(subjects: Array<Pick<ObservationVisitSubject, "occurrenceId" | "regions">>): RegionSwitchMap {
  return Object.fromEntries(
    subjects.map((subject) => [
      subject.occurrenceId,
      subject.regions.map((region) => ({
        assetId: region.assetId,
        rect: region.rect,
        note: region.note,
        confidenceScore: region.confidenceScore,
      })),
    ]),
  );
}

function photoSizeAttrs(asset: PhotoAsset): string {
  const width = Number(asset.widthPx);
  const height = Number(asset.heightPx);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? ` width="${Math.round(width)}" height="${Math.round(height)}"`
    : "";
}

function photoSizeDataAttrs(asset: PhotoAsset): string {
  const width = Number(asset.widthPx);
  const height = Number(asset.heightPx);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? ` data-obs-thumb-width="${Math.round(width)}" data-obs-thumb-height="${Math.round(height)}"`
    : "";
}

function photoDisplayUrl(asset: PhotoAsset, preset: "sm" | "lg"): string {
  return toThumbnailUrl(asset.url, preset) ?? asset.url;
}

function renderPhotoGallery(snapshot: ObservationDetailSnapshot, currentSubject: ObservationVisitSubject): string {
  if (snapshot.photoAssets.length === 0) return "";
  const first = snapshot.photoAssets[0]!;
  const firstDisplayUrl = photoDisplayUrl(first, "lg");
  const thumbsHtml = snapshot.photoAssets.length >= 2
    ? `<div class="obs-hero-thumbs">${snapshot.photoAssets.map((asset, i) => {
      const previewUrl = photoDisplayUrl(asset, "lg");
      const thumbUrl = photoDisplayUrl(asset, "sm");
      return `
         <button type="button" class="obs-hero-thumb${i === 0 ? " is-active" : ""}" data-obs-thumb-index="${i}" data-obs-thumb-src="${escapeHtml(previewUrl)}" data-obs-thumb-asset-id="${escapeHtml(asset.assetId)}"${photoSizeDataAttrs(asset)} aria-label="画像 ${i + 1}">
           <img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy"${photoSizeAttrs(asset)} />
           <span class="obs-hero-thumb-ring" aria-hidden="true"></span>
           <span class="obs-hero-thumb-active-label" aria-hidden="true">表示中</span>
           <span hidden data-obs-thumb-regions="${escapeHtml(asset.assetId)}">${renderObservationRegionBoxes(currentSubject, asset.assetId)}</span>
         </button>`;
    }).join("")}</div>`
    : "";
  return `<div class="obs-hero-gallery" data-obs-gallery>
    <div class="obs-hero-preview" data-obs-preview data-obs-preview-asset-id="${escapeHtml(first.assetId)}">
      <span class="obs-hero-image-frame" data-obs-image-frame>
        <img src="${escapeHtml(firstDisplayUrl)}" alt="${escapeHtml(snapshot.displayName)}" loading="eager" data-obs-preview-img${photoSizeAttrs(first)} />
        <span class="obs-region-layer" data-region-layer="${escapeHtml(first.assetId)}" data-obs-preview-regions>${renderObservationRegionBoxes(currentSubject, first.assetId)}</span>
      </span>
      <button type="button" class="obs-hero-zoom" data-obs-zoom aria-label="画像を拡大">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
    </div>
    ${thumbsHtml}
  </div>`;
}

function renderVideoPlayer(snapshot: ObservationDetailSnapshot, currentSubject: ObservationVisitSubject, primaryVideo: VideoAsset | null): string {
  if (!primaryVideo) return "";
  const videoRegion = currentSubject.regions.find((region) => region.assetId === primaryVideo.assetId && isDisplayableRegion(region)) ?? null;
  return `<div class="obs-hero-video">
     <div class="obs-hero-video-frame">
       <iframe
         src="${escapeHtml(primaryVideo.iframeUrl)}"
         title="${escapeHtml(snapshot.displayName)} の動画"
         loading="lazy"
         allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
         allowfullscreen>
       </iframe>
     </div>
     <div class="obs-hero-video-meta">
       <strong>動画</strong>
       ${videoRegion ? `<span class="obs-region-video-note">AI が 2s 付近の対象位置を記録しています</span>` : ""}
       ${primaryVideo.watchUrl ? `<a href="${escapeHtml(primaryVideo.watchUrl)}" target="_blank" rel="noopener noreferrer">別タブで開く</a>` : ""}
     </div>
   </div>`;
}

export function renderObservationMedia(
  snapshot: ObservationDetailSnapshot,
  currentSubject: ObservationVisitSubject,
): { mediaBlock: string; galleryScript: string } {
  const firstPhoto = snapshot.photoAssets[0] ?? null;
  const initialPhotoRegionCount = firstPhoto
    ? displayableRegionsForAsset(currentSubject, firstPhoto.assetId).length
    : 0;
  const photoGallery = renderPhotoGallery(snapshot, currentSubject);
  const primaryVideo = snapshot.videoAssets[0] ?? null;
  const videoPlayer = renderVideoPlayer(snapshot, currentSubject, primaryVideo);
  const mediaBlock = (videoPlayer || photoGallery)
    ? `<div class="obs-hero-media-stack">${videoPlayer}${photoGallery ? `<div class="${videoPlayer ? "obs-hero-photo-stack" : ""}">${photoGallery}</div>` : ""}${initialPhotoRegionCount > 0 ? `<p class="obs-region-summary" data-region-summary>${OBSERVATION_REGION_SUMMARY_TEXT}</p>` : `<p class="obs-region-summary" data-region-summary hidden></p>`}</div>`
    : `<div class="obs-hero-placeholder"><span>📷</span><span>${escapeHtml(snapshot.displayName)}</span><small>写真も動画もまだありません</small></div>`;

  return {
    mediaBlock,
    galleryScript: renderObservationGalleryScript(snapshot.photoAssets.length > 0),
  };
}

function renderObservationGalleryScript(hasPhotoAssets: boolean): string {
  if (!hasPhotoAssets) return "";
  return `<div class="obs-lightbox" data-obs-lightbox role="dialog" aria-modal="true" aria-label="画像を拡大表示">
     <button type="button" class="obs-lightbox-close" data-obs-lightbox-close aria-label="閉じる">
       <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
       <span>閉じる</span>
     </button>
     <button type="button" class="obs-lightbox-toggle" data-obs-lightbox-toggle aria-label="表示サイズ切替">
       <svg viewBox="0 0 24 24" aria-hidden="true" data-obs-lightbox-icon-fit><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
       <span data-obs-lightbox-toggle-label>等倍で見る</span>
     </button>
     <div class="obs-lightbox-inner" data-obs-lightbox-inner><img class="obs-lightbox-img is-fit" data-obs-lightbox-img alt="" /></div>
     <div class="obs-lightbox-hint" data-obs-lightbox-hint>クリックで等倍 / ドラッグでパン / ホイールでスクロール / Esc で閉じる</div>
   </div>
   <script>(function(){
     var gallery = document.querySelector('[data-obs-gallery]');
     if (!gallery) return;
     var preview = gallery.querySelector('[data-obs-preview]');
     var previewImg = preview && preview.querySelector('[data-obs-preview-img]');
     var previewRegions = preview && preview.querySelector('[data-obs-preview-regions]');
     var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('.obs-hero-thumb'));
     var lightbox = document.querySelector('[data-obs-lightbox]');
     var lightboxImg = lightbox && lightbox.querySelector('[data-obs-lightbox-img]');
     var lightboxClose = lightbox && lightbox.querySelector('[data-obs-lightbox-close]');
     var updateRegionSummary = function(regionHtml){
       var summary = document.querySelector('[data-region-summary]');
       if (!summary) return;
       var hasVisibleRegion = !!regionHtml && regionHtml.trim().length > 0;
       summary.hidden = !hasVisibleRegion;
       summary.textContent = hasVisibleRegion ? '${OBSERVATION_REGION_SUMMARY_TEXT}' : '';
     };

     var selectThumb = function(t){
       if (!t || t.classList.contains('is-active')) return;
       var src = t.getAttribute('data-obs-thumb-src');
       var assetId = t.getAttribute('data-obs-thumb-asset-id');
       var imageWidth = t.getAttribute('data-obs-thumb-width');
       var imageHeight = t.getAttribute('data-obs-thumb-height');
       var regions = t.querySelector('[data-obs-thumb-regions]');
       thumbs.forEach(function(x){ x.classList.remove('is-active'); });
       t.classList.add('is-active');
       if (previewImg && imageWidth && imageHeight) {
         previewImg.setAttribute('width', imageWidth);
         previewImg.setAttribute('height', imageHeight);
       } else if (previewImg) {
         previewImg.removeAttribute('width');
         previewImg.removeAttribute('height');
       }
       if (previewImg && src) { previewImg.src = src; }
       if (preview && assetId) { preview.setAttribute('data-obs-preview-asset-id', assetId); }
       if (previewRegions && regions) {
         previewRegions.innerHTML = regions.innerHTML;
         previewRegions.setAttribute('data-region-layer', assetId || '');
         updateRegionSummary(regions.innerHTML);
       }
     };

     thumbs.forEach(function(t){
       t.addEventListener('click', function(e){ e.preventDefault(); selectThumb(t); });
     });

     var toggleBtn = lightbox && lightbox.querySelector('[data-obs-lightbox-toggle]');
     var toggleLabel = lightbox && lightbox.querySelector('[data-obs-lightbox-toggle-label]');
     var lightboxInner = lightbox && lightbox.querySelector('[data-obs-lightbox-inner]');
     var updateToggleLabel = function(){
       if (!toggleLabel || !lightboxImg) return;
       toggleLabel.textContent = lightboxImg.classList.contains('is-fit') ? '等倍で見る' : '画面に合わせる';
     };
     var setFitMode = function(fit){
       if (!lightboxImg) return;
       lightboxImg.classList.toggle('is-fit', !!fit);
       lightboxImg.classList.toggle('is-actual', !fit);
       updateToggleLabel();
     };
     var openLightbox = function(){
       if (!lightbox || !previewImg) return;
       lightboxImg.src = previewImg.src;
       setFitMode(true);
       lightbox.classList.add('is-open');
       lightbox.scrollTop = 0;
       lightbox.scrollLeft = 0;
       document.body.style.overflow = 'hidden';
     };
     var closeLightbox = function(){
       if (!lightbox) return;
       lightbox.classList.remove('is-open');
       document.body.style.overflow = '';
     };

     if (preview) {
       preview.addEventListener('click', function(e){
         if (e.target.closest && e.target.closest('[data-obs-zoom]')) { e.preventDefault(); openLightbox(); return; }
         openLightbox();
       });
     }
     if (lightboxClose) lightboxClose.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); closeLightbox(); });
     if (toggleBtn) toggleBtn.addEventListener('click', function(e){
       e.preventDefault(); e.stopPropagation();
       setFitMode(!lightboxImg.classList.contains('is-fit'));
       if (lightboxImg.classList.contains('is-actual')) {
         var r = lightboxImg.getBoundingClientRect();
         lightbox.scrollLeft = Math.max(0, (r.width - lightbox.clientWidth) / 2);
         lightbox.scrollTop = Math.max(0, (r.height - lightbox.clientHeight) / 2);
       }
     });
     if (lightboxImg) {
       lightboxImg.addEventListener('click', function(e){
         e.stopPropagation();
         var wasfit = lightboxImg.classList.contains('is-fit');
         setFitMode(!wasfit);
         if (wasfit) {
           var r = lightboxImg.getBoundingClientRect();
           var cx = e.clientX - r.left;
           var cy = e.clientY - r.top;
           var ratioX = cx / Math.max(1, r.width);
           var ratioY = cy / Math.max(1, r.height);
           requestAnimationFrame(function(){
             var nr = lightboxImg.getBoundingClientRect();
             lightbox.scrollLeft = Math.max(0, ratioX * nr.width - lightbox.clientWidth / 2);
             lightbox.scrollTop = Math.max(0, ratioY * nr.height - lightbox.clientHeight / 2);
           });
         }
       });
       var dragState = null;
       lightboxImg.addEventListener('pointerdown', function(e){
         if (lightboxImg.classList.contains('is-fit')) return;
         dragState = { x: e.clientX, y: e.clientY, sl: lightbox.scrollLeft, st: lightbox.scrollTop };
         lightboxImg.classList.add('is-dragging');
         try { lightboxImg.setPointerCapture(e.pointerId); } catch (_) {}
       });
       lightboxImg.addEventListener('pointermove', function(e){
         if (!dragState) return;
         e.preventDefault();
         lightbox.scrollLeft = dragState.sl - (e.clientX - dragState.x);
         lightbox.scrollTop = dragState.st - (e.clientY - dragState.y);
       });
       var endDrag = function(e){
         if (!dragState) return;
         dragState = null;
         lightboxImg.classList.remove('is-dragging');
         try { lightboxImg.releasePointerCapture(e.pointerId); } catch (_) {}
       };
       lightboxImg.addEventListener('pointerup', endDrag);
       lightboxImg.addEventListener('pointercancel', endDrag);
     }
     if (lightbox) {
       lightbox.addEventListener('click', function(e){
         if (e.target === lightbox || e.target === lightboxInner) closeLightbox();
       });
     }
     document.addEventListener('keydown', function(e){
       if (!lightbox || !lightbox.classList.contains('is-open')) return;
       if (e.key === 'Escape') closeLightbox();
       if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFitMode(!lightboxImg.classList.contains('is-fit')); }
     });
    })();</script>`;
}
