import {
  COMMON_EVENT_TEMPLATE_CONTRACT_VERSION,
  type CommonEventTemplateKey,
} from "../../src/services/commonEventTemplateContract";
import {
  COMMON_EVENT_TEMPLATE_PRESETS,
  type CommonEventTemplateActivity as EventActivity,
  type CommonEventTemplatePreset as EventPreset,
} from "../../src/services/commonEventTemplatePresets";

export const EVENT_TEMPLATE_PREVIEW_ROUTES = Object.freeze({
  stampRally: "/preview/events/stamp-rally",
  missionQuest: "/preview/events/mission-quest",
  collaborativeObservation: "/preview/events/collaborative-observation",
  ryuyo: "/preview/events/ryuyo-insect-observation-park",
});

const RYUYO_FIELD_ID = "372eafbd-ea9c-4b2f-ab5f-434b81b928b2";
const DEMO_TOKEN_PATTERN = /^[a-f0-9]{32}$/u;
const PRESETS = COMMON_EVENT_TEMPLATE_PRESETS;
const ROUTES = Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES);
const PRESET_BY_ROUTE: Readonly<Record<string, EventPreset>> = Object.fromEntries(
  ROUTES.map((route, index) => [route, PRESETS[index]!]),
);

function escapeHtml(value: string): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/gu, (character) => entities[character] ?? character);
}
function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (value) => value.toString(16).padStart(2, "0")).join("");
}
function demoHref(route: string, token: string): string {
  return route + "?demo=" + token;
}
function createFromTemplateLink(key: CommonEventTemplateKey): string {
  const query = "event_template=" + encodeURIComponent(key) + (key === "ryuyo" ? "&field_id=" + RYUYO_FIELD_ID : "");
  return "<a class=\"secondary-link\" href=\"/community/events/new?" + escapeHtml(query) + "\">このテンプレートで開催準備を始める</a>";
}
function relatedSection(activeRoute: string, token?: string): string {
  return "<section class=\"related\" aria-labelledby=\"related-heading\"><h2 id=\"related-heading\">ほかの体験も見る</h2><ul>" +
    ROUTES.map((route, index) => "<li><a href=\"" + escapeHtml(token ? demoHref(route, token) : route) + "\"" +
      (route === activeRoute ? " aria-current=\"page\"" : "") + ">" + escapeHtml(PRESETS[index]!.title) + "</a></li>").join("") +
    "</ul></section>";
}
function ryuyoFacts(): string {
  const fields = [
    ["開催日・時間", "未登録"],
    ["主催者・開催承認", "未確認"],
    ["費用・定員", "未確認"],
    ["集合場所・アクセス", "イベントの案内は未登録"],
    ["参加条件・持ち物", "主催者への確認が必要です"],
    ["申込み", "受付なし"],
  ];
  return "<section class=\"event-facts\" aria-labelledby=\"facts-heading\"><h2 id=\"facts-heading\" tabindex=\"-1\">開催情報</h2>" +
    "<p>想定する場所：<a href=\"/ja/community/fields/" + RYUYO_FIELD_ID + "\">竜洋昆虫自然観察公園のエリア図鑑</a></p>" +
    "<dl class=\"facts\">" + fields.map(([label, value]) => "<div class=\"fact\"><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("") +
    "</dl><p class=\"muted\">公園の公式告知や、開催決定を示すものではありません。日時・条件・費用・定員・主催者の確認がそろうまで、このページで申込みは受け付けません。</p></section>";
}
function hero(preset: EventPreset, interactive: boolean): string {
  const title = preset.key === "ryuyo" ?
    "<span class=\"title-place\">竜洋昆虫自然観察公園での</span><span class=\"title-event\">自然観察イベント</span>" :
    escapeHtml(preset.title);
  return "<div class=\"hero\"><p class=\"kicker\">" + (preset.key === "ryuyo" ? "竜洋の開催提案" : "共通イベントテンプレート") +
    " · " + (interactive ? "体験版" : "プレビュー") + "</p><h1>" + title + "</h1>" +
    "<p class=\"lead\">" + escapeHtml(preset.description) + "</p></div>";
}
function faq(): string {
  return "<section class=\"faq\" aria-labelledby=\"faq-heading\"><h2 id=\"faq-heading\">参加方法と写真について</h2>" +
    "<details><summary>写真やアカウントは必要ですか？</summary><p>この体験版はログインせず、写真なしで最後まで試せます。「紙で試す」に切り替えると、紙に印をつけながら進められます。実際のイベントの参加条件は、主催者の案内で確認してください。</p></details>" +
    "<details><summary>選んだ写真や動画はどこに保存されますか？</summary><p>体験版では、この画面で表示するだけです。サーバーへ送信せず、ブラウザの進捗保存にも含めません。再読み込みすると写真・動画の選択は解除されます。</p><p>実際のイベントでの保存・確認・公開は別の手続きです。この体験だけでは、投稿の受付や写真・動画の公開にはなりません。</p></details>" +
    "<details><summary>屋外で試すときは？</summary><p>立ち止まって画面を操作し、現地の案内に従ってください。生きものに無理に近づく必要はありません。人物や位置など、公開したくない情報を撮らずに進めることもできます。</p></details></section>";
}
function renderDesignPreview(route: string, preset: EventPreset, token: string): string {
  return "<main id=\"main\" class=\"page\" data-event-template-contract=\"" + COMMON_EVENT_TEMPLATE_CONTRACT_VERSION +
    "\" data-template-key=\"" + preset.key + "\">" + hero(preset, false) +
    "<aside class=\"notice\"><strong>申込み・投稿をしない体験用ページです</strong><p>開催情報は未登録です。体験版では自分の進み具合を試せます。実際の参加実績や参加者の投稿は表示しません。</p></aside>" +
    "<p class=\"primary-row\"><a class=\"action\" href=\"" + demoHref(route, token) + "\">体験版を開く</a><span class=\"muted\">ログイン不要 · 写真は任意</span></p>" +
    (preset.key === "ryuyo" ? ryuyoFacts() : "") +
    "<section aria-labelledby=\"flow-heading\"><h2 id=\"flow-heading\">こんな流れを試せます</h2><ol class=\"steps\">" +
    preset.activities.flatMap((activity) => preset.key === "ryuyo" ? [activity.title] : activity.steps.map((step) => step.title))
      .map((step) => "<li>" + escapeHtml(step) + "</li>").join("") +
    "</ol></section>" + faq() + relatedSection(route) +
    "<section class=\"organizer\"><h2>企画を準備する方へ</h2><p>確定した日時・参加条件などを、既存のイベント設定に入力して準備を進めます。</p>" + createFromTemplateLink(preset.key) + "</section></main>";
}
function renderActivity(activity: EventActivity, includeIntroduction = true): string {
  const isStamp = activity.kind === "stamp";
  const heading = includeIntroduction ? activity.title : isStamp ? "観察ポイントを回る" : activity.kind === "mission" ? "ミッションを進める" : "共通テーマに記録する";
  return "<section id=\"demo-activity-" + activity.key + "\" class=\"demo-activity\" aria-labelledby=\"demo-heading-" + activity.key + "\">" +
    "<div class=\"activity-heading\"><div><h2 id=\"demo-heading-" + activity.key + "\" tabindex=\"-1\">" + heading + "</h2>" +
    (includeIntroduction ? "<p>" + activity.description + "</p>" : "") + "</div>" +
    "<p id=\"demo-progress-" + activity.key + "\" class=\"progress-label\">0 / " + activity.steps.length + (isStamp ? " スタンプ" : " テーマ") + "</p></div>" +
    "<progress id=\"demo-meter-" + activity.key + "\" max=\"" + activity.steps.length + "\" value=\"0\" aria-label=\"" + activity.title + "の体験の進み具合\"></progress>" +
    "<p class=\"muted\">" + (isStamp ? "この体験は自己チェックです。実際の来場確認や特典の引換にはなりません。" :
      activity.kind === "mission" ? "順番に進みます。ここでの条件確認は体験用で、主催者による確認ではありません。" :
        "目標は3つの見方を集めること。数字と結果はこのブラウザの体験分だけです。実際のみんなの投稿数ではありません。") + "</p>" +
    "<ol class=\"activity-steps\">" + activity.steps.map((step, index) => {
      const choices = step.choices ? "<label class=\"choice-label\" for=\"demo-choice-" + step.id + "\">" + step.title + "の選択</label><select id=\"demo-choice-" + step.id +
        "\" aria-describedby=\"demo-prompt-" + step.id + " demo-error-" + step.id + "\"><option value=\"\">選んでください</option>" +
        step.choices.map((choice) => "<option value=\"" + choice.value + "\">" + escapeHtml(choice.label) + "</option>").join("") + "</select>" : "";
      const actionAttrs = " data-demo-step=\"" + step.id + "\" data-demo-activity=\"" + activity.key + "\"";
      return "<li id=\"demo-card-" + step.id + "\" class=\"activity-step\"><div class=\"step-title\"><span class=\"step-number\" aria-hidden=\"true\">" + String(index + 1).padStart(2, "0") +
        "</span><h3>" + escapeHtml(step.title) + "</h3></div><p id=\"demo-prompt-" + step.id + "\">" + escapeHtml(step.prompt) + "</p>" +
        "<p id=\"demo-state-" + step.id + "\" class=\"step-state\">まだチェックしていません</p>" + choices +
        "<p id=\"demo-error-" + step.id + "\" class=\"input-error\" role=\"alert\"></p><div class=\"step-actions\">" +
        "<button type=\"button\" class=\"action\" id=\"demo-save-" + step.id + "\" data-demo-action=\"save\"" + actionAttrs + " aria-label=\"" +
        escapeHtml(step.title) + "：" + (isStamp ? "チェックインを試す" : "体験用に記録する") + "\">" + (isStamp ? "チェックインを試す" : "体験用に記録する") + "</button>" +
        (!isStamp ? "<button type=\"button\" class=\"action\" id=\"demo-check-" + step.id + "\" data-demo-action=\"check\"" + actionAttrs +
          " aria-label=\"" + escapeHtml(step.title) + "：" + (activity.kind === "mission" ? "条件を確認する" : "集計する内容を確認する") + "\" hidden>" +
          (activity.kind === "mission" ? "条件を確認する（体験）" : "集計する内容を確認（体験）") + "</button>" : "") +
        (activity.kind === "together" ? "<button type=\"button\" class=\"action\" id=\"demo-include-" + step.id + "\" data-demo-action=\"include\"" + actionAttrs +
          " aria-label=\"" + escapeHtml(step.title) + "：この画面の集計へ反映する\" hidden>この画面の集計へ反映</button>" : "") +
        "</div></li>";
    }).join("") + "</ol><div id=\"demo-complete-" + activity.key + "\" class=\"completion\" hidden><h3>体験の区切りまで進みました</h3>" +
    "<p>進めたことを下の振り返りで確かめられます。実際のイベントへは申し込んでいません。</p><a href=\"#demo-recap\" data-demo-action=\"recap\">振り返りを見る</a></div></section>";
}
function renderDemoTools(): string {
  return "<section id=\"demo-tools\" class=\"demo-tools\" aria-labelledby=\"demo-tools-heading\"><h2 id=\"demo-tools-heading\">写真なし・紙でも進められます</h2>" +
    "<label class=\"choice-label\" for=\"demo-mode\">写真なしでも、最後まで進められます</label><select id=\"demo-mode\"><option value=\"screen\">画面で試す</option><option value=\"paper\">紙で試す</option></select>" +
    "<p id=\"demo-paper-notice\" class=\"muted\" hidden>紙に印をつけたら、画面でも同じ項目をチェックできます。紙の印が自動で送信されることはありません。</p>" +
    "<details class=\"optional-media\" id=\"demo-media-panel\"><summary>写真・動画を画面で試す（任意）</summary>" +
    "<p id=\"demo-media-help\">サーバーには送信しません。写真・動画はこの画面を閉じると消え、再読み込み後には残りません。人物や個人情報を含まない、体験用の素材を選んでください。</p>" +
    "<label class=\"choice-label\" for=\"demo-media\">写真・短い動画を選ぶ（任意・12 MiBまで）</label>" +
    "<input id=\"demo-media\" type=\"file\" accept=\"image/jpeg,image/png,image/webp,video/mp4,video/webm\" capture=\"environment\" aria-describedby=\"demo-media-help demo-media-status\">" +
    "<p id=\"demo-media-status\" role=\"status\">選ばずに進められます。撮影できないときも、下の体験を続けられます。</p>" +
    "<div id=\"demo-media-preview\" class=\"media-preview\"></div><button type=\"button\" class=\"secondary\" id=\"demo-media-clear\" data-demo-action=\"media-clear\" hidden>選択を解除する</button></details>" +
    "<details class=\"paper\"><summary>紙の体験シートを使う</summary><p>印刷画面では体験用のチェック欄だけを表示します。実際の参加証や申込み用紙ではありません。</p>" +
    "<button type=\"button\" class=\"secondary\" id=\"demo-print\" data-demo-action=\"print\">体験シートの印刷画面を開く</button></details></section>";
}
function renderRecap(preset: EventPreset): string {
  return "<section id=\"demo-recap\" class=\"recap\" aria-labelledby=\"recap-heading\"><h2 id=\"recap-heading\" tabindex=\"-1\">自分の体験を振り返る</h2>" +
    "<p>このブラウザで進めた体験です。実際の来場・投稿・公開を示すものではありません。</p><dl class=\"recap-list\">" +
    preset.activities.map((activity) => "<div><dt>" + activity.title + "</dt><dd id=\"demo-recap-" + activity.key + "\">まだ進めていません</dd></div>").join("") + "</dl>" +
    (preset.activities.some((activity) => activity.kind === "together") ?
      "<h3>この端末の集計プレビュー</h3><p id=\"demo-gallery-empty\">集計に反映した体験記録はまだありません。</p><ul id=\"demo-gallery\" class=\"finding-list\"></ul>" +
      "<p class=\"muted\">選択した言葉だけを表示します。写真・動画は集計や公開ギャラリーに含めません。</p>" : "") +
    "<div class=\"reset-area\"><button type=\"button\" class=\"secondary\" id=\"demo-reset\" data-demo-action=\"reset-request\">この体験を最初から試す</button>" +
    "<div id=\"demo-reset-confirm\" class=\"notice\" hidden><p>このブラウザ・このテンプレートの進み具合と、画面の写真・動画を消します。ほかの閲覧者やテンプレートには影響しません。</p>" +
    "<div class=\"step-actions\"><button type=\"button\" class=\"secondary\" id=\"demo-reset-cancel\" data-demo-action=\"reset-cancel\">続きに戻る</button>" +
    "<button type=\"button\" class=\"secondary\" id=\"demo-reset-confirm-button\" data-demo-action=\"reset-confirm\">この体験だけリセットする</button></div></div></div></section>";
}
function renderPaperSheet(preset: EventPreset): string {
  return "<section class=\"paper-sheet\"><h2>" + escapeHtml(preset.title) + " · 体験シート</h2><p>体験用です。実際の参加証・申込み用紙ではありません。名前や連絡先を書く必要はありません。</p>" +
    preset.activities.map((activity) => "<h3>" + activity.title + "</h3><ol>" + activity.steps.map((step) => "<li><span aria-hidden=\"true\">□</span> " +
      escapeHtml(step.title) + "<p>" + escapeHtml(step.prompt) + "</p><p>気づいたこと：________________________________</p></li>").join("") + "</ol>").join("") + "</section>";
}
function renderInteractivePage(route: string, preset: EventPreset, token: string, origin: string): string {
  const isRyuyo = preset.key === "ryuyo";
  const activities = preset.activities.map((activity) => ({
    key: activity.key, title: activity.title, kind: activity.kind, description: activity.description,
    steps: activity.steps.map((step) => ({
      id: step.id, title: step.title, prompt: step.prompt,
      ...(step.choices ? { choices: step.choices } : {}),
      ...(step.answer ? { answer: step.answer } : {}),
      ...(step.hint ? { hint: step.hint } : {}),
    })),
  }));
  const config = JSON.stringify({ version: 1, token, key: preset.key, activities }).replace(/</gu, "\\u003c");
  const phaseButtons = isRyuyo ? "<div class=\"phase-controls\" role=\"group\" aria-label=\"イベントの時期ごとの画面を試す\">" +
    ["開催前の案内", "当日の体験", "振り返り"].map((label, index) => "<button type=\"button\" class=\"secondary\" id=\"demo-phase-" +
      ["before", "day", "after"][index] + "\" data-demo-action=\"phase\" data-demo-phase=\"" + ["before", "day", "after"][index] +
      "\" aria-pressed=\"" + (index === 0 ? "true" : "false") + "\">" + label + "</button>").join("") + "</div><p class=\"muted\">時期による見え方を切り替える体験です。実際の開催状況は変わりません。</p>" : "";
  const activityButtons = preset.activities.length > 1 ? "<div class=\"activity-controls\" role=\"group\" aria-label=\"試す体験を選ぶ\">" +
    preset.activities.map((activity, index) => "<button type=\"button\" class=\"secondary\" id=\"demo-select-" + activity.key +
      "\" data-demo-action=\"activity\" data-demo-activity=\"" + activity.key + "\" aria-pressed=\"" + (index === 0 ? "true" : "false") + "\">" + activity.title + "</button>").join("") + "</div>" : "";
  return "<main id=\"main\" class=\"page\" data-event-template-contract=\"" + COMMON_EVENT_TEMPLATE_CONTRACT_VERSION + "\" data-template-key=\"" + preset.key +
    "\" data-event-demo=\"local-only\">" + hero(preset, true) +
    "<aside class=\"notice\"><strong>このブラウザだけで試す体験版</strong><p>申込みや送信は行いません。進み具合はこのブラウザだけで扱います。写真なし・紙でも進められます。</p></aside>" +
    (!isRyuyo ? "<p class=\"primary-row\"><a class=\"action\" id=\"demo-go\" href=\"#demo-heading-" + preset.activities[0]!.key + "\">体験を始める</a></p>" : "") +
    "<p id=\"demo-storage\" class=\"storage-notice\" role=\"status\">ブラウザの保存状態を確認しています。</p><p id=\"demo-status\" class=\"live-status\" role=\"status\" aria-live=\"polite\" aria-atomic=\"true\"></p>" +
    "<noscript><p class=\"notice\">画面での進捗保存にはJavaScriptが必要です。体験の内容を読むか、ブラウザの印刷機能で紙にして試せます。</p></noscript>" +
    (isRyuyo ? "<p class=\"primary-row\"><button type=\"button\" class=\"action\" id=\"demo-start\" data-demo-action=\"phase\" data-demo-phase=\"day\">当日の流れを体験する</button></p>" : "") +
    phaseButtons + (isRyuyo ? "<div id=\"demo-before\">" + ryuyoFacts() + "</div>" : "") +
    "<div id=\"demo-day\"><p><a href=\"#demo-tools\">写真・動画や紙で試す方法を見る</a></p>" + activityButtons +
    preset.activities.map((activity) => renderActivity(activity, isRyuyo)).join("") + renderDemoTools() + "</div>" +
    renderRecap(preset) + faq() +
    "<section class=\"share-demo\" aria-labelledby=\"share-heading\"><h2 id=\"share-heading\">この体験版のリンク</h2><p>このURLから同じ企画を試せます。進み具合や選んだ写真・動画は、相手には渡りません。</p>" +
    "<label class=\"choice-label\" for=\"demo-link\">体験用URL</label><input id=\"demo-link\" type=\"text\" readonly value=\"" +
    escapeHtml(origin + demoHref(route, token)) + "\"><button type=\"button\" class=\"secondary\" id=\"demo-copy\" data-demo-action=\"copy\">URLをコピー</button></section>" +
    relatedSection(route, token) + "<section class=\"organizer\"><h2>企画を準備する方へ</h2>" + createFromTemplateLink(preset.key) + "</section>" +
    renderPaperSheet(preset) + "<script id=\"event-demo-config\" type=\"application/json\">" + config + "</script></main>";
}

// Presentation-only state: no participant credential, event write, media upload or publication.
const EVENT_TEMPLATE_DEMO_SCRIPT = String.raw`(function () {
  "use strict";
  var configNode = document.getElementById("event-demo-config");
  if (!configNode) return;
  var config = JSON.parse(configNode.textContent);
  var storageKey = "zukan:event-template-demo:v1:" + config.token + ":" + config.key;
  var byId = function (id) { return document.getElementById(id); };
  var allSteps = config.activities.flatMap(function (activity) { return activity.steps; });
  var canPersist = true;
  var storageProblem = "";
  var mediaUrl = null;
  var mediaPreview = null;
  function freshState() {
    return { version: 1, mode: "screen", active: config.activities[0].key, phase: config.key === "ryuyo" ? "before" : "day", steps: {} };
  }
  function decode(raw) {
    var clean = freshState();
    if (raw === null) return clean;
    if (typeof raw !== "string" || raw.length > 8192) throw new Error("invalid state");
    var saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object" || Array.isArray(saved) || saved.version !== 1 ||
        !saved.steps || typeof saved.steps !== "object" || Array.isArray(saved.steps)) throw new Error("invalid state");
    clean.mode = saved.mode === "paper" ? "paper" : "screen";
    clean.active = config.activities.some(function (activity) { return activity.key === saved.active; }) ? saved.active : clean.active;
    clean.phase = config.key === "ryuyo" && ["before", "day", "after"].includes(saved.phase) ? saved.phase : clean.phase;
    config.activities.forEach(function (activity) {
      var unlocked = true;
      activity.steps.forEach(function (step) {
        var entry = saved.steps[step.id];
        if (!entry || typeof entry !== "object" || Array.isArray(entry) || (activity.kind === "mission" && !unlocked)) {
          if (activity.kind === "mission") unlocked = false;
          return;
        }
        var stage = entry.stage;
        var choice = activity.kind === "stamp" ? null :
          (step.choices.some(function (item) { return item.value === entry.choice; }) ? entry.choice : null);
        var allowed = activity.kind === "stamp" ? ["checked"] : activity.kind === "mission" ? ["saved", "checked"] : ["saved", "checked", "included"];
        if (!allowed.includes(stage) || (activity.kind !== "stamp" && choice === null)) {
          if (activity.kind === "mission") unlocked = false;
          return;
        }
        if (activity.kind === "mission" && step.answer && choice !== step.answer) stage = "saved";
        clean.steps[step.id] = { stage: stage, choice: choice };
        if (activity.kind === "mission" && stage !== "checked") unlocked = false;
      });
    });
    return clean;
  }
  var state;
  try { state = decode(window.localStorage.getItem(storageKey)); }
  catch (error) {
    state = freshState();
    try {
      window.localStorage.getItem(storageKey);
      storageProblem = "保存された体験の進み具合を読み込めませんでした。最初から試すか、紙で進められます。";
    } catch (_) {
      canPersist = false;
      storageProblem = "このブラウザでは保存できません。この画面では試せますが、再読み込みで進み具合が消えます。紙でも進められます。";
    }
  }
  function save() {
    try {
      var raw = JSON.stringify(state);
      window.localStorage.setItem(storageKey, raw);
      if (window.localStorage.getItem(storageKey) !== raw) throw new Error("save unavailable");
      canPersist = true;
      storageProblem = "";
    } catch (_) {
      canPersist = false;
      storageProblem = "進み具合を保存できませんでした。この画面では続けられますが、再読み込み後には残りません。紙でも進められます。";
    }
  }
  function scope() { return canPersist ? "この端末" : "この画面"; }
  function message(text) { byId("demo-status").textContent = text; }
  function isUnlocked(activity, step) {
    if (activity.kind !== "mission") return true;
    var index = activity.steps.findIndex(function (item) { return item.id === step.id; });
    return activity.steps.slice(0, index).every(function (item) { return state.steps[item.id] && state.steps[item.id].stage === "checked"; });
  }
  function progress(activity) {
    return activity.steps.filter(function (step) {
      var entry = state.steps[step.id];
      return entry && entry.stage === (activity.kind === "together" ? "included" : "checked");
    }).length;
  }
  function render() {
    byId("demo-storage").textContent = storageProblem || "進み具合はこのブラウザに保存します。同じURLで続きから試せます。写真・動画は保存しません。";
    byId("demo-mode").value = state.mode;
    byId("demo-paper-notice").hidden = state.mode !== "paper";
    byId("demo-media-panel").hidden = state.mode === "paper";
    if (config.key === "ryuyo") {
      byId("demo-before").hidden = state.phase !== "before";
      byId("demo-day").hidden = state.phase !== "day";
      ["before", "day", "after"].forEach(function (phase) { byId("demo-phase-" + phase).setAttribute("aria-pressed", String(state.phase === phase)); });
      byId("demo-recap").hidden = state.phase !== "after";
      byId("demo-start").setAttribute("data-demo-phase", state.phase === "after" ? "after" : "day");
      byId("demo-start").textContent = state.phase === "after" ? "自分の振り返りを見る" :
        Object.keys(state.steps).length > 0 ? "体験の続きを開く" : "当日の流れを体験する";
    }
    var entryLink = byId("demo-go");
    if (entryLink) entryLink.textContent = Object.keys(state.steps).length > 0 ? "体験の続きを開く" : "体験を始める";
    config.activities.forEach(function (activity) {
      var count = progress(activity);
      var savedCount = activity.steps.filter(function (step) { return !!state.steps[step.id]; }).length;
      byId("demo-activity-" + activity.key).hidden = state.active !== activity.key;
      var activityButton = byId("demo-select-" + activity.key);
      if (activityButton) activityButton.setAttribute("aria-pressed", String(state.active === activity.key));
      byId("demo-progress-" + activity.key).textContent = count + " / " + activity.steps.length +
        (activity.kind === "stamp" ? " スタンプ" : activity.kind === "mission" ? " 条件確認" : " 集計プレビュー");
      byId("demo-meter-" + activity.key).value = count;
      byId("demo-complete-" + activity.key).hidden = count !== activity.steps.length;
      byId("demo-recap-" + activity.key).textContent = activity.kind === "together" ?
        scope() + "に記録 " + savedCount + " 件 / 集計プレビュー " + count + " 件" :
        count + " / " + activity.steps.length + (activity.kind === "stamp" ? " スタンプ（" : " 条件確認（") + scope() + "）";
      activity.steps.forEach(function (step) {
        var entry = state.steps[step.id];
        var stage = entry ? entry.stage : "";
        var unlocked = isUnlocked(activity, step);
        byId("demo-card-" + step.id).setAttribute("data-stage", stage);
        byId("demo-state-" + step.id).textContent = !unlocked ? "前のミッションの条件確認から進めてください。" :
          stage === "included" ? "この画面の集計に反映（体験）" :
          stage === "checked" ? (activity.kind === "stamp" ? "チェック済み（" + scope() + "）" :
            activity.kind === "mission" ? "条件確認済み（体験）" : "内容確認済み・まだ集計に反映していません") :
          stage === "saved" ? scope() + "に記録・確認はこれから" : "まだ" + (activity.kind === "stamp" ? "チェック" : "記録") + "していません";
        var select = byId("demo-choice-" + step.id);
        if (select) {
          if (entry) select.value = entry.choice;
          select.disabled = !unlocked || stage === "checked" || stage === "included";
        }
        var saveButton = byId("demo-save-" + step.id);
        saveButton.disabled = !unlocked || stage === "checked" || stage === "included";
        saveButton.hidden = stage === "saved" || stage === "checked" || stage === "included";
        saveButton.textContent = activity.kind === "stamp" ? (state.mode === "paper" ? "紙に印をつけた（体験）" : "チェックインを試す") : "体験用に記録する";
        var checkButton = byId("demo-check-" + step.id);
        if (checkButton) checkButton.hidden = stage !== "saved";
        var includeButton = byId("demo-include-" + step.id);
        if (includeButton) includeButton.hidden = stage !== "checked";
      });
    });
    var gallery = byId("demo-gallery");
    if (gallery) {
      gallery.replaceChildren();
      config.activities.filter(function (activity) { return activity.kind === "together"; }).forEach(function (activity) {
        activity.steps.forEach(function (step) {
          var entry = state.steps[step.id];
          if (!entry || entry.stage !== "included") return;
          var item = document.createElement("li");
          item.textContent = step.title + "：" + step.choices.find(function (choice) { return choice.value === entry.choice; }).label + "（" + scope() + "の体験）";
          gallery.append(item);
        });
      });
      byId("demo-gallery-empty").hidden = gallery.children.length > 0;
    }
  }
  function clearMedia() {
    if (mediaPreview && mediaPreview.tagName === "VIDEO") mediaPreview.pause();
    if (mediaPreview) mediaPreview.removeAttribute("src");
    if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    mediaUrl = null;
    mediaPreview = null;
    byId("demo-media-preview").replaceChildren();
    byId("demo-media").value = "";
    byId("demo-media-clear").hidden = true;
  }
  function stepAction(button) {
    var activity = config.activities.find(function (item) { return item.key === button.getAttribute("data-demo-activity"); });
    if (!activity) return;
    var step = activity.steps.find(function (item) { return item.id === button.getAttribute("data-demo-step"); });
    if (!step || !isUnlocked(activity, step)) return;
    var action = button.getAttribute("data-demo-action");
    var entry = state.steps[step.id];
    var select = byId("demo-choice-" + step.id);
    var error = byId("demo-error-" + step.id);
    error.textContent = "";
    if (select) select.removeAttribute("aria-invalid");
    if (action === "save") {
      if (entry && (entry.stage === "checked" || entry.stage === "included")) return;
      var choice = activity.kind === "stamp" ? null : select.value;
      if (activity.kind !== "stamp" && !step.choices.some(function (item) { return item.value === choice; })) {
        error.textContent = "選択肢をひとつ選んでください。写真は不要です。";
        select.setAttribute("aria-invalid", "true");
        select.focus();
        return;
      }
      state.steps[step.id] = { stage: activity.kind === "stamp" ? "checked" : "saved", choice: choice };
    } else if (action === "check") {
      if (!entry || entry.stage !== "saved") return;
      if (step.answer && entry.choice !== step.answer) {
        error.textContent = step.hint;
        select.setAttribute("aria-invalid", "true");
        select.focus();
        return;
      }
      entry.stage = "checked";
    } else if (action === "include") {
      if (!entry || entry.stage !== "checked" || activity.kind !== "together") return;
      entry.stage = "included";
    } else return;
    save();
    render();
    message(scope() + "の体験を更新しました。サーバーには送信していません。");
    var nextButton = state.steps[step.id].stage === "saved" ? byId("demo-check-" + step.id) :
      activity.kind === "together" && state.steps[step.id].stage === "checked" ? byId("demo-include-" + step.id) : null;
    if (nextButton) nextButton.focus();
    else if (activity.kind === "mission") {
      var nextStep = activity.steps.find(function (item) { return !state.steps[item.id]; });
      if (nextStep) byId("demo-choice-" + nextStep.id).focus();
      else byId("demo-heading-" + activity.key).focus();
    } else byId("demo-heading-" + activity.key).focus();
  }
  document.querySelectorAll("[data-demo-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      var action = button.getAttribute("data-demo-action");
      if (["save", "check", "include"].includes(action)) return stepAction(button);
      if (action === "phase") {
        state.phase = button.getAttribute("data-demo-phase");
        save(); render();
        (state.phase === "day" ? byId("demo-heading-" + state.active) : state.phase === "after" ? byId("recap-heading") : byId("facts-heading")).focus();
      } else if (action === "activity") {
        state.active = button.getAttribute("data-demo-activity");
        save(); render(); byId("demo-heading-" + state.active).focus();
      } else if (action === "recap") {
        if (config.key === "ryuyo") { state.phase = "after"; save(); render(); }
        byId("recap-heading").focus();
      } else if (action === "reset-request") {
        byId("demo-reset-confirm").hidden = false; byId("demo-reset-cancel").focus();
      } else if (action === "reset-cancel") {
        byId("demo-reset-confirm").hidden = true; button = byId("demo-reset"); button.focus();
      } else if (action === "reset-confirm") {
        try {
          window.localStorage.removeItem(storageKey);
          if (window.localStorage.getItem(storageKey) !== null) throw new Error("reset unavailable");
          canPersist = true; storageProblem = "";
        }
        catch (_) { canPersist = false; storageProblem = "保存済みの進み具合を消せませんでした。この画面だけ最初に戻します。再読み込みで以前の状態が戻る場合があります。"; }
        state = freshState(); clearMedia();
        allSteps.forEach(function (step) { var select = byId("demo-choice-" + step.id); if (select) { select.value = ""; select.removeAttribute("aria-invalid"); } byId("demo-error-" + step.id).textContent = ""; });
        byId("demo-media-status").textContent = "写真・動画の選択を解除しました。選ばずに進められます。";
        byId("demo-reset-confirm").hidden = true; render(); message("この画面の、この体験だけ最初に戻しました。");
        (config.key === "ryuyo" ? byId("facts-heading") : byId("demo-reset")).focus();
      } else if (action === "media-clear") {
        clearMedia(); byId("demo-media-status").textContent = "選択を解除しました。写真なしで続けられます。"; byId("demo-media").focus();
      } else if (action === "print") window.print();
      else if (action === "copy") {
        var link = byId("demo-link");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(link.value).then(function () { message("体験用URLをコピーしました。進み具合や写真・動画は相手に渡りません。"); },
            function () { link.focus(); link.select(); message("コピーできませんでした。選択されたURLをコピーしてください。"); });
        } else { link.focus(); link.select(); message("選択されたURLをコピーしてください。"); }
      }
    });
  });
  byId("demo-mode").addEventListener("change", function () {
    state.mode = byId("demo-mode").value === "paper" ? "paper" : "screen";
    if (state.mode === "paper") {
      clearMedia();
      byId("demo-media-status").textContent = "選択を解除しました。写真なしで続けられます。";
    }
    save(); render(); message(state.mode === "paper" ? "紙で進める体験に切り替えました。印刷せず、手元の紙でも試せます。" : "画面で進める体験に戻りました。写真は任意です。");
  });
  allSteps.forEach(function (step) {
    var select = byId("demo-choice-" + step.id);
    if (!select) return;
    select.addEventListener("change", function () {
      var entry = state.steps[step.id];
      if (entry && entry.stage === "saved") {
        delete state.steps[step.id];
        save(); render();
      }
      byId("demo-error-" + step.id).textContent = "";
      select.removeAttribute("aria-invalid");
    });
  });
  byId("demo-media").addEventListener("change", function () {
    var file = byId("demo-media").files && byId("demo-media").files[0];
    if (!file) return;
    clearMedia();
    var status = byId("demo-media-status");
    if (!["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"].includes(file.type) || file.size <= 0 || file.size > 12 * 1024 * 1024) {
      status.textContent = "この素材は表示できません。12 MiB以下のJPEG・PNG・WebP写真、MP4・WebM動画を選ぶか、写真なしで続けてください。";
      return;
    }
    try {
      mediaUrl = URL.createObjectURL(file);
      var previewUrl = mediaUrl;
      mediaPreview = document.createElement(file.type.indexOf("video/") === 0 ? "video" : "img");
      mediaPreview.src = mediaUrl;
      if (mediaPreview.tagName === "VIDEO") {
        mediaPreview.controls = true; mediaPreview.playsInline = true; mediaPreview.preload = "metadata";
        mediaPreview.setAttribute("aria-label", "選んだ動画の、この画面だけのプレビュー");
      } else mediaPreview.alt = "選んだ写真の、この画面だけのプレビュー";
      mediaPreview.addEventListener("error", function () {
        if (mediaUrl !== previewUrl) return;
        clearMedia(); status.textContent = "このブラウザでは素材を表示できませんでした。別の素材を選ぶか、写真なしで続けられます。";
      });
      byId("demo-media-preview").append(mediaPreview);
      byId("demo-media-clear").hidden = false;
      status.textContent = "この画面だけで表示しています。写真・動画は保存・送信・集計しません。";
    } catch (_) {
      clearMedia(); status.textContent = "素材を表示できませんでした。写真なしで体験を続けられます。";
    }
  });
  window.addEventListener("pagehide", clearMedia);
  render();
})();`;

const PAGE_CSS = [
  ":root{color-scheme:light;--action:#143f2e;--paper:#f7f7f3;--surface:#fff;--ink:#17211b;--muted:#55615a;--line:#dde2dc;--control:#68746c;--notice:#eef2e9;--focus:#FFD43D}",
  ".title-place{display:block;font-size:clamp(1.125rem,2.2vw,1.5rem);line-height:1.6;margin-block-end:8px}.title-event{display:block}",
  "*{box-sizing:border-box}html{background:var(--paper);scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,\"Segoe UI\",sans-serif;font-size:16px;line-height:1.75}button,input,select{font:inherit}button,input,select,a{touch-action:manipulation}button{cursor:pointer}button:disabled{cursor:default}a{color:#0055ad;text-underline-offset:3px}p{margin:12px 0}h1,h2,h3{line-height:1.4;overflow-wrap:anywhere}h2{font-size:1.5rem;margin:0 0 16px}h3{font-size:1.125rem;margin:0}button,a,input,select{overflow-wrap:anywhere}[hidden]{display:none!important}",
  ".topline{border-bottom:1px solid var(--line);background:var(--surface)}.topline-inner{max-width:1120px;margin:auto;padding:14px clamp(16px,5vw,48px);display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 20px;font-weight:700}.topline small{font-size:1rem;color:var(--muted);font-weight:400}.page{max-width:1120px;margin:auto;padding:clamp(28px,5vw,60px) clamp(16px,5vw,48px) 64px}.hero{max-width:800px}.kicker{margin:0 0 12px;color:var(--action);font-weight:700}.page h1{max-width:27ch;margin:0;font-size:clamp(1.875rem,4vw,3rem);line-height:1.4;letter-spacing:-.025em}.lead{max-width:44em;margin:18px 0 28px;font-size:1.125rem}.page section{margin-top:40px}.muted{color:var(--muted)}.notice{max-width:820px;padding:16px 20px;border-inline-start:4px solid var(--action);background:var(--notice)}.notice p{margin:6px 0 0}.primary-row{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:24px}",
  ".action,.secondary,.secondary-link{min-height:44px;min-width:44px;display:inline-flex;justify-content:center;align-items:center;padding:10px 18px;border:1px solid var(--action);border-radius:8px;font-weight:700;text-align:center;text-decoration:none;line-height:1.5}.action{background:var(--action);color:#fff}.action:hover{background:#0f3023}.secondary,.secondary-link{background:var(--surface);color:var(--action)}.secondary:hover,.secondary-link:hover{background:var(--notice)}button:disabled{background:#e8ece7;color:#55615a;border-color:#68746c}:is(a,button,input,select,summary):focus-visible{outline:2px solid #000;outline-offset:2px;box-shadow:0 0 0 4px var(--focus)}:is(h2,h3):focus{outline:2px solid #000;outline-offset:4px}select,input[type=text]{display:block;width:100%;max-width:38em;min-height:48px;padding:10px 12px;border:1px solid var(--control);border-radius:6px;background:var(--surface);color:var(--ink)}input[type=file]{display:block;max-width:100%;min-height:48px;margin-top:8px}input::file-selector-button{min-height:44px;padding:8px 12px;margin-inline-end:10px;border:1px solid var(--control);border-radius:6px;background:var(--surface);font:inherit}.choice-label{display:block;font-weight:700;margin:12px 0 8px}.input-error{color:#b42318;min-height:0}.input-error:empty{display:none}",
  ".steps{list-style:none;counter-reset:step;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0;padding:0;border-block:1px solid var(--line)}.steps li{padding:20px;counter-increment:step}.steps li::before{content:\"0\" counter(step);display:block;font-weight:700;color:var(--action);margin-bottom:8px}.steps li+li{border-inline-start:1px solid var(--line)}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:0;border-top:1px solid var(--line)}.fact{padding:14px 16px 16px 0;border-bottom:1px solid var(--line)}.fact dt{color:var(--muted)}.fact dd{margin:4px 0 0;font-weight:700}.fact:nth-child(even){padding-inline-start:20px}.event-facts{max-width:820px}.faq,.organizer,.share-demo,.related{max-width:820px}.faq details,.paper,.optional-media{border-bottom:1px solid var(--line);padding:4px 0}.faq summary,.paper summary,.optional-media summary{cursor:pointer;min-height:48px;padding:12px 4px;font-weight:700}.faq details p{max-width:44em}.related ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px 16px}.related a{display:inline-flex;align-items:center;min-height:44px}.related a[aria-current=page]{font-weight:700}.organizer{border-top:1px solid var(--line);padding-top:24px}.organizer h2{font-size:1.125rem}.share-demo button{margin-top:12px}.share-demo input{font-size:1rem}.skip-link{position:absolute;inset-inline-start:12px;top:-80px;z-index:2;min-height:44px;padding:8px 12px;background:var(--surface)}.skip-link:focus{top:12px}",
  ".storage-notice{max-width:820px;color:var(--muted)}.live-status:not(:empty){padding:12px 16px;border:1px solid var(--control);background:var(--surface)}.phase-controls,.activity-controls{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px}.phase-controls [aria-pressed=true],.activity-controls [aria-pressed=true]{box-shadow:inset 0 -3px 0 var(--action);background:var(--notice)}.phase-controls [aria-pressed=true]:focus-visible,.activity-controls [aria-pressed=true]:focus-visible{box-shadow:inset 0 -3px 0 var(--action),0 0 0 4px var(--focus)}.demo-tools{max-width:820px}.activity-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.activity-heading>div{max-width:44em}.activity-heading h2{margin-bottom:8px}.progress-label{font-size:1.125rem;font-weight:700;white-space:nowrap;margin:0}.demo-activity progress{display:block;width:100%;height:10px;border:0;border-radius:6px;overflow:hidden;accent-color:var(--action);background:#dde2dc}.demo-activity progress::-webkit-progress-bar{background:#dde2dc}.demo-activity progress::-webkit-progress-value{background:var(--action)}.activity-steps{list-style:none;margin:24px 0 0;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}.activity-step{min-width:0;padding:20px 0;border-block-start:2px solid var(--control)}.step-title{display:flex;align-items:baseline;gap:12px}.step-number{font-variant-numeric:tabular-nums;color:var(--action);font-weight:700}.step-state{font-weight:700}.activity-step[data-stage=checked],.activity-step[data-stage=included]{border-color:var(--action)}.activity-step[data-stage=checked] .step-number,.activity-step[data-stage=included] .step-number{border:2px solid var(--action);border-radius:50%;padding:4px 8px;animation:stamp-in .2s ease-out}.step-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.step-actions>*{max-width:100%}.completion{margin-top:24px;padding:20px;background:var(--notice)}.completion a{display:inline-flex;min-height:44px;align-items:center}.recap{border-top:1px solid var(--line);padding-top:28px}.recap-list{margin:20px 0}.recap-list>div{padding:12px 0;border-bottom:1px solid var(--line)}.recap-list dt{font-weight:700}.recap-list dd{margin:4px 0 0}.finding-list{padding-inline-start:24px}.finding-list li{padding:8px 0}.reset-area{margin-top:28px}.reset-area>.notice{margin-top:16px}.media-preview:empty{display:none}.media-preview img,.media-preview video{display:block;max-width:100%;width:auto;max-height:340px;object-fit:contain;margin:16px 0;background:#e8ece7}.paper-sheet{display:none}noscript .notice{margin-block:20px}",
  "@keyframes stamp-in{from{transform:scale(.92)}to{transform:scale(1)}}@media(max-width:800px){.activity-steps{grid-template-columns:1fr;gap:8px}.activity-step{padding:20px 0}.activity-heading{display:block}.progress-label{margin:12px 0}.steps{grid-template-columns:1fr}.steps li{padding:16px 4px}.steps li+li{border-inline-start:0;border-top:1px solid var(--line)}}@media(max-width:500px){.facts{grid-template-columns:1fr}.fact:nth-child(even){padding-inline-start:0}.phase-controls,.activity-controls{display:grid;grid-template-columns:1fr}.primary-row .action{width:100%}.page section{margin-top:32px}.notice{padding:14px 16px}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*,*::before,*::after{animation:none!important;transition:none!important}}@media(forced-colors:active){:is(a,button,input,select,summary):focus-visible{outline:3px solid Highlight;box-shadow:none}}",
  "@media print{body{background:#fff;color:#000}.topline,.skip-link,.page>*{display:none!important}.page{max-width:none;padding:0}.page>.paper-sheet{display:block!important}.paper-sheet{font-size:12pt}.paper-sheet h2{font-size:18pt}.paper-sheet li{break-inside:avoid;margin-bottom:16px}.paper-sheet p{margin:6px 0}.paper-sheet ol{padding-inline-start:24px}}",
].join("");

function pageDocument(body: string, nonce: string, title: string, interactive: boolean): string {
  // The JSON configuration is data, but carries the same nonce for strict CSP implementations.
  const bodyWithNonce = body.replace("<script id=\"event-demo-config\"", "<script nonce=\"" + nonce + "\" id=\"event-demo-config\"");
  return "<!doctype html><html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<meta name=\"robots\" content=\"noindex,nofollow,noarchive\"><title>" + escapeHtml(title) + " — ZUKAN 体験プレビュー</title>" +
    "<style nonce=\"" + nonce + "\">" + PAGE_CSS + "</style></head><body><a class=\"skip-link\" href=\"#main\">本文へ移動</a>" +
    "<header class=\"topline\"><div class=\"topline-inner\"><span>ZUKAN　イベントの体験プレビュー</span><small>実際の参加受付は行いません</small></div></header>" +
    bodyWithNonce + "<footer class=\"topline\"><div class=\"topline-inner\"><span>体験用ページ</span><small>公開告知・参加実績ではありません</small></div></footer>" +
    (interactive ? "<script nonce=\"" + nonce + "\">" + EVENT_TEMPLATE_DEMO_SCRIPT + "</script>" : "") + "</body></html>";
}

export function handleEventTemplatePreviewPage(request: Request, pathname: string): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const preset = PRESET_BY_ROUTE[pathname];
  if (!preset) return null;
  const url = new URL(request.url);
  const suppliedToken = url.searchParams.get("demo");
  const tokenIsInvalid = suppliedToken !== null && (!DEMO_TOKEN_PATTERN.test(suppliedToken) || url.searchParams.getAll("demo").length !== 1);
  const interactive = suppliedToken !== null && !tokenIsInvalid;
  const nonce = randomHex(18);
  const token = interactive ? suppliedToken : randomHex(16);
  const body = tokenIsInvalid ? "<main id=\"main\" class=\"page\"><h1>体験用リンクを開けませんでした</h1><p>リンクを確かめるか、テンプレートから体験版を開き直してください。</p><a href=\"" + pathname + "\">テンプレートを見る</a></main>" :
    interactive ? renderInteractivePage(pathname, preset, token!, url.origin) : renderDesignPreview(pathname, preset, token!);
  return new Response(request.method === "HEAD" ? null : pageDocument(body, nonce, preset.title, interactive), {
    status: tokenIsInvalid ? 404 : 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; script-src " +
        (interactive ? "'nonce-" + nonce + "'" : "'none'") + "; connect-src 'none'; img-src " + (interactive ? "blob:" : "'none'") +
        "; media-src " + (interactive ? "blob:" : "'none'") + "; font-src 'self'; style-src 'nonce-" + nonce + "'",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow, noarchive",
    },
  });
}
