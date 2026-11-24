import type { Env } from "./core/env";

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const EVENT_LIVE_MAP_ENTRIES_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS event_live_map_entries (
  entry_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  cell_key TEXT NOT NULL,
  entry_kind TEXT NOT NULL DEFAULT 'note',
  taxon_label TEXT NOT NULL DEFAULT '',
  summary_text TEXT NOT NULL DEFAULT '',
  badge_number INTEGER NOT NULL DEFAULT 0,
  is_first_discovery INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
)
`.trim();

export type EventLiveMapEntryRow = {
  entry_id: string;
  session_id: string;
  cell_key: string;
  entry_kind: "photo" | "voice" | "note" | "count" | "zero";
  taxon_label: string;
  summary_text: string;
  badge_number: number;
  is_first_discovery: number;
  created_at: number;
};

export type EventLiveMapState = {
  sessionId: string;
  title: string;
  isActive: boolean;
  totalCells: number;
  filledCellsCount: number;
  filledCellKeys: string[];
  firstDiscoveries: Array<{
    entryId: string;
    taxonLabel: string;
    summaryText: string;
    badgeNumber: number;
    cellKey: string;
  }>;
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function compute25mGridCell(
  centerLat: number,
  centerLng: number,
  lat: number,
  lng: number,
  radiusM = 500
): string | null {
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (haversineMeters(centerLat, centerLng, lat, lng) > radiusM) {
    return null;
  }
  const latStep = 0.000225; // ~25m
  const lngStep = 0.000275; // ~25m
  const row = Math.max(0, Math.min(4, Math.floor((lat - centerLat) / latStep) + 2));
  const col = Math.max(0, Math.min(7, Math.floor((lng - centerLng) / lngStep) + 4));
  return `${row},${col}`;
}

export function isEventActiveWindow(
  session: { started_at: string; ended_at: string | null },
  nowMs = Date.now()
): boolean {
  if (session.ended_at !== null && session.ended_at !== "") return false;
  const startMs = Date.parse(session.started_at);
  if (Number.isFinite(startMs) && nowMs < startMs) return false;
  return true;
}

export async function recordEventLiveMapEntry(
  env: Env,
  input: {
    sessionId: string;
    cellKey: string;
    entryKind: "photo" | "voice" | "note" | "count" | "zero";
    taxonLabel?: string;
    summaryText?: string;
    badgeNumber: number;
  }
): Promise<EventLiveMapEntryRow> {
  await env.CORE_DB.prepare(EVENT_LIVE_MAP_ENTRIES_CREATE_SQL).run();
  const taxonLabel = (input.taxonLabel ?? "").trim().slice(0, 80);
  let isFirstDiscovery = 0;
  if (taxonLabel) {
    const existingTaxon = await env.CORE_DB.prepare(
      "SELECT 1 AS found FROM event_live_map_entries WHERE session_id = ?1 AND taxon_label = ?2 LIMIT 1"
    ).bind(input.sessionId, taxonLabel).first();
    if (!existingTaxon) isFirstDiscovery = 1;
  }
  const row: EventLiveMapEntryRow = {
    entry_id: `lme_${crypto.randomUUID().slice(0, 12)}`,
    session_id: input.sessionId,
    cell_key: input.cellKey,
    entry_kind: input.entryKind,
    taxon_label: taxonLabel,
    summary_text: (input.summaryText ?? "").trim().slice(0, 160),
    badge_number: Math.max(1, Math.round(input.badgeNumber || 1)),
    is_first_discovery: isFirstDiscovery,
    created_at: Date.now()
  };
  await env.CORE_DB.prepare(
    `INSERT INTO event_live_map_entries (
      entry_id, session_id, cell_key, entry_kind, taxon_label, summary_text, badge_number, is_first_discovery, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`
  ).bind(
    row.entry_id,
    row.session_id,
    row.cell_key,
    row.entry_kind,
    row.taxon_label,
    row.summary_text,
    row.badge_number,
    row.is_first_discovery,
    row.created_at
  ).run();
  return row;
}

export async function loadEventLiveMapState(
  env: Env,
  session: { session_id: string; title: string; started_at: string; ended_at: string | null },
  nowMs = Date.now()
): Promise<EventLiveMapState> {
  await env.CORE_DB.prepare(EVENT_LIVE_MAP_ENTRIES_CREATE_SQL).run();
  const res = await env.CORE_DB.prepare(
    "SELECT * FROM event_live_map_entries WHERE session_id = ?1 ORDER BY created_at DESC LIMIT 400"
  ).bind(session.session_id).all<EventLiveMapEntryRow>();
  const rows = res.results ?? [];
  const filledSet = new Set<string>();
  const firstDiscoveries: EventLiveMapState["firstDiscoveries"] = [];
  for (const r of rows) {
    filledSet.add(r.cell_key);
    if (r.is_first_discovery === 1 && firstDiscoveries.length < 12) {
      firstDiscoveries.push({
        entryId: r.entry_id,
        taxonLabel: r.taxon_label,
        summaryText: r.summary_text,
        badgeNumber: r.badge_number,
        cellKey: r.cell_key
      });
    }
  }
  return {
    sessionId: session.session_id,
    title: session.title,
    isActive: isEventActiveWindow(session, nowMs),
    totalCells: 40,
    filledCellsCount: filledSet.size,
    filledCellKeys: [...filledSet],
    firstDiscoveries
  };
}

export function renderEventLiveMapPage(
  state: EventLiveMapState,
  options: { bigScreen?: boolean; cspNonce?: string }
): string {
  const nonceAttr = options.cspNonce ? ` nonce="${escapeHtml(options.cspNonce)}"` : "";
  const filled = new Set(state.filledCellKeys);
  const cellsHtml: string[] = [];
  for (let r = 0; r < 5; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const key = `${r},${c}`;
      const isFilled = filled.has(key);
      cellsHtml.push(
        `<div class="elm-cell${isFilled ? " is-filled" : ""}" data-cell-key="${key}" aria-label="マス ${key}${isFilled ? " 記録あり" : ""}"></div>`
      );
    }
  }
  const latestCard = state.firstDiscoveries[0] ?? null;
  const heading = state.isActive ? `${state.title} — ライブ地図` : `${state.title} — この日埋まった地図`;

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)}</title>
  <style${nonceAttr}>
    body{margin:0;font-family:"Noto Sans JP",system-ui,sans-serif;background:${options.bigScreen ? "#111a14" : "#fff"};color:${options.bigScreen ? "#f2f8f3" : "#17251b"};padding:16px}
    .elm-wrap{max-width:1100px;margin:0 auto;display:grid;gap:16px}
    .elm-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}
    .elm-progress{font-size:20px;font-weight:800;color:#245c3a;background:#e5f2ea;padding:6px 14px;border-radius:999px}
    .elm-layout{display:grid;gap:16px}
    @media(min-width:860px){.elm-layout{grid-template-columns:2fr 1fr;align-items:start}}
    .elm-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:6px;background:#f6f7f6;padding:12px;border-radius:12px}
    .elm-cell{aspect-ratio:1/1;border-radius:6px;background:#dce3dd;transition:background .2s}
    .elm-cell.is-filled{background:#245c3a}
    .elm-card{padding:16px;border-radius:12px;background:#f6f7f6;color:#17251b;display:grid;gap:6px}
  </style>
</head>
<body>
  <main class="elm-wrap" data-event-live-map="1" data-session-id="${escapeHtml(state.sessionId)}">
    <header class="elm-head">
      <h1>${escapeHtml(heading)}</h1>
      <div class="elm-progress" data-elm-progress>${state.filledCellsCount}/${state.totalCells}マス</div>
    </header>
    <div class="elm-layout">
      <div class="elm-grid" data-elm-grid>${cellsHtml.join("")}</div>
      <aside class="elm-card" aria-label="初発見">
        <strong>はじめての発見</strong>
        ${latestCard
          ? `<div data-elm-latest>${escapeHtml(latestCard.taxonLabel)}（名札 #${latestCard.badgeNumber}）</div>`
          : `<div data-elm-latest>みんなでマスを埋めてみよう</div>`}
      </aside>
    </div>
  </main>
  ${state.isActive ? `<script${nonceAttr}>
    (() => {
      const queueKey = "zukan_live_map_queue_" + ${JSON.stringify(state.sessionId)};
      const sync = async () => {
        try {
          const pending = JSON.parse(localStorage.getItem(queueKey) || "[]");
          if (Array.isArray(pending) && pending.length > 0) {
            for (const item of pending) {
              await fetch("/api/v1/observation-events/" + encodeURIComponent(${JSON.stringify(state.sessionId)}) + "/live-map/entries", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(item)
              });
            }
            localStorage.removeItem(queueKey);
          }
          const res = await fetch("/api/v1/observation-events/" + encodeURIComponent(${JSON.stringify(state.sessionId)}) + "/live-map");
          if (!res.ok) return;
          const data = await res.json();
          const prog = document.querySelector("[data-elm-progress]");
          if (prog) prog.textContent = data.filledCellsCount + "/" + data.totalCells + "マス";
          const filled = new Set(data.filledCellKeys || []);
          document.querySelectorAll("[data-cell-key]").forEach((el) => {
            if (filled.has(el.getAttribute("data-cell-key"))) el.classList.add("is-filled");
          });
        } catch {}
      };
      setInterval(sync, 3000);
    })();
  </script>` : ""}
</body>
</html>`;
}
