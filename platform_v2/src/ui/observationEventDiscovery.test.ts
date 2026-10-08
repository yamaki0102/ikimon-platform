import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  observationEventDiscoveryScript,
  renderObservationEventDiscoveryCampaign,
  renderObservationEventDiscoveryCapture,
  renderObservationEventDiscoveryGallery,
  renderObservationEventDiscoveryJoin,
  renderObservationEventDiscoveryOrganizer,
  renderObservationEventDiscoveryPrint,
} from "./observationEventDiscovery.js";

type Data = Record<string, any>;
type Call = { url: string; method: string; options: Data; body: any };

/** Small DOM contract fixture; behavior uses the actual shipped browser script. */
class Element {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<(event: Data) => unknown>>();
  selectors = new Map<string, Element>();
  childNodes: Element[] = [];
  parent: Element | null = null;
  private inputValue = "";
  get value(): string { return this.inputValue; }
  set value(value: string) { this.inputValue = value; if (this.type === "file" && value === "") this.files = []; }
  name = "";
  type = "";
  className = "";
  checked = false;
  disabled = false;
  hidden = false;
  required = false;
  focused = false;
  files: Data[] = [];
  src = "";
  href = "";
  target = "";
  rel = "";
  minLength = 0;
  maxLength = Number.MAX_SAFE_INTEGER;
  private text = "";
  constructor(public tag = "div") {}
  get textContent(): string { return this.text + this.childNodes.map(child => child.textContent).join(""); }
  set textContent(value: string) { this.text = String(value); this.childNodes = []; }
  get elements() { return { namedItem: (name: string) => this.walk().find(child => child.name === name) ?? null }; }
  walk(): Element[] { return this.childNodes.flatMap(child => [child, ...child.walk()]); }
  append(...children: Element[]) { for (const child of children) { child.parent = this; this.childNodes.push(child); } }
  replaceChildren(...children: Element[]) { this.text = ""; this.childNodes = []; this.append(...children); }
  remove() { if (this.parent) this.parent.childNodes = this.parent.childNodes.filter(child => child !== this); }
  replaceWith(replacement: Element) { if (!this.parent) return; const index = this.parent.childNodes.indexOf(this); replacement.parent = this.parent; this.parent.childNodes[index] = replacement; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name); }
  focus() { this.focused = true; }
  addEventListener(name: string, listener: (event: Data) => unknown) { const list = this.listeners.get(name) ?? []; list.push(listener); this.listeners.set(name, list); }
  async dispatch(name: string, extra: Data = {}) { for (const listener of this.listeners.get(name) ?? []) await listener({ currentTarget: this, target: this, preventDefault() {}, ...extra }); }
  querySelector(selector: string): Element | null { return this.selectors.get(selector) ?? this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector: string): Element[] {
    if (selector === "fieldset") return this.walk().filter(child => child.tag === "fieldset");
    if (selector === "button") return this.walk().filter(child => child.tag === "button");
    if (selector === 'button[type=submit]') return this.walk().filter(child => child.tag === "button" && child.type === "submit");
    if (selector === "[data-discovery-review-filter]") return this.walk().filter(child => Boolean(child.dataset.discoveryReviewFilter));
    return this.selectors.has(selector) ? [this.selectors.get(selector)!] : [];
  }
  reportValidity() { return this.walk().every(child => child.disabled || !child.required || (child.type === "checkbox" ? child.checked : child.type === "file" ? child.files.length > 0 : child.value.length >= Math.max(1, child.minLength))); }
  reset() { for (const child of this.walk()) { child.value = ""; child.checked = false; child.files = []; } }
}

class FormDataFixture {
  values = new Map<string, any>();
  set(key: string, value: any) { this.values.set(key, value); }
  get(key: string) { return this.values.get(key); }
}

function control(form: Element, name: string, type = "text") {
  const child = new Element(type === "textarea" ? "textarea" : "input");
  child.name = name; child.type = type; form.append(child); return child;
}

function setup(kind: string, options: { storage?: Map<string, string>; fetch?: (call: Call) => Promise<any>; minor?: boolean; href?: string; displayName?: string; preview?: boolean } = {}) {
  const root = new Element("section");
  root.dataset = { eventDiscovery: kind, sessionId: "event-fixture", isMinor: String(options.minor === true) };
  const storage = options.storage ?? new Map<string, string>();
  const calls: Call[] = []; const navigations: string[] = [];
  const nodes = new Map<string, Element>();
  const add = (selector: string, tag = "div", parent = root) => { const child = new Element(tag); parent.append(child); root.selectors.set(selector, child); nodes.set(selector, child); return child; };
  add("[data-discovery-status]", "p");
  if (kind === "campaign") {
    add("[data-discovery-occurrence-select]", "select"); add("[data-discovery-occurrence-summary]"); add("[data-discovery-campaign-refresh]", "button");
    const form = add("[data-discovery-application-form]", "form"); form.hidden = true; control(form, "display_name");
    const button = new Element("button"); button.type = "submit"; form.append(button);
    add("[data-discovery-application-status]", "p"); add("[data-discovery-photo-link]", "a").hidden = true; add("[data-discovery-day-state]", "p");
    add("[data-discovery-journals]"); add("[data-discovery-counts]", "p"); add("[data-discovery-gallery-status]", "p");
    add("[data-discovery-gallery-refresh]", "button"); add("[data-discovery-gallery-more]", "button");
    const codeForm=add("[data-discovery-code-form]", "form"); control(codeForm,"event_code");
  }
  if (kind === "join") {
    const form = add("[data-discovery-join-form]", "form");
    control(form, "display_name").value = options.displayName ?? ""; control(form, "is_minor", "checkbox");
    add("[data-discovery-join-submit]", "button", form);
  }
  if (kind === "capture") {
    add("[data-discovery-receipts]"); add("[data-discovery-refresh]", "button");
    add("[data-discovery-photo-count]", "p"); add("[data-discovery-limit-message]", "p");
    const form = add("[data-discovery-media-form]", "form");
    const fields = add("[data-discovery-capture-fields]", "fieldset", form); fields.disabled = true;
    control(fields, "media", "file").required = true;
    control(fields, "camera_media", "file"); add("[data-discovery-capture-heading]", "h2");
    control(fields, "caption", "textarea"); control(fields, "spot_label");
    for (const name of ["private_storage_consent", "creator_rights_attestation", "gallery_consent", "guardian_gallery_consent"]) control(fields, name, "checkbox").required = name === "private_storage_consent" || name === "creator_rights_attestation";
    const guardian = new Element(); form.selectors.set("[data-discovery-guardian-row]", guardian);
    add("[data-discovery-photo-preview]", "div", form);
  }
  if (kind === "gallery" || kind === "organizer") {
    add("[data-discovery-refresh]", "button"); add("[data-discovery-more]", "button").hidden = true;
  }
  if (kind === "gallery") { add("[data-discovery-journals]"); add("[data-discovery-counts]", "p"); }
  if (kind === "organizer") {
    const settings=add("[data-discovery-campaign-settings]","form");const fields=new Element("fieldset");fields.disabled=true;settings.append(fields);
    control(fields,"listed","checkbox");control(fields,"applications_open","checkbox");const save=new Element("button");save.type="submit";fields.append(save);
    add("[data-discovery-settings-status]","p");add("[data-discovery-participant-counts]","p");add("[data-discovery-listing-permission]","p");add("[data-discovery-campaign-link]","a");
    add("[data-discovery-review-list]"); add("[data-discovery-review-count]", "p");
    for (const filter of ["pending", "reviewed", "all"]) { const button = new Element("button"); button.dataset.discoveryReviewFilter = filter; root.append(button); }
    const form = add("[data-discovery-paper-form]", "form"); control(form, "nickname");
    for (const number of [1, 2, 3]) { control(form, "caption_" + number, "textarea"); control(form, "spot_" + number); }
    for (const name of ["is_minor", "gallery_consent", "guardian_gallery_consent"]) control(form, name, "checkbox");
    const guardian = new Element(); form.selectors.set("[data-discovery-guardian-row]", guardian);
    const status = new Element("p"); form.append(status); form.selectors.set("[data-discovery-paper-status]", status);
    const button = new Element("button"); button.type = "submit"; form.append(button);
  }
  if (options.preview) { const template = new Element("template"); (template as any).content = { cloneNode: () => { const content = new Element("fragment"); for (const [selector, el] of nodes) if (!/occurrence|application-form|code-form/.test(selector)) content.append(el); return content; } }; root.selectors.set("[data-discovery-preview-template]", template); }
  let uuid = 0;
  const context = {
    document: { querySelectorAll: () => [root], createElement: (tag: string) => new Element(tag) },
    window: { location: { hostname: new URL(options.href ?? "https://fixture.test/events/ryuyo").hostname, href: options.href ?? "https://fixture.test/events/ryuyo", assign: (url: string) => navigations.push(url) }, confirm: () => true, addEventListener() {}, print() {} },
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) },
    crypto: { randomUUID: () => "test-key-" + ++uuid },
    AbortController, setTimeout: () => 1, clearTimeout() {},
    FormData: FormDataFixture, URL: class extends URL { static override createObjectURL() { return "blob:local"; } static override revokeObjectURL() {} },
    fetch: async (url: string, request: Data) => {
      const call = { url, method: request.method ?? "GET", options: request, body: typeof request.body === "string" ? JSON.parse(request.body) : request.body };
      calls.push(call);
      const answer = await options.fetch?.(call) ?? { receipts: [], reviewQueue: [], nextCursor: null };
      if (answer instanceof Error) throw answer;
      const status = answer.statusCode ?? 200;
      return { ok: status >= 200 && status < 300, status, json: async () => answer };
    },
  };
  runInNewContext(observationEventDiscoveryScript(), context);
  return { root, nodes, calls, storage, navigations, context, node: (selector: string) => nodes.get(selector)! };
}

const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
const formField = (form: Element, name: string) => form.elements.namedItem(name)!;
const base = "/api/v1/observation-events/event-fixture";
const mediaFile = { name: "photo.webp", size: 1200, lastModified: 100, type: "image/webp" };
const receipt = (index: number, overrides: Data = {}) => ({ receiptId: `receipt-${index}`, kind: "photo", mediaState: "saved", rightsReviewStatus: "pending", galleryStatus: "private", galleryConsent: false, caption: "", spotLabel: "", idempotencyKey: `receipt-key-${index}`, ...overrides });
function preparePhoto(form: Element) { formField(form,"media").files = [mediaFile]; formField(form,"private_storage_consent").checked = true; formField(form,"creator_rights_attestation").checked = true; }

test("campaign has three original illustrations, real organizer route, optional name and no fictitious event facts", () => {
  // The isolated staging preview is inert template content until its exact
  // hostname and event code match. Production's active campaign stays native.
  const html = renderObservationEventDiscoveryCampaign().replace(/<template data-discovery-preview-template[\s\S]*?<\/template>/u, "");
  assert.equal((html.match(/<img /g) ?? []).length, 3);
  assert.match(html, /event_template=ryuyo&amp;field_id=372eafbd/);
  assert.match(html, /写真は１枚から/);
  assert.doesNotMatch(html, /\d{4}年|100人が参加|本名を推奨/);
  const input = { sessionId: 'id" onclick="bad', title: "<script>bad</script>", eventCode: "X" };
  for (const render of [renderObservationEventDiscoveryJoin, renderObservationEventDiscoveryCapture, renderObservationEventDiscoveryGallery]) {
    const output = render(input);
    assert.doesNotMatch(output, /<script>bad<\/script>|data-session-id="id" onclick/);
    assert.match(output, /&lt;script&gt;bad&lt;\/script&gt;/);
  }
  const join = renderObservationEventDiscoveryJoin(input);
  assert.doesNotMatch(join.match(/<input[^>]*name="display_name"[^>]*>/)?.[0] ?? "", /required/);
  assert.equal((renderObservationEventDiscoveryPrint().match(/class="ed-print-note"/g) ?? []).length, 3);
  assert.match(renderObservationEventDiscoveryJoin({ ...input, canJoin: false, canViewGallery: true }), /みんなの発見を見る/);
  assert.match(renderObservationEventDiscoveryOrganizer({ sessionId: "fixture", sessionClosed: true }), /data-discovery-paper-form/);
  assert.doesNotThrow(() => new Function(observationEventDiscoveryScript()));
});

test("the isolated preview marks its single tentative day and uses the published Google handoff", () => {
  const output = renderObservationEventDiscoveryCampaign();
  const preview = output.match(/<template data-discovery-preview-template[\s\S]*?<\/template>/u)?.[0] ?? "";
  assert.match(preview, /仮日程・テスト公開/);
  assert.match(preview, /開催は未決定/);
  assert.match(preview, /datetime="2026-10-24"/);
  assert.match(preview, /10:00〜12:00/);
  assert.equal((preview.match(/data-discovery-google-form/g) ?? []).length, 2);
  assert.match(preview, /href="https:\/\/docs\.google\.com\/forms\/d\/e\/1FAIpQLS/);
  assert.doesNotMatch(preview, /data-discovery-occurrence-select|data-discovery-application-form|\/print|download=/);
  assert.match(preview, /紙のシートは、当日会場で配布/);
  assert.match(preview, /写真を選んだだけでは送信されません/);
  assert.match(preview, /共有を選んだ写真は自動確認を通るとすぐに掲載/);
  assert.match(preview, /data-discovery-published open hidden/);
  assert.ok(preview.indexOf('data-discovery-published') < preview.indexOf('ed-demo-gallery'), "published posts appear before illustrations");
});

test("unnamed login-free checkin sends an empty nickname, no account fallback, and no location consent", async () => {
  const app = setup("join", { fetch: async () => ({ participant_id: "participant-fixture" }) });
  await app.node("[data-discovery-join-form]").dispatch("submit");
  assert.equal(app.calls.length, 1);
  assert.deepEqual(app.calls[0]!.body, { display_name: "", team_id: null, is_minor: false, share_location: false, guardian_location_consent: false });
  assert.equal(app.calls[0]!.options.credentials, "same-origin");
  assert.deepEqual(app.navigations, ["/events/event-fixture/rally"]);
});

test("day-of join preserves the escaped application nickname and lets an explicit local draft replace or clear it", async () => {
  const html = renderObservationEventDiscoveryJoin({ sessionId: "event-fixture", eventCode: "CODE", title: "竜洋", displayName: '<虫 & ゆう>"' });
  assert.match(html, /name="display_name" value="&lt;虫 &amp; ゆう&gt;&quot;"/);
  for (const draftName of [undefined, "別の呼び名", ""]) {
    const storage = new Map<string, string>();
    if (draftName !== undefined) storage.set("zukan:event-discovery:join:event-fixture", JSON.stringify({ name: draftName }));
    const app = setup("join", { displayName: "申し込みの呼び名", storage, fetch: async () => ({ participant_id: "participant-fixture" }) });
    const expected = draftName ?? "申し込みの呼び名";
    assert.equal(formField(app.node("[data-discovery-join-form]"), "display_name").value, expected);
    await app.node("[data-discovery-join-form]").dispatch("submit");
    assert.equal(app.calls[0]!.body.display_name, expected);
  }
});

test("gallery appends 100 participant journals without splitting their three photos and only uses gated content paths", async () => {
  const journals = Array.from({ length: 100 }, (_, index) => ({ journalId: `journal-${index}`, displayName: index === 0 ? '<img onerror="bad">' : null, entries: [0,1,2].map(number => ({ id: `entry-${index}-${number}`, kind: "photo", caption: "ひと言", spotLabel: "", contentHref: index === 0 ? "https://untrusted.test/photo" : `${base}/discoveries/entry-${index}-${number}/content` })) }));
  const app = setup("gallery", { fetch: async call => { const cursor = Number(new URL(call.url,"https://fixture.test").searchParams.get("cursor") || 0); return { journals: journals.slice(cursor,cursor+24), nextCursor: cursor+24 < 100 ? String(cursor+24) : null, counts: { journals: 100, entries: 300 } }; } });
  await flush();
  for (let index = 0; index < 4; index++) await app.node("[data-discovery-more]").dispatch("click").then(flush);
  const cards = app.node("[data-discovery-journals]").childNodes;
  assert.equal(cards.length, 100);
  assert.equal(cards[0]!.childNodes[1]!.childNodes.length, 3);
  assert.match(cards[0]!.textContent, /<img onerror="bad">/);
  assert.equal(cards[0]!.walk().filter(item => item.tag === "img").length, 0);
  assert.equal(cards[1]!.walk().filter(item => item.tag === "img").length, 3);
  assert.equal(app.node("[data-discovery-more]").hidden, true);
  assert.match(app.node("[data-discovery-counts]").textContent, /100冊.*300件/);
  assert.equal(app.calls.length, 5);
});

test("a failed third photo consumes its slot but can retry with its original key", async () => {
  let rows = [receipt(1),receipt(2),receipt(3,{mediaState:"failed",caption:"残したいこと"})];
  const app = setup("capture", { fetch: async call => { if(call.method === "GET")return {receipts:rows};rows=rows.map(row => row.receiptId === "receipt-3" ? {...row,mediaState:"saved"} : row);return {receipt:rows[2]}; } });
  await flush();
  assert.equal(app.node("[data-discovery-capture-fields]").disabled, true);
  assert.match(app.node("[data-discovery-photo-count]").textContent, /保存未完了 1件/);
  assert.doesNotMatch(app.node("[data-discovery-limit-message]").textContent, /あと1枚/);
  const retry = app.node("[data-discovery-receipts]").walk().find(item => item.tag === "button" && item.textContent === "この写真を再試行")!;
  await retry.dispatch("click");
  assert.equal(app.node("[data-discovery-capture-fields]").disabled, false);
  const form=app.node("[data-discovery-media-form]");preparePhoto(form);await form.dispatch("submit");
  const post=app.calls.find(call=>call.method==="POST")!;
  assert.equal(post.options.headers["idempotency-key"],"receipt-key-3");
  assert.equal(post.body.get("caption"),"残したいこと");
  assert.equal(app.node("[data-discovery-capture-fields]").disabled,true);
  assert.match(app.node("[data-discovery-photo-count]").textContent,/3 \/ 3 枚を保存/);
});

test("shared save immediately shows publication and a gallery link, held faces explain the review reason", async () => {
  for (const galleryStatus of ["published", "pending_review"]) {
    let rows: Data[] = [];
    const app = setup("capture", { fetch: async call => {
      if (call.method === "GET") return { receipts: rows };
      rows = [receipt(1, { galleryStatus, galleryConsent: true, reviewRequiredReason: galleryStatus === "pending_review" ? "person" : null })];
      return { receipt: rows[0] };
    } });
    await flush(); const form = app.node("[data-discovery-media-form]"); preparePhoto(form);
    formField(form, "gallery_consent").checked = true;
    await form.dispatch("submit");
    const status = app.node("[data-discovery-status]").textContent;
    const cards = app.node("[data-discovery-receipts]");
    if (galleryStatus === "published") {
      assert.match(status, /みんなの発見に掲載しました/);
      assert.equal(cards.walk().find(item => item.textContent === "みんなの発見で見る →")?.href, "/events/event-fixture/discoveries");
    } else {
      assert.match(status, /人物や顔の写り込み/);
      assert.match(cards.textContent, /確認してから掲載/);
      assert.equal(cards.walk().some(item => item.textContent === "みんなの発見で見る →"), false);
    }
  }
});

test("unknown upload results retain text and consent across reload and reuse one idempotency key", async () => {
  const storage = new Map<string,string>();
  const first = setup("capture", { storage, fetch: async call => call.method === "POST" ? new Error("network_lost") : {receipts:[]} });
  await flush();const form=first.node("[data-discovery-media-form]");preparePhoto(form);formField(form,"caption").value="小さな羽の色";formField(form,"gallery_consent").checked=true;
  await form.dispatch("submit");const firstKey=first.calls.find(call=>call.method==="POST")!.options.headers["idempotency-key"];
  let rows: Data[]=[];
  const second=setup("capture",{storage,fetch:async call=>{if(call.method==="GET")return{receipts:rows};rows=[receipt(1,{idempotencyKey:firstKey,caption:"小さな羽の色",galleryConsent:true,galleryStatus:"pending_review"})];return{receipt:rows[0]};}});
  await flush();const restored=second.node("[data-discovery-media-form]");assert.equal(formField(restored,"caption").value,"小さな羽の色");assert.equal(formField(restored,"gallery_consent").checked,true);assert.equal(formField(restored,"media").files.length,0);formField(restored,"media").files=[mediaFile];await restored.dispatch("submit");
  assert.equal(second.calls.find(call=>call.method==="POST")!.options.headers["idempotency-key"],firstKey);
  assert.equal(storage.has("zukan:event-discovery:upload:event-fixture"),false);
  assert.match(second.node("[data-discovery-status]").textContent,/写り込みなどの確認待ち/);
});

test("unknown upload that is visible in read-back is reported saved rather than failed", async () => {
  let rows: Data[]=[];
  const app=setup("capture",{fetch:async call=>{if(call.method==="GET")return{receipts:rows};rows=[receipt(1,{idempotencyKey:call.options.headers["idempotency-key"]})];return new Error("response_lost");}});
  await flush();const form=app.node("[data-discovery-media-form]");preparePhoto(form);await form.dispatch("submit");
  assert.match(app.node("[data-discovery-status]").textContent,/保存されていることを確認しました/);
  assert.equal(app.node("[data-discovery-status]").dataset.error,"false");
});

test("initial own-receipt failure leaves photo intake disabled and offers a retry", async () => {
  const app=setup("capture",{fetch:async()=>new Error("offline")});await flush();
  assert.equal(app.node("[data-discovery-capture-fields]").disabled,true);
  assert.equal(app.node("[data-discovery-refresh]").disabled,false);
  assert.match(app.node("[data-discovery-receipts]").textContent,/再読み込み/);
  assert.match(app.node("[data-discovery-status]").textContent,/通信できませんでした/);
  assert.doesNotMatch(app.node("[data-discovery-status]").textContent,/offline|Failed to fetch/);
});

test("organizer initial read failure clears stale loading copy and keeps retry available", async () => {
  const app=setup("organizer",{fetch:async()=>new Error("Failed to fetch")});await flush();
  assert.match(app.node("[data-discovery-review-list]").textContent,/読み込めませんでした/);
  assert.match(app.node("[data-discovery-status]").textContent,/通信できませんでした/);
  assert.equal(app.node("[data-discovery-refresh]").disabled,false);
});

test("a nickname change that invalidates approval returns to the pending review filter", async () => {
  const app=setup("organizer",{fetch:async()=>({receipts:[receipt(1,{rightsReviewStatus:"approved",galleryStatus:"pending_review",galleryConsent:true})],nextCursor:null})});await flush();
  assert.equal(app.node("[data-discovery-review-list]").childNodes.length,1);
  assert.match(app.node("[data-discovery-review-list]").textContent,/確認して掲載する/);
});

test("organizer can load beyond 90 entries, explicitly approve, then edit or stop a published selection", async () => {
  const rows=Array.from({length:100},(_,index)=>receipt(index,{galleryConsent:true,galleryStatus:"pending_review",privateContentHref:`${base}/guest-media/receipt-${index}/content`}));
  const app=setup("organizer",{fetch:async call=>{if(call.method==="GET"){const cursor=Number(new URL(call.url,"https://fixture.test").searchParams.get("cursor")||0);return{receipts:rows.slice(cursor,cursor+90),nextCursor:cursor===0?"90":null};}const id=call.url.split("/").at(-2)!;const row=rows.find(item=>item.receiptId===id)!;Object.assign(row,{rightsReviewStatus:call.body.decision,galleryStatus:call.body.decision==="approved"?"published":"private",selectionLabel:call.body.selectionLabel,selectionComment:call.body.selectionComment});return{receipt:row};}});
  await flush();await app.node("[data-discovery-more]").dispatch("click");await flush();
  const list=app.node("[data-discovery-review-list]");assert.equal(list.childNodes.length,100);
  const fullPhoto=list.childNodes[0]!.walk().find(item=>item.tag==="a"&&item.href===`${base}/guest-media/receipt-0/content`)!;
  assert.equal(fullPhoto.target,"_blank");assert.equal(fullPhoto.rel,"noopener noreferrer");assert.match(fullPhoto.textContent,/写真を大きく開く/);assert.equal(fullPhoto.walk().some(item=>item.tag==="img"),true);
  const form=list.childNodes[0]!.childNodes[1]!;const approve=form.querySelectorAll("button").find(button=>button.value==="approved")!;
  assert.equal(approve.textContent,"確認して掲載する");
  await form.dispatch("submit",{submitter:approve});assert.equal(app.calls.filter(call=>call.method==="PATCH").length,0);
  formField(form,"confirmed").checked=true;formField(form,"selectionLabel").value="小さな発見賞";await form.dispatch("submit",{submitter:approve});
  const patch=app.calls.find(call=>call.method==="PATCH")!;assert.equal(patch.body.rightsConfirmed,true);assert.equal(patch.body.privacyConfirmed,true);assert.equal(list.childNodes.length,99);
  await app.root.querySelectorAll("[data-discovery-review-filter]").find(button=>button.dataset.discoveryReviewFilter==="reviewed")!.dispatch("click");
  assert.equal(list.childNodes.length,1);const reviewed=list.childNodes[0]!.childNodes[1]!;assert.equal(formField(reviewed,"selectionLabel").value,"小さな発見賞");
  const reject=reviewed.querySelectorAll("button").find(button=>button.value==="rejected")!;assert.equal(reject.textContent,"掲載を止める");await reviewed.dispatch("submit",{submitter:reject});assert.equal(rows[0]!.rightsReviewStatus,"rejected");
});

test("paper entries preserve their recovery draft and require guardian consent only when sharing a minor's note", async () => {
  const storage=new Map<string,string>();
  const app=setup("organizer",{storage,fetch:async call=>call.method==="POST"?new Error("response_lost"):{receipts:[],nextCursor:null}});await flush();
  const form=app.node("[data-discovery-paper-form]");formField(form,"caption_1").value="紙で見つけた葉っぱ";formField(form,"is_minor").checked=true;formField(form,"gallery_consent").checked=true;await form.dispatch("change");
  assert.equal(formField(form,"guardian_gallery_consent").required,true);await form.dispatch("submit");assert.equal(app.calls.filter(call=>call.method==="POST").length,0);
  formField(form,"guardian_gallery_consent").checked=true;await form.dispatch("submit");
  const sent=app.calls.find(call=>call.method==="POST")!;assert.equal(sent.body.nickname,"");assert.equal(sent.body.notes.length,1);
  const reopened=setup("organizer",{storage});await flush();const restored=reopened.node("[data-discovery-paper-form]");assert.equal(formField(restored,"caption_1").value,"紙で見つけた葉っぱ");assert.equal(formField(restored,"guardian_gallery_consent").checked,true);
});

const listedOccurrence=(id="event-fixture",overrides:Data={})=>({sessionId:id,eventCode:id==="event-fixture"?"RYUYO1":id.toUpperCase(),title:"こんちゅうクンとめぐる、竜洋のとっておき。",startedAt:"2026-11-01T01:00:00Z",endedAt:"2026-11-01T03:00:00Z",canApply:true,canCheckIn:false,canSubmit:false,canViewGallery:true,...overrides});
const journalsFor=(id:string,caption:string)=>({journals:[{journalId:"journal-"+id,displayName:null,entries:[{id:"photo-"+id,kind:"photo",caption,contentHref:"/api/v1/observation-events/"+id+"/discoveries/photo-"+id+"/content"}]}],counts:{journals:1,entries:1},nextCursor:null});

test("participant surfaces explain each step without paper hyperlinks and keep separate native album and camera inputs",()=>{
  const event={...listedOccurrence(),canJoin:true,canSubmit:true};
  for(const html of [renderObservationEventDiscoveryCampaign(),renderObservationEventDiscoveryJoin(event),renderObservationEventDiscoveryCapture(event)])assert.doesNotMatch(html,/href="[^"]*\/print/);
  const html=renderObservationEventDiscoveryCapture(event);
  assert.doesNotMatch(html.match(/<input[^>]+name="media"[^>]+>/)?.[0]||"",/capture=/);
  assert.match(html.match(/<input[^>]+name="camera_media"[^>]+>/)?.[0]||"",/capture="environment"/);
  assert.match(html,/写真へのコメント/);assert.match(html,/選ぶだけでは保存・掲載されません/);
  assert.match(renderObservationEventDiscoveryCampaign(),/参加を申し込む/);assert.match(renderObservationEventDiscoveryCampaign(),/申し込みに参加コードは必要ありません/);
  assert.match(renderObservationEventDiscoveryOrganizer({sessionId:"event-fixture"}),/紙のシートを開く/);
});

test("LP bootstraps a real listed occurrence then stores a blank optional signup without day-of checkin",async()=>{
  const event=listedOccurrence();
  const app=setup("campaign",{fetch:async call=>call.url.includes("campaigns/ryuyo")?{events:[event],selectedEvent:null}:call.url.includes("/discoveries")?journalsFor(event.sessionId,"小さな発見"):call.method==="POST"?{confirmed:false,created:true,participant:{status:"registered"}}:{event,confirmed:false,participant:null}});
  await flush();assert.equal(app.node("[data-discovery-application-form]").hidden,false);assert.equal(app.node("[data-discovery-photo-link]").hidden,true);
  await app.node("[data-discovery-application-form]").dispatch("submit");
  const post=app.calls.find(call=>call.method==="POST")!;assert.equal(post.url,base+"/application");assert.deepEqual(post.body,{display_name:""});assert.equal(post.options.credentials,"same-origin");
  assert.equal(app.calls.some(call=>call.url.endsWith("/checkin")),false);assert.equal(app.node("[data-discovery-application-form]").hidden,true);assert.match(app.node("[data-discovery-application-status]").textContent,/申し込みを受け付けています/);
  assert.match(app.node("[data-discovery-journals]").textContent,/小さな発見/);
});

test("LP no-dates state is distinct from a failed listing and makes no application request",async()=>{
  const empty=setup("campaign",{fetch:async()=>({events:[],selectedEvent:null})});await flush();
  assert.equal(empty.calls.length,1);assert.equal(empty.node("[data-discovery-application-form]").hidden,true);assert.match(empty.node("[data-discovery-occurrence-summary]").textContent,/次の開催日/);
  const failed=setup("campaign",{fetch:async()=>new Error("Failed to fetch")});await flush();assert.match(failed.node("[data-discovery-status]").textContent,/通信できませんでした/);assert.match(failed.node("[data-discovery-occurrence-summary]").textContent,/読み込みを完了できませんでした/);
});

test("an explicit occurrence link loads that real occurrence even when absent from the public dates",async()=>{
  const event=listedOccurrence("private-event");const app=setup("campaign",{href:"https://fixture.test/events/ryuyo?event=PRIVATE",fetch:async call=>call.url.includes("campaigns/ryuyo")?{events:[],selectedEvent:event}:call.url.includes("/discoveries")?journalsFor(event.sessionId,"案内された回"):{event,confirmed:false,participant:null}});await flush();
  assert.equal(app.calls[0]!.url,"/api/v1/observation-events/campaigns/ryuyo?event=PRIVATE");assert.equal(app.node("[data-discovery-occurrence-select]").value,"private-event");assert.match(app.node("[data-discovery-journals]").textContent,/案内された回/);
});

test("late application and gallery responses for A cannot replace selected closed event B",async()=>{
  const a=listedOccurrence("event-a"),b=listedOccurrence("event-b",{canApply:false,canCheckIn:false,canSubmit:false});let resolveApplication!:(value:Data)=>void,resolveGallery!:(value:Data)=>void;
  const app=setup("campaign",{fetch:async call=>{
    if(call.url.includes("campaigns/ryuyo"))return {events:[a,b],selectedEvent:null};
    if(call.url.includes("event-a/application"))return new Promise(resolve=>{resolveApplication=resolve;});
    if(call.url.includes("event-a/discoveries"))return new Promise(resolve=>{resolveGallery=resolve;});
    return call.url.includes("/discoveries")?journalsFor("event-b","Bの発見"):{event:b,confirmed:false,participant:{status:"registered",displayName:"Bの呼び名"}};
  }});await flush();const select=app.node("[data-discovery-occurrence-select]");select.value="event-a";await select.dispatch("change");await flush();select.value="event-b";await select.dispatch("change");await flush();
  resolveApplication({event:a,confirmed:false,participant:null});resolveGallery(journalsFor("event-a","Aの遅れた発見"));await flush();
  assert.equal(select.value,"event-b");assert.equal(app.node("[data-discovery-application-form]").hidden,true);assert.match(app.node("[data-discovery-application-status]").textContent,/申し込みを受け付けています/);assert.match(app.node("[data-discovery-journals]").textContent,/Bの発見/);assert.doesNotMatch(app.node("[data-discovery-journals]").textContent,/Aの遅れた/);
  await app.node("[data-discovery-application-form]").dispatch("submit");assert.equal(app.calls.some(call=>call.method==="POST"),false);
});

test("camera selection validates with an empty album and cancel preserves the chosen photo",async()=>{
  const app=setup("capture",{fetch:async call=>call.method==="POST"?{receipt:receipt(1)}:{receipts:[]}});await flush();const form=app.node("[data-discovery-media-form]");const album=formField(form,"media"),camera=formField(form,"camera_media");
  formField(form,"private_storage_consent").checked=true;formField(form,"creator_rights_attestation").checked=true;formField(form,"caption").value="カメラからのコメント";
  camera.files=[mediaFile];await camera.dispatch("change");assert.equal(album.files.length,0);assert.equal(album.required,false);assert.equal(form.reportValidity(),true);assert.match(app.node("[data-discovery-photo-preview]").textContent,/この写真を保存/);
  camera.files=[];await camera.dispatch("change");await form.dispatch("submit");const post=app.calls.find(call=>call.method==="POST")!;assert.equal(post.body.get("media"),mediaFile);assert.equal(post.body.get("caption"),"カメラからのコメント");
});

test("album selection replaces camera selection through the same single-photo upload",async()=>{
  const app=setup("capture",{fetch:async call=>call.method==="POST"?{receipt:receipt(1)}:{receipts:[]}});await flush();const form=app.node("[data-discovery-media-form]");const album=formField(form,"media"),camera=formField(form,"camera_media");preparePhoto(form);
  camera.files=[{...mediaFile,name:"camera.webp"}];await camera.dispatch("change");album.files=[mediaFile];await album.dispatch("change");assert.equal(camera.files.length,0);await form.dispatch("submit");const posts=app.calls.filter(call=>call.method==="POST");assert.equal(posts.length,1);assert.equal(posts[0]!.body.get("media"),mediaFile);
});

test("organizer settings withdraw a stale unauthorized listing and show private signup counts",async()=>{
  let campaign={listed:true,applicationsOpen:false};const settings=()=>({campaign,canManageListing:false,canManageApplications:true,campaignHref:"/events/ryuyo?event=RYUYO1",participantCounts:{registered:7,checkedIn:3}});
  const app=setup("organizer",{fetch:async call=>{if(!call.url.endsWith("/discovery-campaign"))return{receipts:[],nextCursor:null};if(call.method==="PATCH")campaign=call.body;return settings();}});await flush();
  const form=app.node("[data-discovery-campaign-settings]");assert.equal(formField(form,"listed").disabled,true);assert.match(app.node("[data-discovery-participant-counts]").textContent,/申し込み受付 7人.*当日参加 3人/);formField(form,"applications_open").checked=true;formField(form,"listed").checked=false;await form.dispatch("submit");
  const patch=app.calls.find(call=>call.method==="PATCH")!;assert.deepEqual(patch.body,{listed:false,applicationsOpen:true});assert.match(app.node("[data-discovery-settings-status]").textContent,/保存しました/);
});

test("a pending campaign reload cannot submit its previous occurrence and preserves that occurrence draft",async()=>{
  const a=listedOccurrence("event-a"),b=listedOccurrence("event-b");let listingCalls=0,resolveReload!:(value:Data)=>void;
  const app=setup("campaign",{fetch:async call=>{
    if(call.url.includes("campaigns/ryuyo")){listingCalls++;return listingCalls===1?{events:[a],selectedEvent:null}:new Promise(resolve=>{resolveReload=resolve;});}
    const event=call.url.includes("event-b")?b:a;return call.url.includes("/discoveries")?journalsFor(event.sessionId,"発見"):{event,confirmed:false,participant:null};
  }});await flush();const form=app.node("[data-discovery-application-form]");formField(form,"display_name").value="あお";assert.equal(form.hidden,false);
  await app.node("[data-discovery-campaign-refresh]").dispatch("click");await flush();await form.dispatch("submit");
  assert.equal(form.hidden,true);assert.equal(form.querySelector('button[type=submit]')!.disabled,true);assert.equal(app.calls.some(call=>call.method==="POST"),false);assert.equal(JSON.parse(app.storage.get("zukan:event-discovery:application:event-a")!).name,"あお");
  resolveReload({events:[b],selectedEvent:null});await flush();assert.equal(app.node("[data-discovery-occurrence-select]").value,"event-b");assert.equal(formField(form,"display_name").value,"");assert.equal(form.hidden,false);
});


test("public tentative LP has no occurrence picker or failing intake when production has no event", async () => {
  const app=setup("campaign",{preview:true,href:"https://zukan.earth/events/ryuyo",fetch:async()=>({selectedEvent:null,events:[]})});await flush();
  assert.equal(app.root.dataset.discoveryPreview,"true");
  assert.equal(app.node("[data-discovery-photo-link]").hidden,true);
  assert.equal(app.node("[data-discovery-day-state]").textContent,"当日の写真投稿は、会場でご案内します。");
  assert.equal(app.node("[data-discovery-gallery-status]").textContent,"");
  assert.deepEqual(app.calls.map(c=>[c.method,c.url]),[["GET","/api/v1/observation-events/campaigns/ryuyo"]]);
  assert.equal(app.root.walk().includes(app.node("[data-discovery-occurrence-select]")),false);
});
