/** Private, typed references. Public data/transactions remain owned by their source. */
export type SavedTarget = { key: string; type: string; id: string; path: string };
export type SavedReference = SavedTarget & {
  saved: boolean; revision: number; updatedAt: string | null;
  availability: "available" | "unavailable" | "unknown";
  title: string | null;
};
const families: Record<string, string> = {
  places: "place", observations: "record", records: "record", jobs: "job",
  events: "event", offers: "offer", articles: "article", organizations: "organization",
};
/** Accept only stable same-product detail paths; never API, account, arbitrary URL or query. */
export function parseSavedTarget(value: unknown): SavedTarget {
  if (typeof value !== "string" || value.length > 450 || /[\\\s\u0000-\u001f\u007f?#%]/u.test(value)) throw new TypeError("invalid_saved_target");
  const match = value.match(/^\/(?:(ja|en|es|pt-br)\/)?(?:(community\/events)|([a-z]+))\/([A-Za-z0-9][A-Za-z0-9_-]{0,159})$/u);
  if (!match) throw new TypeError("invalid_saved_target");
  const family = match[2] ? "community/events" : match[3]!;
  const type = family === "community/events" ? "event" : families[family];
  if (!type) throw new TypeError("invalid_saved_target");
  const id = match[4]!;
  // Legacy /observations and /community/events are the current source route families.
  const canonicalFamily = family === "records" ? "observations" : family;
  return { key: `${type}:${id}`, type, id, path: `/${canonicalFamily}/${id}` };
}

export async function savedSnapshotBundle(items: readonly SavedReference[]) {
  if (items.length === 0 || items.length > 20 || items.some(x => !x.saved || x.availability !== "available" || !x.title || !x.updatedAt)) {
    throw new TypeError("export_requires_current_selected_references");
  }
  const selected = [...new Map(items.map(x => [x.key, x])).values()].sort((a,b) => a.key.localeCompare(b.key));
  const snapshot = selected.map(x => ({ source: `https://zukan.earth${x.path}`, targetType: x.type,
    targetId: x.id, sourceRelationshipRevision: x.revision, savedAt: x.updatedAt, title: x.title }));
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x=>x.toString(16).padStart(2,"0")).join("");
  const observedAt = selected.map(x=>x.updatedAt!).sort().at(-1)!;
  return {
    idempotencyKey: `zukan_saved_snapshot_${digest}`,
    sources: [{ sourceRef: "saved_selection", sourceKind: "manual", title: "ZUKANで選んだ保存候補",
      locator: "https://zukan.earth/records?view=saved", contentDigest: { algorithm: "sha256", value: digest },
      observedAt, classification: "C2", state: "candidate" }],
    records: [{ recordRef: "saved_selection", recordType: "note", sourceRef: "saved_selection",
      title: "ZUKANで保存した候補", summary: "本人が選んだ時点の候補です。現在の保存状態・訪問・予約・応募・参加を証明するものではありません。\n" + snapshot.map(x=>`${x.title}\n${x.source}`).join("\n\n"),
      state: "candidate", claims: [
        { field: "zukan_saved_selection", value: snapshot, status: "candidate", validFrom: observedAt, verification: "unverified", sensitivity: "C2" },
        { field: "continuity_mode", value: "explicit_snapshot_not_account_link_or_live_sync", status: "candidate", validFrom: observedAt, verification: "unverified", sensitivity: "C2" },
      ] }],
  };
}
