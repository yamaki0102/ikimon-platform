import type { Env } from "./core/env";
import { loadOwnerAreaLabels } from "./ownerAreaLabel";
import { decodePageCursor, encodePageCursor } from "./ownerRecordPaging";
import { ZUKAN_SHELL_CSS, ZUKAN_SHELL_ICONS, renderZukanChrome } from "./zukanShellChrome";

export type LibraryV2ObservationInput = {
  observationId: string;
  observedAt: string;
  placeId: string | null;
  placeName: string | null;
  areaLabel: string | null;
  lat: number | null;
  lng: number | null;
  reportTitle: string | null;
  reportBody: string | null;
  mediaKind: "photo" | "video" | "audio" | null;
  photoUrl: string | null;
  audioTitle?: string | null;
  durationMs: number | null;
  visibility: "public" | "private" | "limited";
  zukanPublished: boolean;
  eventSession: { sessionId: string; title: string } | null;
};

export type LibraryV2VisitPhoto = {
  observationId: string;
  url: string;
  isVideo: boolean;
  durationLabel: string | null;
  timeLabel: string;
};

export type LibraryV2VisitAudio = {
  observationId: string;
  title: string;
  durationLabel: string;
  timeLabel: string;
};

export type LibraryV2Visit = {
  visitKey: string;
  dateDay: string;
  dateLabel: string;
  timeRangeLabel: string;
  headingTitle: string;
  placeId: string | null;
  placeName: string;
  areaLabel: string;
  startedAt: string;
  endedAt: string;
  observationIds: string[];
  zukanEligibleObservationIds: string[];
  photos: LibraryV2VisitPhoto[];
  videos: LibraryV2VisitPhoto[];
  audios: LibraryV2VisitAudio[];
  report: { title: string | null; body: string } | null;
  eventParticipation: { sessionId: string; title: string } | null;
  isPublic: boolean;
  zukanPublished: boolean;
};

const VISIT_GAP_MS = 3 * 60 * 60 * 1000;
const VISIT_SAME_PLACE_METERS = 500;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function enDayLabel(dateDay: string, fallback: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateDay);
  if (!m) return fallback;
  return `${MONTHS_EN[Number(m[1]) - 1] ?? ""} ${Number(m[2])}`;
}

const esc = (v: string): string =>
  v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const r = 6_371_000;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jstWallParts(iso: string): { day: string; hhmm: string; ms: number; label: string } {
  const raw = String(iso ?? "").trim();
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    const day = raw.slice(0, 10) || "1970-01-01";
    return { day, hhmm: "", ms: 0, label: day };
  }
  const jst = new Date(parsed + JST_OFFSET_MS);
  const yyyy = jst.getUTCFullYear();
  const mm = jst.getUTCMonth() + 1;
  const dd = jst.getUTCDate();
  const hh = jst.getUTCHours();
  const min = jst.getUTCMinutes();
  const wd = WEEKDAYS_JA[jst.getUTCDay()] ?? "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    day: `${yyyy}-${pad(mm)}-${pad(dd)}`,
    hhmm: `${hh}:${pad(min)}`,
    ms: parsed,
    label: `${mm}月${dd}日（${wd}）`,
  };
}

function formatDurationMs(ms: number | null): string {
  const totalSec = Math.max(0, Math.round((ms ?? 0) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function slugPlaceSegment(raw: string): string {
  return encodeURIComponent(raw.replace(/\s+/g, "").slice(0, 40) || "place");
}

function samePlaceBucket(a: LibraryV2ObservationInput, b: LibraryV2ObservationInput): boolean {
  if (a.placeId && b.placeId) return a.placeId === b.placeId;
  if (a.placeId || b.placeId) {
    if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
      return haversineMeters(a.lat, a.lng, b.lat, b.lng) <= VISIT_SAME_PLACE_METERS;
    }
    return false;
  }
  const na = (a.placeName ?? "").trim();
  const nb = (b.placeName ?? "").trim();
  if (na && nb) {
    if (na === nb) return true;
    if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
      return haversineMeters(a.lat, a.lng, b.lat, b.lng) <= VISIT_SAME_PLACE_METERS;
    }
    return false;
  }
  if (a.lat !== null && a.lng !== null && b.lat !== null && b.lng !== null) {
    return haversineMeters(a.lat, a.lng, b.lat, b.lng) <= VISIT_SAME_PLACE_METERS;
  }
  return (a.areaLabel ?? "") === (b.areaLabel ?? "");
}

/**
 * Group owner observations into Visits:
 * 1) Same JST calendar day
 * 2) Same place (matching placeId / placeName, or <= 500m apart)
 * 3) Sequential time gap <= 3 hours (180 min)
 */
export function groupObservationsIntoVisitsV2(items: readonly LibraryV2ObservationInput[]): LibraryV2Visit[] {
  if (items.length === 0) return [];
  const enriched = items
    .map((item) => ({ item, wall: jstWallParts(item.observedAt) }))
    .sort((a, b) => a.wall.ms - b.wall.ms || a.item.observationId.localeCompare(b.item.observationId));

  type Cluster = {
    day: string;
    dayLabel: string;
    entries: Array<{ item: LibraryV2ObservationInput; wall: ReturnType<typeof jstWallParts> }>;
  };

  const clusters: Cluster[] = [];
  for (const entry of enriched) {
    let matched: Cluster | null = null;
    for (let i = clusters.length - 1; i >= 0; i--) {
      const c = clusters[i]!;
      if (c.day !== entry.wall.day) continue;
      const last = c.entries[c.entries.length - 1]!;
      if (entry.wall.ms - last.wall.ms > VISIT_GAP_MS) continue;
      if (samePlaceBucket(last.item, entry.item)) {
        matched = c;
        break;
      }
    }
    if (matched) {
      matched.entries.push(entry);
    } else {
      clusters.push({ day: entry.wall.day, dayLabel: entry.wall.label, entries: [entry] });
    }
  }

  const visits: LibraryV2Visit[] = clusters.map((c) => {
    const first = c.entries[0]!;
    const last = c.entries[c.entries.length - 1]!;
    const placeId = c.entries.map((e) => e.item.placeId).find(Boolean) ?? null;
    const placeName = c.entries.map((e) => (e.item.placeName ?? "").trim()).find(Boolean) ?? "";
    const areaLabel = c.entries.map((e) => (e.item.areaLabel ?? "").trim()).find(Boolean) ?? placeName;
    const seenUrls = new Set<string>();
    const photos: LibraryV2VisitPhoto[] = [];
    const videos: LibraryV2VisitPhoto[] = [];
    const audios: LibraryV2VisitAudio[] = [];
    let report: { title: string | null; body: string } | null = null;
    let eventParticipation: { sessionId: string; title: string } | null = null;
    let isPublic = false;
    let zukanPublished = false;
    const eligibleSet = new Set<string>();

    for (const { item, wall } of c.entries) {
      if (item.visibility === "public") isPublic = true;
      if (item.zukanPublished) zukanPublished = true;
      if (!eventParticipation && item.eventSession) eventParticipation = item.eventSession;

      const body = (item.reportBody ?? "").trim();
      const title = (item.reportTitle ?? "").trim() || null;
      if (body && !report) {
        report = { title, body };
        eligibleSet.add(item.observationId);
      } else if (title && !report) {
        report = { title, body: "" };
      }

      if (item.mediaKind === "video" && item.photoUrl) {
        if (!seenUrls.has(item.photoUrl)) {
          seenUrls.add(item.photoUrl);
          videos.push({
            observationId: item.observationId,
            url: item.photoUrl,
            isVideo: true,
            durationLabel: item.durationMs ? formatDurationMs(item.durationMs) : null,
            timeLabel: wall.hhmm,
          });
        }
        eligibleSet.add(item.observationId);
      } else if (item.mediaKind === "photo" && item.photoUrl) {
        if (!seenUrls.has(item.photoUrl)) {
          seenUrls.add(item.photoUrl);
          photos.push({
            observationId: item.observationId,
            url: item.photoUrl,
            isVideo: false,
            durationLabel: null,
            timeLabel: wall.hhmm,
          });
        }
        eligibleSet.add(item.observationId);
      } else if (item.mediaKind === "audio") {
        audios.push({
          observationId: item.observationId,
          title: (item.audioTitle ?? "").trim() || "現地の音",
          durationLabel: formatDurationMs(item.durationMs),
          timeLabel: wall.hhmm,
        });
      }
    }

    const timeRangeLabel =
      first.wall.hhmm && last.wall.hhmm && first.wall.hhmm !== last.wall.hhmm
        ? `${first.wall.hhmm}–${last.wall.hhmm}`
        : first.wall.hhmm;

    const headingTitle = report?.title || placeName || areaLabel || "記録";
    const keyPlacePart = placeId ?? slugPlaceSegment(placeName || areaLabel || "spot");
    const sameBucketVisits = clusters.filter(
      (other) => other.day === c.day && (other.entries[0]?.item.placeId ?? slugPlaceSegment(other.entries[0]?.item.placeName ?? other.entries[0]?.item.areaLabel ?? "spot")) === keyPlacePart,
    );
    const visitKey = sameBucketVisits.length > 1 ? `${c.day}__${keyPlacePart}__${first.wall.hhmm.replace(":", "")}` : `${c.day}__${keyPlacePart}`;

    return {
      visitKey,
      dateDay: c.day,
      dateLabel: c.dayLabel,
      timeRangeLabel,
      headingTitle,
      placeId,
      placeName: placeName || areaLabel || "身近な場所",
      areaLabel: areaLabel || placeName,
      startedAt: first.item.observedAt,
      endedAt: last.item.observedAt,
      observationIds: c.entries.map((e) => e.item.observationId),
      zukanEligibleObservationIds: [...eligibleSet],
      photos,
      videos,
      audios,
      report,
      eventParticipation,
      isPublic,
      zukanPublished,
    };
  });

  visits.sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt) || b.visitKey.localeCompare(a.visitKey));
  return visits;
}

const ICONS = {
  photo: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  video: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4z"/></svg>',
  audio: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4M8 23h8"/></svg>',
  report: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  event: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  pubEye: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  book: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  lock: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  play: '<svg class="zv2l-ic zv2l-playic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>',
  chev: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
  back: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  plus: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  pen: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>',
  upload: '<svg class="zv2l-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/></svg>',
};

const WAVE_BARS = [13, 26, 18, 9, 21, 27, 15, 11, 19, 24, 12, 17, 8, 20, 14, 23, 10, 16, 22, 13]
  .map((h) => `<i style="height:${h}px"></i>`)
  .join("");

const LIBRARY_V2_CSS = `
${ZUKAN_SHELL_CSS}
svg.zv2l-ic{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
svg.zv2l-playic{fill:currentColor;stroke:none}
.nw{white-space:nowrap}
.zv2l-col{max-width:760px;margin:0 auto;padding:6px 0 32px}
.zv2l-headbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
.zv2l-title{margin:0;font-size:24px;font-weight:800;line-height:1.35}
.zv2l-sub{margin:2px 0 12px;font-size:14.5px;color:var(--muted)}
.zv2l-add-btn{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--green);background:#fff;color:var(--green);font-size:14px;font-weight:800;display:inline-flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap}
.zv2l-sync{margin:12px 0 0}
.zv2l-sync[hidden]{display:none}
.zv2l-sync .zt-status-band{margin-top:8px}
.zv2l-sync-bar{display:block;height:4px;border-radius:2px;background:#eadfb8;overflow:hidden;margin-top:6px;width:160px;max-width:100%}
.zv2l-sync-bar b{display:block;height:100%;width:40%;background:var(--green);animation:zv2l-sync-slide 1.4s ease-in-out infinite}
@keyframes zv2l-sync-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
@media (prefers-reduced-motion:reduce){.zv2l-sync-bar b{animation:none;width:60%}}
.zv2l-dsep{display:flex;align-items:center;gap:10px;padding:18px 0 2px}
.zv2l-dt{font-size:14px;font-weight:800;color:var(--green);white-space:nowrap}
.zv2l-dl{flex:1;height:1px;background:#E4E9E4}
.zv2l-visit{padding:16px 0 20px;border-bottom:1px solid #EDF0EC}
.zv2l-visit-link{text-decoration:none;color:inherit;display:block}
.zv2l-vhead{margin:0;font-size:18px;font-weight:800;line-height:1.4;color:#17211B}
.zv2l-vmeta{font-size:14.5px;color:#55615A;margin-top:3px;line-height:1.5}
.zv2l-report{margin-top:10px;background:#F7F7F3;border-radius:10px;padding:12px 14px}
.zv2l-rb{font-size:14.5px;color:#3C4A41;line-height:1.65;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.zv2l-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:12px;border-radius:12px;overflow:hidden}
.zv2l-grid.two{grid-template-columns:repeat(2,1fr)}
.zv2l-grid.one{grid-template-columns:1fr}
.zv2l-grid.one img,.zv2l-grid.one .zv2l-cellv{aspect-ratio:16/9}
.zv2l-grid img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:#EFF3EE}
.zv2l-grid.one .zv2l-cellv img{aspect-ratio:16/9}
.zv2l-cellv{position:relative}
.zv2l-vbadge{position:absolute;left:8px;bottom:8px;width:32px;height:32px;border-radius:50%;background:rgba(9,25,16,.74);color:#fff;display:flex;align-items:center;justify-content:center}
.zv2l-more-tile{aspect-ratio:1/1;background:#F7F7F3;display:flex;align-items:center;justify-content:center;gap:4px;color:var(--green);font-size:15px;font-weight:800}
.zv2l-arow{display:flex;align-items:center;gap:12px;background:#F7F7F3;border-radius:12px;padding:12px 14px;margin-top:10px}
.zv2l-aplay{width:44px;height:44px;border-radius:50%;background:var(--green);color:#fff;display:flex;align-items:center;justify-content:center;flex:none}
.zv2l-ainfo{min-width:0}
.zv2l-atitle{font-size:15px;font-weight:800;line-height:1.35}
.zv2l-ameta{font-size:14px;color:#55615A;margin-top:2px}
.zv2l-wave{margin-left:auto;display:flex;align-items:center;gap:2.5px;height:30px;flex:none}
.zv2l-wave i{width:3px;border-radius:2px;background:#9DB4A6;display:block}
.zv2l-types{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;font-size:14px;color:#3C4A41;margin-top:10px;line-height:1.45}
.zv2l-vt{display:inline-flex;align-items:center;gap:5px}
.zv2l-sep{color:#B9C2B9}
.zv2l-evlink{color:var(--link);font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:2px;min-height:44px}
.zv2l-status{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;font-size:14px;color:#55615A;margin-top:6px}
.zv2l-st{display:inline-flex;align-items:center;gap:5px}
.zv2l-st.pub{color:var(--green);font-weight:800}

/* Zero state */
.zv2l-zero{padding:36px 12px 48px;text-align:center}
.zv2l-zicon{width:84px;height:84px;border-radius:50%;background:#EFF3EE;color:var(--green);display:flex;align-items:center;justify-content:center;margin:0 auto 20px}
.zv2l-zicon svg{width:36px;height:36px}
.zv2l-zero h1{margin:0;font-size:22px;font-weight:800;line-height:1.45}
.zv2l-zbody{max-width:340px;margin:14px auto 0;text-align:center;text-wrap:balance}
.zv2l-zbody p{font-size:15.5px;line-height:1.75;color:#3C4A41;margin:10px 0 0}
.zv2l-btn-main{display:flex;align-items:center;justify-content:center;min-height:48px;width:100%;max-width:320px;margin:22px auto 0;padding:12px 18px;border-radius:999px;background:var(--green);color:#fff!important;font-size:16px;font-weight:800;text-decoration:none;border:0;cursor:pointer}
.zv2l-btn-sub,.zv2l-btn-sub:visited{display:flex;align-items:center;justify-content:center;min-height:48px;width:100%;max-width:320px;margin:12px auto 0;padding:12px 18px;border-radius:999px;border:1.5px solid var(--green);background:#fff;color:var(--green);font-weight:700;text-decoration:none;white-space:nowrap}
.zv2l-btn-main svg{width:20px;height:20px;margin-right:8px}
.zv2l-zlink{display:inline-flex;align-items:center;justify-content:center;gap:3px;min-height:44px;margin-top:14px;font-size:15px;font-weight:700;color:var(--link)!important;text-decoration:none}
.zv2l-search-meta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:14px;padding:6px 12px;border-radius:10px;background:#EFF3EE;font-size:14px;color:#3C4A41}
.zv2l-search-meta a,.zv2l-search-meta a:visited{min-height:44px;display:inline-flex;align-items:center;font-weight:700;color:var(--green);text-decoration:none}

/* Open Visit page */
.zv2l-open-head{display:flex;align-items:center;gap:8px;min-height:48px;margin-bottom:8px}
.zv2l-back{display:inline-flex;align-items:center;gap:4px;min-height:44px;color:var(--green);font-size:15px;font-weight:800;text-decoration:none}
.zv2l-sect{margin:22px 0 8px;font-size:15px;font-weight:800;color:#55615A}
.zv2l-repbox{background:#F7F7F3;border-radius:12px;padding:16px 18px}
.zv2l-repbox .rt{font-size:17px;font-weight:800;line-height:1.45}
.zv2l-repbox .rb{font-size:15.5px;line-height:1.8;color:#26332A;margin-top:8px;white-space:pre-line}
.zv2l-repbox .rm{font-size:14px;color:#55615A;margin-top:10px}
.zv2l-photolist{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.zv2l-photolist img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;display:block;background:#EFF3EE}
.zv2l-vidwrap{position:relative}
.zv2l-vidwrap img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:10px;display:block;background:#EFF3EE}
.zv2l-pnote{font-size:14px;color:#55615A;line-height:1.6;margin-top:8px}
.zv2l-card{border:1px solid #E4E9E4;border-radius:16px;padding:18px;margin-top:8px;background:#fff}
.zv2l-card hr{border:none;border-top:1px solid #EDF0EC;margin:16px 0}
.zv2l-sl{font-size:15px;font-weight:800;margin-bottom:6px}
.zv2l-sd{font-size:14.5px;color:#3C4A41;line-height:1.7}
.zv2l-seg{display:flex;background:#F7F7F3;border-radius:999px;padding:3px;margin-top:12px}
.zv2l-seg button{flex:1;min-height:44px;border:0;border-radius:999px;background:transparent;color:#55615A;font-size:15px;font-weight:700;cursor:pointer}
.zv2l-seg button.on{background:var(--green);color:#fff}

/* Add record sheet */
.zv2l-scrim{position:fixed;inset:0;background:rgba(16,26,19,.48);z-index:50}
.zv2l-scrim[hidden],.zv2l-sheet[hidden]{display:none}
.zv2l-sheet{position:fixed;left:0;right:0;bottom:0;z-index:55;background:#fff;border-radius:18px 18px 0 0;padding:10px 20px calc(24px + env(safe-area-inset-bottom));max-width:540px;margin:0 auto}
.zv2l-grab{width:40px;height:4px;border-radius:2px;background:#DDE2DC;margin:2px auto 12px}
.zv2l-irow{display:flex;align-items:center;gap:14px;padding:12px 2px;border-bottom:1px solid #EDF0EC;min-height:60px;text-decoration:none;color:inherit}
.zv2l-irow:last-child{border-bottom:none}
.zv2l-iic{width:46px;height:46px;border-radius:50%;background:#EFF3EE;color:var(--green);display:flex;align-items:center;justify-content:center;flex:none}
.zv2l-it{font-size:16px;font-weight:800}
.zv2l-id{font-size:14px;color:#55615A;margin-top:2px}
`;

function renderVisitCardHtml(visit: LibraryV2Visit, prefix: string, isEn = false): string {
  const dateLabel = isEn ? enDayLabel(visit.dateDay, visit.dateLabel) : visit.dateLabel;
  const headingTitle = isEn && visit.headingTitle === "記録" ? "Record" : visit.headingTitle;
  const href = `${prefix}/library/group?group=${encodeURIComponent(visit.visitKey)}`;
  const mediaAll = [...visit.photos, ...visit.videos];
  const shown = mediaAll.slice(0, 3);
  const extraCount = mediaAll.length > 3 ? mediaAll.length - 2 : 0;
  let gridHtml = "";
  if (shown.length > 0) {
    const cls = shown.length === 1 ? "zv2l-grid one" : shown.length === 2 ? "zv2l-grid two" : "zv2l-grid";
    const cells = shown.map((m, idx) => {
      if (extraCount > 0 && idx === 2) {
        return `<span class="zv2l-more-tile">＋${extraCount}${isEn ? "" : "件"}</span>`;
      }
      if (m.isVideo) {
        return `<span class="zv2l-cellv"><img src="${esc(m.url)}" alt="" loading="lazy"><span class="zv2l-vbadge">${ICONS.play}</span></span>`;
      }
      return `<img src="${esc(m.url)}" alt="" loading="lazy">`;
    }).join("");
    gridHtml = `<div class="${cls}">${cells}</div>`;
  }

  const reportHtml = visit.report?.body
    ? `<div class="zv2l-report"><div class="zv2l-rb">${esc(visit.report.body)}</div></div>`
    : "";

  const audioHtml = visit.audios.map((a) => `<div class="zv2l-arow">
    <span class="zv2l-aplay">${ICONS.play}</span>
    <div class="zv2l-ainfo"><div class="zv2l-atitle">${esc(a.title)}</div><div class="zv2l-ameta"><span class="nw">${esc(a.durationLabel)}</span>${a.timeLabel ? ` ・ <span class="nw">${esc(a.timeLabel)}</span>` : ""}</div></div>
    <span class="zv2l-wave">${WAVE_BARS}</span>
  </div>`).join("");

  const typeParts: string[] = [];
  if (visit.photos.length > 0) typeParts.push(`<span class="zv2l-vt">${ICONS.photo}<span>${isEn ? `${visit.photos.length} ${visit.photos.length === 1 ? "photo" : "photos"}` : `写真 ${visit.photos.length}枚`}</span></span>`);
  if (visit.videos.length > 0) typeParts.push(`<span class="zv2l-vt">${ICONS.video}<span>${isEn ? `${visit.videos.length} ${visit.videos.length === 1 ? "video" : "videos"}` : `動画 ${visit.videos.length}本`}</span></span>`);
  if (visit.audios.length > 0) typeParts.push(`<span class="zv2l-vt">${ICONS.audio}<span>${isEn ? `${visit.audios.length} ${visit.audios.length === 1 ? "sound" : "sounds"}` : `音 ${visit.audios.length}つ`}</span></span>`);
  if (visit.report) typeParts.push(`<span class="zv2l-vt">${ICONS.report}<span>${isEn ? "Field report" : "フィールドレポート"}</span></span>`);
  if (visit.eventParticipation) {
    typeParts.push(
      `<a class="zv2l-evlink" href="${esc(`${prefix}/community/events`)}">${ICONS.event}<span>${esc(visit.eventParticipation.title)}</span>${ICONS.chev}</a>`,
    );
  }
  const typesHtml = typeParts.length > 0 ? `<div class="zv2l-types">${typeParts.join('<span class="zv2l-sep">・</span>')}</div>` : "";

  const statusParts: string[] = [];
  if (visit.isPublic) statusParts.push(`<span class="zv2l-st pub">${ICONS.pubEye}<span>${isEn ? "Public" : "公開しています"}</span></span>`);
  if (visit.zukanPublished) statusParts.push(`<span class="zv2l-st pub">${ICONS.book}<span>${isEn ? "In the field guide" : "図鑑に載せています"}</span></span>`);
  const statusHtml = statusParts.length > 0
    ? `<div class="zv2l-status">${statusParts.join('<span class="zv2l-sep">・</span>')}</div>`
    : `<div class="zv2l-status"><span class="zv2l-st">${ICONS.lock}<span>${isEn ? "Only me" : "自分のみ"}</span></span></div>`;

  const metaParts = [visit.areaLabel || visit.placeName, visit.timeRangeLabel].filter(Boolean);
  return `<article class="zv2l-visit" data-library-visit="${esc(visit.visitKey)}">
    <a class="zv2l-visit-link" href="${esc(href)}">
      <h3 class="zv2l-vhead"><span class="nw">${esc(dateLabel)}</span>・${esc(headingTitle)}</h3>
      <div class="zv2l-vmeta">${metaParts.map((m) => `<span class="nw">${esc(m)}</span>`).join(" ・ ")}</div>
      ${reportHtml}
      ${gridHtml}
      ${audioHtml}
    </a>
    ${typesHtml}
    ${statusHtml}
  </article>`;
}

export function renderLibraryV2Page(options: {
  visits: readonly LibraryV2Visit[];
  lang: "ja" | "en" | "es" | "pt-br";
  authenticated: boolean;
  displayName?: string | null;
  searchQuery?: string;
  nextCursor?: string | null;
  cspNonce?: string | null;
}): string {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const isEn = options.lang !== "ja";
  const t = (ja: string, en: string): string => (isEn ? en : ja);
  const nonceAttr = options.cspNonce ? ` nonce="${esc(options.cspNonce)}"` : "";
  const chrome = renderZukanChrome({
    lang: options.lang,
    activeNav: "library",
    authenticated: options.authenticated,
    displayName: options.displayName,
    searchAction: `${prefix}/library`,
    searchQuery: options.searchQuery,
    pathname: `${prefix}/library`,
    homeHref: `${prefix}/library`,
  });

  const trimmedSearch = (options.searchQuery ?? "").trim();
  let listContent = "";
  if (options.visits.length === 0) {
    if (trimmedSearch) {
      listContent = `<section class="zv2l-zero" data-library-search-empty="1">
      <div class="zv2l-zicon">${ZUKAN_SHELL_ICONS.search}</div>
      <h1>${t("条件に合う記録がありません", "No matching records")}</h1>
      <div class="zv2l-zbody">
        <p>${isEn ? `No records of yours match "${esc(trimmedSearch)}". Try a species name, place, note, or season (like "last autumn").` : `「${esc(trimmedSearch)}」に一致する自分の記録が見つかりませんでした。生きものの名前・場所・メモ・季節（「去年の秋」など）でお試しください。`}</p>
      </div>
      <a class="zv2l-btn-main" href="${esc(`${prefix}/library`)}">${t("検索をリセット", "Reset search")}</a>
    </section>`;
    } else {
      listContent = `<section class="zv2l-zero" data-library-empty="1">
      <div class="zv2l-zicon">${ICONS.photo}</div>
      <h1>${t("まだ記録がありません", "No records yet")}</h1>
      <div class="zv2l-zbody">
        <p>${t("出かけた先で撮った写真が、ここに場所と日にちでたまります。", "Photos you take while out will collect here by place and date.")}</p>
      </div>
      <a class="zv2l-btn-main" href="${esc(`${prefix}/record`)}">${ZUKAN_SHELL_ICONS.camera}<span>${t("撮る", "Capture")}</span></a>
      <a class="zv2l-btn-sub" href="${esc(`${prefix}/record?mode=upload`)}">${t("写真を選ぶ", "Choose photos")}</a>
    </section>`;
    }
  } else {
    const parts: string[] = [];
    if (trimmedSearch) {
      parts.push(`<div class="zv2l-search-meta" data-library-search-summary="1"><span>${isEn ? `Results for "${esc(trimmedSearch)}" (${options.visits.length})` : `「${esc(trimmedSearch)}」の検索結果（${options.visits.length}件）`}</span><a href="${esc(`${prefix}/library`)}">${t("検索をリセット", "Reset search")}</a></div>`);
    }
    for (const v of options.visits) {
      parts.push(renderVisitCardHtml(v, prefix, isEn));
    }
    if (options.nextCursor) {
      const moreHref = `${prefix}/library?before=${encodeURIComponent(options.nextCursor)}${trimmedSearch ? `&q=${encodeURIComponent(trimmedSearch)}` : ""}`;
      parts.push(`<div style="margin-top:24px;text-align:center;"><a class="zv2l-add-btn" href="${esc(moreHref)}">${t("もっと見る", "Show more")}</a></div>`);
    }
    listContent = parts.join("\n");
  }

  const addSheetHtml = `<div class="zv2l-scrim" id="zv2l-scrim" hidden></div>
  <section class="zv2l-sheet" id="zv2l-add-sheet" hidden role="dialog" aria-modal="true" aria-labelledby="zv2l-sheet-title">
    <div class="zv2l-grab" aria-hidden="true"></div>
    <h2 id="zv2l-sheet-title" style="margin:0;font-size:18px;font-weight:800;">${t("記録を足す", "Add a record")}</h2>
    <p style="margin:4px 0 8px;font-size:14.5px;color:#55615A;">${t("最初に出る場所は自分だけです。後から公開や図鑑への掲載を選べます。", "New records are visible only to you at first. You can share them or add them to the field guide later.")}</p>
    <a class="zv2l-irow" href="${esc(`${prefix}/record?mode=photo`)}"><span class="zv2l-iic">${ZUKAN_SHELL_ICONS.camera}</span><span><span class="zv2l-it">${t("写真を撮る", "Take a photo")}</span><br><span class="zv2l-id">${t("その場の生きものや風景を残します", "Save the wildlife and scenery in front of you")}</span></span></a>
    <a class="zv2l-irow" href="${esc(`${prefix}/record?mode=audio`)}"><span class="zv2l-iic">${ICONS.audio}</span><span><span class="zv2l-it">${t("音を録る", "Record a sound")}</span><br><span class="zv2l-id">${t("鳥の声や水辺の音を記録します", "Capture bird song or sounds by the water")}</span></span></a>
    <a class="zv2l-irow" href="${esc(`${prefix}/record?mode=report`)}"><span class="zv2l-iic">${ICONS.report}</span><span><span class="zv2l-it">${t("フィールドレポートを書く", "Write a field report")}</span><br><span class="zv2l-id">${t("気づいたことを文章で残します", "Write down what you noticed")}</span></span></a>
    <a class="zv2l-irow" href="${esc(`${prefix}/record?mode=upload`)}"><span class="zv2l-iic">${ICONS.upload}</span><span><span class="zv2l-it">${t("端末から選ぶ", "Choose from device")}</span><br><span class="zv2l-id">${t("保存済みの写真や動画を追加します", "Add saved photos or videos")}</span></span></a>
    <button type="button" class="zv2l-add-btn" id="zv2l-sheet-close" style="width:100%;justify-content:center;margin-top:12px;">${t("閉じる", "Close")}</button>
  </section>`;

  const recentCutoff = Date.now() - 48 * 3600 * 1000;
  const recentIds = options.visits
    .filter((v) => Date.parse(v.endedAt) >= recentCutoff)
    .flatMap((v) => v.observationIds)
    .slice(0, 6);

  const body = `<div class="zv2l-col" data-library-v2="1">
    <div class="zv2l-headbar">
      <h1 class="zv2l-title">${t("ライブラリ", "Library")}</h1>
      <button type="button" class="zv2l-add-btn" data-zv2l-open-add="1">${ICONS.plus}<span>${t("記録を足す", "Add a record")}</span></button>
    </div>
    <p class="zv2l-sub">${t("あなたが残した記録です", "Records you have saved")}</p>
    ${chrome.searchHtml}
    <div class="zv2l-sync" id="zv2l-sync" data-library-sync hidden></div>
    ${listContent}
  </div>${addSheetHtml}`;

  return `<!doctype html>
<html lang="${esc(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${t("ライブラリ", "Library")} — ZUKAN</title>
  <style${nonceAttr}>${LIBRARY_V2_CSS}</style>
</head>
<body>
  <div class="zt-shell">
    ${chrome.sidebarHtml}
    <div>
      ${chrome.topbarHtml}
      <main class="zt-main">${body}${chrome.feedbackFootHtml}</main>
    </div>
  </div>
  ${chrome.bottomNavHtml}
  <script${nonceAttr}>
    (function(){
      var box = document.getElementById('zv2l-sync');
      var retryHref = ${JSON.stringify(`${prefix}/record?draft=1`).replace(/</g, "\\u003c")};
      var L = ${JSON.stringify(isEn ? { retry: "Send again", failed: " could not be sent", sending: " sending", kept: "Your photos are still on this device.", auto: "They will be sent automatically when you are back online." } : { retry: "もう一度送る", failed: "件を送れませんでした", sending: "件を送っています", kept: "写真はこの端末に残っています。", auto: "通信が戻ると自動で送られます。" }).replace(/</g, "\u003c")};
      var recentIds = ${JSON.stringify(recentIds).replace(/</g, "\\u003c")};
      function readOutbox(cb){
        var done = false;
        function fin(v){ if (!done) { done = true; cb(v); } }
        if (!window.indexedDB) return fin([]);
        try {
          var rq = indexedDB.open('ikimon-app-outbox-v1', 1);
          rq.onupgradeneeded = function(){ try { rq.transaction.abort(); } catch (e) {} };
          rq.onerror = function(){ fin([]); };
          rq.onsuccess = function(){
            var db = rq.result;
            try {
              if (!db.objectStoreNames.contains('items')) { db.close(); return fin([]); }
              var g = db.transaction('items', 'readonly').objectStore('items').getAll();
              g.onsuccess = function(){ var r = (g.result || []).filter(function(x){ return x && x.source === 'record'; }); db.close(); fin(r); };
              g.onerror = function(){ db.close(); fin([]); };
            } catch (e) { try { db.close(); } catch (e2) {} fin([]); }
          };
        } catch (e) { fin([]); }
      }
      function readServer(cb){
        if (!recentIds.length || !window.fetch) return cb({ sending: 0, failed: 0 });
        Promise.all(recentIds.map(function(id){
          return fetch('/api/v1/observations/' + encodeURIComponent(id) + '/processing-status', { credentials: 'same-origin', cache: 'no-store' })
            .then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; });
        })).then(function(rs){
          var sending = 0, failed = 0;
          rs.forEach(function(r){
            var m = r && r.status && r.status.mediaState;
            if (m === 'processing') sending++; else if (m === 'retry_required') failed++;
          });
          cb({ sending: sending, failed: failed });
        }).catch(function(){ cb({ sending: 0, failed: 0 }); });
      }
      function render(items, srv){
        if (!box) return;
        var dFailed = items.filter(function(x){ return x.status === 'failed'; });
        var dQueued = items.length - dFailed.length;
        var failed = dFailed.length + srv.failed;
        var sending = dQueued + srv.sending;
        if (!failed && !sending) { box.hidden = true; box.innerHTML = ''; return; }
        var html;
        if (failed) {
          html = '<div class="zt-status-band" data-tone="error" data-sync-state="failed" role="status"><div class="zt-status-copy"><strong></strong><span></span></div><a class="zt-status-act" data-sync-retry="1" href="' + retryHref + '">' + L.retry + '</a></div>';
        } else {
          html = '<div class="zt-status-band" data-tone="warn" data-sync-state="sending" role="status"><div class="zt-status-copy"><strong></strong><span></span><i class="zv2l-sync-bar"><b></b></i></div></div>';
        }
        box.innerHTML = html;
        box.querySelector('strong').textContent = failed ? failed + L.failed : sending + L.sending;
        box.querySelector('span').textContent = failed ? L.kept : L.auto;
        box.hidden = false;
      }
      function refresh(){
        readOutbox(function(items){ readServer(function(srv){ render(items, srv); }); });
      }
      if (box) {
        refresh();
        window.addEventListener('ikimon-app-outbox-change', refresh);
        window.addEventListener('online', refresh);
      }
      var openBtn = document.querySelector('[data-zv2l-open-add]');
      var scrim = document.getElementById('zv2l-scrim');
      var sheet = document.getElementById('zv2l-add-sheet');
      var closeBtn = document.getElementById('zv2l-sheet-close');
      function setOpen(v){ if(scrim) scrim.hidden = !v; if(sheet) sheet.hidden = !v; }
      if(openBtn) openBtn.addEventListener('click', function(){ setOpen(true); });
      if(scrim) scrim.addEventListener('click', function(){ setOpen(false); });
      if(closeBtn) closeBtn.addEventListener('click', function(){ setOpen(false); });
    })();
  </script>
</body>
</html>`;
}

export function renderLibraryV2VisitDetailPage(
  visit: LibraryV2Visit,
  options: { lang: "ja" | "en" | "es" | "pt-br"; displayName?: string | null; cspNonce?: string | null },
): string {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  const nonceAttr = options.cspNonce ? ` nonce="${esc(options.cspNonce)}"` : "";
  const chrome = renderZukanChrome({
    lang: options.lang,
    activeNav: "library",
    authenticated: true,
    displayName: options.displayName,
    pathname: `${prefix}/library/group`,
    homeHref: `${prefix}/library`,
  });

  const sections: string[] = [];
  if (visit.report) {
    sections.push(`<div class="zv2l-sect">フィールドレポート</div>
    <div class="zv2l-repbox">
      ${visit.report.title ? `<div class="rt">${esc(visit.report.title)}</div>` : ""}
      <div class="rb">${esc(visit.report.body || visit.report.title || "")}</div>
      <div class="rm">この訪問で書いた報告です</div>
    </div>`);
  }
  if (visit.photos.length > 0) {
    sections.push(`<div class="zv2l-sect">写真（${visit.photos.length}枚）</div>
    <div class="zv2l-photolist">${visit.photos.map((p) => `<a href="${esc(`${prefix}/observations/${encodeURIComponent(p.observationId)}`)}"><img src="${esc(p.url)}" alt="" loading="lazy"></a>`).join("")}</div>`);
  }
  if (visit.videos.length > 0) {
    sections.push(`<div class="zv2l-sect">動画（${visit.videos.length}本）</div>
    ${visit.videos.map((v) => `<a class="zv2l-vidwrap" href="${esc(`${prefix}/observations/${encodeURIComponent(v.observationId)}`)}"><img src="${esc(v.url)}" alt="" loading="lazy"><span class="zv2l-vbadge">${ICONS.play}</span></a>`).join("")}
    <div class="zv2l-pnote">動画は自動では再生されません</div>`);
  }
  if (visit.audios.length > 0) {
    sections.push(`<div class="zv2l-sect">音（${visit.audios.length}つ）</div>
    ${visit.audios.map((a) => `<a class="zv2l-arow" style="text-decoration:none;color:inherit;" href="${esc(`${prefix}/observations/${encodeURIComponent(a.observationId)}`)}"><span class="zv2l-aplay">${ICONS.play}</span><div class="zv2l-ainfo"><div class="zv2l-atitle">${esc(a.title)}</div><div class="zv2l-ameta">${esc(a.durationLabel)}${a.timeLabel ? ` ・ ${esc(a.timeLabel)}` : ""}</div></div><span class="zv2l-wave">${WAVE_BARS}</span></a>`).join("")}`);
  }

  const eligibleSummary: string[] = [];
  if (visit.report) eligibleSummary.push("この訪問のフィールドレポート");
  if (visit.photos.length > 0) eligibleSummary.push(`写真${visit.photos.length}枚`);
  if (visit.videos.length > 0) eligibleSummary.push(`動画${visit.videos.length}本`);

  let zukanDesc = "";
  let zukanActionHtml = "";
  if (visit.zukanEligibleObservationIds.length === 0) {
    zukanDesc = "この訪問には場所の図鑑に載せる写真・動画・フィールドレポートがありません。音やイベントの参加記録は場所の図鑑には出ません。";
  } else if (visit.zukanPublished) {
    zukanDesc = `${visit.placeName}の図鑑に載っています（${eligibleSummary.join("・")}）。音は出ません。`;
    zukanActionHtml = `<button type="button" class="zv2l-add-btn" id="zv2l-unpublish-btn" style="width:100%;justify-content:center;margin-top:12px;">図鑑から外す</button>`;
  } else {
    zukanDesc = `まだ載せていません。載せると、${visit.placeName}のページに、${eligibleSummary.join("と")}が出ます。音は出ません。写真を撮った正確な場所は、ぼかして出ます。`;
    zukanActionHtml = `<button type="button" class="zv2l-btn-main" id="zv2l-publish-btn">図鑑に載せる</button>`;
  }

  const cfg = JSON.stringify({
    visitKey: visit.visitKey,
    placeId: visit.placeId,
    placeName: visit.placeName,
    eligibleIds: visit.zukanEligibleObservationIds,
    allIds: visit.observationIds,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="${esc(options.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(visit.headingTitle)} — ZUKAN</title>
  <style${nonceAttr}>${LIBRARY_V2_CSS}</style>
</head>
<body>
  <div class="zt-shell">
    ${chrome.sidebarHtml}
    <div>
      ${chrome.topbarHtml}
      <main class="zt-main">
        <div class="zv2l-col" data-library-open-v2="${esc(visit.visitKey)}">
          <div class="zv2l-open-head">
            <a class="zv2l-back" href="${esc(`${prefix}/library`)}">${ICONS.back}<span>ライブラリ</span></a>
          </div>
          <h1 class="zv2l-title">${esc(visit.headingTitle)}</h1>
          <div class="zv2l-vmeta">${esc(visit.dateLabel)}${visit.areaLabel ? ` ・ ${esc(visit.areaLabel)}` : ""}${visit.timeRangeLabel ? ` ・ ${esc(visit.timeRangeLabel)}` : ""}</div>
          ${sections.join("\n")}
          <div class="zv2l-sect">この訪問の見せ方</div>
          <div class="zv2l-card">
            <div class="zv2l-sl">見せ方</div>
            <div class="zv2l-sd">${visit.isPublic ? "いまは公開しています。自分のみに戻すこともできます。" : "いまは自分のみです。公開すると、あなたの記録として他の人にも見えるようになります。"}</div>
            <div class="zv2l-seg">
              <button type="button" class="${visit.isPublic ? "" : "on"}" data-zv2l-vis="private">自分のみ</button>
              <button type="button" class="${visit.isPublic ? "on" : ""}" data-zv2l-vis="public">公開する</button>
            </div>
            <hr>
            <div class="zv2l-sl">場所の図鑑</div>
            <div class="zv2l-sd">${esc(zukanDesc)}</div>
            ${zukanActionHtml}
          </div>
        </div>
        ${chrome.feedbackFootHtml}
      </main>
    </div>
  </div>
  ${chrome.bottomNavHtml}
  <script${nonceAttr} id="zv2l-open-cfg" type="application/json">${cfg}</script>
  <script${nonceAttr}>
    (function(){
      var cfg = JSON.parse(document.getElementById('zv2l-open-cfg').textContent || '{}');
      var pubBtn = document.getElementById('zv2l-publish-btn');
      var unpubBtn = document.getElementById('zv2l-unpublish-btn');
      if(pubBtn){
        pubBtn.addEventListener('click', async function(){
          var res = await fetch('/api/v1/zukan-top/publish', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ groupKey: cfg.visitKey, placeId: cfg.placeId, placeName: cfg.placeName, observationIds: cfg.eligibleIds })
          });
          if(res.ok) location.reload();
        });
      }
      if(unpubBtn){
        unpubBtn.addEventListener('click', async function(){
          var res = await fetch('/api/v1/zukan-top/unpublish', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ groupKey: cfg.visitKey, observationIds: cfg.eligibleIds })
          });
          if(res.ok) location.reload();
        });
      }
      document.querySelectorAll('[data-zv2l-vis]').forEach(function(btn){
        btn.addEventListener('click', async function(){
          var targetVis = btn.getAttribute('data-zv2l-vis');
          for(var i=0;i<(cfg.allIds||[]).length;i++){
            var fd = new FormData();
            fd.set('action', 'set_visibility');
            fd.set('visibility', targetVis);
            fd.set('operation_id', 'libv2-vis-' + Date.now() + '-' + i);
            await fetch('/api/v1/records/' + encodeURIComponent(cfg.allIds[i]) + '/observation-actions', { method: 'POST', body: fd });
          }
          location.reload();
        });
      });
    })();
  </script>
</body>
</html>`;
}

const SEASON_MONTHS: Readonly<Record<string, ReadonlySet<number>>> = {
  春: new Set([3, 4, 5]),
  夏: new Set([6, 7, 8]),
  秋: new Set([9, 10, 11]),
  冬: new Set([12, 1, 2]),
};

export function jstYearFromMs(nowMs: number): number {
  const isoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(nowMs));
  return Number(isoDate.slice(0, 4)) || 2026;
}

function jstYearMonthFromDateDay(dateDay: string): { year: number; month: number } | null {
  const m = dateDay.match(/^(\d{4})-(\d{2})-/);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

export type SearchTokenSpec = {
  textToken: string;
  temporalMatch: ((obs: { year: number; month: number } | null) => boolean) | null;
};

export function parseLibraryV2SearchToken(rawToken: string, currentYear: number): SearchTokenSpec {
  const normalized = rawToken.normalize("NFKC").trim();
  const textToken = normalized.toLocaleLowerCase("ja-JP");
  const match = normalized.match(
    /^(?:(今年|去年|昨年|一昨年|おととし|(?:19|20)\d{2}年?)(?:の)?)?(?:(春|夏|秋|冬)|([1-9]|1[0-2])月)?$/u,
  );
  if (!match || (!match[1] && !match[2] && !match[3])) {
    return { textToken, temporalMatch: null };
  }
  const yearPart = match[1] ?? "";
  let targetYear: number | null = null;
  if (yearPart === "今年") targetYear = currentYear;
  else if (yearPart === "去年" || yearPart === "昨年") targetYear = currentYear - 1;
  else if (yearPart === "一昨年" || yearPart === "おととし") targetYear = currentYear - 2;
  else if (yearPart) targetYear = Number(yearPart.replace(/年$/u, ""));

  const targetMonths: ReadonlySet<number> | null = match[2]
    ? (SEASON_MONTHS[match[2]] ?? null)
    : match[3]
      ? new Set([Number(match[3])])
      : null;

  return {
    textToken,
    temporalMatch: (obs) => {
      if (!obs) return false;
      if (targetYear !== null && obs.year !== targetYear) return false;
      if (targetMonths !== null && !targetMonths.has(obs.month)) return false;
      return true;
    },
  };
}

export function filterLibraryV2Visits(
  visits: readonly LibraryV2Visit[],
  searchQuery: string,
  visitExtraTexts?: ReadonlyMap<string, readonly string[]>,
  nowMs = Date.now(),
): LibraryV2Visit[] {
  const rawTokens = searchQuery.normalize("NFKC").trim().split(/\s+/u).filter(Boolean);
  if (rawTokens.length === 0) return [...visits];
  const currentYear = jstYearFromMs(nowMs);
  const tokens = rawTokens.map((t) => parseLibraryV2SearchToken(t, currentYear));

  return visits.filter((visit) => {
    const ym = jstYearMonthFromDateDay(visit.dateDay);
    const baseTexts = [
      visit.headingTitle,
      visit.placeName,
      visit.areaLabel,
      visit.dateDay,
      visit.dateLabel,
      visit.report?.title ?? "",
      visit.report?.body ?? "",
      visit.eventParticipation?.title ?? "",
      ...visit.audios.map((a) => a.title),
      ...(visitExtraTexts?.get(visit.visitKey) ?? []),
    ]
      .filter(Boolean)
      .map((s) => s.normalize("NFKC").toLocaleLowerCase("ja-JP"));

    return tokens.every((tok) => {
      if (tok.temporalMatch && tok.temporalMatch(ym)) return true;
      return baseTexts.some((s) => s.includes(tok.textToken));
    });
  });
}

type DbObsRow = {
  observation_id: string;
  observed_at: string;
  taxon_label: string | null;
  note: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  public_area_label: string | null;
  visibility: string;
  mime: string | null;
  duration_ms: number | null;
  derivative_key: string | null;
};

export async function loadUserLibraryV2Data(
  env: Env,
  userId: string,
  searchQuery = "",
  options: { limit?: number; before?: string | null; nowMs?: number } = {},
): Promise<{ visits: LibraryV2Visit[]; nextCursor: string | null }> {
  const limit = options.limit ?? 60;
  const trimmedQuery = searchQuery.trim();
  const isSearchMode = trimmedQuery.length > 0;
  const params: Array<string | number> = [userId];
  const where: string[] = ["o.owner_user_id = ?1", "COALESCE(o.emergency_hidden, 0) = 0"];
  const cursor = decodePageCursor(options.before);
  if (!isSearchMode && cursor) {
    params.push(cursor.observedAt);
    const at = `?${params.length}`;
    params.push(cursor.id);
    const idp = `?${params.length}`;
    where.push(`(o.observed_at < ${at} OR (o.observed_at = ${at} AND o.observation_id < ${idp}))`);
  }
  const sqlLimit = isSearchMode ? 300 : limit + 1;
  params.push(sqlLimit);
  const lim = `?${params.length}`;

  let rows: DbObsRow[] = [];
  try {
    const res = await env.OBS_DB.prepare(
      `SELECT o.observation_id,
              o.observed_at,
              o.taxon_label,
              o.note,
              o.exact_lat,
              o.exact_lng,
              o.public_area_label,
              COALESCE(o.visibility, 'private') AS visibility,
              (SELECT a.mime FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.processing_state = 'uploaded' ORDER BY COALESCE(a.uploaded_at, '') DESC LIMIT 1) AS mime,
              (SELECT a.duration_ms FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.processing_state = 'uploaded' ORDER BY COALESCE(a.uploaded_at, '') DESC LIMIT 1) AS duration_ms,
              (SELECT a.public_derivative_key FROM asset_ledger a WHERE a.observation_id = o.observation_id AND a.processing_state = 'uploaded' AND a.public_derivative_key IS NOT NULL ORDER BY COALESCE(a.uploaded_at, '') DESC LIMIT 1) AS derivative_key
         FROM observations o
        WHERE ${where.join(" AND ")}
        ORDER BY o.observed_at DESC, o.observation_id DESC
        LIMIT ${lim}`,
    ).bind(...params).all<DbObsRow>();
    rows = res.results ?? [];
  } catch {
    return { visits: [], nextCursor: null };
  }

  const sliced = isSearchMode ? rows : rows.slice(0, limit);
  const lastRow = sliced[sliced.length - 1];
  const nextCursor = !isSearchMode && rows.length > limit && lastRow ? encodePageCursor(lastRow.observed_at, lastRow.observation_id) : null;
  if (sliced.length === 0) return { visits: [], nextCursor: null };

  const obsIds = sliced.map((r) => r.observation_id);
  const placeholders = obsIds.map(() => "?").join(", ");

  const placeByObs = new Map<string, { placeId: string; placeName: string }>();
  try {
    const pRes = await env.OBS_DB.prepare(
      `SELECT c.visit_id, p.place_id, p.canonical_name
         FROM civic_observation_contexts c
         JOIN places p ON p.place_id = c.field_id
        WHERE c.visit_id IN (${placeholders}) AND p.public_profile_status = 'published'`,
    ).bind(...obsIds).all<{ visit_id: string; place_id: string; canonical_name: string }>();
    for (const r of pRes.results ?? []) {
      placeByObs.set(r.visit_id, { placeId: r.place_id, placeName: r.canonical_name });
    }
  } catch { /* optional table in tests */ }

  const aiLabelByObs = new Map<string, string>();
  if (isSearchMode) {
    try {
      const occIds = obsIds.map((id) => `occ:${id}:0`);
      const occPlaceholders = occIds.map(() => "?").join(", ");
      const aiRes = await env.OBS_DB.prepare(
        `SELECT occurrence_id, COALESCE(candidate_vernacular_name, candidate_scientific_name, ai_recommended_taxon_name) AS ai_label
           FROM observation_ai_review_targets
          WHERE occurrence_id IN (${occPlaceholders})`,
      ).bind(...occIds).all<{ occurrence_id: string; ai_label: string | null }>();
      for (const row of aiRes.results ?? []) {
        const obsId = row.occurrence_id.replace(/^occ:/, "").replace(/:0$/, "");
        const label = (row.ai_label ?? "").trim();
        if (label) aiLabelByObs.set(obsId, label);
      }
    } catch { /* optional table in tests */ }
  }

  const ownerLabels = await loadOwnerAreaLabels(env, sliced.filter((r) => !(r.public_area_label ?? "").trim()).map((r) => r.observation_id)).catch(() => new Map<string, string>());

  const pubByObs = new Map<string, boolean>();
  const pubByGroup = new Map<string, boolean>();
  try {
    const [oPub, gPub] = await Promise.all([
      env.CORE_DB.prepare("SELECT observation_id, published FROM zukan_observation_publications WHERE user_id = ?1").bind(userId).all<{ observation_id: string; published: number }>().catch(() => ({ results: [] })),
      env.CORE_DB.prepare("SELECT group_key, published FROM zukan_book_publications WHERE user_id = ?1").bind(userId).all<{ group_key: string; published: number }>().catch(() => ({ results: [] })),
    ]);
    for (const row of oPub.results ?? []) pubByObs.set(row.observation_id, row.published === 1);
    for (const row of gPub.results ?? []) pubByGroup.set(row.group_key, row.published === 1);
  } catch { /* optional */ }

  const eventsByPlaceOrDay = new Map<string, { sessionId: string; title: string }>();
  try {
    const evRes = await env.OBS_DB.prepare(
      `SELECT s.session_id, s.title, s.started_at, s.field_id
         FROM observation_event_participants p
         JOIN observation_event_sessions s ON s.session_id = p.session_id
        WHERE p.user_id = ?1
        LIMIT 40`,
    ).bind(userId).all<{ session_id: string; title: string; started_at: string; field_id: string | null }>();
    for (const ev of evRes.results ?? []) {
      const day = String(ev.started_at ?? "").slice(0, 10);
      if (ev.field_id) eventsByPlaceOrDay.set(`${day}__${ev.field_id}`, { sessionId: ev.session_id, title: ev.title });
      eventsByPlaceOrDay.set(day, { sessionId: ev.session_id, title: ev.title });
    }
  } catch { /* optional */ }

  const titleFetchLimit = isSearchMode ? Math.min(sliced.length, 60) : 20;
  const titleEntries = await Promise.all(
    sliced.slice(0, titleFetchLimit).map(async (r) => {
      try {
        const obj = await env.ASSET_BUCKET?.get(`record-title/${r.observation_id}.json`);
        if (!obj?.body) return [r.observation_id, null] as const;
        const parsed = (await new Response(obj.body).json()) as { title?: unknown };
        return [r.observation_id, typeof parsed.title === "string" ? parsed.title.trim() : null] as const;
      } catch {
        return [r.observation_id, null] as const;
      }
    }),
  );
  const titleMap = new Map(titleEntries);

  const obsExtraTextById = new Map<string, string[]>();
  const inputs: LibraryV2ObservationInput[] = sliced.map((r) => {
    const mime = String(r.mime ?? "").toLowerCase();
    const mediaKind: LibraryV2ObservationInput["mediaKind"] = mime.startsWith("video/")
      ? "video"
      : mime.startsWith("audio/")
        ? "audio"
        : mime.startsWith("image/") || r.derivative_key
          ? "photo"
          : null;
    const pl = placeByObs.get(r.observation_id);
    const area = (r.public_area_label ?? "").trim() || ownerLabels.get(r.observation_id) || "";
    const dateDay = r.observed_at.slice(0, 10);
    const legacyKey = `${dateDay}__${pl?.placeId ?? (area || "身近な場所")}`;
    const eventSession = (pl?.placeId ? eventsByPlaceOrDay.get(`${dateDay}__${pl.placeId}`) : null) ?? eventsByPlaceOrDay.get(dateDay) ?? null;
    const taxonLabel = (r.taxon_label ?? "").trim() || "";
    const aiLabel = aiLabelByObs.get(r.observation_id) || "";
    const customTitle = titleMap.get(r.observation_id) ?? null;
    obsExtraTextById.set(r.observation_id, [taxonLabel, aiLabel, customTitle ?? "", r.note ?? "", area, pl?.placeName ?? ""].filter(Boolean));
    return {
      observationId: r.observation_id,
      observedAt: r.observed_at,
      placeId: pl?.placeId ?? null,
      placeName: pl?.placeName ?? (area || null),
      areaLabel: area || null,
      lat: typeof r.exact_lat === "number" ? r.exact_lat : null,
      lng: typeof r.exact_lng === "number" ? r.exact_lng : null,
      reportTitle: customTitle,
      reportBody: (r.note ?? "").trim() || null,
      mediaKind,
      photoUrl: r.derivative_key ? `/${String(r.derivative_key).replace(/^\/+/, "")}` : null,
      audioTitle: taxonLabel || aiLabel || null,
      durationMs: typeof r.duration_ms === "number" ? r.duration_ms : null,
      visibility: r.visibility === "public" ? "public" : "private",
      zukanPublished: pubByObs.get(r.observation_id) === true || pubByGroup.get(legacyKey) === true,
      eventSession,
    };
  });

  const allVisits = groupObservationsIntoVisitsV2(inputs);
  if (!isSearchMode) {
    return { visits: allVisits, nextCursor };
  }

  const visitExtraTexts = new Map<string, string[]>();
  for (const v of allVisits) {
    visitExtraTexts.set(
      v.visitKey,
      v.observationIds.flatMap((id) => obsExtraTextById.get(id) ?? []),
    );
  }
  const filtered = filterLibraryV2Visits(allVisits, trimmedQuery, visitExtraTexts, options.nowMs);
  const filteredCursor = cursor
    ? filtered.filter((v) => v.endedAt < cursor.observedAt)
    : filtered;
  const pageVisits = filteredCursor.slice(0, limit);
  const lastVisit = pageVisits[pageVisits.length - 1];
  const searchNextCursor = filteredCursor.length > limit && lastVisit
    ? encodePageCursor(lastVisit.endedAt, lastVisit.observationIds[0] ?? lastVisit.visitKey)
    : null;
  return { visits: pageVisits, nextCursor: searchNextCursor };
}
