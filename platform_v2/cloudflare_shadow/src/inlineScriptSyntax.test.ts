import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import type { Env } from "./core/env";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2";
import { recordCaptureCameraCopy } from "../../src/ui/siteShell";
import { renderLibraryV2Page } from "./zukanLibraryV2";
import { renderIdentifyV3Page } from "./identifyV3";
import { handleEventsV2List } from "./zukanEventsV2";
import { renderProfileHub, renderProfileSettingsHub } from "./zukanProfileHub";
import { recordCaptureCopy, renderRecordEntryStageHtml } from "./zukanRecordEntry";
import { renderRegionSurfacePage } from "./regionSurfaceV1";
import { renderRegionInvasivePage, renderInvasiveSpeciesPage } from "./invasiveMapV1";
import { INVASIVE_SEED_ROWS } from "./mapInvasive";
import * as shareScripts from "./invasiveMapV1";
import * as recordEntry from "./zukanRecordEntry";
import * as recordInput from "./zukanRecordInput";
import * as recordMemo from "./zukanRecordMemoOnly";
import * as recordPlaceTime from "./zukanRecordPlaceAndTime";
import * as bioScript from "../../src/ui/biosecurity";
import { renderBiosecurityPage } from "../../src/ui/biosecurity";
import { BIOSECURITY_PROFILES } from "../../src/services/biosecurityProfiles";
import * as collab from "../../src/ui/collaborationContext";
import * as face from "../../src/ui/facePrivacyScript";
import * as eventStyles from "../../src/ui/observationEventStyles";
import * as photoPrep from "../../src/ui/photoUploadPreparation";
import * as bioMeta from "../../src/services/biosecurityPhotoMetadata";
import * as soundReview from "../../src/ui/admin/soundReview";

type L = "ja" | "en" | "es" | "pt-br";
const LANGS: L[] = ["ja", "en", "es", "pt-br"];

function failure(label: string, body: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  let ctx = body.slice(0, 80);
  try {
    new vm.Script(`(function(){\n${body}\n})`, { filename: "inline.js" });
  } catch (e) {
    const m = /inline\.js:(\d+)/.exec(String((e as Error).stack ?? ""));
    if (m) {
      const lines = body.split("\n");
      const line = lines[Number(m[1]) - 2] ?? "";
      const col = ((e as Error).stack ?? "").split("\n")[2]?.indexOf("^") ?? -1;
      const at = col >= 0 ? col : 0;
      ctx = `line ${Number(m[1]) - 1}: ${line.slice(Math.max(0, at - 40), at + 40)}`;
    }
  }
  return `${label}: ${msg} | near: ${ctx}`;
}

function checkBody(label: string, body: string, errors: string[]): void {
  try {
    new Function(body);
  } catch (err) {
    errors.push(failure(label, body, err));
  }
}

function checkHtml(label: string, html: string, errors: string[]): number {
  let n = 0;
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const attrs = m[1] ?? "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1]?.toLowerCase();
    if (type && type !== "text/javascript" && type !== "application/javascript") continue;
    n += 1;
    checkBody(`${label}#${n}`, m[2] ?? "", errors);
  }
  return n;
}

const failingDb = {
  prepare() {
    return { bind() { return this; }, async all() { throw new Error("fake"); }, async first() { return null; } };
  },
} as unknown as Env["OBS_DB"];

const invasiveSeed = INVASIVE_SEED_ROWS[0]!;
const invasiveRecord = {
  visitId: "v1",
  slug: invasiveSeed[2],
  name: invasiveSeed[0],
  category: "specified" as never,
  categoryLabel: "x",
  observedAt: "2026-05-01T00:00:00Z",
  cell: "3500:13900",
  lat: 35.0,
  lng: 139.0,
  halfStep: 0.005,
  area: "Hamamatsu",
  photoUrl: null,
};

const hubData = { displayName: "Hana", bio: "It's a bio", recordCount: 3, savedPlaceCount: 1, joinedEventCount: 1, unreadCount: 2, records: [] };

async function renders(lang: L): Promise<Array<[string, string]>> {
  const out: Array<[string, string]> = [];
  for (const placeTab of [true, false]) {
    for (const authenticated of [true, false]) {
      out.push([`map[placeTab=${placeTab},auth=${authenticated}]`, renderMapExplorerV2Document({ lang, authenticated, displayName: "Hana", basePath: "/map", placeTab })]);
    }
  }
  for (const authenticated of [true, false]) {
    out.push([`library[auth=${authenticated}]`, renderLibraryV2Page({ visits: [], lang, authenticated, displayName: "Hana", nextCursor: "c" })]);
    out.push([`regionInvasive[auth=${authenticated}]`, renderRegionInvasivePage({ area: "Hamamatsu", records: [invasiveRecord], lang, authenticated, displayName: "Hana" })]);
    const sp = renderInvasiveSpeciesPage({ slug: invasiveRecord.slug, records: [invasiveRecord], lang, authenticated, displayName: "Hana" });
    if (sp) out.push([`invasiveSpecies[auth=${authenticated}]`, sp]);
    out.push([
      `region[auth=${authenticated}]`,
      renderRegionSurfacePage({
        data: { area: "Hamamatsu", recordTotal: 2, species: [], places: [], placeTotal: 0, events: [], eventTotal: 0 },
        lang,
        authenticated,
        displayName: "Hana",
        invasiveAvailable: true,
      }),
    ]);
  }
  for (const view of ["feed", "skills", "saved"] as const) {
    out.push([
      `identifyV3[${view}]`,
      renderIdentifyV3Page({ view, lang, displayName: "Hana", skills: [], autoGrown: [], promotionSuggestions: [], confirmedCountsByNode: {}, feedItems: [], savedItems: [], settledSavedItems: [], savedCount: 0, nextCursor: null }),
    ]);
  }
  out.push(["eventsList", await (await handleEventsV2List(new URL(`https://x.test/${lang}/community/events`), lang, null, failingDb)).text()]);
  for (const view of ["guide", "chooser", "capture", "receipt", "municipalities", "inbox"] as const) {
    out.push([`biosecurity[${view}]`, renderBiosecurityPage(view, { lang, profile: BIOSECURITY_PROFILES[2]!, profiles: [...BIOSECURITY_PROFILES], recordId: `br_${"a".repeat(40)}` })]);
  }
  out.push(["profileHub", renderProfileHub(lang, hubData)]);
  out.push(["profileSettings", renderProfileSettingsHub(lang, { displayName: "Hana", email: "a@b.c", recordCount: 1, flash: null })]);
  for (const startMode of ["photo", "video"] as const) {
    out.push([
      `recordEntry[${startMode}]`,
      renderRecordEntryStageHtml({ lang, prefix: lang === "ja" ? "/ja" : `/${lang}`, copy: recordCaptureCopy(lang), engineCopy: recordCaptureCameraCopy(lang === "pt-br" ? "en" : lang), startMode, voiceButtonHtml: "" }),
    ]);
  }
  return out;
}

for (const lang of LANGS) {
  test(`inline scripts parse: rendered pages [${lang}]`, async () => {
    const errors: string[] = [];
    let scripts = 0;
    for (const [label, html] of await renders(lang)) scripts += checkHtml(`${label}/${lang}`, html, errors);
    assert.ok(scripts > 0);
    assert.deepEqual(errors, []);
  });
}

test("inline scripts parse: exported *_SCRIPT constants", () => {
  const errors: string[] = [];
  let n = 0;
  const mods: Record<string, Record<string, unknown>> = {
    "invasiveMapV1": shareScripts, "zukanRecordEntry": recordEntry, "zukanRecordInput": recordInput, "zukanRecordMemoOnly": recordMemo,
    "zukanRecordPlaceAndTime": recordPlaceTime, "biosecurity": bioScript, "collaborationContext": collab, "facePrivacyScript": face,
    "observationEventStyles": eventStyles, "photoUploadPreparation": photoPrep, "biosecurityPhotoMetadata": bioMeta, "soundReview": soundReview,
  };
  for (const [mod, exps] of Object.entries(mods)) {
    for (const [name, value] of Object.entries(exps)) {
      if (!/SCRIPT$/.test(name) || typeof value !== "string") continue;
      n += 1;
      if (/<script\b/i.test(value)) checkHtml(`${mod}.${name}`, value, errors);
      else checkBody(`${mod}.${name}`, value, errors);
    }
  }
  assert.ok(n >= 8, `only ${n} script constants found`);
  assert.deepEqual(errors, []);
});
