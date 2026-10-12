import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { BIOSECURITY_PROFILES } from "../services/biosecurityProfiles.js";
import { BIOSECURITY_SCRIPT, renderBiosecurityPage, type BiosecurityView } from "./biosecurity.js";

type ScriptHelpers = {
  stableKey(scope: string, value: unknown): Promise<string>;
  privatePhotoUrl(value: string): string;
  shareForm(record: Record<string, unknown>): string;
  details(record: Record<string, unknown>): string;
  detailText(record: Record<string, unknown>): string;
  dateText(value: unknown): string;
  observedTimeText(record: Record<string, unknown>): string;
  captureMetadata(photos: Array<{metadata:Record<string, unknown>}>, overrides?: Record<string, unknown>): {time:Record<string, unknown>; originalTime:Record<string, unknown>; location:Record<string, unknown> | null; conflicts:{time:boolean;location:boolean}};
  environmentSection(record: Record<string, unknown>): string;
  environmentEntries(environment: Record<string, unknown>): Array<{field:string;source:string;value:string}>;
  privatePhoto(file: { size: number }): Promise<unknown>;
};

function helpers(options: { storageThrows?: boolean } = {}): ScriptHelpers {
  const values = new Map<string, string>();
  const config = JSON.parse(renderBiosecurityPage("receipt").match(/<script id="bio-config"[^>]*>([\s\S]*?)<\/script>/)![1]!);
  config.view = "test";
  const context = vm.createContext({
    document: { getElementById: () => ({ textContent: JSON.stringify(config) }) },
    location: { origin: "https://zukan.earth" },
    crypto: webcrypto,
    TextEncoder,
    URL,
    Uint8Array,
    Blob,
    Map,
    window: { createImageBitmap: async () => { throw new Error("decode_failed"); }, addEventListener: () => undefined },
    Image: class { set src(_value: string) { throw new Error("decode_failed"); } },
    sessionStorage: {
      getItem(key: string) { if (options.storageThrows) throw new Error("storage_denied"); return values.get(key) ?? null; },
      setItem(key: string, value: string) { if (options.storageThrows) throw new Error("storage_denied"); values.set(key, value); },
      removeItem(key: string) { values.delete(key); },
    },
  });
  // Observe browser behavior without adding a production test hook or running page effects.
  const script = BIOSECURITY_SCRIPT.replace(
    "  if (config.view === 'capture') setupCapture();",
    "  globalThis.__helpers = {stableKey, privatePhotoUrl, shareForm, details, detailText, dateText, observedTimeText, captureMetadata, environmentSection, environmentEntries, privatePhoto};\n  if (config.view === 'capture') setupCapture();",
  );
  vm.runInContext(script, context);
  return context.__helpers as ScriptHelpers;
}

test("all views render and the browser script parses without Node dependencies", () => {
  assert.doesNotThrow(() => new Function(BIOSECURITY_SCRIPT));
  for (const view of ["guide", "capture", "receipt", "municipalities", "inbox"] as BiosecurityView[]) {
    const html = renderBiosecurityPage(view);
    assert.match(html, /<!doctype html>/);
    assert.match(html, /<html lang="ja">/);
    assert.match(html, /data-zukan-design/);
    assert.match(html, /<main id="bio-main"/);
    if (view !== "guide") assert.match(html, /noindex,nofollow,noarchive/);
  }
  assert.match(renderBiosecurityPage("municipalities"), /id="bio-staff-code"[^>]*pattern="\[0-9\]\{8\}"/);
});

test("the public guide does not create a session or reveal a previous guest's records", () => {
  const html = renderBiosecurityPage("guide");
  assert.doesNotMatch(html, /<script|fetch\(|bio-config/);
  assert.match(html, /href="\/ja\/biosecurity\/records">自分の記録を見る/);
  assert.match(html, /自治体での正式受付とは異なります/);
  assert.match(html, /虫の名前や被害の有無は確定しません/);
  assert.match(html, /src="\/assets\/biosecurity\/photo-watch.webp"[^>]*alt=""/);
});

test("registered profile headings and guide destinations do not inherit the first species", () => {
  const profile = { ...BIOSECURITY_PROFILES[0]!, id: "fixture-plant", title: "植物の見守り", guideHeading: undefined, guideUrl: "https://example.test/plant", summary: "植物を写真で残す" };
  const html = renderBiosecurityPage("guide", { profile });
  assert.match(html, /<h1>植物の見守り<\/h1>/);
  assert.match(html, /href="\/ja\/biosecurity\/fixture-plant\/capture"/);
  assert.doesNotMatch(html, /クビアカツヤカミキリ|農林水産省の/);
  assert.match(renderBiosecurityPage("guide", { profile: { ...profile, guideHeading: "気になる植物を見つけたら" } }), /<h1>気になる植物を見つけたら<\/h1>/);
});

test("profile copy and JSON configuration cannot break out into HTML or script", () => {
  const payload = '</script><img src=x onerror="alert(1)">';
  const profile = { ...BIOSECURITY_PROFILES[0]!, id: payload, title: payload, summary: payload, guideUrl: "javascript:alert(1)", safety: [payload] };
  const guide = renderBiosecurityPage("guide", { profile });
  assert.doesNotMatch(guide, /<img src=x|href="javascript:/);
  assert.match(guide, /&lt;\/script&gt;/);
  const capture = renderBiosecurityPage("capture", { profile, nonce: '" onload="bad' });
  assert.doesNotMatch(capture, /<img src=x/);
  const config = capture.match(/<script id="bio-config"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(config);
  assert.equal(JSON.parse(config).profile.id, payload);
  assert.match(capture, /nonce="&quot; onload=&quot;bad"/);
});

test("private save separates retention, exact location and municipality sharing", () => {
  const html = renderBiosecurityPage("capture");
  assert.match(html, /同じ端末で90日間見返せます/);
  assert.match(html, /90日で閲覧終了し、その後順次削除します/);
  assert.match(html, /端末のデータを消すと戻れません/);
  assert.match(html, /現在地は、ボタンを押したときだけ調べます/);
  const form = html.match(/<form id="bio-capture-form"[\s\S]*?<\/form>/)?.[0];
  assert.ok(form);
  assert.doesNotMatch(form, /share-consent|guardian-consent|name="email"|name="password"/);
  assert.match(form, /id="bio-save">写真を残す/);
  assert.match(form, /id="bio-is-minor"/);
  const dateInput = form.match(/<input[^>]*id="bio-observed-at"[^>]*>/)?.[0];
  assert.ok(dateInput);
  assert.doesNotMatch(dateInput, /required|value=/);
  assert.match(dateInput, /step="1"/);
  assert.match(form, /日時や場所がわからなくても、このまま残せます/);
  assert.doesNotMatch(form, /environment-hints|Cloudflare/);
});

test("unchanged retries keep their command key while changed content or photos get a fresh key", async () => {
  const browser = helpers();
  const first = await browser.stableKey("capture", { note: "幹の根元", photos: ["sha-a"] });
  assert.equal(await browser.stableKey("capture", { note: "幹の根元", photos: ["sha-a"] }), first);
  const changedNote = await browser.stableKey("capture", { note: "公園の入口", photos: ["sha-a"] });
  assert.notEqual(changedNote, first);
  assert.notEqual(await browser.stableKey("capture", { note: "公園の入口", photos: ["sha-b"] }), changedNote);
  assert.notEqual(await browser.stableKey("share.record-a", { fields: ["photos"], municipalityCode: "221309" }), first);
});

test("retries remain idempotent when browser storage is denied", async () => {
  const browser = helpers({ storageThrows: true });
  const key = await browser.stableKey("capture", { note: "同じ入力", photos: ["sha-a"] });
  assert.equal(await browser.stableKey("capture", { note: "同じ入力", photos: ["sha-a"] }), key);
});

test("sharing is field opt-in, preserves unknown time and requires guardian consent for a minor", () => {
  const browser = helpers();
  const html = browser.shareForm({ photoCount: 2, note: "木くず", spotLabel: "公園", exactLocation: { lat: 34.7, lng: 137.7 }, isMinor: true, environment:{version:2,values:{place_type:"woodland",place_type_source:"derived"}} });
  assert.match(html, /value="observedAt" checked disabled/);
  assert.match(html, /日時（わからない場合はそのまま）/);
  for (const field of ["photos", "note", "spotLabel", "exactLocation", "environment"]) {
    const control = html.match(new RegExp('<input[^>]*value="' + field + '"[^>]*>'))?.[0];
    assert.ok(control, field);
    assert.doesNotMatch(control, /checked/, field);
  }
  assert.match(html, /id="bio-guardian-consent" required/);
  assert.match(html, /id="bio-share-consent" required/);
  assert.doesNotMatch(browser.shareForm({ photoCount: 1, isMinor: false }), /bio-guardian-consent|value="exactLocation"|value="environment"/);
});

test("missing dates never become the epoch or the common-record fallback, and local dates retain unknown timezones", () => {
  const browser = helpers();
  assert.equal(browser.dateText(null), "日時はわからない");
  assert.equal(browser.observedTimeText({observedAt:null}), "日時はわからない");
  assert.equal(browser.observedTimeText({observedAt:"2026-10-12T12:00:00Z",observedTime:{source:"unknown",localDateTime:null}}), "わからない");
  const local = {source:"photo_exif",localDateTime:"2026-10-12T14:35:06",offsetMinutes:null,precision:"second",photoIndex:0};
  assert.equal(browser.observedTimeText({observedAt:null,observedTime:local}), "2026年10月12日 14:35:06（時間帯は不明）");
  assert.equal(browser.observedTimeText({observedTime:{...local,localDateTime:"2026-10-12",precision:"date"}}), "2026年10月12日");
  const record = {observedAt:null,observedTime:local,originalTime:{...local,localDateTime:"1980-01-01T01:01:01"}};
  for (const rendered of [browser.details(record),browser.detailText(record)]) {
    assert.match(rendered, /1枚目の写真から/);
    assert.doesNotMatch(rendered, /1980|1970|日本時間/);
  }
});

test("photo metadata uses the first photo, flags disagreement and keeps explicit edits or clearing across added or removed photos", () => {
  const browser = helpers();
  const first = {metadata:{time:{source:"photo_exif",localDateTime:"2026-10-12T14:30:01",offsetMinutes:540,instant:"2026-10-12T05:30:01Z",precision:"second"},location:{source:"photo_exif",lat:34.7,lng:137.7}}};
  const second = {metadata:{time:{source:"photo_exif",localDateTime:"2026-10-11T14:30:01",offsetMinutes:null,instant:null,precision:"second"},location:{source:"photo_exif",lat:34.8,lng:137.8}}};
  const original = browser.captureMetadata([first,second]);
  assert.equal(original.time.localDateTime, "2026-10-12T14:30:01");
  assert.equal(original.time.photoIndex, 0);
  assert.equal(original.location?.lat, 34.7);
  assert.deepEqual(JSON.parse(JSON.stringify(original.conflicts)), {time:true,location:true});
  const userTime = {source:"user",localDateTime:"2026-09-01T12:00",offsetMinutes:540,instant:"2026-09-01T03:00:00Z",precision:"minute",photoIndex:null};
  const edited = browser.captureMetadata([first,second], {time:userTime,location:null});
  assert.equal(edited.time.localDateTime, userTime.localDateTime);
  assert.equal(edited.originalTime.localDateTime, first.metadata.time.localDateTime);
  assert.equal(edited.location, null);
  const removedFirst = browser.captureMetadata([second], {time:{source:"user",localDateTime:null,offsetMinutes:null,instant:null,precision:"unknown",photoIndex:null},location:null});
  assert.equal(removedFirst.time.source, "user");
  assert.equal(removedFirst.time.localDateTime, null);
  assert.equal(removedFirst.location, null);
  const absent = browser.captureMetadata([{metadata:{time:{source:"unknown",localDateTime:null,offsetMinutes:null,instant:null,precision:"unknown"},location:null}}]);
  assert.equal(absent.time.localDateTime, null);
  assert.equal(absent.location, null);
});

test("environment candidates are optional, typed, source-labelled and unavailable states retain the saved record", () => {
  const browser = helpers();
  const initial = browser.environmentSection({environment:{status:"not_requested",version:0,values:{}}});
  assert.match(initial, /id="bio-environment-hints"/);
  assert.match(initial, /1枚目の写真をCloudflareのAIで調べます/);
  assert.doesNotMatch(initial, / required/);
  assert.match(browser.environmentSection({environment:{status:"ready",version:1,model:null,values:{contact_surface:"unknown",contact_surface_source:"user"}}}), /id="bio-environment-hints"/);
  const environment = {status:"ready",version:2,values:{place_type:"woodland",place_type_source:"derived",contact_surface:"rock",contact_surface_source:"user",environment_condition:"unknown",environment_condition_source:"user",human_change:"<script>bad</script>",human_change_source:"derived"}};
  const entries = browser.environmentEntries(environment);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.source, "1枚目の写真からの候補（AI）");
  assert.equal(entries[1]?.source, "自分で入力");
  const rendered = browser.environmentSection({environment});
  assert.doesNotMatch(rendered, /id="bio-environment-hints"|<script>bad/);
  assert.match(rendered, /わからない・使わない/);
  for (const status of ["off","budget_reached","unavailable","processing"]) {
    const html = browser.environmentSection({environment:{status,version:1,values:{}}});
    assert.doesNotMatch(html, /id="bio-environment-hints"/);
    assert.match(html, /自分で入れる/);
  }
});

test("sharing a changed environmental snapshot requires a new command key", async () => {
  const browser = helpers();
  const request = {fields:["observedAt","photos","environment"],municipalityCode:"221309",environmentVersion:1};
  const first = await browser.stableKey("share.record-a", request);
  assert.equal(await browser.stableKey("share.record-a", request), first);
  assert.notEqual(await browser.stableKey("share.record-a", {...request,environmentVersion:2}), first);
});

test("private photo links stay on the protected API and filtered fields stay absent", () => {
  const browser = helpers();
  assert.equal(browser.privatePhotoUrl("https://other.example/photo.jpg"), "");
  assert.equal(browser.privatePhotoUrl("/assets/photo.jpg"), "");
  assert.equal(browser.privatePhotoUrl("javascript:alert(1)"), "");
  assert.equal(browser.privatePhotoUrl("/api/v1/biosecurity/records/a/photos/b"), "/api/v1/biosecurity/records/a/photos/b");
  const html = browser.details({ observedAt: "2026-10-12T00:00:00Z", note: "<script>bad</script>" });
  assert.doesNotMatch(html, /場所の目印|記録した位置|<script>/);
  assert.match(html, /&lt;script&gt;bad/);
});

test("photo preparation never uploads the original bytes when decoding fails", async () => {
  const browser = helpers();
  await assert.rejects(browser.privatePhoto(new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" })), (error: unknown) => {
    assert.equal((error as { code?: string }).code, "photo_decode_failed");
    return true;
  });
});
