import { ZUKAN_DESIGN_FOUNDATION_STYLES } from "./appExperience.js";
import { FRONTEND_FOUNDATION_CSS } from "./frontendFoundation.js";
import { PHOTO_UPLOAD_PREPARATION_SCRIPT } from "./photoUploadPreparation.js";
import { BIOSECURITY_PROFILES, type BiosecurityProfile } from "../services/biosecurityProfiles.js";

/** Dependency-free renderer for the active Worker. Private content is loaded by protected APIs. */
export type { BiosecurityProfile };
export type BiosecurityView = "guide" | "capture" | "receipt" | "municipalities" | "inbox";
export type BiosecurityPageParams = { profile?: BiosecurityProfile; recordId?: string; nonce?: string };
const DEFAULT_PROFILE = BIOSECURITY_PROFILES[0]!;
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
@media(max-width:600px){.bio-header>div{padding-inline:20px;gap:12px;min-height:64px}.bio-header nav{gap:12px}.bio-header nav a{font-size:.875rem}.bio-brand img:first-child{display:none}.bio-main{padding:24px 20px 40px}.bio-main h1{text-wrap:initial}.bio-steps{grid-template-columns:1fr;gap:20px}.bio-steps li{padding-top:12px}.bio-pair{grid-template-columns:1fr;gap:24px}.bio-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bio-actions>.bio-action{width:100%}.bio-detail-list{grid-template-columns:1fr;gap:4px}.bio-detail-list dd{margin-bottom:12px}.bio-support{padding:16px}.bio-footer{padding:20px;gap:8px 20px}}
`;
function municipalityPicker(required: boolean): string {
  return `<div class="bio-field" data-municipality-picker><label for="bio-municipality-query">市区町村を探す${required ? "（必須）" : "（任意）"}</label>
  <div class="bio-search"><input id="bio-municipality-query" type="search" placeholder="例：浜松市" maxlength="80" autocomplete="off"><button class="bio-action secondary" type="button" data-municipality-search>探す</button></div>
  <label for="bio-municipality-code" class="bio-note">候補から選択</label><select id="bio-municipality-code" name="municipality_code" ${required ? "required" : ""}><option value="">${required ? "市区町村を選んでください" : "まだ選ばない"}</option></select>
  <p class="bio-note" data-municipality-state aria-live="polite">市区町村名や都道府県名で検索できます。</p><p class="bio-note bio-contact" data-official-contact hidden></p></div>`;
}
function capture(profile: BiosecurityProfile): string {
  return `<div class="bio-intro"><a class="bio-back" href="/ja/biosecurity">見守りの案内へ</a><p class="bio-eyebrow">${escape(profile.title)}</p><h1>写真と場所を残す</h1><p class="bio-lead">ログイン不要・無料。まず非公開で保存します。自治体への共有は、保存後に自分で選べます。</p></div>
  <div id="bio-status" class="bio-status" role="status" aria-live="polite" hidden></div>
  <form id="bio-capture-form" class="bio-form"><fieldset data-controls>
  <div class="bio-field"><label for="bio-photos">写真（1〜6枚）</label><input type="file" id="bio-photos" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple aria-describedby="bio-photo-help"><small id="bio-photo-help">虫・痕跡・木全体など、今ある写真で大丈夫です。送信前に写真の位置情報を除き、容量を小さくします。送信後は1枚4MB、合計18MBまで。</small><div id="bio-photo-preview" class="bio-photo-grid" aria-live="polite"></div></div>
  <div class="bio-pair"><div class="bio-field"><label for="bio-observed-at">見つけた日時</label><input id="bio-observed-at" name="observed_at" type="datetime-local" required></div><div class="bio-field"><label for="bio-signal">何が気になりましたか</label><select id="bio-signal" name="signal">${profile.signals.map((signal) => `<option value="${escape(signal.value)}"${signal.value === "unknown" ? " selected" : ""}>${escape(signal.label)}</option>`).join("")}</select></div></div>
  ${municipalityPicker(false)}
  <div class="bio-field"><label for="bio-spot">場所の目印（任意）</label><input id="bio-spot" name="spot_label" maxlength="160" placeholder="例：公園の入口にあるサクラ"><small>氏名や自宅の住所は書かず、目印だけでも残せます。</small></div>
  <details><summary>正確な位置も残す（任意）</summary><div><p class="bio-note">現在地はボタンを押したときだけ取得します。自治体へ提供するときは、改めて選べます。</p><div class="bio-actions"><button class="bio-action secondary" type="button" id="bio-location">現在地を取得する</button><button class="bio-action secondary" type="button" id="bio-location-clear" hidden>位置を外す</button></div><p id="bio-location-state" class="bio-note" aria-live="polite">位置情報は取得していません。</p></div></details>
  <div class="bio-field"><label for="bio-note">気づいたこと（任意）</label><textarea id="bio-note" name="note" maxlength="1000" placeholder="虫や木の様子など、分かる範囲で"></textarea></div>
  <label class="bio-check"><input id="bio-is-minor" type="checkbox" name="is_minor"><span>私は18歳未満です <small class="bio-note">（自治体と共有するときに保護者の確認が必要です）</small></span></label>
  <div class="bio-support"><p><strong>写真は非公開で保存されます。</strong></p><p class="bio-note">同じ端末で90日間見返せます。写真と記録は90日で閲覧終了し、その後順次削除します。端末のデータを消すと戻れません。必要な記録は手元にも保存してください。</p></div>
  <button class="bio-action" type="submit" id="bio-save">非公開で保存する</button><p class="bio-note">${escape(profile.safety[0])} この保存だけで、種の判定や自治体への通報は行いません。</p></fieldset></form>`;
}
function guide(profile: BiosecurityProfile): string {
  const source = officialUrl(profile.guideUrl);
  return `<div class="bio-intro"><p class="bio-eyebrow">外来種の記録と共有</p><h1>${escape(profile.guideHeading || profile.title)}</h1><p class="bio-lead">${escape(profile.summary)}</p><div class="bio-actions"><a class="bio-action" href="/ja/biosecurity/${encodeURIComponent(profile.id)}/capture">写真を残す</a><a href="#bio-guide">撮り方・見分け方を見る</a></div><p class="bio-note" style="margin-top:16px">無料・ログイン不要。記録はまず非公開で保存されます。</p></div>
  <ol class="bio-steps"><li><span>1. 見つけたら</span><h2>写真と場所を残す</h2><p>名前の確定は不要です。安全な場所から撮影してください。</p></li><li><span>2. 自分で見返す</span><h2>非公開で保存</h2><p>同じ端末から写真や記録を見返せます。公開はされません。</p></li><li><span>3. 必要なときに</span><h2>共有範囲を選ぶ</h2><p>本人が選んだ情報だけを、選んだ自治体のZUKAN受信箱へ共有できます。</p></li></ol>
  <section id="bio-guide" class="bio-section"><h2>何を撮ればよい？</h2><div class="bio-pair"><div><h3>気になる虫を見つけた</h3><p>虫の全体、特徴が気になる部分、周りの様子。名前が分からなくても保存できます。</p></div><div><h3>木くずや木の異変が気になる</h3><p>痕跡の近く、幹や根元、木の全体を、無理のない範囲で撮ってください。</p></div></div><p class="bio-note">色や痕跡だけで種を確定することはできません。この画面ではAI判定や専門家による確認は行いません。</p>
  ${source ? `<p><a href="${escape(source)}" target="_blank" rel="noopener noreferrer">対象の公式な見分け方・対応方法を見る（別のタブ）</a>${profile.sourceCheckedAt ? `<span class="bio-note"> ／案内の確認：${escape(profile.sourceCheckedAt)}</span>` : ""}</p>` : ""}
  <div class="bio-support"><h3>安全な場所から、今ある写真で</h3>${profile.safety.map((line) => `<p>${escape(line)}</p>`).join("")}<p class="bio-note">対応を急ぐ場合は地域の公式窓口へ直接連絡してください。ZUKANの共有は、自治体での正式受付とは異なります。</p></div></section>
  <section class="bio-section"><h2>記録を見返したい方へ</h2><p>保存した写真と記録は同じ端末で90日間見返せます。90日で閲覧終了し、その後順次削除します。端末のデータを消すと戻れません。</p><a class="bio-action secondary" href="/ja/biosecurity/records">自分の記録を見る</a></section>
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
  return `<div class="bio-intro"><a class="bio-back" href="${recordId ? "/ja/biosecurity/records" : "/ja/biosecurity"}">${recordId ? "自分の記録一覧へ" : "見守りの案内へ"}</a><p class="bio-eyebrow">この端末で残した記録</p><h1>${recordId ? "写真と記録を確認する" : "自分の記録"}</h1><p class="bio-lead">写真は非公開です。自治体への共有は、記録ごとに選べます。</p></div><div id="bio-status" class="bio-status" role="status" aria-live="polite" hidden></div><div id="bio-receipt-content"><p role="status">記録を読み込んでいます。</p></div>
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
  const dateText = (value) => { const date = new Date(value); return Number.isNaN(date.getTime()) ? '日時不明' : new Intl.DateTimeFormat('ja-JP', {dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Tokyo'}).format(date) + '（日本時間）'; };
  const signalLabel = (value) => (config.profile.signals.find((item) => item.value === value) || {}).label || '気になるもの';
  const message = (text, error = false) => { const node = $('#bio-status'); if (!node) return; node.textContent = text; node.hidden = !text; node.setAttribute('role', error ? 'alert' : 'status'); node.dataset.zukanUiState = error ? 'error' : 'info'; if (error && node.scrollIntoView) node.scrollIntoView({block:'nearest'}); };
  const errorText = (error) => {
    const code = String(error.code || '');
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
    return '通信またはサービスの状態を確認できませんでした。入力はこの画面に残っています。もう一度お試しください。';
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
  const photoGrid = (photos) => '<div class="bio-photo-grid">' + (photos || []).map((photo, i) => { const url = privatePhotoUrl(photo.url); return url ? '<figure class="bio-photo"><a href="' + esc(url) + '" target="_blank" rel="noopener"><img src="' + esc(url) + '" alt="保存した写真 ' + (i + 1) + '" loading="lazy"></a><figcaption>写真 ' + (i + 1) + '・未確認</figcaption><a href="' + esc(url) + '" download>写真を保存</a></figure>' : ''; }).join('') + '</div>';
  const detailText = (record) => [
    'ZUKAN 外来種の記録（種の判定は未確認）', record.observedAt && '見つけた日時：' + dateText(record.observedAt),
    record.municipalityName && '市区町村：' + record.municipalityName, record.spotLabel && '場所の目印：' + record.spotLabel,
    record.signal && '気になったこと：' + signalLabel(record.signal), record.note && 'メモ：' + record.note,
    record.exactLocation && '記録した位置：' + record.exactLocation.lat + ', ' + record.exactLocation.lng,
    'これは自治体での正式受付を示すものではありません。'
  ].filter(Boolean).join('\n');
  const details = (record) => '<dl class="bio-detail-list">' + [
    record.observedAt && ['見つけた日時', dateText(record.observedAt)], record.municipalityName && ['市区町村', record.municipalityName],
    record.spotLabel && ['場所の目印', record.spotLabel], record.signal && ['気になったこと', signalLabel(record.signal)],
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
  // Always re-encode: the shared original-file fallback would preserve EXIF.
  const privatePhoto = async (file) => {
    if (file.size > 30 * 1024 * 1024) throw Object.assign(new Error('photo_too_large'), {code:'photo_too_large'});
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
      return {blob, hash:Array.from(new Uint8Array(digest)).map((n) => n.toString(16).padStart(2,'0')).join(''), url:URL.createObjectURL(blob), name:'photo.' + (encoded.mimeType === 'image/webp' ? 'webp' : 'jpg')};
    } catch (error) { if (!error.code) error.code = 'photo_decode_failed'; throw error; }
    finally { if (decoded && decoded.close) decoded.close(); if (canvas) { canvas.width = 1; canvas.height = 1; } }
  };
  let captureDirty = false;
  const setupCapture = () => {
    const form = $('#bio-capture-form'); if (!form) return;
    let photos = [], exactLocation = null, ready = false, submitting = false, preparing = false, sessionPromise, savedRecordId;
    const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); $('#bio-observed-at').value = now.toISOString().slice(0,16);
    setupPicker(form); form.addEventListener('input', () => { captureDirty = true; });
    const renderPhotos = () => {
      $('#bio-photo-preview').innerHTML = photos.map((photo, index) => '<figure class="bio-photo"><img src="' + esc(photo.url) + '" alt="送信前の写真 ' + (index + 1) + '"><figcaption>写真 ' + (index + 1) + '・未送信</figcaption><button type="button" data-remove-photo="' + index + '" aria-label="写真 ' + (index + 1) + 'を外す">外す</button></figure>').join('');
      $$('[data-remove-photo]', form).forEach((button) => button.addEventListener('click', () => { const removed = photos.splice(Number(button.dataset.removePhoto), 1)[0]; URL.revokeObjectURL(removed.url); captureDirty = true; renderPhotos(); }));
    };
    $('#bio-photos').addEventListener('change', async (event) => {
      const files = Array.from(event.target.files || []); event.target.value = ''; if (!files.length) return;
      if (photos.length + files.length > 6) { message('写真は6枚までです。いくつか外してから選んでください。', true); return; }
      preparing = true; busy(form, true); message('写真を準備しています。まだ送信していません。'); const prepared = [];
      try {
        for (const file of files) prepared.push(await privatePhoto(file));
        if (photos.concat(prepared).reduce((sum, photo) => sum + photo.blob.size, 0) > 18 * 1024 * 1024) throw Object.assign(new Error('photo_too_large'), {code:'photo_too_large'});
        photos.push(...prepared); captureDirty = true; renderPhotos(); message('写真を準備しました。内容を確認して保存してください。まだ送信していません。');
      } catch (error) { prepared.forEach((photo) => URL.revokeObjectURL(photo.url)); message(errorText(error), true); }
      finally { preparing = false; busy(form, false); }
    });
    $('#bio-location').addEventListener('click', () => {
      if (!navigator.geolocation) { $('#bio-location-state').textContent = '現在地を取得できない端末です。場所の目印だけでも保存できます。'; return; }
      $('#bio-location').disabled = true; $('#bio-location-state').textContent = '現在地を確認しています。';
      navigator.geolocation.getCurrentPosition((position) => {
        exactLocation = {lat:position.coords.latitude, lng:position.coords.longitude}; captureDirty = true;
        $('#bio-location-state').textContent = '現在地を取得しました。精度の目安：約' + Math.round(position.coords.accuracy) + 'm。実際の発見場所と違うときは位置を外してください。';
        $('#bio-location-clear').hidden = false; $('#bio-location').disabled = false;
      }, () => { $('#bio-location-state').textContent = '現在地を取得できませんでした。場所の目印だけでも保存できます。'; $('#bio-location').disabled = false; }, {enableHighAccuracy:false, timeout:10000, maximumAge:0});
    });
    $('#bio-location-clear').addEventListener('click', () => { exactLocation = null; captureDirty = true; $('#bio-location-clear').hidden = true; $('#bio-location-state').textContent = '位置情報を外しました。'; });
    const ensureSession = () => sessionPromise || (sessionPromise = request('/session').then((result) => { if (!result.ready) throw new Error('session_unavailable'); ready = true; }).catch((error) => { sessionPromise = null; throw error; }));
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (submitting || preparing || !form.reportValidity()) return;
      if (savedRecordId) { location.assign('/ja/biosecurity/records/' + encodeURIComponent(savedRecordId)); return; }
      if (!photos.length) { message('写真を1枚以上選んでください。', true); $('#bio-photos').focus(); return; }
      submitting = true; busy(form, true); message('写真と記録を保存しています。この画面を開いたままお待ちください。');
      try {
        if (!ready) await ensureSession();
        const payload = {profile_id:config.profile.id, observed_at:new Date($('#bio-observed-at').value).toISOString(), municipality_code:$('#bio-municipality-code').value, spot_label:$('#bio-spot').value.trim(), signal:$('#bio-signal').value, note:$('#bio-note').value.trim(), is_minor:$('#bio-is-minor').checked ? 'true':'false'};
        if (exactLocation) { payload.exact_lat = String(exactLocation.lat); payload.exact_lng = String(exactLocation.lng); }
        const key = await stableKey('capture', {payload, photos:photos.map((photo) => photo.hash)});
        const body = new FormData(); Object.entries(payload).forEach(([name, value]) => body.append(name, value)); body.append('idempotency_key', key);
        photos.forEach((photo, i) => body.append('photos', photo.blob, (i + 1) + '-' + photo.name));
        const result = await request('/records', {method:'POST', body}); if (!result.record || !result.record.id) throw new Error('receipt_missing');
        captureDirty = false; savedRecordId = result.record.id; location.assign('/ja/biosecurity/records/' + encodeURIComponent(savedRecordId));
      } catch (error) { message(errorText(error) + ' 保存の成否が不明でも、同じ内容の再試行で重複を防ぎます。', true); }
      finally { submitting = false; busy(form, false); }
    });
    ensureSession().catch(() => message('通信状態を確認できませんでした。写真と内容を入力し、保存時にもう一度試せます。', true));
    window.addEventListener('beforeunload', (event) => { if (captureDirty) { event.preventDefault(); event.returnValue = ''; } });
  };
  const sharePickerHtml = ${scriptJson(municipalityPicker(true))};
  const fieldLabels = {photos:'写真', observedAt:'日時', spotLabel:'場所の目印', note:'気づいたこと', exactLocation:'正確な位置'};
  const shareForm = (record) => '<details id="bio-share-panel"><summary>自治体と共有する（任意）</summary><div><p>選んだ自治体のZUKAN受信箱へ提供します。Web上には公開されません。</p><form id="bio-share-form" class="bio-form"><fieldset data-controls>' + sharePickerHtml +
    '<fieldset class="bio-field"><legend>提供する情報を選ぶ</legend><div class="bio-checks">' +
    '<label class="bio-check"><input type="checkbox" name="share_field" value="observedAt" checked disabled><span>見つけた日時（必須）</span></label>' +
    '<label class="bio-check"><input type="checkbox" name="share_field" value="photos"><span>写真 ' + Number(record.photoCount || (record.photos || []).length) + '枚</span></label>' +
    (record.spotLabel ? '<label class="bio-check"><input type="checkbox" name="share_field" value="spotLabel"><span>場所の目印</span></label>' : '') +
    (record.note ? '<label class="bio-check"><input type="checkbox" name="share_field" value="note"><span>気づいたこと</span></label>' : '') +
    (record.exactLocation ? '<label class="bio-check"><input type="checkbox" name="share_field" value="exactLocation"><span>正確な位置</span></label>' : '') +
    '</div><small>写真か「気づいたこと」のどちらかを含めてください。</small></fieldset>' +
    (record.isMinor ? '<label class="bio-check bio-minor"><input type="checkbox" id="bio-guardian-consent" required><span>保護者が、選んだ情報を自治体へ提供することを確認しました。</span></label>' : '') +
    '<p id="bio-share-summary" class="bio-note">共有先と情報を選んでください。</p><label class="bio-check"><input type="checkbox" id="bio-share-consent" required><span>共有先と選んだ情報を確認しました。写真に写る人などの権利にも配慮し、外来種対応のための提供に同意します。</span></label>' +
    '<button class="bio-action" type="submit">選んだ情報を共有する</button><p class="bio-note">自治体での正式受付とは異なります。担当者がまだ受信箱を利用していない場合もあります。急ぐ場合は自治体の公式窓口へ直接連絡してください。</p></fieldset></form></div></details>';
  let ownRecords = [], ownNextOffset = null;
  const loadReceipt = async (append = false) => {
    const target = $('#bio-receipt-content');
    try {
      if (!config.recordId) {
        const data = await request('/records' + (append === true && ownNextOffset != null ? '?offset=' + encodeURIComponent(ownNextOffset) : ''));
        const records = Array.isArray(data) ? data : data.records || data.items || [];
        ownRecords = append === true ? ownRecords.concat(records) : records; ownNextOffset = data.nextOffset == null ? null : data.nextOffset;
        target.innerHTML = ownRecords.length ? ownRecords.map((record) => '<article class="bio-record-item"><p class="bio-note">' + esc(dateText(record.observedAt)) + '</p><h2><a href="/ja/biosecurity/records/' + encodeURIComponent(record.id) + '">' + esc(record.spotLabel || record.municipalityName || signalLabel(record.signal)) + '</a></h2><p class="bio-note">非公開・写真' + Number(record.photoCount || 0) + '枚</p></article>').join('') : '<h2>この端末の記録はまだありません</h2><p>写真を保存すると、ここから見返せます。別の端末の記録や、保存期限を過ぎた記録は表示されません。</p><a class="bio-action" href="/ja/biosecurity/' + encodeURIComponent(config.profile.id) + '/capture">写真を残す</a>';
        if (ownNextOffset != null) { target.insertAdjacentHTML('beforeend', '<div class="bio-actions"><button id="bio-records-more" class="bio-action secondary" type="button">続きを読み込む</button></div>'); $('#bio-records-more').addEventListener('click', async () => { $('#bio-records-more').disabled = true; await loadReceipt(true); }); }
        return;
      }
      const data = await request('/records/' + encodeURIComponent(config.recordId)), record = data.record;
      if (!record || !record.id) throw new Error('record_missing');
      target.innerHTML = '<span class="bio-private">非公開で保存済み・種は未確認</span>' + details(record) + photoGrid(record.photos) +
        '<div class="bio-actions"><button class="bio-action secondary" id="bio-copy-record" type="button">通報用の文章をコピー</button>' + (safeHttps(record.officialUrl) ? '<a href="' + esc(safeHttps(record.officialUrl)) + '" target="_blank" rel="noopener noreferrer">公式の案内・連絡先を確認（別のタブ）</a>' : '') + '</div><p class="bio-note" style="margin-top:16px">コピーには、この画面の日時・場所・メモを含みます。必要な情報を自分で選んで公式窓口へお伝えください。</p>' +
        (record.expiresAt ? '<p class="bio-note">閲覧期限：' + esc(dateText(record.expiresAt)) + '。期限後は順次削除します。必要な写真は手元にも保存してください。</p>' : '') +
        '<section class="bio-section"><h2>自治体への共有状況</h2>' +
        ((record.shares || []).length ? record.shares.map((share) => '<article class="bio-record-item"><h3>' + esc(share.municipalityName) + '</h3><p>' +
        (share.status === 'withdrawn' ? '共有を取り消しました' : share.status === 'acknowledged' ? '自治体の担当者がZUKAN受信箱で確認しました' : share.recipientActive === false ? 'ZUKAN受信箱に共有済み・担当者が受信箱を開設すると閲覧できます' : 'ZUKAN受信箱に共有済み・担当者の確認待ち') + '</p><p class="bio-note">' + esc((share.fields || []).map((field) => fieldLabels[field] || '').filter(Boolean).join('・')) + '</p>' +
        (share.status !== 'withdrawn' ? '<button class="bio-action secondary" type="button" data-withdraw="' + esc(share.id) + '" data-version="' + Number(share.version) + '">共有を取り消す</button>' : '') + '</article>').join('') : '<p>まだどの自治体にも共有していません。</p>') +
        '<p class="bio-note">自治体での正式受付とは異なります。共有を取り消すと、この受信箱から新たに閲覧できなくなります。すでに保存された情報は回収できません。</p></section>' + shareForm(record) +
        '<details><summary>この記録を削除する</summary><div><p>写真と記録を削除し、自治体への共有を取り消します。削除は元に戻せません。すでに相手が保存した情報は回収できません。</p><button class="bio-action secondary" id="bio-delete-record" type="button">写真と記録を削除する</button></div></details>';
      $('#bio-copy-record').addEventListener('click', async () => { try { await navigator.clipboard.writeText(detailText(record)); message('通報用の文章をコピーしました。連絡先と内容を確認してからお使いください。'); } catch (_) { message('コピーできませんでした。表示している情報を選択してコピーしてください。', true); } });
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
        try { await post('/shares/' + encodeURIComponent(button.dataset.withdraw) + '/withdraw', {expectedVersion:Number(button.dataset.version)}); await loadReceipt(); message('共有を取り消しました。記録は非公開のまま残っています。'); }
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
        busy(form, true); message('選んだ情報の共有状態を確認しています。');
        try { payload.idempotencyKey = await stableKey('share.' + record.id, payload); await post('/records/' + encodeURIComponent(record.id) + '/share', payload); dropKey('share.' + record.id); await loadReceipt(); message('選んだ情報をZUKAN受信箱に共有しました。自治体での正式受付とは異なります。'); }
        catch (error) { message(errorText(error), true); busy(form, false); }
      });
    } catch (error) {
      if (append === true) { message(errorText(error), true); if ($('#bio-records-more')) $('#bio-records-more').disabled = false; return; }
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
        return '<article class="bio-record-item"><h2>' + esc(record.spotLabel || signalLabel(record.signal)) + '</h2><p class="bio-private">' + (item.status === 'acknowledged' ? '受信箱で確認済み' : 'まだ確認していない') + '・種は未確認</p>' + details(record) + photoGrid(record.photos) +
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
  const title = {guide:profile.title, capture:"写真と場所を残す", receipt:"自分の記録", municipalities:"自治体の受信箱を利用する", inbox:"共有された記録"}[view];
  const nonce = params.nonce ? ` nonce="${escape(params.nonce)}"` : "";
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="theme-color" content="#143f2e"><title>${escape(title)} | ZUKAN</title><meta name="description" content="${escape(view === "guide" ? profile.summary : "外来種の写真と記録を非公開で保存し、選んだ情報を自治体へ共有できます。")}">${view !== "guide" ? '<meta name="robots" content="noindex,nofollow,noarchive">' : ""}<link rel="icon" href="/assets/brand/zukan-favicon-32.png"><style>${BIOSECURITY_STYLES}</style></head>
  <body data-zukan-design="v1"><a class="bio-skip" href="#bio-main">本文へ</a><header class="bio-header"><div><a class="bio-brand" href="/ja/" aria-label="ZUKANのホーム"><img src="/assets/brand/zukan-app-icon-192.png" alt="" width="32" height="32"><img src="/assets/brand/zukan-wordmark.svg" alt="ZUKAN" width="92" height="29"></a><nav aria-label="外来種の記録"><a href="/ja/biosecurity">案内</a><a href="/ja/biosecurity/records">自分の記録</a></nav></div></header>
  <main id="bio-main" class="bio-main" data-view="${view}">${renderBiosecurityBody(view, {...params, profile})}<noscript><div class="bio-support"><p>写真の保存、記録の閲覧、自治体への共有にはJavaScriptが必要です。ブラウザの設定をご確認ください。</p><a href="${escape(officialUrl(profile.guideUrl) || "/ja/biosecurity")}">公式の案内を確認する</a></div></noscript></main>
  <footer class="bio-footer"><span>運営：IKIMON</span><a href="/ja/privacy">プライバシー</a><a href="/ja/terms">利用規約</a><a href="/ja/biosecurity/municipalities">自治体の担当者の方へ</a></footer>
  ${view === "guide" ? "" : `<script id="bio-config" type="application/json"${nonce}>${scriptJson({view,recordId:params.recordId || null,profile:{id:profile.id,signals:profile.signals}})}</script><script${nonce}>${BIOSECURITY_SCRIPT}</script>`}</body></html>`;
}
