import { ZUKAN_DESIGN_FOUNDATION_STYLES } from "./appExperience.js";
import { FRONTEND_FOUNDATION_CSS } from "./frontendFoundation.js";
import { PHOTO_UPLOAD_PREPARATION_SCRIPT } from "./photoUploadPreparation.js";
import { BIOSECURITY_PHOTO_METADATA_SCRIPT } from "../services/biosecurityPhotoMetadata.js";
import { BIOSECURITY_PROFILES, type BiosecurityProfile } from "../services/biosecurityProfiles.js";
import { ENVIRONMENT_RECORD_FIELDS } from "../services/environmentRecord.js";

/** Dependency-free renderer for the active Worker. Private content is loaded by protected APIs. */
export type { BiosecurityProfile };
export type BiosecurityView = "guide" | "capture" | "receipt" | "municipalities" | "inbox";
export type BiosecurityPageParams = { profile?: BiosecurityProfile; recordId?: string; nonce?: string };
const DEFAULT_PROFILE = BIOSECURITY_PROFILES[0]!;
const ENVIRONMENT_UI_LABELS: Record<string, string> = {place_type:"まわりの場所", contact_surface:"どこについている？", surrounding_cover:"まわりのようす", environment_condition:"明るさ・しめり気", human_change:"人が手を入れたあと"};
const ENVIRONMENT_UI_OPTIONS: Record<string, string> = {"place_type.grassland_urban_edge":"草地と町のさかい", "place_type.urban":"町なか", "place_type.woodland":"林の中", "contact_surface.soil_gravel_litter":"土・小石・枯れ草", "contact_surface.plant":"植物の上", "contact_surface.artificial":"道路や建物など", "surrounding_cover.trees_shrubs":"木や低い木", "surrounding_cover.bare_ground":"草のない地面", "surrounding_cover.built_surface":"道路や建物", "environment_condition.open_dry":"開けていて、乾いている", "environment_condition.sunny":"日が当たっている", "environment_condition.wet":"しめっている", "human_change.trampling_mowing":"踏まれたあと・草刈りのあと", "human_change.trampling":"踏まれたあと", "human_change.planting":"植えられた木や草", "human_change.construction":"工事のあと", "human_change.none_visible":"目立つあとがない"};
const ENVIRONMENT_UI_FIELDS = ENVIRONMENT_RECORD_FIELDS.map((field) => ({field:field.field, label:ENVIRONMENT_UI_LABELS[field.field] || field.label, options:field.options.map((option) => ({value:option.value, label:ENVIRONMENT_UI_OPTIONS[field.field + "." + option.value] || option.label}))}));
function escape(value: unknown): string {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function officialUrl(value: string): string {
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e").replaceAll("&", "\\u0026").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}
export const BIOSECURITY_STYLES = `
${FRONTEND_FOUNDATION_CSS}
${ZUKAN_DESIGN_FOUNDATION_STYLES}
.bio-taxa-candidates{margin-top:18px}.bio-taxa-list{list-style:none;padding:0;margin:12px 0;display:grid;gap:8px}.bio-taxa-list li{border:1px solid var(--zukan-border-decorative);border-radius:12px;padding:12px 14px}.bio-taxa-list li p{margin:6px 0 0;font-size:14px}.bio-taxa-list strong{font-weight:650}
html{scroll-padding-top:24px}body{margin:0}body [hidden]{display:none!important}
.bio-header{border-bottom:1px solid var(--zukan-border-decorative)}
.bio-header>div{max-width:1120px;margin:auto;min-height:72px;padding:12px 24px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:16px}
.bio-brand{display:inline-flex;align-items:center;gap:8px;min-height:44px;flex-shrink:0}.bio-brand img{object-fit:contain}
.bio-header nav{display:flex;align-items:center;gap:16px}.bio-header nav a{display:inline-flex;align-items:center;min-height:44px;color:var(--zukan-text-primary);font-size:.875rem;text-underline-offset:4px;white-space:nowrap}
.bio-skip{position:absolute;left:20px;top:-120px;z-index:10;background:white;padding:12px}.bio-skip:focus{top:8px}
.bio-main{width:min(100%,800px);padding:32px 24px 56px;margin:auto}.bio-main[data-view=guide]{width:min(100%,1040px)}
.bio-main h1{font-size:clamp(1.65rem,4vw,2rem);margin:8px 0 16px}.bio-main[data-view=guide] h1{font-size:clamp(1.9rem,4.5vw,2.6rem)}
.bio-main h2{font-size:1.375rem;margin:0 0 16px}.bio-main h3{font-size:1.0625rem;margin:0 0 8px}.bio-main p{margin:0 0 16px}
.bio-eyebrow{font-size:.875rem;color:var(--zukan-text-secondary);font-weight:700}.bio-lead{max-width:42em;line-height:1.8;color:var(--zukan-text-secondary)}
.bio-intro{margin-bottom:32px}.bio-back{display:inline-flex;min-height:44px;align-items:center;color:var(--zukan-link);margin-bottom:12px;text-underline-offset:4px}
.bio-action{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:10px 20px;border:1px solid var(--zukan-action-primary);border-radius:var(--zukan-radius-control);background:var(--zukan-action-primary);color:white;text-decoration:none;font-weight:700;cursor:pointer;line-height:1.5;text-align:center}
.bio-action.secondary{background:var(--zukan-surface-base);color:var(--zukan-action-primary);border-color:var(--zukan-border-control);font-weight:400}.bio-action:disabled{cursor:wait;opacity:.6}.bio-action:hover:not(:disabled){background:var(--zukan-action-hover);color:white}
.bio-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-top:20px}.bio-actions>a:not(.bio-action){display:inline-flex;align-items:center;min-height:44px}
.bio-section{padding:28px 0;border-top:1px solid var(--zukan-border-decorative)}.bio-section:last-child{padding-bottom:0}
.bio-support{background:var(--zukan-surface-subtle);border-radius:var(--zukan-radius-content);padding:20px;margin-top:24px}.bio-support p:last-child{margin-bottom:0}
.bio-note{font-size:.875rem;color:var(--zukan-text-secondary);line-height:1.75}.bio-status{margin:20px 0;overflow-wrap:anywhere}.bio-status:empty{display:none!important}
.bio-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;padding:0;list-style:none;margin:32px 0}.bio-steps li{padding-top:16px;border-top:2px solid var(--zukan-action-primary)}.bio-steps span{display:block;color:var(--zukan-text-secondary);font-size:.875rem;margin-bottom:8px}.bio-steps p{margin:8px 0 0}
.bio-form{display:grid;gap:24px}.bio-form fieldset{min-width:0;border:0;padding:0;margin:0}.bio-form fieldset[data-controls]{display:grid;gap:24px}
.bio-field{display:grid;gap:8px;min-width:0}.bio-field>label,.bio-field>legend{font-weight:700}.bio-field small{font-size:.875rem;color:var(--zukan-text-secondary)}
.bio-field input:not([type=checkbox],[type=radio]),.bio-field select,.bio-field textarea{width:100%;min-width:0;max-width:100%;padding:11px 12px;border:1px solid var(--zukan-border-control);border-radius:var(--zukan-radius-control);color:var(--zukan-text-primary);background:white}
.bio-field textarea{resize:vertical;min-height:112px}.bio-field input[type=file]{padding:12px;background:var(--zukan-surface-subtle)}.bio-field input[type=file]::file-selector-button{font:inherit;padding:8px 12px;min-height:44px;background:white;color:var(--zukan-action-primary);border:1px solid var(--zukan-border-control);border-radius:4px;margin-right:12px}
.bio-pair{display:grid;grid-template-columns:1fr 1fr;gap:20px}.bio-search{display:flex;gap:8px}.bio-search input{flex:1;min-width:0}.bio-search button{flex-shrink:0;padding-inline:14px}
.bio-checks{display:grid;gap:8px}.bio-check{display:flex;align-items:flex-start;gap:12px;min-height:44px;padding:8px 0;cursor:pointer}.bio-check input{flex:0 0 auto;width:20px;height:20px;margin:4px 0 0;accent-color:var(--zukan-action-primary)}.bio-check span{min-width:0;overflow-wrap:anywhere}.bio-check:has(input:disabled){color:var(--zukan-text-secondary)}
.bio-photo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.bio-photo{margin:0;min-width:0}.bio-photo img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;border:1px solid var(--zukan-border-decorative);background:var(--zukan-surface-subtle)}.bio-photo figcaption{font-size:.875rem;overflow-wrap:anywhere;padding-top:8px}.bio-photo button,.bio-photo a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:6px 8px;color:var(--zukan-link);background:white;border:0;text-decoration:underline;cursor:pointer;font:inherit}
.bio-detail-list{display:grid;grid-template-columns:7em minmax(0,1fr);gap:12px 20px;margin:24px 0}.bio-detail-list dt{color:var(--zukan-text-secondary)}.bio-detail-list dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.bio-private{display:inline-flex;border:1px solid var(--zukan-border-decorative);padding:4px 10px;border-radius:4px;font-size:.875rem;color:var(--zukan-text-secondary)}
.bio-record-item{padding:24px 0;border-bottom:1px solid var(--zukan-border-decorative)}.bio-record-item h2{font-size:1.125rem}.bio-record-item:first-child{padding-top:0}.bio-record-item .bio-actions{margin-top:12px}
.bio-main details{border-top:1px solid var(--zukan-border-decorative);padding:20px 0}.bio-main summary{cursor:pointer;display:list-item;align-content:center;min-height:44px;font-weight:700;padding:8px 0}.bio-main details>div{padding-top:16px}
.bio-minor{padding:16px;background:var(--zukan-surface-subtle);border-radius:8px}.bio-inbox-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}.bio-inbox-top p{margin:0}.bio-inbox-top .bio-field{min-width:140px}
.bio-contact{margin:8px 0 0!important;overflow-wrap:anywhere}.bio-footer{max-width:1040px;margin:auto;border-top:1px solid var(--zukan-border-decorative);padding:24px;display:flex;flex-wrap:wrap;gap:16px 24px;font-size:.875rem;color:var(--zukan-text-secondary)}.bio-footer a{min-height:44px;display:inline-flex;align-items:center}.bio-footer span{display:flex;align-items:center}.bio-device{margin-top:32px}.bio-device p{font-size:.875rem}
.bio-hero{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:36px;margin-bottom:40px}.bio-hero .bio-intro{margin:0}.bio-hero-art{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:var(--zukan-radius-content)}
.bio-capture-intro{display:grid;grid-template-columns:minmax(0,1fr) 112px;align-items:center;gap:20px;margin-bottom:24px}.bio-capture-intro h1{margin-top:4px}.bio-capture-intro p:last-child{margin:0}.bio-capture-art{display:block;width:100%;height:auto;border-radius:16px}.bio-capture-intro .bio-eyebrow{font-weight:400}
.bio-upload{position:relative}.bio-file-input{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0}.bio-photo-chooser{display:flex;align-items:center;justify-content:center;gap:12px;min-height:76px;padding:16px;border:1px solid var(--zukan-action-primary);border-radius:var(--zukan-radius-content);background:var(--zukan-surface-subtle);color:var(--zukan-action-primary);font-weight:700;cursor:pointer}.bio-photo-chooser>span:first-child{font-size:1.75rem;font-weight:400;line-height:1}.bio-file-input:focus-visible+.bio-photo-chooser{outline:3px solid currentColor;outline-offset:4px}.bio-file-input:disabled+.bio-photo-chooser{opacity:.6;cursor:wait}.bio-upload-help{margin:10px 0 16px!important}.bio-upload .bio-photo-grid{margin-top:20px}.bio-upload .bio-photo-grid:has(figure:only-child),.bio-main[data-view=receipt] .bio-photo-grid:has(figure:only-child){grid-template-columns:1fr;max-width:480px;margin-inline:auto}.bio-upload .bio-photo:only-child img,.bio-main[data-view=receipt] .bio-photo:only-child img{max-height:320px;object-fit:contain;background:var(--zukan-surface-subtle)}
.bio-capture-details{display:grid;gap:24px}.bio-context{border:1px solid var(--zukan-border-decorative);border-radius:var(--zukan-radius-content);padding:4px 20px}.bio-context-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0}.bio-context-row:not(:first-child){border-top:1px solid var(--zukan-border-decorative)}.bio-context-copy{min-width:0}.bio-context-copy h2{font-size:.875rem;color:var(--zukan-text-secondary);margin:0 0 4px}.bio-context-copy p{margin:0;overflow-wrap:anywhere}.bio-context-copy .bio-note{margin-top:4px}.bio-context-editor{padding:0 0 20px}.bio-context-editor .bio-field+.bio-field{margin-top:20px}.bio-context-editor .bio-actions{margin:12px 0}.bio-text-button{background:transparent;color:var(--zukan-link);border:0;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:4px;min-height:44px;padding:8px 0;flex-shrink:0;max-width:45%}.bio-context-editor .bio-text-button{max-width:none}.bio-context-notice{margin:0 0 16px!important}.bio-more{padding:0!important}.bio-more>div{display:grid;gap:24px}.bio-save-note{margin:0!important}.bio-environment-values{margin-top:16px}.bio-environment-values dd small{display:block;margin-top:4px}.bio-environment .bio-form{gap:20px}.bio-environment .bio-form fieldset[data-controls]{gap:20px}.bio-environment .bio-actions{margin-top:12px}.bio-empty{display:grid;grid-template-columns:128px minmax(0,1fr);align-items:center;gap:24px}.bio-empty img{width:100%;height:auto;border-radius:16px}.bio-empty h2{margin-bottom:12px}.bio-empty p{margin-bottom:16px}
@media(max-width:600px){.bio-header>div{padding-inline:20px;gap:12px;min-height:64px}.bio-header nav{gap:12px}.bio-header nav a{font-size:.875rem}.bio-brand img:first-child{display:none}.bio-main{padding:24px 20px 40px}.bio-main h1{text-wrap:initial}.bio-steps{grid-template-columns:1fr;gap:20px}.bio-steps li{padding-top:12px}.bio-pair{grid-template-columns:1fr;gap:24px}.bio-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bio-actions>.bio-action{width:100%}.bio-detail-list{grid-template-columns:1fr;gap:4px}.bio-detail-list dd{margin-bottom:12px}.bio-support{padding:16px}.bio-footer{padding:20px;gap:8px 20px}}
@media(max-width:700px){.bio-hero{grid-template-columns:1fr;gap:24px}.bio-hero-art{max-width:520px;margin-inline:auto}.bio-hero .bio-intro{order:1}.bio-hero-art{order:2}.bio-capture-intro{grid-template-columns:minmax(0,1fr) 80px;gap:12px}.bio-capture-intro .bio-eyebrow{font-size:.8125rem}.bio-context{padding-inline:16px}.bio-context-row{gap:12px}.bio-empty{grid-template-columns:1fr}.bio-empty img{width:120px}.bio-empty .bio-action{width:100%}}
`;
function municipalityPicker(required: boolean): string {
  return `<div class="bio-field" data-municipality-picker><label for="bio-municipality-query">市区町村を探す${required ? "（必須）" : "（任意）"}</label>
  <div class="bio-search"><input id="bio-municipality-query" type="search" placeholder="例：浜松市" maxlength="80" autocomplete="off"><button class="bio-action secondary" type="button" data-municipality-search>探す</button></div>
  <label for="bio-municipality-code" class="bio-note">候補から選択</label><select id="bio-municipality-code" name="municipality_code" ${required ? "required" : ""}><option value="">${required ? "市区町村を選んでください" : "まだ選ばない"}</option></select>
  <p class="bio-note" data-municipality-state aria-live="polite">市区町村名や都道府県名で検索できます。</p><p class="bio-note bio-contact" data-official-contact hidden></p></div>`;
}
function capture(profile: BiosecurityProfile): string {
  return `<a class="bio-back" href="/ja/biosecurity">見守りの案内へ</a><div class="bio-capture-intro"><div><p class="bio-eyebrow">${escape(profile.title)}</p><h1>写真を残そう</h1><p>名前がわからなくても、写真だけで残せます。</p></div><img class="bio-capture-art" src="/assets/event-discovery/ryuyo-memories.webp" width="800" height="800" alt=""></div>
  <div id="bio-status" class="bio-status" role="status" aria-live="polite" hidden></div>
  <form id="bio-capture-form" class="bio-form"><fieldset data-controls>
  <div class="bio-upload"><input class="bio-file-input" type="file" id="bio-photos" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple aria-describedby="bio-photo-help"><label class="bio-photo-chooser" for="bio-photos"><span aria-hidden="true">＋</span><span id="bio-photo-button-label">写真を選ぶ</span></label><p id="bio-photo-help" class="bio-note bio-upload-help">1〜6枚。今ある写真で大丈夫です。</p><div id="bio-photo-preview" class="bio-photo-grid" aria-live="polite"></div></div>
  <p class="bio-note bio-save-note">無料・ログイン不要。ネットには公開されません。市役所などに送るかは、保存したあとに選べます。</p>
  <div id="bio-capture-details" class="bio-capture-details" hidden>
  <section class="bio-context" aria-label="写真の日時と場所">
    <div class="bio-context-row"><div class="bio-context-copy"><h2>いつ</h2><p id="bio-time-summary">わからない</p><p id="bio-time-source" class="bio-note"></p></div><button class="bio-text-button" type="button" id="bio-time-edit" aria-controls="bio-time-editor" aria-expanded="false">日時を入れる</button></div>
    <div id="bio-time-editor" class="bio-context-editor" hidden><div class="bio-field"><label for="bio-observed-at">見つけた日時（任意）</label><input id="bio-observed-at" name="observed_at" type="datetime-local" step="1"><small id="bio-time-zone">入力した日時は、この端末の時間帯で残します。</small></div><button class="bio-text-button" type="button" id="bio-time-clear">日時を「わからない」にする</button></div>
    <div class="bio-context-row"><div class="bio-context-copy"><h2>どこ</h2><p id="bio-place-summary">わからない</p><p id="bio-place-source" class="bio-note"></p></div><button class="bio-text-button" type="button" id="bio-place-edit" aria-controls="bio-place-editor" aria-expanded="false">場所をつける</button></div>
    <div id="bio-place-editor" class="bio-context-editor" hidden>${municipalityPicker(false)}<div class="bio-field"><label for="bio-spot">場所の目印（任意）</label><input id="bio-spot" name="spot_label" maxlength="160" placeholder="例：公園の入口にあるサクラ"><small>自分の名前や家の住所は書かず、目印だけでも大丈夫です。</small></div><p id="bio-location-value" class="bio-note" style="margin-top:16px" hidden></p><div class="bio-actions"><button class="bio-action secondary" type="button" id="bio-location">今いる場所を使う</button><button class="bio-text-button" type="button" id="bio-location-clear" hidden>位置情報を外す</button></div><p id="bio-location-state" class="bio-note" aria-live="polite">現在地は、ボタンを押したときだけ調べます。</p></div>
    <p id="bio-metadata-help" class="bio-note bio-context-notice">日時や場所がわからなくても、このまま残せます。</p><p id="bio-photo-conflicts" class="bio-note bio-context-notice" role="status" hidden></p>
  </section>
  <details class="bio-more"><summary>メモをつける・くわしく残す</summary><div><div class="bio-field"><label for="bio-signal">何が気になりましたか</label><select id="bio-signal" name="signal">${profile.signals.map((signal) => `<option value="${escape(signal.value)}"${signal.value === "unknown" ? " selected" : ""}>${escape(signal.label)}</option>`).join("")}</select></div><div class="bio-field"><label for="bio-note">気づいたこと（任意）</label><textarea id="bio-note" name="note" maxlength="1000" placeholder="虫や木のようすなど、わかることだけ"></textarea></div></div></details>
  <label class="bio-check"><input id="bio-is-minor" type="checkbox" name="is_minor"><span>私は18歳未満です <small class="bio-note">（自治体と共有するときに保護者の確認が必要です）</small></span></label>
  <button class="bio-action" type="submit" id="bio-save">写真を残す</button><p class="bio-note bio-save-note">同じ端末で90日間見返せます。写真と記録は90日で閲覧終了し、その後順次削除します。端末のデータを消すと戻れません。必要な写真は手元にも保存してください。</p>
  </div>${profile.safety.slice(0, 2).map((line) => `<p class="bio-note bio-save-note">${escape(line)}</p>`).join("")}</fieldset></form>`;
}
function guide(profile: BiosecurityProfile): string {
  const source = officialUrl(profile.guideUrl);
  return `<div class="bio-hero"><div class="bio-intro"><p class="bio-eyebrow">${escape(profile.title)}</p><h1>${escape(profile.guideHeading || profile.title)}</h1><p class="bio-lead">${escape(profile.summary)}</p><div class="bio-actions"><a class="bio-action" href="/ja/biosecurity/${encodeURIComponent(profile.id)}/capture">写真を残す</a><a href="#bio-guide">撮り方を見る</a></div><p class="bio-note" style="margin-top:16px">無料・ログイン不要。ネットには公開されません。</p></div><img class="bio-hero-art" src="/assets/biosecurity/photo-watch.webp" width="1200" height="800" alt=""></div>
  <ol class="bio-steps"><li><span>1. 写真を選ぶ</span><h2>名前がわからなくても</h2><p>気になる虫や木を、写真で残せます。今ある写真でも大丈夫です。</p></li><li><span>2. 自分の記録に</span><h2>まずは自分だけで見る</h2><p>写真の日時や場所も一緒に残せます。わからないところは、そのままで。</p></li><li><span>3. 必要なときに</span><h2>市役所などに知らせる</h2><p>送り先と、送ってよい情報を選びます。保存しただけでは送られません。</p></li></ol>
  <section id="bio-guide" class="bio-section"><h2>どんな写真を撮ろう？</h2><div class="bio-pair"><div><h3>気になる虫を見つけたら</h3><p>虫の全体と、気になるところ。近づきすぎず、安全な場所から撮りましょう。</p></div><div><h3>木くずや木の変化を見つけたら</h3><p>気になるところと、木の全体。無理に触ったり、木の中を調べたりしなくて大丈夫です。</p></div></div><p class="bio-note">写真を残しても、虫の名前や被害の有無は確定しません。対応方法は公式の案内を確認してください。</p>
  ${source ? `<p><a href="${escape(source)}" target="_blank" rel="noopener noreferrer">公式の見分け方・対応方法を見る（別のタブ）</a>${profile.sourceCheckedAt ? `<span class="bio-note"> ／案内の確認：${escape(profile.sourceCheckedAt)}</span>` : ""}</p>` : ""}
  <div class="bio-support"><h3>安全な場所から、今ある写真で</h3>${profile.safety.map((line) => `<p>${escape(line)}</p>`).join("")}<p class="bio-note">対応を急ぐ場合は地域の公式窓口へ直接連絡してください。ZUKANの共有は、自治体での正式受付とは異なります。</p></div></section>
  <section class="bio-section"><h2>残した写真を見返す</h2><p>同じ端末で90日間見返せます。90日で閲覧終了し、その後順次削除します。端末のデータを消すと戻れません。</p><a class="bio-action secondary" href="/ja/biosecurity/records">自分の記録を見る</a></section>
  <section class="bio-section"><h2>自治体の担当者の方へ</h2><p>公式メールの所有確認で、自治体向けの受信箱を無料で利用できます。IKIMONへの事前連絡は不要です。</p><p class="bio-note">閲覧できるのは、その自治体への提供に本人が同意した情報だけです。メールの認証は、自治体の公式採用や代表権限を示すものではありません。</p><a class="bio-action secondary" href="/ja/biosecurity/municipalities">自治体の受信箱を利用する</a></section>`;
}
function municipalities(): string {
  return `<div class="bio-intro"><a class="bio-back" href="/ja/biosecurity">見守りの案内へ</a><p class="bio-eyebrow">自治体の担当者向け</p><h1>公式メールで受信箱を開く</h1><p class="bio-lead">基本利用は無料。市区町村を選び、担当者の公式メールを認証すると、その自治体に提供された記録を見られます。IKIMONへの申請は不要です。</p></div>
  <div id="bio-status" class="bio-status" role="status" aria-live="polite" hidden></div><div id="bio-staff-existing" hidden></div>
  <form id="bio-staff-form" class="bio-form"><fieldset data-controls>${municipalityPicker(true)}<div class="bio-field"><label for="bio-staff-email">担当者の公式メールアドレス</label><input id="bio-staff-email" type="email" required maxlength="254" autocomplete="email" placeholder="担当者のメールアドレス"><small>選んだ自治体の公式サイトで確認できるメールドメインを使用してください。</small></div><button class="bio-action" type="submit">確認コードをメールで受け取る</button></fieldset></form>
  <form id="bio-code-form" class="bio-form" hidden><fieldset data-controls><p id="bio-code-sent"></p><div class="bio-field"><label for="bio-staff-code">メールに届いた確認コード（8桁）</label><input id="bio-staff-code" type="text" inputmode="numeric" pattern="[0-9]{8}" maxlength="8" autocomplete="one-time-code" required><small id="bio-code-expiry">コードには有効期限があります。</small></div><button class="bio-action" type="submit">認証して受信箱を開く</button><button class="bio-action secondary" type="button" id="bio-code-back">宛先の変更・コードを再発行</button></fieldset></form>
  <div class="bio-support"><h2>見られる情報について</h2><p>投稿した人がこの自治体への提供に同意した情報だけを表示します。他の自治体の記録や、共有されていない記録は閲覧できません。</p><p class="bio-note">公式メールの所有確認は、自治体の正式採用や、組織全体を代表する権限の確認ではありません。同じ自治体の認証済み担当者が受信箱を利用できます。</p></div>`;
}
function receipt(recordId?: string): string {
  return `<div class="bio-intro"><a class="bio-back" href="${recordId ? "/ja/biosecurity/records" : "/ja/biosecurity"}">${recordId ? "自分の記録一覧へ" : "見守りの案内へ"}</a><p class="bio-eyebrow">この端末で残した記録</p><h1>${recordId ? "残した写真" : "自分の記録"}</h1><p class="bio-lead">ネットには公開されません。市役所などに知らせるかは、ここで選べます。</p></div><div id="bio-status" class="bio-status" role="status" aria-live="polite" hidden></div><div id="bio-receipt-content"><p role="status">記録を開いています。</p></div>
  <details class="bio-device"><summary>共用の端末を使っている方へ</summary><div><p>利用を終了すると、この端末から保存した記録へ戻れなくなります。記録そのものは保存期限まで残ります。取り消したい共有がある場合は、先に記録を開いて取り消してください。</p><button id="bio-reset" class="bio-action secondary" type="button">この端末の利用を終了する</button></div></details>`;
}
function inbox(): string {
  return `<div class="bio-intro"><a class="bio-back" href="/ja/biosecurity">見守りの案内へ</a><p class="bio-eyebrow">自治体の担当者向け</p><h1>共有された記録</h1><p class="bio-lead">投稿者がこの自治体に提供した情報を確認できます。</p></div><div id="bio-status" class="bio-status" role="status" aria-live="polite" hidden></div><div id="bio-inbox-session"><p role="status">認証状態を確認しています。</p></div>
  <div id="bio-inbox-controls" hidden><div class="bio-inbox-top"><p id="bio-inbox-identity"></p><div class="bio-field"><label for="bio-inbox-filter">表示する記録</label><select id="bio-inbox-filter"><option value="all">すべて</option><option value="available">まだ確認していない</option><option value="acknowledged">確認済み</option></select></div></div><div class="bio-actions"><button type="button" class="bio-action secondary" id="bio-inbox-refresh">最新の情報に更新</button><button type="button" class="bio-action secondary" id="bio-staff-logout">利用を終了する</button></div><p class="bio-note" style="margin-top:16px">「確認済み」はZUKAN受信箱での確認です。種の同定、対処の完了、自治体での正式受付を意味しません。</p><div id="bio-inbox-items"></div></div>`;
}
export function renderBiosecurityBody(view: BiosecurityView, params: BiosecurityPageParams = {}): string {
  const profile = params.profile ?? DEFAULT_PROFILE;
  if (view === "guide") return guide(profile);
  if (view === "capture") return capture(profile);
  if (view === "municipalities") return municipalities();
  if (view === "inbox") return inbox();
  return receipt(params.recordId);
}

export const BIOSECURITY_SCRIPT = String.raw`
(function () {
  'use strict';
  const configElement = document.getElementById('bio-config');
  if (!configElement) return;
  const config = JSON.parse(configElement.textContent);
  const API = '/api/v1/biosecurity';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const safeHttps = (value) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; } };
  const dateText = (value) => { if (value == null || value === '') return '日時はわからない'; const date = new Date(value); return Number.isNaN(date.getTime()) ? '日時はわからない' : new Intl.DateTimeFormat('ja-JP', {dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Tokyo'}).format(date) + '（日本時間）'; };
  const unknownTime = () => ({source:'unknown', localDateTime:null, offsetMinutes:null, instant:null, precision:'unknown', photoIndex:null});
  const offsetText = (minutes) => minutes == null ? '時間帯は不明' : minutes === 540 ? '日本時間' : 'UTC' + (minutes >= 0 ? '+' : '−') + String(Math.floor(Math.abs(minutes) / 60)).padStart(2,'0') + ':' + String(Math.abs(minutes) % 60).padStart(2,'0');
  const localTimeText = (time) => {
    const match = time && typeof time.localDateTime === 'string' && /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(time.localDateTime);
    if (!match) return 'わからない';
    return Number(match[1]) + '年' + Number(match[2]) + '月' + Number(match[3]) + '日' + (match[4] ? ' ' + match[4] + ':' + match[5] + (time.precision === 'second' && match[6] ? ':' + match[6] : '') + '（' + offsetText(time.offsetMinutes) + '）' : '');
  };
  const observedTimeText = (record) => record.observedTime ? localTimeText(record.observedTime) : dateText(record.observedAt);
  const timeSourceText = (time) => !time || !time.localDateTime ? '' : time.source === 'photo_exif' ? ((time.photoIndex == null ? 0 : time.photoIndex) + 1) + '枚目の写真から' : time.source === 'user' ? '自分で入力' : '';
  const hasTime = (record) => Object.prototype.hasOwnProperty.call(record, 'observedTime') || Object.prototype.hasOwnProperty.call(record, 'observedAt');
  const captureMetadata = (photos, overrides = {}) => {
    const first = photos[0] && photos[0].metadata || {time:unknownTime(), location:null};
    const original = first.time && first.time.localDateTime ? {...first.time, photoIndex:0} : unknownTime();
    const time = overrides.time ? {...overrides.time} : original;
    const location = Object.prototype.hasOwnProperty.call(overrides, 'location') ? overrides.location : first.location ? {...first.location, photoIndex:0} : null;
    const times = photos.map((photo) => photo.metadata && photo.metadata.time).filter((item) => item && item.localDateTime).map((item) => item.instant || item.localDateTime + '|' + item.offsetMinutes);
    const locations = photos.map((photo) => photo.metadata && photo.metadata.location).filter(Boolean).map((item) => Number(item.lat).toFixed(5) + ',' + Number(item.lng).toFixed(5));
    return {time, originalTime:original, location, conflicts:{time:new Set(times).size > 1, location:new Set(locations).size > 1}};
  };
  const signalLabel = (value) => !value || value === 'unknown' ? '写真の記録' : (config.profile.signals.find((item) => item.value === value) || {}).label || '写真の記録';
  const message = (text, error = false) => { const node = $('#bio-status'); if (!node) return; node.textContent = text; node.hidden = !text; node.setAttribute('role', error ? 'alert' : 'status'); node.dataset.zukanUiState = error ? 'error' : 'info'; if (error && node.scrollIntoView) node.scrollIntoView({block:'nearest'}); };
  const errorText = (error) => {
    const code = String(error.code || '');
    if (code === 'save_in_progress_retry_same_request') return '保存を確認しています。少し待ってから、もう一度「写真を残す」を押してください。';
    if (code === 'share_capacity_reached') return 'この記録は共有回数の上限（20回）に達しました。現在の共有状況を確認するか、必要な情報を公式窓口へ直接連絡してください。';
    if (code === 'record_deletion_in_progress') return 'この記録を削除しています。少し時間をおいて、記録一覧を確認してください。';
    if (error.status === 429 || /rate|quota|capacity|limit_reached/.test(code)) return '利用が集中しています。少し時間をおいて、同じ内容でもう一度お試しください。';
    if (/expired/.test(code)) return '有効期限が切れました。確認コードの場合は、新しく発行してください。';
    if (/code|challenge_invalid/.test(code)) return '確認コードを確認してください。期限が切れている場合は、新しく発行できます。';
    if (/domain|municipality_not|official_email/.test(code)) return 'この自治体の公式メールとして確認できませんでした。市区町村の選択と公式メールアドレスをご確認ください。';
    if (/email|mail_|delivery/.test(code)) return '確認メールを送信できませんでした。時間をおいて再度お試しください。';
    if (error.status === 401 || error.status === 403) return 'この端末からは操作できません。担当者の方は公式メールで再認証してください。';
    if (error.status === 409) return '情報が更新されました。現在の状態を確認してから、もう一度操作してください。';
    if (error.status === 413 || /photo.*(?:large|size|limit)/.test(code)) return '写真の容量が上限を超えています。枚数を減らすか、小さい写真を選んでください。';
    if (/photo|media|image/.test(code)) return '写真を読み込めませんでした。JPEG、PNG、WebPの写真でもう一度お試しください。';
    if (error.status === 400 || error.status === 422) return '入力内容を確認してください。日時、市区町村、共有する項目が正しいか見直してください。';
    return '通信を確認できませんでした。入力した内容はこの画面に残っています。もう一度お試しください。';
  };
  const request = async (path, options = {}) => {
    const response = await fetch(API + path, {credentials:'same-origin', cache:'no-store', ...options, headers:{Accept:'application/json', ...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}), ...(options.headers || {})}});
    let data;
    try { data = await response.json(); } catch (_) { throw Object.assign(new Error('invalid_response'), {status:response.status}); }
    if (!response.ok) throw Object.assign(new Error('request_failed'), {status:response.status, data, code:typeof data.error === 'string' ? data.error : data.error && data.error.code || data.code});
    return data;
  };
  const post = (path, body) => request(path, {method:'POST', body:JSON.stringify(body || {})});
  const busy = (form, value) => { const controls = $('[data-controls]', form); if (controls) controls.disabled = value; form.setAttribute('aria-busy', String(value)); const submit = $('button[type=submit]', form); if (submit) { submit.dataset.idleLabel = submit.dataset.idleLabel || submit.textContent; submit.textContent = value ? '処理しています…' : submit.dataset.idleLabel; } };
  const memoryKeys = new Map();
  const stableKey = async (scope, value) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    const signature = Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2,'0')).join('');
    let previous = memoryKeys.get(scope);
    if (!previous) { try { previous = JSON.parse(sessionStorage.getItem('zukan.biosecurity.' + scope) || 'null'); } catch (_) {} }
    if (!previous || previous.signature !== signature) previous = {signature, key:crypto.randomUUID()};
    memoryKeys.set(scope, previous);
    try { sessionStorage.setItem('zukan.biosecurity.' + scope, JSON.stringify(previous)); } catch (_) {}
    return previous.key;
  };
  const dropKey = (scope) => { memoryKeys.delete(scope); try { sessionStorage.removeItem('zukan.biosecurity.' + scope); } catch (_) {} };
  const privatePhotoUrl = (value) => { try { const url = new URL(value, location.origin); return url.origin === location.origin && url.pathname.startsWith(API + '/') ? url.pathname + url.search : ''; } catch (_) { return ''; } };
  const photoGrid = (photos) => '<div class="bio-photo-grid">' + (photos || []).map((photo, i) => { const url = privatePhotoUrl(photo.url); return url ? '<figure class="bio-photo"><a href="' + esc(url) + '" target="_blank" rel="noopener"><img src="' + esc(url) + '" alt="保存した写真 ' + (i + 1) + '" loading="lazy"></a><figcaption>写真 ' + (i + 1) + '</figcaption><a href="' + esc(url) + '" download>手元にも保存</a></figure>' : ''; }).join('') + '</div>';
  const environmentFields = config.environmentFields || [];
  const environmentEntries = (environment) => environmentFields.flatMap((field) => {
    const values = environment && environment.values || {}, choice = field.options.find((option) => option.value === values[field.field]);
    return choice && choice.value !== 'unknown' ? [{field:field.field, label:field.label, value:choice.label, source:values[field.field + '_source'] === 'user' ? '自分で入力' : values[field.field + '_source'] === 'derived' ? '1枚目の写真からの候補（AI）' : '記録した内容'}] : [];
  });
  const hasEnvironment = (environment) => environmentEntries(environment).length > 0 || environmentFields.some((field) => environment && environment.values && environment.values[field.field + '_source'] === 'user');

  const countBandText = {unknown:'数は不明', one:'1匹・1個体ほど', two_three:'2〜3個体ほど', four_nine:'4〜9個体ほど', ten_plus:'10個体以上'};
  const taxonRankText = {class:'綱', order:'目', family:'科', genus:'属'};
  const taxaDetails = (environment) => {
    const analysis = environment && environment.multiTaxa;
    if (!analysis) return '';
    if (analysis.status === 'unavailable') return '<p class="bio-note">生きものの判定は利用できませんでした。写真は保存されています。</p>';
    const candidates = Array.isArray(analysis.candidates) ? analysis.candidates : [];
    if (!candidates.length) return '<p class="bio-note">写真から生きものの分類候補を見つけられませんでした。「いない」と確定した意味ではありません。</p>';
    return '<section class="bio-taxa-candidates" aria-label="生きものの分類候補"><h3>写真に写る生きものの候補</h3>' +
      '<p class="bio-note">同じ個体の科と属が両方並ぶことがあります。別の生きものとして数えません。写真をまたいだ個体数は合計しません。</p>' +
      '<ul class="bio-taxa-list">' + candidates.map((item) => {
        const observations = Array.isArray(item.observations) ? item.observations : [];
        const evidence = observations.map((photo) => '写真' + Number(photo.photoNumber) + '：' + (countBandText[photo.countBand] || '数は不明')).join(' ／ ');
        const strength = Number(item.presenceScore);
        const caveat = Number.isFinite(strength) && strength < 0.8 ? '（候補の根拠は弱め）' : '';
        return '<li><strong>' + esc(item.label) + '</strong><span class="bio-note"> ' +
          esc(taxonRankText[item.rank] || '') + 'の候補 ' + esc(caveat) + '</span><p>' + esc(evidence || '写真から数は不明') + '</p></li>';
      }).join('') + '</ul><p class="bio-note">自動判定による未確認の記録です。数や分類が違っていても、写真自体の保存・共有範囲は変わりません。</p></section>';
  };
  const environmentDetails = (environment) => { const entries = environmentEntries(environment); return entries.length ? '<dl class="bio-detail-list bio-environment-values">' + entries.map((item) => '<dt>' + esc(item.label) + '</dt><dd>' + esc(item.value) + '<small class="bio-note">' + esc(item.source) + '</small></dd>').join('') + '</dl>' : ''; };
  const detailText = (record) => [
    'ZUKAN 外来種の記録（虫の名前や被害は未確認）', hasTime(record) && '見つけた日時：' + observedTimeText(record) + (timeSourceText(record.observedTime) ? ' ／' + timeSourceText(record.observedTime) : ''),
    record.municipalityName && '市区町村：' + record.municipalityName, record.spotLabel && '場所の目印：' + record.spotLabel,
    record.signal && record.signal !== 'unknown' && '気になったこと：' + signalLabel(record.signal), record.note && 'メモ：' + record.note,
    record.exactLocation && '記録した位置：' + record.exactLocation.lat + ', ' + record.exactLocation.lng,
    ...environmentEntries(record.environment).map((item) => item.label + '：' + item.value + ' ／' + item.source),
    'これは自治体での正式受付を示すものではありません。'
  ].filter(Boolean).join('\n');
  const details = (record) => '<dl class="bio-detail-list">' + [
    hasTime(record) && ['見つけた日時', observedTimeText(record) + (timeSourceText(record.observedTime) ? '\n' + timeSourceText(record.observedTime) : '')], record.municipalityName && ['市区町村', record.municipalityName],
    record.spotLabel && ['場所の目印', record.spotLabel], record.signal && record.signal !== 'unknown' && ['気になったこと', signalLabel(record.signal)],
    record.note && ['気づいたこと', record.note], record.exactLocation && ['記録した位置', record.exactLocation.lat + ', ' + record.exactLocation.lng]
  ].filter(Boolean).map((item) => '<dt>' + esc(item[0]) + '</dt><dd>' + esc(item[1]) + '</dd>').join('') + '</dl>';
  const setupPicker = (root, initial) => {
    const picker = $('[data-municipality-picker]', root); if (!picker) return;
    const query = $('#bio-municipality-query', picker), select = $('#bio-municipality-code', picker), state = $('[data-municipality-state]', picker), contact = $('[data-official-contact]', picker), button = $('[data-municipality-search]', picker);
    let candidates = initial ? [initial] : [];
    const contactChange = () => {
      const municipality = candidates.find((item) => String(item.code) === select.value), url = municipality && safeHttps(municipality.website);
      contact.hidden = !url; contact.innerHTML = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(municipality.name) + 'の公式サイトで連絡先を確認（別のタブ）</a>' : '';
      root.dispatchEvent(new Event('change'));
    };
    if (initial) { select.appendChild(new Option(initial.name, initial.code)); select.value = initial.code; contactChange(); }
    select.addEventListener('change', contactChange);
    const search = async () => {
      const term = query.value.trim(); if (!term) { state.textContent = '市区町村名か都道府県名を入力してください。'; query.focus(); return; }
      button.disabled = true; state.textContent = '市区町村を探しています。';
      try {
        const data = await request('/municipalities?q=' + encodeURIComponent(term));
        candidates = Array.isArray(data) ? data : data.municipalities || data.items || [];
        select.replaceChildren(new Option(select.required ? '市区町村を選んでください' : 'まだ選ばない', ''));
        candidates.forEach((item) => select.appendChild(new Option([item.prefecture, item.name].filter(Boolean).join(' '), item.code)));
        state.textContent = candidates.length ? candidates.length + '件の候補があります。市区町村を選んでください。' : '該当する市区町村が見つかりません。都道府県名や正式名称でもう一度お試しください。';
        select.dispatchEvent(new Event('change'));
      } catch (error) { state.textContent = errorText(error); } finally { button.disabled = false; }
    };
    button.addEventListener('click', search);
    query.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } });
  };

  ${PHOTO_UPLOAD_PREPARATION_SCRIPT}
  ${BIOSECURITY_PHOTO_METADATA_SCRIPT}
  // Always re-encode: the shared original-file fallback would preserve EXIF.
  const privatePhoto = async (file) => {
    if (file.size > 30 * 1024 * 1024) throw Object.assign(new Error('photo_too_large'), {code:'photo_too_large'});
    let metadata = {time:unknownTime(), location:null};
    try { metadata = window.readBiosecurityPhotoMetadata(await file.slice(0, window.BIOSECURITY_PHOTO_METADATA_MAX_BYTES).arrayBuffer()); } catch (_) {}
    let decoded, canvas;
    try {
      decoded = await loadImageForUpload(file);
      const width = Number(decoded.naturalWidth || decoded.width), height = Number(decoded.naturalHeight || decoded.height);
      if (!(width > 0 && height > 0)) throw new Error('photo_decode_failed');
      const scale = Math.min(1, PHOTO_UPLOAD_MAX_EDGE / Math.max(width, height));
      canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d'); if (!context) throw new Error('photo_canvas_unavailable');
      context.drawImage(decoded, 0, 0, canvas.width, canvas.height);
      const encoded = await canvasToImage(canvas, 'image/webp') || await canvasToImage(canvas, 'image/jpeg');
      if (!encoded) throw new Error('photo_encode_failed');
      const raw = atob(encoded.dataUrl.split(',')[1]), bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
      if (bytes.byteLength > 4 * 1024 * 1024) throw Object.assign(new Error('photo_too_large'), {code:'photo_too_large'});
      const blob = new Blob([bytes], {type:encoded.mimeType}), digest = await crypto.subtle.digest('SHA-256', bytes);
      return {blob, metadata, hash:Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2,'0')).join(''), url:URL.createObjectURL(blob), name:'photo.' + (encoded.mimeType === 'image/webp' ? 'webp' : 'jpg')};
    } catch (error) { if (!error.code) error.code = 'photo_decode_failed'; throw error; }
    finally { if (decoded && decoded.close) decoded.close(); if (canvas) { canvas.width = 1; canvas.height = 1; } }
  };
  let captureDirty = false;
  const setupCapture = () => {
    const form = $('#bio-capture-form'); if (!form) return;
    let photos = [], overrides = {}, ready = false, submitting = false, preparing = false, sessionPromise, savedRecordId, locationEpoch = 0;
    const timeInput = $('#bio-observed-at');
    const timePayload = (time) => ({source:time.source, localDateTime:time.localDateTime, offsetMinutes:time.offsetMinutes, precision:time.precision, photoIndex:time.photoIndex == null ? null : time.photoIndex});
    const renderMetadata = () => {
      const adopted = captureMetadata(photos, overrides), time = adopted.time, exact = adopted.location;
      const municipality = $('#bio-municipality-code'), spot = $('#bio-spot').value.trim();
      $('#bio-time-summary').textContent = localTimeText(time);
      $('#bio-time-source').textContent = timeSourceText(time);
      timeInput.value = time.localDateTime || '';
      $('#bio-time-zone').textContent = time.precision === 'date' ? '写真には日付だけが入っています。時刻がわからなければ、このままで大丈夫です。入力する場合は、この端末の時間帯で残します。' : '入力した日時は、この端末の時間帯で残します。';
      $('#bio-time-edit').textContent = !$('#bio-time-editor').hidden ? '閉じる' : time.localDateTime ? '直す' : '日時を入れる';
      $('#bio-place-summary').textContent = spot || (municipality.value ? municipality.options[municipality.selectedIndex].text : exact ? exact.source === 'device' ? '今いる場所' : '写真に記録された場所' : 'わからない');
      $('#bio-place-source').textContent = exact ? exact.source === 'device' ? 'この端末の現在地から' : (exact.photoIndex + 1) + '枚目の写真から' : '';
      $('#bio-place-edit').textContent = !$('#bio-place-editor').hidden ? '閉じる' : exact || municipality.value || spot ? '確かめる・直す' : '場所をつける';
      $('#bio-location-value').hidden = !exact;
      $('#bio-location-value').textContent = exact ? '記録する位置：緯度 ' + Number(exact.lat).toFixed(5) + '、経度 ' + Number(exact.lng).toFixed(5) : '';
      $('#bio-location-clear').hidden = !exact;
      $('#bio-metadata-help').textContent = time.source === 'photo_exif' && time.localDateTime || exact && exact.source === 'photo_exif' ? '写真に入っていた情報も一緒に残せます。違っていたら、直したり外したりできます。' : '日時や場所は、わかるところだけで大丈夫です。';
      const conflicts = [adopted.conflicts.time && '日時', adopted.conflicts.location && '場所'].filter(Boolean);
      $('#bio-photo-conflicts').hidden = !conflicts.length;
      $('#bio-photo-conflicts').textContent = conflicts.length ? '写真ごとに' + conflicts.join('や') + 'が違います。自分で直していない項目は、1枚目の写真の情報を使います。' : '';
    };
    setupPicker(form);
    form.addEventListener('input', () => { captureDirty = true; });
    $('#bio-spot').addEventListener('input', renderMetadata);
    $('#bio-municipality-code').addEventListener('change', renderMetadata);
    const toggleEditor = (name) => { const editor = $('#bio-' + name + '-editor'), button = $('#bio-' + name + '-edit'); editor.hidden = !editor.hidden; button.setAttribute('aria-expanded', String(!editor.hidden)); renderMetadata(); };
    $('#bio-time-edit').addEventListener('click', () => { toggleEditor('time'); if (!$('#bio-time-editor').hidden) timeInput.focus(); });
    $('#bio-place-edit').addEventListener('click', () => toggleEditor('place'));
    timeInput.addEventListener('input', () => {
      const value = timeInput.value, date = value ? new Date(value) : null;
      overrides.time = value && date && !Number.isNaN(date.getTime()) ? {source:'user', localDateTime:value, offsetMinutes:-date.getTimezoneOffset(), instant:date.toISOString(), precision:value.length > 16 ? 'second' : 'minute', photoIndex:null} : {...unknownTime(), source:'user'};
      captureDirty = true; renderMetadata();
    });
    $('#bio-time-clear').addEventListener('click', () => { overrides.time = {...unknownTime(), source:'user'}; captureDirty = true; renderMetadata(); message('日時は「わからない」のまま残します。'); });
    const renderPhotos = () => {
      $('#bio-photo-preview').innerHTML = photos.map((photo, index) => '<figure class="bio-photo"><img src="' + esc(photo.url) + '" alt="選んだ写真 ' + (index + 1) + '"><figcaption>写真 ' + (index + 1) + '</figcaption><button type="button" data-remove-photo="' + index + '" aria-label="写真 ' + (index + 1) + 'を外す">外す</button></figure>').join('');
      $('#bio-photo-button-label').textContent = photos.length ? '写真を追加する' : '写真を選ぶ';
      $('#bio-capture-details').hidden = !photos.length;
      $$('[data-remove-photo]', form).forEach((button) => button.addEventListener('click', () => { const removed = photos.splice(Number(button.dataset.removePhoto), 1)[0]; URL.revokeObjectURL(removed.url); captureDirty = true; renderPhotos(); message('写真を外しました。'); }));
      renderMetadata();
    };
    $('#bio-photos').addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []); event.target.value = ''; if (!files.length) return;
      if (photos.length + files.length > 6) { message('写真は6枚までです。いくつか外してから選んでください。', true); return; }
      preparing = true; busy(form, true); message('写真を開いています。'); const prepared = [];
      try {
        for (const file of files) { const photo = await privatePhoto(file); if (Object.prototype.hasOwnProperty.call(overrides, 'location') && overrides.location === null) photo.metadata.location = null; prepared.push(photo); }
        if (photos.concat(prepared).reduce((sum, photo) => sum + photo.blob.size, 0) > 18 * 1024 * 1024) throw Object.assign(new Error('photo_too_large'), {code:'photo_too_large'});
        photos.push(...prepared); captureDirty = true; renderPhotos(); message('写真を選びました。日時や場所がわからなくても残せます。');
      } catch (error) { prepared.forEach((photo) => URL.revokeObjectURL(photo.url)); message(errorText(error), true); }
      finally { preparing = false; busy(form, false); }
    });
    $('#bio-location').addEventListener('click', () => {
      if (!navigator.geolocation) { $('#bio-location-state').textContent = 'この端末では現在地を調べられません。このまま写真を残せます。'; return; }
      const epoch = ++locationEpoch;
      $('#bio-location').disabled = true; $('#bio-location-state').textContent = '現在地を確認しています。';
      navigator.geolocation.getCurrentPosition((position) => {
        if (epoch !== locationEpoch || submitting || savedRecordId) return;
        overrides.location = {lat:position.coords.latitude, lng:position.coords.longitude, source:'device', photoIndex:null}; captureDirty = true;
        $('#bio-location-state').textContent = '現在地を入れました。約' + Math.round(position.coords.accuracy) + 'mのずれがある場合があります。写真を撮った場所と違うときは、位置情報を外してください。';
        $('#bio-location').disabled = false; renderMetadata();
      }, (error) => { if (epoch !== locationEpoch || savedRecordId) return; $('#bio-location-state').textContent = error.code === 1 ? '現在地の利用が許可されませんでした。このまま写真を残せます。' : '現在地がわかりませんでした。このまま写真を残せます。'; $('#bio-location').disabled = false; }, {enableHighAccuracy:false, timeout:10000, maximumAge:0});
    });
    $('#bio-location-clear').addEventListener('click', () => { ++locationEpoch; overrides.location = null; photos.forEach((photo) => { photo.metadata.location = null; }); captureDirty = true; $('#bio-location').disabled = false; renderMetadata(); $('#bio-location-state').textContent = '位置情報を外しました。写真を追加しても、自動では入れ直しません。'; });
    const ensureSession = () => sessionPromise || (sessionPromise = request('/session').then((result) => { if (!result.ready) throw new Error('session_unavailable'); ready = true; }).catch((error) => { sessionPromise = null; throw error; }));
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (submitting || preparing || !form.reportValidity()) return;
      if (savedRecordId) { location.assign('/ja/biosecurity/records/' + encodeURIComponent(savedRecordId)); return; }
      if (!photos.length) { message('写真を1枚以上選んでください。', true); $('#bio-photos').focus(); return; }
      submitting = true; ++locationEpoch; $('#bio-location').disabled = false; busy(form, true); message('写真を残しています。このままお待ちください。');
      try {
        if (!ready) await ensureSession();
        const adopted = captureMetadata(photos, overrides), exactLocation = adopted.location;
        const metadata = {version:1, time:timePayload(adopted.time), originalTime:timePayload(adopted.originalTime), location:{source:exactLocation ? exactLocation.source : 'unknown', photoIndex:exactLocation && exactLocation.source === 'photo_exif' ? exactLocation.photoIndex : null}, conflicts:adopted.conflicts};
        const payload = {profile_id:config.profile.id, capture_metadata:JSON.stringify(metadata), municipality_code:$('#bio-municipality-code').value, spot_label:$('#bio-spot').value.trim(), signal:$('#bio-signal').value, note:$('#bio-note').value.trim(), is_minor:$('#bio-is-minor').checked ? 'true':'false'};
        if (adopted.time.instant && adopted.time.localDateTime && adopted.time.offsetMinutes != null) payload.observed_at = adopted.time.instant;
        if (exactLocation) { payload.exact_lat = String(exactLocation.lat); payload.exact_lng = String(exactLocation.lng); }
        const key = await stableKey('capture', {payload, photos:photos.map((photo) => photo.hash)});
        const body = new FormData(); Object.entries(payload).forEach(([name, value]) => body.append(name, value)); body.append('idempotency_key', key);
        photos.forEach((photo, i) => body.append('photos', photo.blob, (i + 1) + '-' + photo.name));
        const result = await request('/records', {method:'POST', body}); if (!result.record || !result.record.id) throw new Error('receipt_missing');
        captureDirty = false; savedRecordId = result.record.id; location.assign('/ja/biosecurity/records/' + encodeURIComponent(savedRecordId));
      } catch (error) { message(error.status >= 400 && error.status < 500 ? errorText(error) : '保存できたか確認できませんでした。写真はこの画面に残っています。もう一度「写真を残す」を押してください。', true); }
      finally { submitting = false; busy(form, false); }
    });
    ensureSession().catch(() => message('通信を確認できませんでした。写真は選べます。保存するときに、もう一度つなぎ直します。', true));
    window.addEventListener('beforeunload', (event) => { if (captureDirty) { event.preventDefault(); event.returnValue = ''; } });
  };
  const sharePickerHtml = ${scriptJson(municipalityPicker(true))};
  const fieldLabels = {photos:'写真', observedAt:'日時', spotLabel:'場所の目印', note:'気づいたこと', exactLocation:'正確な位置', environment:'まわりのようす'};
  const environmentShareField = (record) => hasEnvironment(record.environment) ? '<label class="bio-check"><input type="checkbox" name="share_field" value="environment"><span>まわりのようす（今の内容）</span></label>' : '';
  const shareForm = (record) => '<details id="bio-share-panel"><summary>市役所などに知らせる（任意）</summary><div><p>送り先と、送ってよい情報を選びます。選んだ自治体のZUKAN受信箱に届きます。</p><form id="bio-share-form" class="bio-form"><fieldset data-controls>' + sharePickerHtml +
    '<fieldset class="bio-field"><legend>送ってよい情報を選ぶ</legend><div class="bio-checks">' +
    '<label class="bio-check"><input type="checkbox" name="share_field" value="observedAt" checked disabled><span>日時（わからない場合はそのまま）</span></label>' +
    '<label class="bio-check"><input type="checkbox" name="share_field" value="photos"><span>写真 ' + Number(record.photoCount || (record.photos || []).length) + '枚</span></label>' +
    (record.spotLabel ? '<label class="bio-check"><input type="checkbox" name="share_field" value="spotLabel"><span>場所の目印</span></label>' : '') +
    (record.note ? '<label class="bio-check"><input type="checkbox" name="share_field" value="note"><span>気づいたこと</span></label>' : '') +
    (record.exactLocation ? '<label class="bio-check"><input type="checkbox" name="share_field" value="exactLocation"><span>正確な位置</span></label>' : '') +
    '<div id="bio-environment-share-field">' + environmentShareField(record) + '</div>' +
    '</div><small>写真か「気づいたこと」のどちらかを含めてください。</small></fieldset>' +
    (record.isMinor ? '<label class="bio-check bio-minor"><input type="checkbox" id="bio-guardian-consent" required><span>保護者が、選んだ情報を自治体へ提供することを確認しました。</span></label>' : '') +
    '<p id="bio-share-summary" class="bio-note">共有先と情報を選んでください。</p><label class="bio-check"><input type="checkbox" id="bio-share-consent" required><span>共有先と選んだ情報を確認しました。写真に写る人などの権利にも配慮し、外来種対応のための提供に同意します。</span></label>' +
    '<button class="bio-action" type="submit">選んだ情報を送る</button><p class="bio-note">自治体での正式受付とは異なります。担当者がまだ受信箱を利用していない場合もあります。急ぐ場合は自治体の公式窓口へ直接連絡してください。</p></fieldset></form></div></details>';
  const environmentSection = (record) => {
    const environment = record.environment || {status:'not_requested', version:0, values:{}}, entries = environmentEntries(environment), values = environment.values || {};
    const state = environment.status || 'not_requested';
    const text = {not_requested:'写真に写った草や木、地面のようすも残せます。', processing:'写真を調べています。写真と記録は保存できています。', ready:entries.length ? entries.some((entry) => entry.source === '1枚目の写真からの候補（AI）') || Boolean(environment.multiTaxa?.candidates?.length) ? '写真から出した候補は、間違っていることもあります。違っていたら直してください。' : 'わかるところを残しました。内容はいつでも直せます。' : '写真からは、まわりのようすがわかりませんでした。わかることがあれば書き足せます。', unavailable:'今は写真から調べられません。写真と記録は保存されています。', budget_reached:'今日は写真から調べられる回数の上限に達しました。写真と記録は保存されています。', off:'写真から調べる機能は、今はお休みです。わかることを自分で残せます。'}[state] || '写真と記録は保存されています。';
    return '<section class="bio-section bio-environment" id="bio-environment"><h2>写真から分かったこと</h2><p role="status">' + esc(text) + '</p>' + environmentDetails(environment) + taxaDetails(environment) +
      (state === 'not_requested' || state === 'ready' && environment.model === null ? '<p class="bio-note" id="bio-environment-disclosure">保存した写真を調べ、まわりの環境や、写っている生きものの分類候補を探します。候補は確定ではなく、外来種の正式な同定や自治体への通報は行いません。</p><button type="button" class="bio-action secondary" id="bio-environment-hints" aria-describedby="bio-environment-disclosure">写真から分かることを調べる</button>' : '') +
      (state === 'processing' || state === 'unavailable' ? '<button type="button" class="bio-action secondary" id="bio-environment-refresh">結果を確認する</button>' : '') +
      '<details><summary>' + (entries.length ? '違うところを直す' : 'わかることを自分で入れる') + '</summary><div><p class="bio-note">わかるところだけで大丈夫です。「わからない・使わない」を選ぶと、その候補を外せます。</p><form id="bio-environment-form" class="bio-form"><fieldset data-controls>' + environmentFields.map((field) => '<div class="bio-field"><label for="bio-environment-' + esc(field.field) + '">' + esc(field.label) + '</label><select id="bio-environment-' + esc(field.field) + '" name="' + esc(field.field) + '">' + field.options.map((option) => '<option value="' + esc(option.value) + '"' + (option.value === (values[field.field] || 'unknown') ? ' selected' : '') + '>' + esc(option.value === 'unknown' ? 'わからない・使わない' : option.label) + '</option>').join('') + '</select></div>').join('') + '<button class="bio-action secondary" type="submit">直した内容を残す</button></fieldset></form></div></details>' +
      ((record.shares || []).some((share) => share.status !== 'withdrawn' && (share.fields || []).includes('environment')) ? '<p class="bio-note">すでに自治体へ送った内容は変わりません。直した内容を送りたいときは、改めて共有してください。</p>' : '') + '</section>';
  };
  const setupEnvironment = (record) => {
    const section = $('#bio-environment'); if (!section) return;
    const form = $('#bio-environment-form', section), changed = new Set(); let updating = false;
    $$('select', form).forEach((select) => select.addEventListener('change', () => changed.add(select.name)));
    const refresh = async (resultEnvironment = null) => {
      const latest = await request('/records/' + encodeURIComponent(record.id));
      if (!latest.record || !latest.record.environment) throw new Error('environment_missing');
      record.environment = latest.record.environment;
      if (resultEnvironment && ['off','budget_reached'].includes(resultEnvironment.status) && resultEnvironment.version === record.environment.version) record.environment = {...record.environment, status:resultEnvironment.status};
      const fieldSlot = $('#bio-environment-share-field'), previouslySelected = !!$('input[value=environment]:checked', fieldSlot);
      fieldSlot.innerHTML = environmentShareField(record);
      if (previouslySelected && $('input', fieldSlot)) { $('input', fieldSlot).checked = true; $('#bio-share-consent').checked = false; }
      $('#bio-share-form').dispatchEvent(new Event('change'));
      section.outerHTML = environmentSection(record); setupEnvironment(record);
    };
    const begin = () => { updating = true; busy(form, true); const button = $('#bio-environment-hints', section); if (button) button.disabled = true; };
    const end = () => { updating = false; busy(form, false); const button = $('#bio-environment-hints', section); if (button) button.disabled = false; };
    const hints = $('#bio-environment-hints', section);
    if (hints) hints.addEventListener('click', async () => {
      if (updating) return; begin(); message('写真から、まわりのようすを調べています。');
      try { const result = await post('/records/' + encodeURIComponent(record.id) + '/environment-hints', {consent:true}); await refresh(result.environment); message(record.environment.status === 'ready' ? 'まわりのようすを表示しました。違っていたら直してください。' : ''); }
      catch (error) { message('結果を確認できませんでした。写真と記録は保存されています。' + (error.status === 401 || error.status === 403 ? 'この端末から開ける記録か確認してください。' : '時間をおいて、もう一度お試しください。'), true); end(); }
    });
    const reload = $('#bio-environment-refresh', section);
    if (reload) reload.addEventListener('click', async () => { if (updating) return; reload.disabled = true; try { await refresh(); } catch (error) { message(errorText(error), true); reload.disabled = false; } });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (updating) return;
      if (!changed.size) { message('変えたい項目を選んでください。わからないところは、そのままで大丈夫です。'); return; }
      const values = {}; changed.forEach((field) => { values[field] = $('select[name="' + field + '"]', form).value; });
      begin();
      try { await post('/records/' + encodeURIComponent(record.id) + '/environment', {expectedVersion:Number(record.environment && record.environment.version || 0), values}); await refresh(); message('直した内容を残しました。自治体へ送る内容は、共有するときに確認してください。'); }
      catch (error) { message(error.status === 409 ? '記録の内容が変わっています。ページを開き直してから、もう一度直してください。' : errorText(error), true); end(); }
    });
  };
  let ownRecords = [], ownNextOffset = null;
  const loadReceipt = async (append = false) => {
    const target = $('#bio-receipt-content');
    try {
      if (!config.recordId) {
        const data = await request('/records' + (append === true && ownNextOffset != null ? '?offset=' + encodeURIComponent(ownNextOffset) : ''));
        const records = Array.isArray(data) ? data : data.records || data.items || [];
        ownRecords = append === true ? ownRecords.concat(records) : records; ownNextOffset = data.nextOffset == null ? null : data.nextOffset;
        target.innerHTML = ownRecords.length ? ownRecords.map((record) => '<article class="bio-record-item"><p class="bio-note">' + esc(observedTimeText(record)) + '</p><h2><a href="/ja/biosecurity/records/' + encodeURIComponent(record.id) + '">' + esc(record.spotLabel || record.municipalityName || signalLabel(record.signal)) + '</a></h2><p class="bio-note">非公開・写真' + Number(record.photoCount || 0) + '枚</p></article>').join('') : '<div class="bio-empty"><img src="/assets/event-discovery/ryuyo-memories.webp" width="800" height="800" alt=""><div><h2>まだ写真を残していません</h2><p>写真を残すと、ここから見返せます。別の端末の記録や、保存期限を過ぎた記録は表示されません。</p><a class="bio-action" href="/ja/biosecurity/' + encodeURIComponent(config.profile.id) + '/capture">写真を残す</a></div></div>';
        if (ownNextOffset != null) { target.insertAdjacentHTML('beforeend', '<div class="bio-actions"><button id="bio-records-more" class="bio-action secondary" type="button">続きを読み込む</button></div>'); $('#bio-records-more').addEventListener('click', async () => { $('#bio-records-more').disabled = true; await loadReceipt(true); }); }
        return;
      }
      const data = await request('/records/' + encodeURIComponent(config.recordId)), record = data.record;
      if (!record || !record.id) throw new Error('record_missing');
      target.innerHTML = '<p><span class="bio-private">保存済み・非公開</span></p>' + photoGrid(record.photos) + details(record) +
        (record.photoConflicts && (record.photoConflicts.time || record.photoConflicts.location) ? '<p class="bio-note">写真ごとに日時や場所の情報が違います。保存前に選んだ内容を表示しています。</p>' : '') + environmentSection(record) +
        '<div class="bio-actions"><button class="bio-action secondary" id="bio-copy-record" type="button">連絡用の文章をコピー</button>' + (safeHttps(record.officialUrl) ? '<a href="' + esc(safeHttps(record.officialUrl)) + '" target="_blank" rel="noopener noreferrer">公式の案内・連絡先を確認（別のタブ）</a>' : '') + '</div><p class="bio-note" style="margin-top:16px">コピーには、この画面の日時・場所・メモなどが入ります。伝えたい情報を選んで、公式窓口への連絡に使えます。</p>' +
        (record.expiresAt ? '<p class="bio-note">閲覧期限：' + esc(dateText(record.expiresAt)) + '。期限後は順次削除します。必要な写真は手元にも保存してください。</p>' : '') +
        '<section class="bio-section"><h2>自治体への共有状況</h2>' +
        ((record.shares || []).length ? record.shares.map((share) => '<article class="bio-record-item"><h3>' + esc(share.municipalityName) + '</h3><p>' +
        (share.status === 'withdrawn' ? '共有を取り消しました' : share.status === 'acknowledged' ? '自治体の担当者がZUKAN受信箱で確認しました' : share.recipientActive === false ? 'ZUKAN受信箱に共有済み・担当者が受信箱を開設すると閲覧できます' : 'ZUKAN受信箱に共有済み・担当者の確認待ち') + '</p><p class="bio-note">' + esc((share.fields || []).map((field) => fieldLabels[field] || '').filter(Boolean).join('・')) + '</p>' +
        (share.status !== 'withdrawn' ? '<button class="bio-action secondary" type="button" data-withdraw="' + esc(share.id) + '" data-version="' + Number(share.version) + '">共有を取り消す</button>' : '') + '</article>').join('') : '<p>まだ自治体には送っていません。</p>') +
        '<p class="bio-note">自治体での正式受付とは異なります。共有を取り消すと、この受信箱から新たに閲覧できなくなります。すでに保存された情報は回収できません。</p></section>' + shareForm(record) +
        '<details><summary>この記録を削除する</summary><div><p>写真と記録を削除し、自治体への共有を取り消します。削除は元に戻せません。すでに相手が保存した情報は回収できません。</p><button class="bio-action secondary" id="bio-delete-record" type="button">写真と記録を削除する</button></div></details>';
      setupEnvironment(record);
      $('#bio-copy-record').addEventListener('click', async () => { try { await navigator.clipboard.writeText(detailText(record)); message('連絡用の文章をコピーしました。連絡先と内容を確認してからお使いください。'); } catch (_) { message('コピーできませんでした。表示している情報を選択してコピーしてください。', true); } });
      $('#bio-delete-record').addEventListener('click', async () => {
        if (!confirm('この写真と記録を削除し、すべての自治体への共有を取り消します。削除は元に戻せません。削除しますか？')) return;
        $('#bio-delete-record').disabled = true;
        try { await request('/records/' + encodeURIComponent(record.id), {method:'DELETE'}); dropKey('share.' + record.id); location.replace('/ja/biosecurity/records'); }
        catch (error) {
          try { await request('/records/' + encodeURIComponent(record.id)); }
          catch (readError) { if (readError.status === 404) { location.replace('/ja/biosecurity/records'); return; } }
          message('削除の結果を確認できませんでした。' + errorText(error), true); $('#bio-delete-record').disabled = false;
        }
      });
      $$('[data-withdraw]', target).forEach((button) => button.addEventListener('click', async () => {
        if (!confirm('この自治体への共有を取り消しますか？ すでに保存された情報は回収できません。')) return; button.disabled = true;
        try { await post('/shares/' + encodeURIComponent(button.dataset.withdraw) + '/withdraw', {expectedVersion:Number(button.dataset.version)}); await loadReceipt(); message('共有を取り消しました。写真は自分の記録に残っています。'); }
        catch (error) { await loadReceipt(); message(errorText(error) + ' 共有状態を読み直しました。', true); }
      }));
      const form = $('#bio-share-form');
      setupPicker(form, record.municipalityCode ? {code:record.municipalityCode, name:record.municipalityName || record.municipalityCode, website:record.officialUrl} : null);
      const selectedFields = () => $$('input[name=share_field]:checked', form).map((input) => input.value);
      form.addEventListener('change', () => { const select = $('#bio-municipality-code', form), labels = selectedFields().map((field) => fieldLabels[field]); $('#bio-share-summary').textContent = select.value ? select.options[select.selectedIndex].text + 'へ：' + labels.join('・') : '共有先と情報を選んでください。'; });
      form.dispatchEvent(new Event('change'));
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); if (form.getAttribute('aria-busy') === 'true' || !form.reportValidity()) return;
        const fields = selectedFields();
        if (!fields.includes('photos') && !fields.includes('note')) { message('提供する写真か「気づいたこと」を選んでください。', true); return; }
        const payload = {municipalityCode:$('#bio-municipality-code', form).value, purpose:'invasive_response', fields, consent:$('#bio-share-consent').checked, guardianConsent:!!$('#bio-guardian-consent') && $('#bio-guardian-consent').checked};
        if (fields.includes('environment')) payload.environmentVersion = Number(record.environment.version);
        busy(form, true); message('選んだ情報を送っています。');
        try { payload.idempotencyKey = await stableKey('share.' + record.id, payload); await post('/records/' + encodeURIComponent(record.id) + '/share', payload); dropKey('share.' + record.id); await loadReceipt(); message('選んだ情報をZUKANの受信箱に送りました。自治体での正式受付とは異なります。'); }
        catch (error) { message(errorText(error), true); busy(form, false); }
      });
    } catch (error) {
      if (append === true) { message(errorText(error), true); if ($('#bio-records-more')) $('#bio-records-more').disabled = false; return; }
      if (!config.recordId && error.status === 401) { target.innerHTML = '<div class="bio-empty"><img src="/assets/event-discovery/ryuyo-memories.webp" width="800" height="800" alt=""><div><h2>この端末の記録を見つけられませんでした</h2><p>初めて使う方は、写真を残してみましょう。前の記録は、保存した端末から開いてください。端末のデータを消した場合や期限が過ぎた場合は戻れません。</p><a class="bio-action" href="/ja/biosecurity/' + encodeURIComponent(config.profile.id) + '/capture">写真を残す</a></div></div>'; return; }
      target.innerHTML = '<h2>記録を開けませんでした</h2><p>' + (error.status === 401 || error.status === 403 || error.status === 404 ? 'この端末で保存した記録か、保存期間内かをご確認ください。端末のデータを消した場合は戻れません。' : esc(errorText(error))) + '</p><button class="bio-action secondary" id="bio-receipt-retry" type="button">もう一度確認する</button>';
      $('#bio-receipt-retry').addEventListener('click', () => loadReceipt());
    }
  };
  const setupStaff = async () => {
    const form = $('#bio-staff-form'); if (!form) return;
    setupPicker(form); const codeForm = $('#bio-code-form'); let challenge = null;
    const showCodeEntry = (result, email, uncertain) => {
      challenge = result; form.hidden = true; codeForm.hidden = false;
      $('#bio-code-sent').textContent = uncertain ? email + ' への送信結果を確認できませんでした。メールが届いた場合は、その確認コードを入力できます。' : email + ' に確認コードを送りました。';
      $('#bio-code-expiry').textContent = challenge.expiresAt ? '有効期限：' + dateText(challenge.expiresAt) : 'メールに記載された有効期限内に入力してください。';
      message(uncertain ? 'メールは自動で再送していません。届いていない場合は、宛先を確認してコードを再発行してください。' : ''); $('#bio-staff-code').focus();
    };
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (form.getAttribute('aria-busy') === 'true' || !form.reportValidity()) return;
      busy(form, true); message('確認メールを送信しています。'); const email = $('#bio-staff-email').value.trim();
      try { const result = await post('/staff/challenge', {municipalityCode:$('#bio-municipality-code').value, email}); if (!result.challengeId) throw new Error('challenge_missing'); showCodeEntry(result, email, false); }
      catch (error) { if (error.code === 'email_delivery_unconfirmed' && error.data && error.data.challengeId) showCodeEntry(error.data, email, true); else message(errorText(error), true); }
      finally { busy(form, false); }
    });
    $('#bio-code-back').addEventListener('click', () => { challenge = null; codeForm.hidden = true; $('#bio-staff-code').value = ''; form.hidden = false; message(''); });
    codeForm.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!challenge || codeForm.getAttribute('aria-busy') === 'true' || !codeForm.reportValidity()) return; busy(codeForm, true);
      try { await post('/staff/verify', {challengeId:challenge.challengeId, code:$('#bio-staff-code').value.trim()}); location.assign('/ja/biosecurity/inbox'); }
      catch (error) { message(errorText(error), true); } finally { busy(codeForm, false); }
    });
    try { const session = await request('/staff/session'); if (session.authenticated) { const existing = $('#bio-staff-existing'); existing.hidden = false; existing.innerHTML = '<p>' + esc(session.municipality && session.municipality.name) + ' の担当者として認証されています。</p><div class="bio-actions" style="margin-bottom:24px"><a class="bio-action" href="/ja/biosecurity/inbox">受信箱を開く</a></div>'; } } catch (_) {}
  };
  let inboxItems = [], inboxNextOffset = null, inboxEpoch = 0;
  const loadInbox = async (append = false) => {
    const target = $('#bio-inbox-items'), epoch = ++inboxEpoch;
    try {
      $('#bio-inbox-refresh').disabled = true;
      const data = await request('/inbox?status=' + encodeURIComponent($('#bio-inbox-filter').value) + (append === true && inboxNextOffset != null ? '&offset=' + encodeURIComponent(inboxNextOffset) : ''));
      if (epoch !== inboxEpoch) return;
      inboxItems = append === true ? inboxItems.concat(data.items || []) : data.items || []; inboxNextOffset = data.nextOffset == null ? null : data.nextOffset;
      target.innerHTML = '<p class="bio-note" style="margin-top:24px">' + inboxItems.length + '件の記録を表示</p>' + (inboxItems.length ? inboxItems.map((item) => {
        const record = item.record || item;
        return '<article class="bio-record-item"><h2>' + esc(record.spotLabel || signalLabel(record.signal)) + '</h2><p class="bio-private">' + (item.status === 'acknowledged' ? '受信箱で確認済み' : 'まだ確認していない') + '・種は未確認</p>' + details(record) + photoGrid(record.photos) + (record.environment ? '<h3 style="margin-top:24px">まわりのようす</h3>' + (environmentDetails(record.environment) || '<p class="bio-note">わからない項目として共有されています。</p>') : '') +
        (item.status === 'available' ? '<div class="bio-actions"><button class="bio-action secondary" type="button" data-acknowledge="' + esc(item.shareId) + '" data-version="' + Number(item.version) + '">内容を確認した</button></div>' : '') + '</article>';
      }).join('') : '<div class="bio-support"><h2>この条件に合う記録はありません</h2><p>この自治体への提供に同意された記録が、ここに表示されます。市民の投稿入口を案内する場合は、下のリンクをお使いください。</p><a href="/ja/biosecurity">市民向けの記録ページを見る</a></div>');
      $$('[data-acknowledge]', target).forEach((button) => button.addEventListener('click', async () => {
        button.disabled = true;
        try { await post('/inbox/' + encodeURIComponent(button.dataset.acknowledge) + '/acknowledge', {expectedVersion:Number(button.dataset.version)}); await loadInbox(); message('受信内容を確認済みにしました。'); }
        catch (error) { await loadInbox(); message(errorText(error), true); }
      }));
      if (inboxNextOffset != null) { target.insertAdjacentHTML('beforeend', '<div class="bio-actions"><button id="bio-inbox-more" class="bio-action secondary" type="button">続きを読み込む</button></div>'); $('#bio-inbox-more').addEventListener('click', async () => { $('#bio-inbox-more').disabled = true; await loadInbox(true); }); }
    } catch (error) {
      if (epoch !== inboxEpoch) return;
      if (append === true) { message(errorText(error), true); if ($('#bio-inbox-more')) $('#bio-inbox-more').disabled = false; return; }
      target.innerHTML = '<div class="bio-support"><h2>受信箱を読み込めませんでした</h2><p>' + esc(errorText(error)) + '</p>' + (error.status === 401 || error.status === 403 ? '<a class="bio-action secondary" href="/ja/biosecurity/municipalities">公式メールで再認証する</a>' : '<p>「最新の情報に更新」から、もう一度確認できます。</p>') + '</div>';
    } finally { if (epoch === inboxEpoch) $('#bio-inbox-refresh').disabled = false; }
  };
  const setupInbox = async () => {
    const state = $('#bio-inbox-session'); if (!state) return;
    try {
      const session = await request('/staff/session');
      if (!session.authenticated) { state.innerHTML = '<p>受信箱を利用するには、公式メールの認証が必要です。</p><a class="bio-action" href="/ja/biosecurity/municipalities">公式メールで認証する</a>'; return; }
      state.hidden = true; $('#bio-inbox-controls').hidden = false; $('#bio-inbox-identity').textContent = [session.municipality && session.municipality.name, session.email].filter(Boolean).join(' ／ ');
      $('#bio-inbox-filter').addEventListener('change', () => loadInbox()); $('#bio-inbox-refresh').addEventListener('click', () => loadInbox());
      $('#bio-staff-logout').addEventListener('click', async () => { $('#bio-staff-logout').disabled = true; try { await post('/staff/logout'); location.assign('/ja/biosecurity/municipalities'); } catch (error) { message(errorText(error), true); $('#bio-staff-logout').disabled = false; } });
      await loadInbox();
    } catch (error) { state.innerHTML = '<p>' + esc(errorText(error)) + '</p><button type="button" id="bio-session-retry" class="bio-action secondary">もう一度確認する</button>'; $('#bio-session-retry').addEventListener('click', setupInbox); }
  };
  if (config.view === 'capture') setupCapture();
  if (config.view === 'municipalities') setupStaff();
  if (config.view === 'inbox') setupInbox();
  if (config.view === 'receipt') {
    loadReceipt();
    $('#bio-reset').addEventListener('click', async () => {
      if (!confirm('この端末から記録へ戻れなくなります。必要な共有の取り消しと写真の保存は済みましたか？')) return;
      $('#bio-reset').disabled = true;
      try { await post('/session/reset'); try { Object.keys(sessionStorage).filter((key) => key.startsWith('zukan.biosecurity.')).forEach((key) => sessionStorage.removeItem(key)); } catch (_) {} location.assign('/ja/biosecurity'); }
      catch (error) { message(errorText(error), true); $('#bio-reset').disabled = false; }
    });
  }
  // Do not restore private DOM from browser history after logout or shared-device reset.
  window.addEventListener('pagehide', () => { const main = $('#bio-main'); if (main) main.replaceChildren(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
})();
`;

export function renderBiosecurityPage(view: BiosecurityView, params: BiosecurityPageParams = {}): string {
  const profile = params.profile ?? DEFAULT_PROFILE;
  const title = {guide:profile.title, capture:"写真を残そう", receipt:"自分の記録", municipalities:"自治体の受信箱を利用する", inbox:"共有された記録"}[view];
  const nonce = params.nonce ? ` nonce="${escape(params.nonce)}"` : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#143f2e"><title>${escape(title)} | ZUKAN</title><meta name="description" content="${escape(view === "guide" ? profile.summary : "外来種の写真と記録を非公開で保存し、選んだ情報を自治体へ共有できます。")}">${view !== "guide" ? '<meta name="robots" content="noindex,nofollow,noarchive">' : ""}<link rel="icon" href="/assets/brand/zukan-favicon-32.png"><style>${BIOSECURITY_STYLES}</style></head>
  <body data-zukan-design="v1"><a class="bio-skip" href="#bio-main">本文へ</a><header class="bio-header"><div><a class="bio-brand" href="/ja/" aria-label="ZUKANのホーム"><img src="/assets/brand/zukan-app-icon-192.png" alt="" width="32" height="32"><img src="/assets/brand/zukan-wordmark.svg" alt="ZUKAN" width="92" height="29"></a><nav aria-label="外来種の記録"><a href="/ja/biosecurity">案内</a><a href="/ja/biosecurity/records">自分の記録</a></nav></div></header>
  <main id="bio-main" class="bio-main" data-view="${view}">${renderBiosecurityBody(view, {...params, profile})}<noscript><div class="bio-support"><p>写真の保存、記録の閲覧、自治体への共有にはJavaScriptが必要です。ブラウザの設定をご確認ください。</p><a href="${escape(officialUrl(profile.guideUrl) || "/ja/biosecurity")}">公式の案内を確認する</a></div></noscript></main>
  <footer class="bio-footer"><span>運営：IKIMON</span><a href="/ja/privacy">プライバシー</a><a href="/ja/terms">利用規約</a><a href="/ja/biosecurity/municipalities">自治体の担当者の方へ</a></footer>
  ${view === "guide" ? "" : `<script id="bio-config" type="application/json"${nonce}>${scriptJson({view,recordId:params.recordId || null,profile:{id:profile.id,signals:profile.signals},environmentFields:ENVIRONMENT_UI_FIELDS})}</script><script${nonce}>${BIOSECURITY_SCRIPT}</script>`}</body></html>`;
}
