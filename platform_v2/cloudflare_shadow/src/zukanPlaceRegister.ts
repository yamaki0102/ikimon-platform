import type { Env } from "./core/env";
import { assertSameOriginRequest, escapeHtml, json } from "./core/http";
import { readCompatibleSession, type SessionSnapshot } from "./core/shared";
import { prototypeEnabledForPrincipal } from "./prototype-flags";
import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { ZUKAN_SUBPAGE_CSS } from "./zukanSubpageUi";
import {
  bboxForPlaceGeometry,
  defaultPlacePolicy,
  normalizePlaceSearchText,
  type PlaceGeometry,
  type PlaceKind,
} from "../../src/services/placeDomain";

export const PLACE_REGISTER_FLAG = "PLACE_REGISTER_ENABLED";
export const PLACE_REGISTER_VIA = "admin_place_register";
export const PLACE_REGISTER_SOURCE_TYPE = "owner_registered";
export const PLACE_REGISTER_VERIFICATION = "owner_registered";
export const PLACE_REGISTER_DEDUPE_METERS = 200;
export const PLACE_REGISTER_RECENT_LIMIT = 20;
export const PLACE_REGISTER_CIRCLE_POINTS = 24;
export const PLACE_REGISTER_JAPAN_BBOX = { minLat: 20, maxLat: 46, minLng: 122, maxLng: 154 } as const;
export const PLACE_REGISTER_RADII = [50, 100, 300, 1000] as const;

export type PlaceRegisterKind = "park" | "shop" | "org" | "facility" | "other";

export const PLACE_REGISTER_KINDS: Record<PlaceRegisterKind, { label: string; placeKind: PlaceKind; defaultRadiusM: number }> = {
  park: { label: "公園・自然", placeKind: "park", defaultRadiusM: 300 },
  shop: { label: "店", placeKind: "commercial_complex", defaultRadiusM: 100 },
  org: { label: "会社・団体", placeKind: "other_named_area", defaultRadiusM: 100 },
  facility: { label: "施設", placeKind: "public_facility", defaultRadiusM: 100 },
  other: { label: "その他", placeKind: "other_named_area", defaultRadiusM: 100 },
};

const KIND_KEYS = Object.keys(PLACE_REGISTER_KINDS) as PlaceRegisterKind[];

export const PLACE_GUESS_RULES: ReadonlyArray<{ kind: PlaceRegisterKind; radiusM: number; words: readonly string[] }> = [
  { kind: "org", radiusM: 100, words: ["株式会社", "有限会社", "(株)", "（株）", "協会", "組合", "法人", "学校", "大学"] },
  { kind: "shop", radiusM: 50, words: ["店", "カフェ", "食堂", "亭", "屋", "レストラン", "ベーカリー"] },
  { kind: "park", radiusM: 300, words: ["公園", "緑地", "広場"] },
  { kind: "facility", radiusM: 100, words: ["神社", "寺", "院", "城", "跡", "遺跡", "古墳", "史跡"] },
  { kind: "park", radiusM: 300, words: ["森", "山", "川", "池", "湖", "湿地", "海岸", "浜", "自然"] },
];
export const PLACE_GUESS_WIDE_WORDS = ["山", "森", "湖", "湿地"] as const;

export function guessPlaceKindFromName(name: string): { kind: PlaceRegisterKind; radiusM: number } {
  for (const rule of PLACE_GUESS_RULES) {
    if (rule.words.some((word) => name.includes(word))) {
      const wide = rule.kind === "park" && PLACE_GUESS_WIDE_WORDS.some((word) => name.includes(word));
      return { kind: rule.kind, radiusM: wide ? 1000 : rule.radiusM };
    }
  }
  return { kind: "other", radiusM: 100 };
}
const EARTH_RADIUS_M = 6_371_008.8;

export type PlaceRegisterInput = {
  name: string;
  kind: PlaceRegisterKind;
  lat: number;
  lng: number;
  radiusM: number;
  locality: string | null;
};

export type PlaceRegisterValidation =
  | { ok: true; value: PlaceRegisterInput }
  | { ok: false; error: "invalid_name" | "invalid_kind" | "invalid_location" | "invalid_radius" | "invalid_locality" };

function finiteCoordinate(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function cleanLabel(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/u;

export function validatePlaceRegisterInput(body: unknown): PlaceRegisterValidation {
  const record = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const name = cleanLabel(record.name);
  const nameLength = [...name].length;
  if (nameLength < 1 || nameLength > 80 || CONTROL_CHARS.test(name)) return { ok: false, error: "invalid_name" };
  const kindOmitted = record.kind === undefined || record.kind === null || record.kind === "";
  const guess = guessPlaceKindFromName(name);
  const kind = kindOmitted ? guess.kind : record.kind;
  if (typeof kind !== "string" || !KIND_KEYS.includes(kind as PlaceRegisterKind)) return { ok: false, error: "invalid_kind" };
  const lat = finiteCoordinate(record.lat);
  const lng = finiteCoordinate(record.lng);
  const box = PLACE_REGISTER_JAPAN_BBOX;
  if (lat === null || lng === null || lat < box.minLat || lat > box.maxLat || lng < box.minLng || lng > box.maxLng) {
    return { ok: false, error: "invalid_location" };
  }
  const requestedRadius = record.radiusM === undefined || record.radiusM === null || record.radiusM === ""
    ? (kindOmitted ? guess.radiusM : PLACE_REGISTER_KINDS[kind as PlaceRegisterKind].defaultRadiusM)
    : finiteCoordinate(record.radiusM);
  if (requestedRadius === null || !(PLACE_REGISTER_RADII as readonly number[]).includes(requestedRadius)) {
    return { ok: false, error: "invalid_radius" };
  }
  const rawLocality = cleanLabel(record.locality);
  if ([...rawLocality].length > 80 || CONTROL_CHARS.test(rawLocality)) return { ok: false, error: "invalid_locality" };
  return {
    ok: true,
    value: {
      name,
      kind: kind as PlaceRegisterKind,
      lat,
      lng,
      radiusM: requestedRadius,
      locality: rawLocality || null,
    },
  };
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

export function circlePolygon(lat: number, lng: number, radiusM: number, points = PLACE_REGISTER_CIRCLE_POINTS): PlaceGeometry {
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const ring: number[][] = [];
  for (let index = 0; index < points; index += 1) {
    const angle = (2 * Math.PI * index) / points;
    ring.push([round6(lng + dLng * Math.cos(angle)), round6(lat + dLat * Math.sin(angle))]);
  }
  ring.push([ring[0]![0]!, ring[0]![1]!]);
  return { type: "Polygon", coordinates: [ring] };
}

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function newRegisteredPlaceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `plc_${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function isPlaceRegisterAdmin(session: SessionSnapshot | null | undefined): session is SessionSnapshot {
  return Boolean(session && !session.banned && session.userId && (session.roleName ?? "").trim().toLowerCase() === "admin");
}

type Db = Env["OBS_DB"];

type RegisteredPlaceRow = {
  place_id: string;
  canonical_name: string;
  place_kind: string;
  locality_label: string | null;
  public_profile_status: string;
  metadata_json: string | null;
};

export type RecentRegisteredPlace = {
  placeId: string;
  name: string;
  kindLabel: string;
  locality: string | null;
  published: boolean;
};

function kindLabelOf(row: RegisteredPlaceRow): string {
  try {
    const meta = JSON.parse(row.metadata_json ?? "{}") as { registerKind?: unknown };
    if (typeof meta.registerKind === "string" && meta.registerKind in PLACE_REGISTER_KINDS) {
      return PLACE_REGISTER_KINDS[meta.registerKind as PlaceRegisterKind].label;
    }
  } catch {
    return "その他";
  }
  return "その他";
}

export async function listRecentRegisteredPlaces(db: Db, userId: string): Promise<RecentRegisteredPlace[]> {
  const rows = await db
    .prepare(
      `SELECT place_id, canonical_name, place_kind, locality_label, public_profile_status, metadata_json
         FROM places
        WHERE json_extract(metadata_json, '$.via') = ?
          AND json_extract(metadata_json, '$.createdBy') = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT ${PLACE_REGISTER_RECENT_LIMIT}`
    )
    .bind(PLACE_REGISTER_VIA, userId)
    .all<RegisteredPlaceRow>();
  return (rows.results ?? []).map((row) => ({
    placeId: row.place_id,
    name: row.canonical_name,
    kindLabel: kindLabelOf(row),
    locality: row.locality_label,
    published: row.public_profile_status === "published",
  }));
}

async function findDuplicate(db: Db, input: PlaceRegisterInput): Promise<string | null> {
  const dLat = 0.01;
  const dLng = 0.01 / Math.max(Math.cos((input.lat * Math.PI) / 180), 0.01);
  const rows = await db
    .prepare(
      `SELECT p.place_id AS place_id,
              (b.bbox_south + b.bbox_north) / 2.0 AS lat,
              (b.bbox_west + b.bbox_east) / 2.0 AS lng
         FROM places p
         JOIN place_boundaries b
           ON b.boundary_id = (
                SELECT b2.boundary_id
                  FROM place_boundaries b2
                 WHERE b2.place_id = p.place_id
                   AND b2.valid_to IS NULL
                   AND b2.superseded_by_boundary_id IS NULL
                   AND b2.bbox_south IS NOT NULL AND b2.bbox_north IS NOT NULL
                   AND b2.bbox_west IS NOT NULL AND b2.bbox_east IS NOT NULL
                 ORDER BY b2.is_primary DESC, b2.boundary_version DESC
                 LIMIT 1)
        WHERE p.public_profile_status = 'published'
          AND p.superseded_by_place_id IS NULL
          AND p.canonical_name_normalized = ?
          AND (b.bbox_south + b.bbox_north) / 2.0 BETWEEN ? AND ?
          AND (b.bbox_west + b.bbox_east) / 2.0 BETWEEN ? AND ?
        LIMIT 20`
    )
    .bind(normalizePlaceSearchText(input.name), input.lat - dLat, input.lat + dLat, input.lng - dLng, input.lng + dLng)
    .all<{ place_id: string; lat: number; lng: number }>();
  for (const row of rows.results ?? []) {
    if (haversineMeters(input.lat, input.lng, Number(row.lat), Number(row.lng)) <= PLACE_REGISTER_DEDUPE_METERS) return row.place_id;
  }
  return null;
}

export function buildRegisterStatements(db: Db, input: PlaceRegisterInput, placeId: string, createdBy: string) {
  const kind = PLACE_REGISTER_KINDS[input.kind];
  const geometry = circlePolygon(input.lat, input.lng, input.radiusM);
  const bbox = bboxForPlaceGeometry(geometry)!;
  const areaHa = (0.5 * PLACE_REGISTER_CIRCLE_POINTS * input.radiusM * input.radiusM * Math.sin((2 * Math.PI) / PLACE_REGISTER_CIRCLE_POINTS)) / 10_000;
  const policy = defaultPlacePolicy({ placeKind: kind.placeKind });
  const sourceReferenceId = `src_${placeId}_owner`;
  const metadata = JSON.stringify({
    via: PLACE_REGISTER_VIA,
    createdBy,
    registerKind: input.kind,
    radiusM: input.radiusM,
    lat: round6(input.lat),
    lng: round6(input.lng),
  });
  return [
    db
      .prepare(
        `INSERT INTO places (
           place_id, canonical_name, canonical_name_normalized, locality_label, place_kind,
           verification_status, public_profile_status, official_status, metadata_json
         ) VALUES (?, ?, ?, ?, ?, ?, 'published', 'unofficial', ?)`
      )
      .bind(placeId, input.name, normalizePlaceSearchText(input.name), input.locality, kind.placeKind, PLACE_REGISTER_VERIFICATION, metadata),
    db
      .prepare(
        `INSERT INTO place_source_references (
           source_reference_id, place_id, source_type, source_id, source_confidence,
           verification_status, precedence_rank, last_checked_at
         ) VALUES (?, ?, ?, ?, 0.6, 'source_verified', 50, CURRENT_TIMESTAMP)`
      )
      .bind(sourceReferenceId, placeId, PLACE_REGISTER_SOURCE_TYPE, placeId),
    db
      .prepare(
        `INSERT INTO place_boundaries (
           boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson,
           source_reference_id, source_type, confidence, precision_kind, boundary_version,
           validation_state, validation_details_json, is_primary,
           bbox_west, bbox_south, bbox_east, bbox_north, area_ha
         ) VALUES (?, ?, 'primary', 'Polygon', ?, ?, ?, 0.6, 'approximate', 1, 'valid', ?, 1, ?, ?, ?, ?, ?)`
      )
      .bind(
        `bnd_${placeId}_v1`,
        placeId,
        JSON.stringify(geometry),
        sourceReferenceId,
        PLACE_REGISTER_SOURCE_TYPE,
        JSON.stringify({ circle: { lat: round6(input.lat), lng: round6(input.lng), radiusM: input.radiusM, points: PLACE_REGISTER_CIRCLE_POINTS } }),
        bbox.west,
        bbox.south,
        bbox.east,
        bbox.north,
        areaHa
      ),
    db
      .prepare(
        `INSERT INTO place_policies (
           place_policy_id, place_id, place_visibility, recording_policy, photography_rule_status,
           public_location_mode, contribution_cta_mode, verification_status, last_checked_at
         ) VALUES (?, ?, 'public', ?, 'unknown', ?, ?, 'unverified', CURRENT_TIMESTAMP)`
      )
      .bind(`pol_${placeId}_v1`, placeId, policy.recordingPolicy, policy.publicLocationMode, policy.contributionCtaMode),
  ];
}

const NO_STORE = { "cache-control": "no-store" } as const;

function notFound(api: boolean): Response {
  return api
    ? json({ ok: false, error: "not_found" }, 404, NO_STORE)
    : new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8", ...NO_STORE } });
}

export async function createRegisteredPlace(
  db: Db,
  body: unknown,
  userId: string,
  newId: () => string = newRegisteredPlaceId
): Promise<Response> {
  const validation = validatePlaceRegisterInput(body);
  if (!validation.ok) return json({ ok: false, error: validation.error }, 400, NO_STORE);
  const input = validation.value;
  let duplicateId: string | null;
  try {
    duplicateId = await findDuplicate(db, input);
  } catch {
    return json({ ok: false, error: "duplicate_check_failed" }, 503, NO_STORE);
  }
  if (duplicateId) {
    return json({ ok: false, error: "duplicate_place", placeId: duplicateId, url: `/ja/places/${encodeURIComponent(duplicateId)}` }, 409, NO_STORE);
  }
  const placeId = newId();
  try {
    await db.batch(buildRegisterStatements(db, input, placeId, userId));
  } catch {
    return json({ ok: false, error: "register_failed" }, 500, NO_STORE);
  }
  return json(
    {
      ok: true,
      place: {
        placeId,
        name: input.name,
        kind: input.kind,
        kindLabel: PLACE_REGISTER_KINDS[input.kind].label,
        placeKind: PLACE_REGISTER_KINDS[input.kind].placeKind,
        radiusM: input.radiusM,
        lat: input.lat,
        lng: input.lng,
        locality: input.locality,
        url: `/ja/places/${encodeURIComponent(placeId)}`,
      },
    },
    201,
    NO_STORE
  );
}

export async function makeRegisteredPlacePrivate(db: Db, placeId: string): Promise<Response> {
  let changes = 0;
  try {
    const result = await db
      .prepare(
        `UPDATE places
            SET public_profile_status = 'private', updated_at = CURRENT_TIMESTAMP
          WHERE place_id = ?
            AND public_profile_status = 'published'
            AND json_extract(metadata_json, '$.via') = ?`
      )
      .bind(placeId, PLACE_REGISTER_VIA)
      .run();
    changes = Number((result as { meta?: { changes?: number } }).meta?.changes ?? 0);
  } catch {
    return json({ ok: false, error: "update_failed" }, 500, NO_STORE);
  }
  if (changes < 1) return json({ ok: false, error: "not_found" }, 404, NO_STORE);
  return json({ ok: true, placeId }, 200, NO_STORE);
}

const PAGE_CSS = `
.pr-form{display:grid;gap:16px}
.pr-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}
.pr-btn{min-height:48px;padding:10px 16px;border:1.5px solid #143F2E;border-radius:14px;background:#fff;color:#143F2E;font:inherit;font-weight:700;cursor:pointer}
.pr-btn[disabled]{opacity:.5}
.pr-msg{margin:0;min-height:1.5em;font-size:.9375rem;line-height:1.6;color:#55615a}
.pr-msg[data-tone="error"]{color:#a12626}
.pr-done{display:grid;gap:12px;padding:16px;border:2px solid #143F2E;border-radius:16px;background:#f7f7f3}
.pr-done[hidden]{display:none}
.pr-list{margin:0;padding:0;list-style:none;display:grid}
.pr-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #dde2dc}
.pr-item-main{flex:1;min-width:0}
.pr-item-main a{color:#17251b;font-weight:700;overflow-wrap:anywhere}
.pr-item-main small{display:block;color:#55615a}
.pr-item .pr-btn{min-height:44px;flex:none}
.pr-loc{margin:0;font-size:.875rem;color:#55615a}
.pr-more{border-top:1px solid #dde2dc;padding-top:8px}
.pr-more summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:#143F2E;font-weight:700}
.pr-more[open] summary{margin-bottom:8px}
.pr-more-body{display:grid;gap:16px}
`;

function renderRecentItem(place: RecentRegisteredPlace): string {
  const href = `/ja/places/${encodeURIComponent(place.placeId)}`;
  const meta = [place.kindLabel, place.locality].filter(Boolean).join(" ・ ");
  const action = place.published
    ? `<button type="button" class="pr-btn" data-pr-private="${escapeHtml(place.placeId)}">非公開に戻す</button>`
    : `<span class="pr-state">非公開</span>`;
  return `<li class="pr-item" data-pr-item="${escapeHtml(place.placeId)}"><div class="pr-item-main"><a href="${escapeHtml(href)}">${escapeHtml(place.name)}</a><small>${escapeHtml(meta)}</small></div>${action}</li>`;
}

const PAGE_SCRIPT = `(() => {
  const rules = ${JSON.stringify(PLACE_GUESS_RULES)}, wide = ${JSON.stringify(PLACE_GUESS_WIDE_WORDS)};
  const kindRadius = ${JSON.stringify(Object.fromEntries(KIND_KEYS.map((key) => [key, PLACE_REGISTER_KINDS[key].defaultRadiusM])))};
  const $ = (id) => document.getElementById(id);
  const form = $("pr-form"), msg = $("pr-msg"), loc = $("pr-loc"), done = $("pr-done"), list = $("pr-list"), nameEl = $("pr-name");
  let kindTouched = false, radiusTouched = false, fixed = false;
  const say = (text, tone) => { msg.textContent = text; msg.dataset.tone = tone || ""; };
  const guess = (name) => {
    for (const r of rules) if (r.words.some((w) => name.includes(w))) return { kind: r.kind, radiusM: r.kind === "park" && wide.some((w) => name.includes(w)) ? 1000 : r.radiusM };
    return { kind: "other", radiusM: 100 };
  };
  const setPos = (lat, lng, text) => { $("pr-lat").value = Number(lat).toFixed(6); $("pr-lng").value = Number(lng).toFixed(6); fixed = true; loc.textContent = text; };
  const locate = () => {
    if (!navigator.geolocation) { loc.textContent = "位置が取れません。詳しく から入力"; return; }
    loc.textContent = "現在地を取得中…";
    navigator.geolocation.watchPosition(
      (pos) => setPos(pos.coords.latitude, pos.coords.longitude, "現在地：取得済み（±" + Math.round(pos.coords.accuracy || 0) + "m）"),
      () => { if (!fixed) loc.textContent = "位置が取れません。詳しく から入力"; },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
  };
  const q = new URLSearchParams(location.search);
  if (q.get("lat") && q.get("lng") && Number.isFinite(Number(q.get("lat"))) && Number.isFinite(Number(q.get("lng")))) setPos(q.get("lat"), q.get("lng"), "現在地：指定済み");
  else locate();
  $("pr-radius").addEventListener("change", () => { radiusTouched = true; });
  $("pr-kind").addEventListener("change", () => { kindTouched = true; if (!radiusTouched) $("pr-radius").value = String(kindRadius[$("pr-kind").value]); });
  nameEl.addEventListener("input", () => {
    const g = guess(nameEl.value.trim());
    if (!kindTouched) $("pr-kind").value = g.kind;
    if (!radiusTouched) $("pr-radius").value = String(g.radiusM);
  });
  const post = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body || {}) });
    return { res, data: await res.json().catch(() => ({})) };
  };
  const errorText = { invalid_name: "名前を入れてください。", invalid_kind: "種類を選んでください。", invalid_location: "位置が取れていません。詳しく から入力してください。", invalid_radius: "範囲を選び直してください。", invalid_locality: "地区名は80文字までです。", not_found: "見つかりませんでした。" };
  const addItem = (place) => {
    const li = document.createElement("li"); li.className = "pr-item"; li.dataset.prItem = place.placeId;
    const main = document.createElement("div"); main.className = "pr-item-main";
    const a = document.createElement("a"); a.href = place.url; a.textContent = place.name;
    const small = document.createElement("small"); small.textContent = [place.kindLabel, place.locality].filter(Boolean).join(" ・ ");
    main.append(a, small);
    const b = document.createElement("button"); b.type = "button"; b.className = "pr-btn"; b.dataset.prPrivate = place.placeId; b.textContent = "非公開に戻す";
    li.append(main, b); list.prepend(li);
    while (list.children.length > ${PLACE_REGISTER_RECENT_LIMIT}) list.lastElementChild.remove();
  };
  const showDone = (label, url) => { const l = $("pr-done-link"); l.textContent = label; l.href = url; done.hidden = false; };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); return; }
    const btn = $("pr-submit"); btn.disabled = true; done.hidden = true; say("登録しています…");
    const body = { name, lat: $("pr-lat").value, lng: $("pr-lng").value, locality: $("pr-locality").value };
    if (kindTouched) body.kind = $("pr-kind").value;
    if (radiusTouched) body.radiusM = Number($("pr-radius").value);
    try {
      const { res, data } = await post("/api/v1/admin/places", body);
      if (res.ok && data.ok) {
        say(""); showDone("登録しました：" + data.place.name + "（開く）", data.place.url); addItem(data.place);
        nameEl.value = ""; $("pr-locality").value = ""; kindTouched = false; radiusTouched = false; $("pr-kind").value = "other"; $("pr-radius").value = "100";
      } else if (data && data.error === "duplicate_place") {
        say(""); showDone("近くに同じ名前があります（開く）", data.url);
      } else {
        say(errorText[data && data.error] || "登録できませんでした。もう一度試してください。", "error");
      }
    } catch (e) { say("通信できませんでした。もう一度試してください。", "error"); }
    btn.disabled = false; nameEl.focus();
  });
  list.addEventListener("click", async (event) => {
    const btn = event.target.closest("[data-pr-private]");
    if (!btn) return;
    btn.disabled = true;
    const { res, data } = await post("/api/v1/admin/places/" + encodeURIComponent(btn.dataset.prPrivate) + "/private").catch(() => ({ res: { ok: false }, data: {} }));
    if (res.ok && data.ok) { const s = document.createElement("span"); s.className = "pr-state"; s.textContent = "非公開"; btn.replaceWith(s); say(""); }
    else { btn.disabled = false; say("非公開に戻せませんでした。", "error"); }
  });
})();`;

export function renderPlaceRegisterPage(session: SessionSnapshot, recent: RecentRegisteredPlace[]): string {
  const kindOptions = KIND_KEYS.map((key) => `<option value="${key}"${key === "other" ? " selected" : ""}>${escapeHtml(PLACE_REGISTER_KINDS[key].label)}</option>`).join("");
  const radiusOptions = PLACE_REGISTER_RADII.map((m) => `<option value="${m}"${m === 100 ? " selected" : ""}>${m >= 1000 ? `${m / 1000}km` : `${m}m`}</option>`).join("");
  const items = recent.map(renderRecentItem).join("");
  const bodyHtml = `<section class="zt-sp" data-place-register>
<style>${ZUKAN_SUBPAGE_CSS}${PAGE_CSS}</style>
<h1 class="zt-sp-title">場所を登録</h1>
<form id="pr-form" class="pr-form" novalidate>
<label class="zt-sp-field"><span>名前</span><input id="pr-name" class="zt-sp-input" type="text" name="name" maxlength="80" required autocomplete="off" autofocus enterkeyhint="done"></label>
<button type="submit" id="pr-submit" class="zt-sp-primary" style="min-height:52px">ここを登録</button>
<p id="pr-loc" class="pr-loc" role="status" aria-live="polite">現在地を取得中…</p>
<p id="pr-msg" class="pr-msg" role="status" aria-live="polite"></p>
<div id="pr-done" class="pr-done" hidden><a id="pr-done-link" class="zt-sp-secondary" href="#">開く</a></div>
<details class="pr-more"><summary>詳しく</summary><div class="pr-more-body">
<label class="zt-sp-field"><span>種類</span><select id="pr-kind" class="zt-sp-input" name="kind">${kindOptions}</select></label>
<label class="zt-sp-field"><span>範囲</span><select id="pr-radius" class="zt-sp-input" name="radiusM">${radiusOptions}</select></label>
<div class="pr-row"><label class="zt-sp-field"><span>緯度</span><input id="pr-lat" class="zt-sp-input" type="text" inputmode="decimal" name="lat" autocomplete="off"></label><label class="zt-sp-field"><span>経度</span><input id="pr-lng" class="zt-sp-input" type="text" inputmode="decimal" name="lng" autocomplete="off"></label></div>
<label class="zt-sp-field"><span>地区名（なくてもよい）</span><input id="pr-locality" class="zt-sp-input" type="text" name="locality" maxlength="80" autocomplete="off"></label>
</div></details>
</form>
<h2 class="zt-sp-title" style="font-size:1.125rem">最近登録した場所</h2>
<ul id="pr-list" class="pr-list">${items}</ul>
<script>${PAGE_SCRIPT}</script>
</section>`;
  return renderZukanCommonShell({
    lang: "ja",
    title: "場所を登録",
    activeNav: "places",
    authenticated: true,
    displayName: session.displayName ?? null,
    bodyHtml,
    pathname: "/ja/admin/places/new",
  });
}

export type PlaceRegisterDeps = {
  readSession?: (request: Request, env: Env) => Promise<SessionSnapshot | null>;
  newId?: () => string;
};

export async function handlePlaceRegisterRequest(request: Request, env: Env, deps: PlaceRegisterDeps = {}): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  const isPage = pathname === "/ja/admin/places/new";
  const isCreate = pathname === "/api/v1/admin/places";
  const privateMatch = pathname.match(/^\/api\/v1\/admin\/places\/([^/]+)\/private$/u);
  if (!isPage && !isCreate && !privateMatch) return null;
  const api = !isPage;
  const session = await (deps.readSession ?? ((req, e) => readCompatibleSession(req, e)))(request, env).catch(() => null);
  if (!isPlaceRegisterAdmin(session)) return notFound(api);
  if (!prototypeEnabledForPrincipal(env, PLACE_REGISTER_FLAG, session.userId, session.roleName)) return notFound(api);

  if (isPage) {
    if (request.method !== "GET" && request.method !== "HEAD") return notFound(false);
    const recent = await listRecentRegisteredPlaces(env.OBS_DB, session.userId).catch(() => []);
    return new Response(request.method === "HEAD" ? null : renderPlaceRegisterPage(session, recent), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
    });
  }

  if (request.method !== "POST") return notFound(true);
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;
  if (privateMatch?.[1]) return makeRegisteredPlacePrivate(env.OBS_DB, decodeURIComponent(privateMatch[1]));
  const body = await request.json().catch(() => null);
  return createRegisteredPlace(env.OBS_DB, body, session.userId, deps.newId);
}
