import type { Env } from "./core/env";
import { FACE_PRIVACY_CLIENT_SCRIPT } from "../../src/ui/facePrivacyScript";
import {
  assertSameOriginRequest,
  base64ToArrayBuffer,
  escapeHtml,
  html,
  json,
  normalizeOptionalText,
  readJson,
  sanitizeFileName,
  sha256Hex,
} from "./core/http";
import {
  getFieldManagerRoleFromD1,
  isMunicipalWalkMapAdminRole,
  type SessionSnapshot,
} from "./core/shared";
import {
  buildGuestPassCookieHeader,
  findActiveGuestPass,
  issueGuestPass,
} from "./guestPosting";
import { prototypeEnabledForViewer } from "./prototype-flags";
import { inspectPublicDerivativeMetadata } from "./publicDerivativeMetadata";
import { recordableFacePrivacy } from "./publicMediaRepair";

export const SHOP_PHOTO_PERK_FLAG = "SHOP_PHOTO_PERK_ENABLED";

const ALLOWED_IMAGE_EXT: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "image/avif": ["avif"],
};

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const VALID_LANG_RE = /^(?:ja|en|es|pt-br)$/;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,159}$/;

export type ShopPerkConfigRow = {
  place_id: string;
  shop_name: string;
  perk_text: string;
  active: number;
  updated_by_user_id: string;
  updated_at: string;
};

export type ShopPhotoPerkRow = {
  perk_post_id: string;
  place_id: string;
  observation_id: string | null;
  asset_id: string;
  object_key: string;
  mime: string;
  owner_key: string;
  guest_pass_id: string | null;
  has_perk_disclosure: number;
  inspection_status: string;
  inspection_reason: string | null;
  face_privacy: string | null;
  moderation_status: string;
  taken_down_by_user_id: string | null;
  taken_down_at: string | null;
  checkout_session_id: string;
  perk_snapshot_text: string;
  ticket_status: string;
  redeemed_at: string | null;
  redeemed_by_actor: string | null;
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  created_at: string;
};

export type ShopPlacePerkSectionData = {
  placeId: string;
  shopName: string;
  perkText: string;
  active: boolean;
  canManage: boolean;
  photos: Array<{
    perkPostId: string;
    imageUrl: string;
    createdAt: string;
    hasPerkDisclosure: boolean;
  }>;
  metrics: ShopPerkMetrics | null;
};

export type ShopPerkMetrics = {
  qrVisits: number;
  submittedCount: number;
  passedCount: number;
  rejectedCount: number;
  redeemedCount: number;
  oneTapSavedCount: number;
  takenDownCount: number;
  submissionRate: number | null;
  redemptionCount: number;
  rejectionRate: number | null;
  oneTapSaveRate: number | null;
};

export function shopPhotoPerkEnabled(env: Env, session?: SessionSnapshot | null): boolean {
  const principalId = session && !session.banned ? session.userId : null;
  const role = session && !session.banned ? session.roleName : null;
  return prototypeEnabledForViewer(env, SHOP_PHOTO_PERK_FLAG, principalId, role);
}

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  return null;
}

function validateImageBytes(bytes: Uint8Array, mimeType: string, filename: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_IMAGE_EXT, mimeType)) {
    return "unsupported_image_type";
  }
  const headText = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 256)).trimStart().toLowerCase();
  if (headText.startsWith("<svg") || headText.startsWith("<?xml")) {
    return "svg_rejected";
  }
  const detected = detectImageMime(bytes);
  if (!detected || detected !== mimeType) {
    return "image_content_type_mismatch";
  }
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!ext || !ALLOWED_IMAGE_EXT[mimeType]?.includes(ext)) {
    return "image_extension_mismatch";
  }
  return null;
}

async function canManageShopPlace(session: SessionSnapshot | null, placeId: string, env: Env): Promise<boolean> {
  if (!session || session.banned) return false;
  if (isMunicipalWalkMapAdminRole(session)) return true;
  const fieldRole = await getFieldManagerRoleFromD1(session.userId, placeId, env).catch(() => null);
  return fieldRole === "owner" || fieldRole === "steward";
}

async function loadShopPlace(
  db: Env["OBS_DB"],
  placeId: string
): Promise<{ placeId: string; shopName: string; config: ShopPerkConfigRow | null } | null> {
  const place = await db.prepare(
    "SELECT place_id, canonical_name FROM places WHERE place_id = ? AND superseded_by_place_id IS NULL LIMIT 1"
  ).bind(placeId).first<{ place_id: string; canonical_name: string }>();
  if (!place) return null;
  const config = await db.prepare(
    "SELECT place_id, shop_name, perk_text, active, updated_by_user_id, updated_at FROM shop_perk_configs WHERE place_id = ? LIMIT 1"
  ).bind(placeId).first<ShopPerkConfigRow>();
  return {
    placeId: place.place_id,
    shopName: config?.shop_name?.trim() || place.canonical_name,
    config: config ?? null,
  };
}

async function recordMetricEvent(
  db: Env["OBS_DB"],
  placeId: string,
  eventType:
    | "qr_visit"
    | "post_submitted"
    | "inspection_passed"
    | "inspection_rejected"
    | "ticket_redeemed"
    | "save_to_record_tapped"
    | "taken_down",
  actorKey: string | null,
  perkPostId: string | null = null,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await db.prepare(
    `INSERT INTO shop_photo_perk_events (event_id, place_id, perk_post_id, event_type, actor_key, detail_json)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(`spe_${crypto.randomUUID()}`, placeId, perkPostId, eventType, actorKey, JSON.stringify(detail)).run();
}

export async function computeShopPerkMetrics(db: Env["OBS_DB"], placeId: string): Promise<ShopPerkMetrics> {
  const rows = (await db.prepare(
    `SELECT event_type, COUNT(*) AS cnt
       FROM shop_photo_perk_events
      WHERE place_id = ?
      GROUP BY event_type`
  ).bind(placeId).all<{ event_type: string; cnt: number }>()).results;

  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.event_type, Number(row.cnt ?? 0));
  }
  const qrVisits = counts.get("qr_visit") ?? 0;
  const submittedCount = counts.get("post_submitted") ?? 0;
  const passedCount = counts.get("inspection_passed") ?? 0;
  const rejectedCount = counts.get("inspection_rejected") ?? 0;
  const redeemedCount = counts.get("ticket_redeemed") ?? 0;
  const oneTapSavedCount = counts.get("save_to_record_tapped") ?? 0;
  const takenDownCount = counts.get("taken_down") ?? 0;
  const inspectedTotal = passedCount + rejectedCount;

  return {
    qrVisits,
    submittedCount,
    passedCount,
    rejectedCount,
    redeemedCount,
    oneTapSavedCount,
    takenDownCount,
    submissionRate: qrVisits > 0 ? submittedCount / qrVisits : null,
    redemptionCount: redeemedCount,
    rejectionRate: inspectedTotal > 0 ? rejectedCount / inspectedTotal : null,
    oneTapSaveRate: passedCount > 0 ? oneTapSavedCount / passedCount : null,
  };
}

/**
 * Reuse ZUKAN's derivative metadata and face-privacy inspection checks before
 * publishing a shop photo or minting a perk voucher.
 */
export async function inspectShopPhotoForPublication(input: {
  bytes: ArrayBuffer;
  mimeType: string;
  filename: string;
  facePrivacy: unknown;
  images?: Env["IMAGES"];
}): Promise<
  | { passed: true; storedBytes: ArrayBuffer; storedMime: string; facePrivacy: string }
  | { passed: false; reason: string }
> {
  const byteView = new Uint8Array(input.bytes);
  if (byteView.byteLength === 0) return { passed: false, reason: "empty_image" };
  if (byteView.byteLength > MAX_PHOTO_BYTES) return { passed: false, reason: "image_too_large" };

  const formatError = validateImageBytes(byteView, input.mimeType, input.filename);
  if (formatError) return { passed: false, reason: formatError };

  const safeFaceStatus = recordableFacePrivacy(input.facePrivacy);
  if (safeFaceStatus !== "no_faces" && safeFaceStatus !== "redacted") {
    return { passed: false, reason: "face_privacy_check_required" };
  }

  let storedBytes = input.bytes;
  let storedMime = input.mimeType;

  if (input.images) {
    try {
      const transformed = await input.images
        .input(new Response(input.bytes.slice(0)).body!)
        .transform({ width: 1200 })
        .output({ format: "image/webp", quality: 82, anim: false });
      const res = transformed.response();
      const ct = (res.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
      if (!res.ok || ct !== "image/webp") {
        return { passed: false, reason: "image_transform_failed" };
      }
      storedBytes = await res.arrayBuffer();
      storedMime = "image/webp";
    } catch {
      return { passed: false, reason: "image_transform_failed" };
    }
  }

  const inspection = inspectPublicDerivativeMetadata(storedBytes, storedMime);
  if (
    inspection.scannedContainer === "svg+xml" ||
    inspection.gpsExifPresent ||
    inspection.exactCoordinateLiteralPresent
  ) {
    return { passed: false, reason: "metadata_privacy_check_failed" };
  }
  if (storedMime === "image/webp" && inspection.scannedContainer !== "webp") {
    return { passed: false, reason: "invalid_webp_container" };
  }
  if (storedMime === "image/jpeg") {
    const asciiScan = new TextDecoder("latin1").decode(new Uint8Array(storedBytes).subarray(0, 65536)).toLowerCase();
    if (asciiScan.includes("gpslatitude") || asciiScan.includes("gpslongitude")) {
      return { passed: false, reason: "metadata_privacy_check_failed" };
    }
  }

  return { passed: true, storedBytes, storedMime, facePrivacy: safeFaceStatus };
}

function hasPerkOwnership(
  row: Pick<ShopPhotoPerkRow, "owner_key" | "guest_pass_id" | "claimed_by_user_id">,
  session: SessionSnapshot | null,
  guestPassId: string | null
): boolean {
  if (session && !session.banned) {
    if (row.owner_key === `user:${session.userId}`) return true;
    if (row.claimed_by_user_id && row.claimed_by_user_id === session.userId) return true;
  }
  if (guestPassId && (row.guest_pass_id === guestPassId || row.owner_key === `guest:${guestPassId}`)) {
    return true;
  }
  return false;
}

export async function loadShopPlacePerkSectionData(
  env: Env,
  placeId: string,
  session: SessionSnapshot | null
): Promise<ShopPlacePerkSectionData | null> {
  if (!shopPhotoPerkEnabled(env, session)) return null;
  const shop = await loadShopPlace(env.OBS_DB, placeId);
  if (!shop) return null;

  const canManage = await canManageShopPlace(session, placeId, env);
  const rows = (await env.OBS_DB.prepare(
    `SELECT perk_post_id, has_perk_disclosure, created_at
       FROM shop_photo_perks
      WHERE place_id = ?
        AND inspection_status = 'passed'
        AND moderation_status = 'published'
      ORDER BY created_at DESC, rowid DESC
      LIMIT 24`
  ).bind(placeId).all<{ perk_post_id: string; has_perk_disclosure: number; created_at: string }>()).results;

  if (!shop.config && rows.length === 0 && !canManage) return null;

  const metrics = canManage ? await computeShopPerkMetrics(env.OBS_DB, placeId) : null;
  return {
    placeId,
    shopName: shop.shopName,
    perkText: shop.config?.perk_text ?? "",
    active: shop.config?.active === 1,
    canManage,
    photos: rows.map((row) => ({
      perkPostId: row.perk_post_id,
      imageUrl: `/api/v1/shops/${encodeURIComponent(placeId)}/photo-perk/${encodeURIComponent(row.perk_post_id)}/image`,
      createdAt: row.created_at,
      hasPerkDisclosure: row.has_perk_disclosure === 1,
    })),
    metrics,
  };
}

export function renderShopPlacePerkSectionHtml(data: ShopPlacePerkSectionData | null): string {
  if (!data) return "";
  const e = escapeHtml;
  const photosHtml = data.photos.length > 0
    ? `<div class="spp-grid">${data.photos
        .map((photo) => `<article class="spp-card" data-shop-perk-post="${e(photo.perkPostId)}">
            <img src="${e(photo.imageUrl)}" alt="${e(data.shopName)}の写真" loading="lazy">
            <div class="spp-meta">
              ${photo.hasPerkDisclosure ? `<span class="spp-badge" data-shop-perk-disclosure="1">特典つき投稿</span>` : ""}
              ${data.canManage ? `<button type="button" class="spp-takedown" data-shop-takedown-btn="${e(photo.perkPostId)}">1タップで下げる</button>` : ""}
            </div>
          </article>`)
        .join("")}</div>`
    : `<p class="spp-empty">まだ公開された投稿写真はありません。</p>`;

  const manageHtml = data.canManage
    ? `<div class="spp-manage" data-shop-perk-manage="1">
        <form class="spp-config-form" id="shop-perk-config-form">
          <label for="spp-perk-text">特典の文言</label>
          <input id="spp-perk-text" name="perkText" type="text" maxlength="200" value="${e(data.perkText)}" placeholder="例：写真投稿でドリンク50円引き">
          <label class="spp-check"><input type="checkbox" name="active" ${data.active ? "checked" : ""}> 受付中（店頭QRを有効）</label>
          <button type="submit" class="spp-save-btn">特典設定を保存</button>
          <p class="spp-status" id="shop-perk-config-status" aria-live="polite"></p>
        </form>
        ${data.metrics ? `<dl class="spp-metrics" data-shop-perk-metrics="1">
          <div><dt>投稿率</dt><dd>${data.metrics.submissionRate === null ? "-" : `${Math.round(data.metrics.submissionRate * 100)}%`}</dd></div>
          <div><dt>引換数</dt><dd>${data.metrics.redemptionCount}</dd></div>
          <div><dt>はじいた率</dt><dd>${data.metrics.rejectionRate === null ? "-" : `${Math.round(data.metrics.rejectionRate * 100)}%`}</dd></div>
          <div><dt>1タップ登録率</dt><dd>${data.metrics.oneTapSaveRate === null ? "-" : `${Math.round(data.metrics.oneTapSaveRate * 100)}%`}</dd></div>
        </dl>` : ""}
        <p class="spp-note">店頭QR URL: <code>/ja/shops/${e(data.placeId)}/qr</code>（実店舗への案内・公開はスイッチON後に判断）</p>
      </div>
      <script>(()=>{const placeId=${JSON.stringify(data.placeId).replace(/</g, "\\u003c")};const form=document.getElementById("shop-perk-config-form");if(form){form.addEventListener("submit",async(ev)=>{ev.preventDefault();const fd=new FormData(form);const res=await fetch("/api/v1/shops/"+encodeURIComponent(placeId)+"/perk-config",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({perkText:String(fd.get("perkText")||""),active:Boolean(fd.get("active"))})});document.getElementById("shop-perk-config-status").textContent=res.ok?"保存しました":"保存に失敗しました";});}document.querySelectorAll("[data-shop-takedown-btn]").forEach(btn=>btn.addEventListener("click",async()=>{const id=btn.getAttribute("data-shop-takedown-btn");if(!id)return;const res=await fetch("/api/v1/shops/"+encodeURIComponent(placeId)+"/photo-perk/"+encodeURIComponent(id)+"/takedown",{method:"POST"});if(res.ok){btn.closest("[data-shop-perk-post]")?.remove();}}));})();</script>`
    : "";

  return `<section class="spp-sec" data-shop-photo-perks="1" aria-labelledby="spp-title">
    <style>
      .spp-sec{margin:24px auto 0;max-width:1120px;padding:18px;border:1px solid #dce3dd;border-radius:16px;background:#f7f8f6}
      .spp-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}
      .spp-head h2{margin:0;font-size:19px;font-weight:800}
      .spp-perk-pill{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:#e8f2ec;color:#143f2e;font-size:14px;font-weight:700}
      .spp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
      .spp-card{border:1px solid #dce3dd;border-radius:12px;overflow:hidden;background:#fff}
      .spp-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#eef1ed}
      .spp-meta{padding:8px 10px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px}
      .spp-badge{font-size:14px;font-weight:700;color:#245c3a}
      .spp-takedown{min-height:44px;padding:6px 10px;border:1px solid #b91c1c;border-radius:8px;background:#fff;color:#b91c1c;font-weight:700;cursor:pointer}
      .spp-manage{margin-top:16px;padding-top:14px;border-top:1px solid #dce3dd;display:grid;gap:12px}
      .spp-config-form{display:grid;gap:8px;max-width:480px}
      .spp-config-form input[type="text"]{min-height:44px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
      .spp-save-btn{min-height:44px;padding:8px 14px;border:0;border-radius:8px;background:#143f2e;color:#fff;font-weight:700;cursor:pointer;justify-self:start}
      .spp-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:0}
      .spp-metrics>div{padding:8px 10px;border-radius:8px;background:#fff;border:1px solid #dce3dd}
      .spp-metrics dt{font-size:14px;color:#485a4e}.spp-metrics dd{margin:2px 0 0;font-size:18px;font-weight:800}
      .spp-status,.spp-note,.spp-empty{margin:0;font-size:14px;color:#485a4e}
    </style>
    <div class="spp-head">
      <h2 id="spp-title">店の写真投稿</h2>
      ${data.active && data.perkText ? `<span class="spp-perk-pill">${e(data.perkText)}</span>` : ""}
    </div>
    ${photosHtml}
    ${manageHtml}
  </section>`;
}

function renderShopQrPhotoHtml(input: {
  lang: string;
  placeId: string;
  shopName: string;
  perkText: string;
  active: boolean;
  hasPassOrSession: boolean;
}): string {
  const e = escapeHtml;
  const body = !input.active
    ? `<section class="spq-card"><p>現在このお店の特典つき写真投稿は受付を休止しています。</p></section>`
    : input.hasPassOrSession
      ? `<section class="spq-card">
          <p class="spq-badge" data-shop-perk-disclosure="1">特典つき投稿</p>
          <p class="spq-perk">${e(input.perkText || "店頭特典つき投稿")}</p>
          <form class="spq-form" id="shop-photo-form">
            <label for="spq-file">その場で写真を撮影して投稿（1会計1回）</label>
            <input id="spq-file" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required>
            <button type="submit" class="spq-btn">写真を送って引換券を出す</button>
            <p class="spq-status" id="spq-status" aria-live="polite"></p>
          </form>
        </section>`
      : `<section class="spq-card">
          <p class="spq-badge" data-shop-perk-disclosure="1">特典つき投稿</p>
          <p class="spq-perk">${e(input.perkText || "店頭特典つき投稿")}</p>
          <button type="button" class="spq-btn" id="spq-start-btn">カメラで参加する</button>
          <p class="spq-status" id="spq-start-status" aria-live="polite"></p>
        </section>`;

  const script = `<script>window.ikimonFacePrivacyAssetBase="/assets/face-privacy";</script><script>${FACE_PRIVACY_CLIENT_SCRIPT}</script><script>(()=>{const placeId=${JSON.stringify(input.placeId).replace(/</g, "\\u003c")};const start=document.getElementById("spq-start-btn");if(start){start.addEventListener("click",async()=>{start.disabled=true;const r=await fetch("/api/v1/shops/"+encodeURIComponent(placeId)+"/pass/issue",{method:"POST"});if(r.ok)location.reload();else{document.getElementById("spq-start-status").textContent="開始できませんでした";start.disabled=false;}});}const form=document.getElementById("shop-photo-form");if(form){form.addEventListener("submit",async(ev)=>{ev.preventDefault();const file=document.getElementById("spq-file").files?.[0];if(!file)return;const st=document.getElementById("spq-status");st.textContent="写真を検査しています…";let mimeType=file.type||"image/jpeg";let filename=file.name||"shot.jpg";let b64="";let facePrivacy="pending";try{const bmp=await createImageBitmap(file);const canvas=document.createElement("canvas");const scale=Math.min(1,1280/Math.max(bmp.width,bmp.height,1));canvas.width=Math.max(1,Math.round(bmp.width*scale));canvas.height=Math.max(1,Math.round(bmp.height*scale));const ctx=canvas.getContext("2d");if(ctx){ctx.drawImage(bmp,0,0,canvas.width,canvas.height);const api=window.ikimonFacePrivacy;if(api&&typeof api.redactCanvasFaces==="function"&&typeof api.summarizeFacePrivacy==="function"){const summary=api.summarizeFacePrivacy(await api.redactCanvasFaces(canvas,{}));facePrivacy=summary.status==="redacted"||summary.status==="no_faces"?summary.status:"pending";}const dataUrl=canvas.toDataURL("image/webp",0.86);if(dataUrl.startsWith("data:image/webp;base64,")){mimeType="image/webp";filename="shot.webp";b64=dataUrl.split(",")[1]||"";}}}catch{}if(!b64){b64=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result).split(",")[1]||"");fr.onerror=rej;fr.readAsDataURL(file);});}const r=await fetch("/api/v1/shops/"+encodeURIComponent(placeId)+"/photo-perk",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({mimeType,filename,base64Data:b64,facePrivacy})});const data=await r.json().catch(()=>({}));if(r.ok&&data.ticketUrl){location.href=data.ticketUrl;}else{st.textContent="公開判定を通過できませんでした ("+(data.reason||r.status)+")";}});}})();</script>`;

  return `<!doctype html>
<html lang="${e(input.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${e(input.shopName)} — 写真で特典</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#17251b;font-family:"Noto Sans JP",system-ui,sans-serif;font-size:16px;line-height:1.5}
    .spq-main{max-width:520px;margin:0 auto;padding:20px 16px 40px;display:grid;gap:14px}
    .spq-card{padding:18px;border:1px solid #dce3dd;border-radius:14px;background:#f6f7f6;display:grid;gap:12px}
    .spq-badge{margin:0;padding:4px 10px;border-radius:999px;background:#e8f2ec;color:#143f2e;font-size:14px;font-weight:700;justify-self:start}
    .spq-perk{margin:0;font-size:18px;font-weight:800}
    .spq-form{display:grid;gap:12px}
    .spq-form input[type="file"]{min-height:44px;font:inherit}
    .spq-btn{min-height:48px;padding:12px 16px;border:0;border-radius:10px;background:#b94f18;color:#fff;font:inherit;font-weight:800;cursor:pointer}
    .spq-status{margin:0;font-size:14px;color:#485a4e}
  </style>
</head>
<body>
  <main class="spq-main" data-shop-qr-page="1" data-place-id="${e(input.placeId)}">
    <header><h1 style="margin:0;font-size:22px">${e(input.shopName)}</h1></header>
    ${body}
  </main>
  ${script}
</body>
</html>`;
}

function renderShopTicketHtml(input: {
  lang: string;
  placeId: string;
  shopName: string;
  row: ShopPhotoPerkRow;
  serverNowIso: string;
  viewerLoggedIn: boolean;
}): string {
  const e = escapeHtml;
  const redeemed = input.row.ticket_status === "redeemed";
  const ticketPath = `/${input.lang}/shops/${encodeURIComponent(input.placeId)}/tickets/${encodeURIComponent(input.row.perk_post_id)}`;
  const imageUrl = `/api/v1/shops/${encodeURIComponent(input.placeId)}/photo-perk/${encodeURIComponent(input.row.perk_post_id)}/image`;

  const script = `<script>(()=>{const clock=document.querySelector("[data-shop-ticket-clock]");const baseMs=Date.parse(${JSON.stringify(input.serverNowIso)});const loadedMs=Date.now();const fmt=()=>{const now=new Date(baseMs+(Date.now()-loadedMs));if(clock)clock.textContent=now.toLocaleTimeString("ja-JP",{hour12:false});};fmt();setInterval(fmt,1000);const placeId=${JSON.stringify(input.placeId).replace(/</g, "\\u003c")};const postId=${JSON.stringify(input.row.perk_post_id).replace(/</g, "\\u003c")};const redeemBtn=document.getElementById("spt-redeem-btn");if(redeemBtn){redeemBtn.addEventListener("click",async()=>{redeemBtn.disabled=true;const r=await fetch("/api/v1/shops/"+encodeURIComponent(placeId)+"/tickets/"+encodeURIComponent(postId)+"/redeem",{method:"POST"});if(r.ok){location.reload();}else{document.getElementById("spt-redeem-status").textContent="使用できませんでした ("+r.status+")";redeemBtn.disabled=false;}});}const saveBtn=document.getElementById("spt-save-btn");if(saveBtn){saveBtn.addEventListener("click",async()=>{const r=await fetch("/api/v1/shops/"+encodeURIComponent(placeId)+"/photo-perk/"+encodeURIComponent(postId)+"/save-to-record",{method:"POST"});const d=await r.json().catch(()=>({}));if(r.status===401&&d.loginUrl){location.href=d.loginUrl;return;}if(r.ok){document.getElementById("spt-save-status").textContent="自分の記録に保存しました";}else{document.getElementById("spt-save-status").textContent="保存できませんでした ("+r.status+")";}});}})();</script>`;

  return `<!doctype html>
<html lang="${e(input.lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>引換券 — ${e(input.shopName)}</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#17251b;font-family:"Noto Sans JP",system-ui,sans-serif;font-size:16px;line-height:1.5}
    .spt-main{max-width:460px;margin:0 auto;padding:20px 16px 40px;display:grid;gap:14px}
    .spt-ticket{padding:18px;border:2px dashed #143f2e;border-radius:16px;background:#f7f9f7;display:grid;gap:12px}
    .spt-head{display:flex;align-items:center;gap:12px}
    .spt-thumb{width:88px;height:88px;border-radius:10px;object-fit:cover;flex:none;background:#eef1ed}
    .spt-clock{margin:0;font-family:ui-monospace,monospace;font-size:22px;font-weight:800;color:#143f2e}
    .spt-perk{margin:0;font-size:18px;font-weight:800}
    .spt-redeem{min-height:48px;padding:12px 16px;border:0;border-radius:10px;background:#b94f18;color:#fff;font:inherit;font-weight:800;cursor:pointer}
    .spt-redeem:disabled{background:#94a3b8;cursor:default}
    .spt-save{min-height:44px;padding:10px 14px;border:1px solid #143f2e;border-radius:10px;background:#fff;color:#143f2e;font:inherit;font-weight:700;cursor:pointer}
    .spt-status{margin:0;font-size:14px;color:#485a4e}
  </style>
</head>
<body>
  <main class="spt-main" data-shop-ticket-page="1">
    <section class="spt-ticket">
      <div class="spt-head">
        <img class="spt-thumb" src="${e(imageUrl)}" alt="投稿写真の縮小画像" width="88" height="88">
        <div>
          <p style="margin:0;font-size:14px;color:#485a4e">引換券（1会計1回）</p>
          <h1 style="margin:2px 0 0;font-size:20px">${e(input.shopName)}</h1>
        </div>
      </div>
      <p class="spt-perk">${e(input.row.perk_snapshot_text)}</p>
      <p class="spt-clock" data-shop-ticket-clock aria-live="off">${e(input.serverNowIso.slice(11, 19))}</p>
      <button type="button" class="spt-redeem" id="spt-redeem-btn" ${redeemed ? "disabled" : ""}>
        ${redeemed ? "使用済み" : "店員が押す・使用済みにする（もぎり）"}
      </button>
      <p class="spt-status" id="spt-redeem-status" aria-live="polite">${redeemed && input.row.redeemed_at ? `引換時刻: ${e(input.row.redeemed_at)}` : ""}</p>
    </section>
    <section>
      <button type="button" class="spt-save" id="spt-save-btn" data-save-to-record="1">この写真を自分の記録に残す</button>
      ${input.viewerLoggedIn ? "" : `<p class="spt-status">未ログインの場合は <a href="/login?next=${e(encodeURIComponent(ticketPath))}">ログイン</a> 後に保存されます。</p>`}
      <p class="spt-status" id="spt-save-status" aria-live="polite"></p>
    </section>
  </main>
  ${script}
</body>
</html>`;
}

/**
 * Dispatch all SHOP_PHOTO_PERK_ENABLED routes. Returns null if path is unrelated.
 */
export async function handleShopPhotoPerkRequest(
  request: Request,
  url: URL,
  env: Env,
  session: SessionSnapshot | null
): Promise<Response | null> {
  const qrMatch = url.pathname.match(/^(?:\/(ja|en|es|pt-br))?\/shops\/([^/]+)\/qr$/);
  const ticketPageMatch = url.pathname.match(/^(?:\/(ja|en|es|pt-br))?\/shops\/([^/]+)\/tickets\/([^/]+)$/);
  const apiMatch = url.pathname.match(
    /^\/api\/v1\/shops\/([^/]+)\/(pass\/issue|perk-config|photo-perk|perk-metrics|tickets\/([^/]+)\/redeem|photo-perk\/([^/]+)\/(?:takedown|save-to-record|image))$/
  );

  if (!qrMatch && !ticketPageMatch && !apiMatch) return null;

  if (!shopPhotoPerkEnabled(env, session)) {
    return json({ ok: false, error: "shop_photo_perk_disabled" }, 404, { "cache-control": "no-store" });
  }

  const placeIdRaw = decodeURIComponent((qrMatch?.[2] ?? ticketPageMatch?.[2] ?? apiMatch?.[1]) ?? "");
  if (!SAFE_ID_RE.test(placeIdRaw)) {
    return json({ ok: false, error: "invalid_place_id" }, 400, { "cache-control": "no-store" });
  }
  const placeId = placeIdRaw;

  // GET /:lang/shops/:placeId/qr
  if (qrMatch && (request.method === "GET" || request.method === "HEAD")) {
    const lang = qrMatch[1] && VALID_LANG_RE.test(qrMatch[1]) ? qrMatch[1] : "ja";
    const shop = await loadShopPlace(env.OBS_DB, placeId);
    if (!shop) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    const pass = await findActiveGuestPass(env.OBS_DB, request);
    const active = shop.config?.active === 1;
    if (active) {
      await recordMetricEvent(env.OBS_DB, placeId, "qr_visit", pass ? `guest:${pass.pass_id}` : session?.userId ?? null);
    }
    const body = renderShopQrPhotoHtml({
      lang,
      placeId,
      shopName: shop.shopName,
      perkText: shop.config?.perk_text ?? "",
      active,
      hasPassOrSession: Boolean(pass || (session && !session.banned)),
    });
    return html(request.method === "HEAD" ? "" : body, 200, { "cache-control": "no-store" });
  }

  // PUT /api/v1/shops/:placeId/perk-config
  if (apiMatch && apiMatch[2] === "perk-config" && request.method === "PUT") {
    const sameOriginErr = assertSameOriginRequest(request);
    if (sameOriginErr) return sameOriginErr;
    if (!session || session.banned) return json({ ok: false, error: "login_required" }, 401, { "cache-control": "no-store" });
    if (!(await canManageShopPlace(session, placeId, env))) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
    const shop = await loadShopPlace(env.OBS_DB, placeId);
    if (!shop) return json({ ok: false, error: "place_not_found" }, 404, { "cache-control": "no-store" });

    const body = await readJson<{ perkText?: unknown; shopName?: unknown; active?: unknown }>(request);
    const perkText = normalizeOptionalText(body.perkText)?.slice(0, 200) ?? "";
    if (!perkText) return json({ ok: false, error: "perk_text_required" }, 400, { "cache-control": "no-store" });
    const shopName = normalizeOptionalText(body.shopName)?.slice(0, 120) ?? shop.shopName;
    const active = body.active === false ? 0 : 1;

    await env.OBS_DB.prepare(
      `INSERT INTO shop_perk_configs (place_id, shop_name, perk_text, active, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(place_id) DO UPDATE SET
         shop_name = excluded.shop_name,
         perk_text = excluded.perk_text,
         active = excluded.active,
         updated_by_user_id = excluded.updated_by_user_id,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(placeId, shopName, perkText, active, session.userId).run();

    return json({ ok: true, placeId, shopName, perkText, active: active === 1 }, 200, { "cache-control": "no-store" });
  }

  // GET /api/v1/shops/:placeId/perk-metrics
  if (apiMatch && apiMatch[2] === "perk-metrics" && request.method === "GET") {
    if (!session || session.banned) return json({ ok: false, error: "login_required" }, 401, { "cache-control": "no-store" });
    if (!(await canManageShopPlace(session, placeId, env))) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
    const metrics = await computeShopPerkMetrics(env.OBS_DB, placeId);
    return json({ ok: true, placeId, ...metrics }, 200, { "cache-control": "no-store" });
  }

  // POST /api/v1/shops/:placeId/pass/issue
  if (apiMatch && apiMatch[2] === "pass/issue" && request.method === "POST") {
    const sameOriginErr = assertSameOriginRequest(request);
    if (sameOriginErr) return sameOriginErr;
    const shop = await loadShopPlace(env.OBS_DB, placeId);
    if (!shop || shop.config?.active !== 1) {
      return json({ ok: false, error: "shop_perk_inactive" }, 404, { "cache-control": "no-store" });
    }
    const issued = await issueGuestPass(env.OBS_DB, { destination: { kind: "place", id: placeId } });
    return json(
      { ok: true, passId: issued.passId, placeId },
      201,
      {
        "cache-control": "no-store",
        "set-cookie": buildGuestPassCookieHeader(issued.rawToken, url.protocol === "https:"),
      }
    );
  }

  // POST /api/v1/shops/:placeId/photo-perk
  if (apiMatch && apiMatch[2] === "photo-perk" && request.method === "POST") {
    const sameOriginErr = assertSameOriginRequest(request);
    if (sameOriginErr) return sameOriginErr;

    const pass = await findActiveGuestPass(env.OBS_DB, request);
    const activeSession = session && !session.banned ? session : null;
    if (!pass && !activeSession) {
      return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
    }
    const shop = await loadShopPlace(env.OBS_DB, placeId);
    if (!shop || !shop.config || shop.config.active !== 1) {
      return json({ ok: false, error: "shop_perk_inactive" }, 404, { "cache-control": "no-store" });
    }

    const ownerKey = pass ? `guest:${pass.pass_id}` : `user:${activeSession!.userId}`;
    const checkoutSessionId = pass
      ? `checkout:guest:${pass.pass_id}`
      : `checkout:user:${activeSession!.userId}:${new Date().toISOString().slice(0, 10)}`;

    const existingCheckout = await env.OBS_DB.prepare(
      `SELECT perk_post_id FROM shop_photo_perks
        WHERE place_id = ? AND checkout_session_id = ? AND inspection_status = 'passed'
        LIMIT 1`
    ).bind(placeId, checkoutSessionId).first<{ perk_post_id: string }>();
    if (existingCheckout) {
      return json({ ok: false, error: "already_claimed_for_checkout" }, 409, { "cache-control": "no-store" });
    }

    const body = await readJson<{ mimeType?: unknown; filename?: unknown; base64Data?: unknown; facePrivacy?: unknown }>(request);
    const mimeType = (normalizeOptionalText(body.mimeType) ?? "image/jpeg").split(";", 1)[0]!.trim().toLowerCase();
    const filename = sanitizeFileName(normalizeOptionalText(body.filename) ?? "shot.jpg");
    const rawBuffer = base64ToArrayBuffer(normalizeOptionalText(body.base64Data) ?? "");

    await recordMetricEvent(env.OBS_DB, placeId, "post_submitted", ownerKey);

    const inspection = await inspectShopPhotoForPublication({
      bytes: rawBuffer,
      mimeType,
      filename,
      facePrivacy: body.facePrivacy,
      images: env.IMAGES,
    });

    const perkPostId = `spp_${crypto.randomUUID()}`;
    const assetId = `asset_shop_${crypto.randomUUID()}`;

    if (!inspection.passed) {
      await env.OBS_DB.prepare(
        `INSERT INTO shop_photo_perks
         (perk_post_id, place_id, asset_id, object_key, mime, owner_key, guest_pass_id, has_perk_disclosure,
          inspection_status, inspection_reason, moderation_status, checkout_session_id, perk_snapshot_text, ticket_status)
         VALUES (?, ?, ?, '', ?, ?, ?, 1, 'rejected', ?, 'rejected', ?, ?, 'void')`
      ).bind(
        perkPostId,
        placeId,
        assetId,
        mimeType,
        ownerKey,
        pass?.pass_id ?? null,
        inspection.reason,
        checkoutSessionId,
        shop.config.perk_text
      ).run();
      await recordMetricEvent(env.OBS_DB, placeId, "inspection_rejected", ownerKey, perkPostId, { reason: inspection.reason });
      return json({ ok: false, passed: false, reason: inspection.reason }, 422, { "cache-control": "no-store" });
    }

    const objectKey = `derived/shop-perks/${placeId}/${perkPostId}.webp`;
    await env.ASSET_BUCKET.put(objectKey, inspection.storedBytes, {
      httpMetadata: { contentType: inspection.storedMime },
    });

    try {
      await env.OBS_DB.prepare(
        `INSERT INTO shop_photo_perks
         (perk_post_id, place_id, asset_id, object_key, mime, owner_key, guest_pass_id, has_perk_disclosure,
          inspection_status, face_privacy, moderation_status, checkout_session_id, perk_snapshot_text, ticket_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'passed', ?, 'published', ?, ?, 'issued')`
      ).bind(
        perkPostId,
        placeId,
        assetId,
        objectKey,
        inspection.storedMime,
        ownerKey,
        pass?.pass_id ?? null,
        inspection.facePrivacy,
        checkoutSessionId,
        shop.config.perk_text
      ).run();
    } catch (error) {
      await env.ASSET_BUCKET.delete(objectKey).catch(() => undefined);
      throw error;
    }
    await recordMetricEvent(env.OBS_DB, placeId, "inspection_passed", ownerKey, perkPostId);

    const ticketUrl = `/ja/shops/${encodeURIComponent(placeId)}/tickets/${encodeURIComponent(perkPostId)}`;
    return json(
      {
        ok: true,
        passed: true,
        perkPostId,
        placeId,
        ticketStatus: "issued",
        moderationStatus: "published",
        hasPerkDisclosure: true,
        ticketUrl,
      },
      201,
      { "cache-control": "no-store" }
    );
  }

  // GET /:lang/shops/:placeId/tickets/:perkPostId
  if (ticketPageMatch && (request.method === "GET" || request.method === "HEAD")) {
    const lang = ticketPageMatch[1] && VALID_LANG_RE.test(ticketPageMatch[1]) ? ticketPageMatch[1] : "ja";
    const perkPostId = decodeURIComponent(ticketPageMatch[3]!);
    const pass = await findActiveGuestPass(env.OBS_DB, request);
    if (!pass && (!session || session.banned)) {
      return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
    }
    const row = await env.OBS_DB.prepare(
      `SELECT * FROM shop_photo_perks WHERE perk_post_id = ? AND place_id = ? LIMIT 1`
    ).bind(perkPostId, placeId).first<ShopPhotoPerkRow>();
    if (!row) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

    const isOwner = hasPerkOwnership(row, session, pass?.pass_id ?? null);
    const isManager = await canManageShopPlace(session, placeId, env);
    if (!isOwner && !isManager) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
    if (row.inspection_status !== "passed") {
      return json({ ok: false, error: "inspection_not_passed" }, 409, { "cache-control": "no-store" });
    }
    const shop = await loadShopPlace(env.OBS_DB, placeId);
    const body = renderShopTicketHtml({
      lang,
      placeId,
      shopName: shop?.shopName ?? placeId,
      row,
      serverNowIso: new Date().toISOString(),
      viewerLoggedIn: Boolean(session && !session.banned),
    });
    return html(request.method === "HEAD" ? "" : body, 200, { "cache-control": "no-store" });
  }

  // POST /api/v1/shops/:placeId/tickets/:perkPostId/redeem
  if (apiMatch && apiMatch[3] && request.method === "POST") {
    const sameOriginErr = assertSameOriginRequest(request);
    if (sameOriginErr) return sameOriginErr;
    const perkPostId = decodeURIComponent(apiMatch[3]);
    const pass = await findActiveGuestPass(env.OBS_DB, request);
    if (!pass && (!session || session.banned)) {
      return json({ ok: false, error: "auth_required" }, 401, { "cache-control": "no-store" });
    }
    const row = await env.OBS_DB.prepare(
      `SELECT * FROM shop_photo_perks WHERE perk_post_id = ? AND place_id = ? LIMIT 1`
    ).bind(perkPostId, placeId).first<ShopPhotoPerkRow>();
    if (!row) return json({ ok: false, error: "ticket_not_found" }, 404, { "cache-control": "no-store" });

    const isOwner = hasPerkOwnership(row, session, pass?.pass_id ?? null);
    const isManager = await canManageShopPlace(session, placeId, env);
    if (!isOwner && !isManager) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
    if (row.inspection_status !== "passed" || row.moderation_status !== "published") {
      return json({ ok: false, error: "ticket_unavailable" }, 409, { "cache-control": "no-store" });
    }
    if (row.ticket_status !== "issued") {
      return json({ ok: false, error: "already_redeemed" }, 409, { "cache-control": "no-store" });
    }

    const actor = isManager && session ? `staff:${session.userId}` : "staff_tap";
    const updateRes = await env.OBS_DB.prepare(
      `UPDATE shop_photo_perks
          SET ticket_status = 'redeemed',
              redeemed_at = CURRENT_TIMESTAMP,
              redeemed_by_actor = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE perk_post_id = ? AND place_id = ? AND ticket_status = 'issued'`
    ).bind(actor, perkPostId, placeId).run();
    const changes = Number((updateRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
    if (changes === 0) {
      return json({ ok: false, error: "already_redeemed" }, 409, { "cache-control": "no-store" });
    }
    await recordMetricEvent(env.OBS_DB, placeId, "ticket_redeemed", actor, perkPostId);
    return json({ ok: true, perkPostId, ticketStatus: "redeemed" }, 200, { "cache-control": "no-store" });
  }

  // GET /api/v1/shops/:placeId/photo-perk/:perkPostId/image
  if (apiMatch && apiMatch[4] && url.pathname.endsWith("/image") && request.method === "GET") {
    const perkPostId = decodeURIComponent(apiMatch[4]);
    const row = await env.OBS_DB.prepare(
      `SELECT * FROM shop_photo_perks WHERE perk_post_id = ? AND place_id = ? LIMIT 1`
    ).bind(perkPostId, placeId).first<ShopPhotoPerkRow>();
    if (!row || !row.object_key) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

    const isPublic = row.inspection_status === "passed" && row.moderation_status === "published";
    if (!isPublic) {
      const pass = await findActiveGuestPass(env.OBS_DB, request);
      const isOwner = hasPerkOwnership(row, session, pass?.pass_id ?? null);
      const isManager = await canManageShopPlace(session, placeId, env);
      if (!isOwner && !isManager) {
        return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
      }
    }
    const obj = await env.ASSET_BUCKET.get(row.object_key);
    if (!obj?.body) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
    return new Response(obj.body, {
      status: 200,
      headers: {
        "content-type": row.mime || "image/webp",
        "cache-control": isPublic ? "public, max-age=300" : "private, no-store",
      },
    });
  }

  // POST /api/v1/shops/:placeId/photo-perk/:perkPostId/takedown
  if (apiMatch && apiMatch[4] && url.pathname.endsWith("/takedown") && request.method === "POST") {
    const sameOriginErr = assertSameOriginRequest(request);
    if (sameOriginErr) return sameOriginErr;
    if (!session || session.banned) return json({ ok: false, error: "login_required" }, 401, { "cache-control": "no-store" });
    if (!(await canManageShopPlace(session, placeId, env))) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
    const perkPostId = decodeURIComponent(apiMatch[4]);
    const res = await env.OBS_DB.prepare(
      `UPDATE shop_photo_perks
          SET moderation_status = 'taken_down',
              taken_down_by_user_id = ?,
              taken_down_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE perk_post_id = ? AND place_id = ?`
    ).bind(session.userId, perkPostId, placeId).run();
    const changes = Number((res as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
    if (changes === 0) return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });
    await recordMetricEvent(env.OBS_DB, placeId, "taken_down", session.userId, perkPostId);
    return json({ ok: true, perkPostId, moderationStatus: "taken_down" }, 200, { "cache-control": "no-store" });
  }

  // POST /api/v1/shops/:placeId/photo-perk/:perkPostId/save-to-record
  if (apiMatch && apiMatch[4] && url.pathname.endsWith("/save-to-record") && request.method === "POST") {
    const sameOriginErr = assertSameOriginRequest(request);
    if (sameOriginErr) return sameOriginErr;
    const perkPostId = decodeURIComponent(apiMatch[4]);
    const ticketNext = `/ja/shops/${encodeURIComponent(placeId)}/tickets/${encodeURIComponent(perkPostId)}`;
    if (!session || session.banned) {
      return json(
        { ok: false, error: "login_required", loginUrl: `/login?next=${encodeURIComponent(ticketNext)}` },
        401,
        { "cache-control": "no-store" }
      );
    }

    const pass = await findActiveGuestPass(env.OBS_DB, request);
    const row = await env.OBS_DB.prepare(
      `SELECT * FROM shop_photo_perks WHERE perk_post_id = ? AND place_id = ? LIMIT 1`
    ).bind(perkPostId, placeId).first<ShopPhotoPerkRow>();
    if (!row) return json({ ok: false, error: "not_found" }, 404, { "cache-control": "no-store" });

    if (!hasPerkOwnership(row, session, pass?.pass_id ?? null)) {
      return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
    }
    if (row.observation_id && row.claimed_by_user_id === session.userId) {
      return json({ ok: true, alreadySaved: true, observationId: row.observation_id, ownerUserId: session.userId }, 200, { "cache-control": "no-store" });
    }

    const nowIso = new Date().toISOString();
    const partitionMonth = nowIso.slice(0, 7);
    const observationId = `obs_shop_${crypto.randomUUID()}`;
    const draftId = `draft_shop_${crypto.randomUUID()}`;
    const savedAssetId = `asset_shop_rec_${crypto.randomUUID()}`;
    const obj = await env.ASSET_BUCKET.get(row.object_key);
    const objBytes = obj?.body ? await new Response(obj.body).arrayBuffer() : null;
    const digest = objBytes ? await sha256Hex(objBytes) : await sha256Hex(new TextEncoder().encode(row.object_key).buffer);

    await env.OBS_DB.batch([
      env.OBS_DB.prepare(
        `INSERT INTO draft_observations
         (draft_id, owner_user_id, observed_at, public_cell, visibility, processing_state, finalized_at)
         VALUES (?, ?, ?, 'private', 'private', 'finalized', CURRENT_TIMESTAMP)`
      ).bind(draftId, session.userId, nowIso),
      env.OBS_DB.prepare(
        `INSERT INTO observations
         (observation_id, draft_id, owner_user_id, observed_at, taxon_label, public_cell, visibility, partition_month, processing_state)
         VALUES (?, ?, ?, ?, NULL, 'private', 'private', ?, 'accepted')`
      ).bind(observationId, draftId, session.userId, nowIso, partitionMonth),
      env.OBS_DB.prepare(
        `INSERT INTO asset_ledger
         (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility, processing_state, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private', 'uploaded', CURRENT_TIMESTAMP)`
      ).bind(savedAssetId, draftId, observationId, session.userId, row.object_key, digest, row.mime, Math.max(1, objBytes?.byteLength ?? 1)),
      env.OBS_DB.prepare(
        `UPDATE shop_photo_perks
            SET observation_id = ?, claimed_by_user_id = ?, claimed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE perk_post_id = ?`
      ).bind(observationId, session.userId, perkPostId),
    ]);
    await recordMetricEvent(env.OBS_DB, placeId, "save_to_record_tapped", session.userId, perkPostId, { observationId });
    return json({ ok: true, observationId, ownerUserId: session.userId }, 201, { "cache-control": "no-store" });
  }

  return null;
}
