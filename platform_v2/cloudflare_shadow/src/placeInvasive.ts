import { invasiveItemInfo, type InvasiveCategory } from "./mapInvasive";

export type PlaceInvasiveItem = { name: string; label: string; category: InvasiveCategory; count: number; firstLabel: string | null; mediaUrl: string | null; recordHref: string; learnHref: string };

type Rec = { displayName?: string | null; identificationStatus?: string | null; observedAt?: string | null; mediaUrl?: string | null; mediaKind?: string | null; href: string };

export function buildPlaceInvasive(records: readonly Rec[]): PlaceInvasiveItem[] {
  const by = new Map<string, { info: NonNullable<ReturnType<typeof invasiveItemInfo>>; recs: Rec[] }>();
  for (const r of records) {
    if (r.identificationStatus !== "confirmed" || !r.displayName) continue;
    const info = invasiveItemInfo(r.displayName);
    if (!info) continue;
    const g = by.get(r.displayName) ?? { info, recs: [] };
    g.recs.push(r);
    by.set(r.displayName, g);
  }
  return [...by.entries()].map(([name, g]) => {
    const dates = g.recs.map((r) => r.observedAt ?? "").filter((d) => Number.isFinite(Date.parse(d))).sort();
    const m = dates[0] ? /^(\d{4})-(\d{2})/.exec(dates[0]) : null;
    const photo = g.recs.find((r) => r.mediaUrl && r.mediaKind !== "audio");
    return { name, label: g.info.label, category: g.info.category, count: g.recs.length, firstLabel: m ? `${m[1]}年${Number(m[2])}月` : null, mediaUrl: photo?.mediaUrl ?? null, recordHref: g.recs[0]!.href, learnHref: g.info.learnHref };
  }).sort((a, b) => b.count - a.count);
}

export async function loadPlaceLinkedEvents(
  db: { prepare(sql: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }> } } },
  placeId: string,
  lang: string,
  eventTimingFn: (core: { startedAt: string; endedAt: string | null }, lang: "ja" | "en") => { whenLabel: string },
): Promise<Array<{ title: string; href: string; whenLabel: string }>> {
  try {
    const res = await db
      .prepare("SELECT session_id, title, started_at, ended_at FROM observation_event_sessions WHERE field_id = ? AND event_code IS NOT NULL AND trim(event_code) <> '' AND title IS NOT NULL AND trim(title) <> '' ORDER BY started_at DESC LIMIT 12")
      .bind(placeId)
      .all<{ session_id: string; title: string; started_at: string; ended_at: string | null }>();
    const prefix = `/${lang}`;
    return (res.results ?? []).map((r) => ({
      title: r.title,
      href: `${prefix}/events/${encodeURIComponent(r.session_id)}/preview`,
      whenLabel: eventTimingFn({ startedAt: r.started_at, endedAt: r.ended_at }, lang === "ja" ? "ja" : "en").whenLabel,
    }));
  } catch {
    return [];
  }
}
