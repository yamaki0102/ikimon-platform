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
  privatePhoto(file: { size: number }): Promise<unknown>;
};

function helpers(options: { storageThrows?: boolean } = {}): ScriptHelpers {
  const values = new Map<string, string>();
  const config = { view: "test", profile: BIOSECURITY_PROFILES[0] };
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
    "  globalThis.__helpers = {stableKey, privatePhotoUrl, shareForm, details, privatePhoto};\n  if (config.view === 'capture') setupCapture();",
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
  assert.match(html, /AI判定や専門家による確認は行いません/);
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
  assert.match(html, /正確な位置も残す（任意）/);
  const form = html.match(/<form id="bio-capture-form"[\s\S]*?<\/form>/)?.[0];
  assert.ok(form);
  assert.doesNotMatch(form, /share-consent|guardian-consent|name="email"|name="password"/);
  assert.match(form, /非公開で保存する/);
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

test("sharing is field opt-in and requires guardian consent for a minor", () => {
  const browser = helpers();
  const html = browser.shareForm({ photoCount: 2, note: "木くず", spotLabel: "公園", exactLocation: { lat: 34.7, lng: 137.7 }, isMinor: true });
  assert.match(html, /value="observedAt" checked disabled/);
  for (const field of ["photos", "note", "spotLabel", "exactLocation"]) {
    const control = html.match(new RegExp('<input[^>]*value="' + field + '"[^>]*>'))?.[0];
    assert.ok(control, field);
    assert.doesNotMatch(control, /checked/, field);
  }
  assert.match(html, /id="bio-guardian-consent" required/);
  assert.match(html, /id="bio-share-consent" required/);
  assert.doesNotMatch(browser.shareForm({ photoCount: 1, isMinor: false }), /bio-guardian-consent|value="exactLocation"/);
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
