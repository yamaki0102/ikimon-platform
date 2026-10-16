import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import test from "node:test";
import vm from "node:vm";
import { BIOSECURITY_PROFILES } from "../services/biosecurityProfiles.js";
import { BIOSECURITY_SCRIPT, renderBiosecurityPage, type BiosecurityView } from "./biosecurity.js";

type EditValues = Record<string, string | boolean>;
type ScriptHelpers = {
  stableKey(scope: string, value: unknown): Promise<string>;
  privatePhotoUrl(value: string): string;
  shareForm(record: Record<string, unknown>): string;
  setupShare(record: Record<string, unknown>): void;
  recordEditForm(record: Record<string, unknown>): string;
  recordListItem(record: Record<string, unknown>): string;
  detailEditValues(record: Record<string, unknown>): EditValues;
  editedTime(value: string, previousTime?: Record<string, unknown> | null, useDeviceTimeZone?: boolean): Record<string, unknown> | null;
  buildDetailsPatch(record: Record<string, unknown>, values: EditValues, clear?: {time?: boolean; location?: boolean}, before?: EditValues): Record<string, unknown>;
  details(record: Record<string, unknown>): string;
  detailText(record: Record<string, unknown>): string;
  dateText(value: unknown): string;
  observedTimeText(record: Record<string, unknown>): string;
  captureMetadata(photos: Array<{metadata:Record<string, unknown>}>, overrides?: Record<string, unknown>): {time:Record<string, unknown>; originalTime:Record<string, unknown> | null; location:Record<string, unknown> | null; conflicts:{time:boolean;location:boolean}};
  environmentSection(record: Record<string, unknown>): string;
  environmentEntries(environment: Record<string, unknown>): Array<{field:string;source:string;value:string}>;
  privatePhoto(file: { size: number }): Promise<unknown>;
};

function helpers(options: { storageThrows?: boolean; document?: Record<string, unknown>; fetch?: (...args: unknown[]) => Promise<unknown> } = {}): ScriptHelpers {
  const values = new Map<string, string>();
  const config = JSON.parse(renderBiosecurityPage("receipt").match(/<script id="bio-config"[^>]*>([\s\S]*?)<\/script>/)![1]!);
  config.view = "test";
  const context = vm.createContext({
    document: { getElementById: () => ({ textContent: JSON.stringify(config) }), ...options.document },
    location: { origin: "https://zukan.earth" },
    crypto: webcrypto,
    TextEncoder,
    URL,
    Uint8Array,
    Blob,
    FormData,
    Event,
    Map,
    fetch: options.fetch,
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
    "  globalThis.__helpers = {stableKey, privatePhotoUrl, shareForm, setupShare, recordEditForm, recordListItem, detailEditValues, editedTime, buildDetailsPatch, details, detailText, dateText, observedTimeText, captureMetadata, environmentSection, environmentEntries, privatePhoto};\n  if (config.view === 'capture') setupCapture();",
  );
  vm.runInContext(script, context);
  return context.__helpers as ScriptHelpers;
}

// Small event fixture for the existing share form. Native layout/validation is
// assessed separately; reportValidity deliberately returns true to exercise the
// explicit guardian and empty-selection guards even without browser validation.
function shareEvents() {
  type Control = {value?:string; checked?:boolean; disabled?:boolean; required?:boolean; hidden?:boolean; textContent?:string; dataset?:Record<string,string>; selectedIndex?:number; options?:Array<{text:string}>};
  const fields: Control[] = [{value:"photos",checked:false},{value:"observedAt",checked:false},{value:"note",checked:false}];
  const roles: Control[] = [{value:"adult",checked:false},{value:"guardian",checked:false}];
  const consent: Control = {checked:false}, guardian: Control = {checked:false,disabled:true,required:false};
  const destination: Control = {value:"221309",selectedIndex:0,options:[{text:"浜松市"},{text:"静岡市"}]};
  const nodes: Record<string, Control> = {"#bio-share-consent":consent,"#bio-guardian-consent":guardian,"#bio-guardian-confirmation":{hidden:true},"#bio-municipality-code":destination,"#bio-share-summary":{},"[data-controls]":{disabled:false},"button[type=submit]":{textContent:"自治体に知らせる",dataset:{}}};
  const listeners = new Map<string,Array<(event: unknown) => unknown>>(), attributes = new Map<string,string>(), sent: Array<{path:string;payload:Record<string,unknown>}> = [];
  const emit = (type: string, target?: unknown) => Promise.all((listeners.get(type) || []).map(listener => listener({target:target || form,preventDefault(){}})));
  const form = {
    querySelector(selector: string) { if (selector === "input[name=share_role]:checked") return roles.find(input => input.checked) || null; return nodes[selector] || null; },
    querySelectorAll(selector: string) { return selector === "input[name=share_field]:checked" ? fields.filter(input => input.checked) : []; },
    addEventListener(type: string, listener: (event: unknown) => unknown) { listeners.set(type,[...(listeners.get(type) || []),listener]); },
    dispatchEvent(event: {type:string}) { void emit(event.type); return true; },
    getAttribute(name: string) { return attributes.get(name); },
    setAttribute(name: string, value: string) { attributes.set(name,value); },
    reportValidity() { return true; },
  };
  const browser = helpers({document:{querySelector:(selector:string) => selector === "#bio-share-form" ? form : null},fetch:async (path, options) => {
    sent.push({path:String(path),payload:JSON.parse((options as {body:string}).body)});
    return {ok:false,status:409,json:async()=>({error:"fixture_stops_before_external_write"})};
  }});
  return {browser,form,fields,roles,consent,guardian,destination,nodes,sent,emit};
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
  assert.doesNotMatch(form, /share-consent|guardian-consent|bio-is-minor|name="email"|name="password"/);
  assert.match(form, /id="bio-photo-button-label">写真を撮る・選ぶ/);
  assert.match(form, /id="bio-save">写真を残す/);
  const optional = form.match(/<details[^>]*id="bio-capture-more"[^>]*>/)?.[0];
  assert.ok(optional);
  assert.doesNotMatch(optional, / open/);
  assert.ok(form.indexOf('id="bio-save"') < form.indexOf('id="bio-capture-more"'));
  assert.ok(form.indexOf('id="bio-photo-conflicts"') < form.indexOf('id="bio-capture-more"'));
  assert.ok(form.indexOf('id="bio-capture-more"') < form.indexOf('id="bio-observed-at"'));
  const dateInput = form.match(/<input[^>]*id="bio-observed-at"[^>]*>/)?.[0];
  assert.ok(dateInput);
  assert.doesNotMatch(dateInput, /required|value=/);
  assert.match(dateInput, /step="1"/);
  const timezone = form.match(/<input[^>]*id="bio-time-device-zone"[^>]*>/)?.[0];
  assert.ok(timezone); assert.doesNotMatch(timezone, /checked|required/);
  assert.match(form, /写真の時間帯を引きつぎます。不明な場合は、不明のまま残します/);
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

test("sharing starts with no fields or age role selected and minors cannot choose adult consent", () => {
  const browser = helpers();
  const html = browser.shareForm({ photoCount: 2, note: "木くず", spotLabel: "公園", exactLocation: { lat: 34.7, lng: 137.7 }, isMinor: true, environment:{version:2,values:{place_type:"woodland",place_type_source:"derived"}} });
  assert.match(html, /日時（わからない場合はそのまま）/);
  for (const field of ["observedAt", "photos", "note", "spotLabel", "exactLocation", "environment"]) {
    const control = html.match(new RegExp('<input[^>]*value="' + field + '"[^>]*>'))?.[0];
    assert.ok(control, field);
    assert.doesNotMatch(control, /checked|disabled/, field);
  }
  assert.doesNotMatch(html, /value="adult"| checked/);
  assert.match(html, /name="share_role" value="guardian" required/);
  assert.match(html, /id="bio-guardian-consent" disabled/);
  assert.match(html, /id="bio-share-consent" required/);
  const adult = browser.shareForm({ photoCount: 1, isMinor: false });
  assert.match(adult, /name="share_role" value="adult" required/);
  assert.match(adult, /name="share_role" value="guardian" required/);
  assert.doesNotMatch(adult, / checked|value="exactLocation"|value="environment"/);
  assert.match(adult, /1つ以上選んでください/);
});

test("sharing content, destination and role changes clear consent, while checking consent does not clear itself", async () => {
  const fixture = shareEvents(); fixture.browser.setupShare({id:"record-a",recordVersion:4});
  fixture.roles[1]!.checked=true; await fixture.emit("change",fixture.roles[1]);
  assert.equal(fixture.guardian.required,true); assert.equal(fixture.guardian.disabled,false); assert.equal(fixture.nodes["#bio-guardian-confirmation"]!.hidden,false);
  fixture.guardian.checked=true; await fixture.emit("change",fixture.guardian);
  fixture.consent.checked=true; await fixture.emit("change",fixture.consent); assert.equal(fixture.consent.checked,true); assert.equal(fixture.guardian.checked,true);
  fixture.fields[0]!.checked=true; await fixture.emit("change",fixture.fields[0]); assert.equal(fixture.consent.checked,false); assert.equal(fixture.guardian.checked,false);
  fixture.guardian.checked=true; fixture.consent.checked=true; fixture.destination.value="221007"; await fixture.emit("change",fixture.destination);
  assert.equal(fixture.consent.checked,false); assert.equal(fixture.guardian.checked,false);
  fixture.guardian.checked=true; fixture.consent.checked=true; fixture.roles[1]!.checked=false; fixture.roles[0]!.checked=true; await fixture.emit("change",fixture.roles[0]);
  assert.equal(fixture.consent.checked,false); assert.equal(fixture.guardian.checked,false); assert.equal(fixture.guardian.disabled,true); assert.equal(fixture.guardian.required,false);
});

test("sharing accepts one optional field and binds the viewed version and explicit adult or guardian consent", async () => {
  const fixture = shareEvents(); fixture.browser.setupShare({id:"record-a",recordVersion:4});
  fixture.roles[0]!.checked=true; fixture.consent.checked=true;
  await fixture.emit("submit"); assert.equal(fixture.sent.length,0);
  fixture.fields[1]!.checked=true; await fixture.emit("submit");
  assert.equal(fixture.sent.length,1);
  assert.equal(fixture.sent[0]!.path,"/api/v1/biosecurity/records/record-a/share");
  assert.deepEqual(fixture.sent[0]!.payload.fields,["observedAt"]);
  assert.equal(fixture.sent[0]!.payload.recordVersion,4); assert.equal(fixture.sent[0]!.payload.adultConsent,true); assert.equal(fixture.sent[0]!.payload.guardianConsent,false);
  fixture.roles[0]!.checked=false; fixture.roles[1]!.checked=true; await fixture.emit("change",fixture.roles[1]); fixture.consent.checked=true;
  await fixture.emit("submit"); assert.equal(fixture.sent.length,1);
  fixture.guardian.checked=true; await fixture.emit("change",fixture.guardian); fixture.consent.checked=true; await fixture.emit("submit");
  assert.equal(fixture.sent.length,2); assert.equal(fixture.sent[1]!.payload.adultConsent,false); assert.equal(fixture.sent[1]!.payload.guardianConsent,true);
  const minor = shareEvents(); minor.browser.setupShare({id:"record-minor",recordVersion:0,isMinor:true});
  minor.fields[0]!.checked=true; minor.roles[0]!.checked=true; minor.consent.checked=true; await minor.emit("submit"); assert.equal(minor.sent.length,0);
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
  assert.equal(edited.originalTime?.localDateTime, first.metadata.time.localDateTime);
  assert.equal(edited.location, null);
  const removedFirst = browser.captureMetadata([second], {time:{source:"user",localDateTime:null,offsetMinutes:null,instant:null,precision:"unknown",photoIndex:null},location:null});
  assert.equal(removedFirst.time.source, "user");
  assert.equal(removedFirst.time.localDateTime, null);
  assert.equal(removedFirst.originalTime, null);
  assert.equal(removedFirst.location, null);
  const absent = browser.captureMetadata([{metadata:{time:{source:"unknown",localDateTime:null,offsetMinutes:null,instant:null,precision:"unknown"},location:null}}]);
  assert.equal(absent.time.localDateTime, null);
  assert.equal(absent.location, null);
});

test("environment candidates are optional, typed, source-labelled and unavailable states retain the saved record", () => {
  const browser = helpers();
  const initial = browser.environmentSection({environment:{status:"not_requested",version:0,values:{}}});
  assert.match(initial, /id="bio-environment-hints"/);
  assert.match(initial, /保存した写真をCloudflareの画像処理に送ります/);
  assert.match(initial, /日時・場所・メモは送りません/);
  assert.match(initial, /写真からまわりのようすを調べる/);
  assert.doesNotMatch(initial, / required/);
  assert.match(browser.environmentSection({environment:{status:"ready",version:1,model:null,values:{contact_surface:"unknown",contact_surface_source:"user"}}}), /id="bio-environment-hints"/);
  const environment = {status:"ready",version:2,values:{place_type:"woodland",place_type_source:"derived",contact_surface:"rock",contact_surface_source:"user",environment_condition:"unknown",environment_condition_source:"user",human_change:"<script>bad</script>",human_change_source:"derived"}};
  const entries = browser.environmentEntries(environment);
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.source, "写真からの候補");
  assert.equal(entries[1]?.source, "自分で入力");
  const rendered = browser.environmentSection({environment});
  assert.doesNotMatch(rendered, /id="bio-environment-hints"|<script>bad/);
  assert.match(rendered, /わからない・使わない/);
  const shared = browser.environmentSection({environment, shares:[{status:"available",fields:["environment"]}]});
  assert.match(shared, /その内容を含む共有は取り消されます/);
  assert.doesNotMatch(shared, /すでに自治体へ送った内容は変わりません/);
  for (const status of ["off","budget_reached","unavailable","processing"]) {
    const html = browser.environmentSection({environment:{status,version:1,values:{}}});
    assert.doesNotMatch(html, /id="bio-environment-hints"/);
    assert.match(html, /自分で入れる/);
  }
});

test("detail edits preserve untouched photo facts and send only the changed fields", () => {
  const browser = helpers();
  const record = {observedTime:{source:"photo_exif",localDateTime:"2026-10-12T14:30:00",offsetMinutes:null,precision:"second",photoIndex:0}, note:"木くず", spotLabel:"公園のサクラ", municipalityCode:"221309", exactLocation:{lat:34.7,lng:137.7}};
  const values = browser.detailEditValues(record);
  assert.equal(JSON.stringify(browser.buildDetailsPatch(record, values)), "{}");
  // Browsers normalize zero seconds; a note edit must not silently adopt the device timezone.
  const normalized = {...values, observedTime:"2026-10-12T14:30"};
  const noteOnly = browser.buildDetailsPatch(record, {...normalized, note:"葉のようす"}, {}, normalized);
  assert.deepEqual(JSON.parse(JSON.stringify(noteOnly)), {note:"葉のようす"});
  const cleared = browser.buildDetailsPatch(record, {...values, observedTime:"", lat:"", lng:"", municipalityCode:""});
  assert.deepEqual(JSON.parse(JSON.stringify(cleared)), {observedTime:null, municipalityCode:null, exactLocation:null});
  const changed = browser.buildDetailsPatch(record, {...values, observedTime:"2026-10-13T10:15"});
  assert.equal((changed.observedTime as Record<string, unknown>).source, "user");
  assert.equal((changed.observedTime as Record<string, unknown>).localDateTime, "2026-10-13T10:15");
  assert.equal((changed.observedTime as Record<string, unknown>).offsetMinutes, null);
  const zero = browser.buildDetailsPatch(record, {...values, lat:"0", lng:"0"});
  assert.deepEqual(JSON.parse(JSON.stringify(zero)), {exactLocation:{lat:0,lng:0}});
  assert.throws(() => browser.buildDetailsPatch(record, {...values, lat:"", lng:"137.7"}), /invalid_location/);
  assert.throws(() => browser.buildDetailsPatch(record, {...values, lat:"91"}), /invalid_location/);
});

test("correcting or adding a local time never adopts the device timezone without an explicit choice", () => {
  const browser = helpers();
  const value = "2026-10-13T10:15", previous = {source:"photo_exif",localDateTime:"2026-10-12T14:30",offsetMinutes:330,precision:"minute",photoIndex:0};
  assert.equal(browser.editedTime(value, previous)!.offsetMinutes,330);
  assert.equal(browser.editedTime(value, {...previous,offsetMinutes:null})!.offsetMinutes,null);
  assert.equal(browser.editedTime(value)!.offsetMinutes,null);
  assert.equal(browser.editedTime(value,previous,true)!.offsetMinutes,-new Date(value).getTimezoneOffset());
  assert.equal(browser.editedTime("2026-10-13",previous)!.offsetMinutes,330);
  assert.equal(browser.editedTime("2026-10-13",null,true)!.offsetMinutes,null);
  assert.equal(browser.editedTime("",previous,true),null);
  const record = {observedTime:previous};
  const values = browser.detailEditValues(record);
  const correction = browser.buildDetailsPatch(record,{...values,observedTime:value});
  assert.equal((correction.observedTime as Record<string,unknown>).offsetMinutes,330);
  const unknown = {observedTime:{...previous,offsetMinutes:null}};
  const explicit = browser.buildDetailsPatch(unknown,{...browser.detailEditValues(unknown),deviceTimeZone:true});
  assert.equal((explicit.observedTime as Record<string,unknown>).offsetMinutes,-new Date(previous.localDateTime).getTimezoneOffset());
  const added = browser.buildDetailsPatch({}, {...browser.detailEditValues({}), observedTime:value});
  assert.equal((added.observedTime as Record<string,unknown>).offsetMinutes,null);
  const html = browser.recordEditForm(unknown), checkbox = html.match(/<input[^>]*id="bio-edit-device-zone"[^>]*>/)?.[0];
  assert.ok(checkbox); assert.doesNotMatch(checkbox,/checked|required/);
  assert.match(html,/時間帯は今の記録を引きつぎます。不明な場合は、不明のまま残します/);
  assert.doesNotMatch(html,/日時を直すと、この端末の時間帯で残します/);
});

test("optional detail editing retains date-only precision and offers deletion without making up a timestamp", () => {
  const browser = helpers();
  const record = {observedTime:{source:"photo_exif",localDateTime:"2026-10-12",offsetMinutes:null,precision:"date"}, note:"<script>bad</script>"};
  const html = browser.recordEditForm(record);
  assert.match(html, /<details id="bio-record-edit">/);
  assert.match(html, /id="bio-edit-time" type="date"/);
  assert.doesNotMatch(html, /T00:00|<script>bad| required/);
  assert.match(html, /&lt;script&gt;bad/);
  assert.match(html, /id="bio-edit-time-clear"/);
  assert.match(html, /id="bio-edit-location-clear"/);
  assert.match(html, /その内容を含む共有|直した内容を含む共有/);
  const patch = browser.buildDetailsPatch(record, {...browser.detailEditValues(record), observedTime:"2026-10-13"});
  assert.deepEqual(JSON.parse(JSON.stringify(patch.observedTime)), {source:"user",localDateTime:"2026-10-13",offsetMinutes:null,precision:"date",photoIndex:null});
  assert.doesNotMatch(browser.recordEditForm({observedTime:{localDateTime:null}}), /value="\d{4}-/);
});

test("record list thumbnails use protected photos and keep untrusted titles as text", () => {
  const browser = helpers();
  const record = {id:"record-a",photoCount:1,spotLabel:"<img src=x onerror=bad>",photos:[{url:"https://other.example/photo.jpg"},{url:"/api/v1/biosecurity/records/record-a/photos/photo-a"}]};
  const html = browser.recordListItem(record);
  assert.match(html, /class="bio-record-thumbnail" src="\/api\/v1\/biosecurity\/records\/record-a\/photos\/photo-a"/);
  assert.match(html, /href="\/ja\/biosecurity\/records\/record-a"/);
  assert.match(html, /&lt;img src=x onerror=bad&gt;/);
  assert.doesNotMatch(html, /other\.example|<img src=x/);
  assert.doesNotMatch(browser.recordListItem({...record,photos:[]}), /class="bio-record-thumbnail"/);
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
