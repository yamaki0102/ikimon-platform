import {
  COMMON_EVENT_TEMPLATE_LABELS,
  isCommonEventTemplateKey,
  type CommonEventTemplateKey,
} from "../services/commonEventTemplateContract.js";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Authenticated organizer section; the Worker page supplies the main heading and CSP nonce. */
export function renderObservationEventTemplateOrganizer(input: {
  sessionId: string;
  sessionClosed?: boolean;
  templateKey?: CommonEventTemplateKey | null;
}): string {
  const templateKey = isCommonEventTemplateKey(input.templateKey) ? input.templateKey : "";
  return `<style>${ORGANIZER_STYLES}</style>
<section class="evt-template-organizer" data-event-template-organizer data-session-id="${escapeHtml(input.sessionId)}" data-session-closed="${input.sessionClosed === true}" data-template-key="${templateKey}" aria-label="企画の準備と進行">
  <header class="eto-heading"><div><p class="eto-eyebrow">主催者の操作</p><h2>企画の準備と進行</h2></div><button type="button" class="eto-button" data-organizer-refresh data-organizer-action="refresh">再読み込み</button></header>
  ${templateKey ? `<p class="eto-template">選択した企画：${escapeHtml(COMMON_EVENT_TEMPLATE_LABELS[templateKey])}</p>` : ""}
  <p>ミッションの内容を確認して参加者に公開し、ミッションの受付を開始します。公開前のミッションは下書きとして保存されます。</p>
  <p class="eto-status" data-organizer-status role="status" aria-live="polite" tabindex="-1">企画の状態を読み込んでいます。</p>
  <div data-organizer-course></div>
  <section class="eto-section" aria-label="ミッションの準備"><h3>ミッション</h3><div data-organizer-missions><p>読み込み中です。</p></div></section>
  <section class="eto-section" aria-label="参加者から届いた記録の確認"><h3>受付番号で記録を確認</h3><p>参加者の画面にある受付番号と、内容・件数を照合してください。「内容を確認して承認」は、このミッションへの記録を集計に反映する操作です。写真の公開や利用許可は別に確認します。</p><div data-organizer-reviews><p>確認待ちの記録を読み込んでいます。</p></div></section>
  <noscript><p>準備・進行の操作には JavaScript が必要です。ブラウザーの設定を確認して再読み込みしてください。</p></noscript>
</section><script>${observationEventTemplateOrganizerScript()}</script>`;
}

const ORGANIZER_STYLES = `
.evt-template-organizer{color:#18241c;background:#fff;border:1px solid #dde2dc;border-radius:8px;padding:24px;margin:24px 0;font-size:16px;line-height:1.7;overflow-wrap:anywhere}
.evt-template-organizer *{box-sizing:border-box}.evt-template-organizer [hidden]{display:none!important}
.evt-template-organizer h2{font-size:24px;margin:0;line-height:1.4}.evt-template-organizer h3{font-size:20px;margin:0 0 12px}.evt-template-organizer h4{font-size:18px;margin:0;line-height:1.5}.evt-template-organizer p{margin:8px 0 16px}
.evt-template-organizer .eto-heading,.evt-template-organizer .eto-row-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.evt-template-organizer .eto-eyebrow{font-size:14px;color:#536158;margin:0 0 4px}.evt-template-organizer .eto-template{font-weight:700}.evt-template-organizer .eto-section{margin-top:32px;border-top:1px solid #dde2dc;padding-top:24px}
.evt-template-organizer .eto-status{padding:12px 16px;background:#f2f5f0;border-left:4px solid #146c43}.evt-template-organizer .eto-status[data-error="true"]{border-color:#b42318;color:#8b1c13;background:#fff3f0}
.evt-template-organizer .eto-course{background:#f2f5f0;border-radius:8px;padding:16px}.evt-template-organizer .eto-label{display:inline-block;font-size:14px;font-weight:700;color:#354d3d;background:#e5ede3;padding:4px 8px;border-radius:4px}
.evt-template-organizer .eto-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.evt-template-organizer .eto-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-width:44px;min-height:46px;padding:10px 16px;background:#fff;border:1px solid #68746c;border-radius:4px;color:#18241c;font:inherit;font-weight:700;line-height:1.5;white-space:normal;text-align:center;cursor:pointer;text-decoration:none}
.evt-template-organizer .eto-button.eto-primary{background:#245c36;color:#fff;border-color:#245c36}.evt-template-organizer .eto-button:disabled{background:#eef0ec;border-color:#a0a8a2;color:#536158;cursor:not-allowed}.evt-template-organizer .eto-button:not(:disabled):hover{background:#e5ede3;color:#18241c}.evt-template-organizer .eto-button:focus-visible,.evt-template-organizer input:focus-visible,.evt-template-organizer textarea:focus-visible,.evt-template-organizer summary:focus-visible,.evt-template-organizer .eto-status:focus-visible{outline:3px solid #000;outline-offset:3px;box-shadow:0 0 0 6px #ffd43d}
.evt-template-organizer .eto-mission,.evt-template-organizer .eto-receipt{padding:20px 0;border-bottom:1px solid #dde2dc}.evt-template-organizer .eto-mission:last-child,.evt-template-organizer .eto-receipt:last-child{border-bottom:0}
.evt-template-organizer fieldset{min-width:0;margin:16px 0 0;padding:0;border:0}.evt-template-organizer .eto-fields{display:grid;grid-template-columns:minmax(0,1fr) 140px;gap:16px}.evt-template-organizer label{display:block;font-weight:700;margin-bottom:12px}.evt-template-organizer .eto-wide{grid-column:1/-1}
.evt-template-organizer input,.evt-template-organizer textarea{display:block;width:100%;min-width:0;min-height:46px;border:1px solid #68746c;border-radius:4px;padding:10px 12px;margin-top:4px;color:#18241c;background:#fff;font:inherit;line-height:1.5}.evt-template-organizer textarea{resize:vertical;min-height:100px}.evt-template-organizer fieldset:disabled input,.evt-template-organizer fieldset:disabled textarea{background:#f2f5f0;color:#536158}
.evt-template-organizer .eto-help{font-size:14px;color:#536158}.evt-template-organizer .eto-target{white-space:pre-wrap}.evt-template-organizer .eto-receipt-number{font-size:18px;letter-spacing:.04em}.evt-template-organizer details{margin-top:12px}.evt-template-organizer summary{cursor:pointer;min-height:44px;padding:8px 0}.evt-template-organizer .eto-receipt input{font-family:monospace;font-size:14px}.evt-template-organizer .eto-receipt time{white-space:normal}
@media(max-width:600px){.evt-template-organizer{padding:16px}.evt-template-organizer .eto-fields{grid-template-columns:minmax(0,1fr)}.evt-template-organizer .eto-heading{gap:12px}.evt-template-organizer .eto-actions .eto-button{flex:1 1 180px}.evt-template-organizer .eto-row-heading{gap:8px}}
@media(prefers-reduced-motion:reduce){.evt-template-organizer *{scroll-behavior:auto!important}}
@media(forced-colors:active){.evt-template-organizer .eto-button:focus-visible,.evt-template-organizer input:focus-visible,.evt-template-organizer textarea:focus-visible,.evt-template-organizer summary:focus-visible{outline:3px solid Highlight;box-shadow:none}}
`;

export function observationEventTemplateOrganizerScript(): string {
  return String.raw`(() => {
  const root = document.querySelector('[data-event-template-organizer]');
  if (!root || root.dataset.organizerBound === 'true') return;
  root.dataset.organizerBound = 'true';
  const courseNode = root.querySelector('[data-organizer-course]');
  const missionsNode = root.querySelector('[data-organizer-missions]');
  const reviewsNode = root.querySelector('[data-organizer-reviews]');
  const statusNode = root.querySelector('[data-organizer-status]');
  const refreshButton = root.querySelector('[data-organizer-refresh]');
  const base = '/api/v1/observation-events/' + encodeURIComponent(root.dataset.sessionId) + '/rally';
  const sessionClosed = root.dataset.sessionClosed === 'true';
  const templateSelected = Boolean(root.dataset.templateKey);
  const courseLabels = {draft:'下書き', preflight:'開始前・一時停止', live:'開始済み', closed:'終了'};
  const missionLabels = {draft:'下書き', published:'参加者に公開済み', paused:'一時停止', replaced:'差し替え済み', closed:'終了'};
  const edits = new Map();
  let snapshot = null;
  let busy = false;
  let uncertain = false;
  function escape(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function message(value, error = false) { statusNode.textContent = value; statusNode.setAttribute('data-error', String(error)); }
  function validId(value) { return typeof value === 'string' && value.length > 0 && value.length <= 256; }
  function isObject(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function disabled(value) { return value ? ' disabled' : ''; }
  function button(action, label, id = '', locked = false, primary = false) {
    return '<button type="button" class="eto-button' + (primary ? ' eto-primary' : '') + '" data-organizer-action="' + action + '" data-id="' + escape(id) + '"' + disabled(locked) + '>' + label + '</button>';
  }
  function readFields(form) {
    return {title:form.elements.namedItem('title').value, target:form.elements.namedItem('target').value, goal_count:form.elements.namedItem('goal_count').value};
  }
  function differs(mission, values) { return values && (values.title.trim() !== mission.title || values.target.trim() !== mission.target || Number(values.goal_count) !== mission.goalCount); }
  function timestamp(value) {
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? '受信日時を確認できません' : date.toLocaleString('ja-JP', {year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  function render() {
    refreshButton.disabled = busy;
    root.setAttribute('aria-busy', String(busy));
    if (!snapshot) return;
    const course = snapshot.course;
    const locked = busy || uncertain;
    const closed = sessionClosed || (course && course.status === 'closed');
    if (!course) {
      courseNode.innerHTML = '<div class="eto-course"><h3>企画のミッションはまだありません</h3><p>' + (templateSelected ? '選択した企画から、確認・編集できる下書きを準備します。' : 'このイベントには、共通企画のテンプレートが設定されていません。') + '</p>' + (templateSelected ? button('prepare','企画の下書きを準備','',locked || closed,true) : '') + (closed ? '<p>終了したイベントのため、新しい下書きは準備できません。</p>' : '') + '</div>';
    } else {
      const hasPublished = snapshot.missions.some(m => m.status === 'published');
      courseNode.innerHTML = '<div class="eto-course"><div class="eto-row-heading"><h3>' + escape(course.title) + '</h3><span class="eto-label">' + courseLabels[course.status] + '</span></div><p>' + (closed ? 'この企画は終了しています。届いている記録は引き続き確認できます。' : '公開したミッションの受付を開始・停止できます。受付には、イベントに設定した開催日時の条件も適用されます。') + '</p>' + (!closed ? '<div class="eto-actions">' + (course.status === 'live' ? button('pause-course','ミッションの受付を停止','',locked) : button('start','ミッションの受付を開始','',locked || !hasPublished,true)) + '</div>' + (!hasPublished ? '<p class="eto-help">まずミッションの内容を確認し、ひとつ以上を参加者に公開してください。</p>' : '') : '') + '</div>';
    }
    missionsNode.innerHTML = snapshot.missions.length ? snapshot.missions.map((mission, index) => {
      const id = escape(mission.missionId);
      const prefix = 'eto-mission-' + index;
      const fields = edits.get(mission.missionId) || {title:mission.title,target:mission.target,goal_count:String(mission.goalCount)};
      const controlsLocked = locked || closed;
      const editor = mission.status === 'draft' ? '<form data-organizer-edit data-mission-id="' + id + '"><fieldset' + disabled(controlsLocked) + '><div class="eto-fields"><label for="' + prefix + '-title">タイトル（必須）<input id="' + prefix + '-title" name="title" maxlength="160" required value="' + escape(fields.title) + '"></label><label for="' + prefix + '-goal">目標件数（必須）<input id="' + prefix + '-goal" name="goal_count" type="number" min="0.000001" step="any" required value="' + escape(fields.goal_count) + '"></label><label class="eto-wide" for="' + prefix + '-target">達成する内容（必須）<textarea id="' + prefix + '-target" name="target" maxlength="1200" required rows="3">' + escape(fields.target) + '</textarea></label></div><button class="eto-button" type="submit">下書きを保存</button></fieldset></form>' : '<p class="eto-target">' + escape(mission.target) + '</p><p>目標件数：' + escape(mission.goalCount) + '</p>';
      const action = mission.status === 'published' ? button('pause','ミッションを一時停止',mission.missionId,controlsLocked) : (mission.status === 'draft' || mission.status === 'paused') ? button('publish','内容を確認して参加者に公開',mission.missionId,controlsLocked,true) : '';
      return '<article class="eto-mission"><div class="eto-row-heading"><h4>' + (index + 1) + '. ' + escape(mission.title) + '</h4><span class="eto-label">' + missionLabels[mission.status] + '</span></div>' + editor + '<div class="eto-actions">' + action + '</div>' + (mission.status === 'draft' ? '<p class="eto-help">編集した内容は、下書きを保存してから公開してください。公開はこの企画の参加者への表示です。</p>' : '') + '</article>';
    }).join('') : '<p>ミッションはまだありません。</p>';
    reviewsNode.innerHTML = snapshot.reviewQueue.length ? '<p>表示中の確認待ち：' + snapshot.reviewQueue.length + '件' + (snapshot.reviewQueueHasMore ? '（古い順に100件。確認後に再読み込みすると、続きが表示されます）' : '') + '</p>' + snapshot.reviewQueue.map(receipt => {
      const mission = snapshot.missions.find(m => m.missionId === receipt.missionId);
      const number = receipt.submissionId.slice(-12);
      return '<article class="eto-receipt" data-organizer-receipt-row><h4>受付番号 <code class="eto-receipt-number" title="' + escape(receipt.submissionId) + '">' + escape(number) + '</code></h4><p><strong>' + escape(mission ? mission.title : 'ミッション名を確認できません') + '</strong><br>件数：' + escape(receipt.countValue) + '<br>受信：<time>' + escape(timestamp(receipt.createdAt)) + '</time></p><details><summary>照合用IDを表示</summary><label>照合用ID<input data-organizer-receipt readonly value="' + escape(receipt.submissionId) + '"></label>' + button('copy','照合用IDをコピー',receipt.submissionId) + '</details><div class="eto-actions">' + button('review-accept','内容を確認して承認',receipt.submissionId,locked,true) + button('review-reject','今回は集計に含めない',receipt.submissionId,locked) + '</div></article>';
    }).join('') : '<p>確認待ちの記録はありません。</p>';
  }
  function parseSnapshot(data) {
    const value = data && data.rally;
    if (!isObject(value) || !Array.isArray(value.missions) || value.missions.length > 1000 || !Array.isArray(value.reviewQueue) || value.reviewQueue.length > 100 || typeof value.reviewQueueHasMore !== 'boolean') throw new Error('企画の情報を正しく読み取れませんでした。');
    if (value.course !== null && (!isObject(value.course) || !validId(value.course.courseId) || typeof value.course.title !== 'string' || !Object.hasOwn(courseLabels, value.course.status))) throw new Error('企画の状態を確認できませんでした。');
    const missions = value.missions.map(m => {
      if (!isObject(m) || !validId(m.missionId) || typeof m.title !== 'string' || typeof m.target !== 'string' || !Number.isFinite(m.goalCount) || m.goalCount <= 0 || !Object.hasOwn(missionLabels,m.status)) throw new Error('ミッションの情報を確認できませんでした。');
      return {missionId:m.missionId,title:m.title,target:m.target,goalCount:m.goalCount,status:m.status};
    });
    const reviewQueue = value.reviewQueue.map(r => {
      if (!isObject(r) || !validId(r.submissionId) || !validId(r.missionId) || !Number.isFinite(r.countValue) || r.countValue <= 0 || r.reviewStatus !== 'pending' || typeof r.createdAt !== 'string') throw new Error('確認待ちの記録を読み取れませんでした。');
      return {submissionId:r.submissionId,missionId:r.missionId,countValue:r.countValue,reviewStatus:r.reviewStatus,createdAt:r.createdAt};
    });
    if (!value.course && (missions.length || reviewQueue.length)) throw new Error('企画とミッションの状態が一致していません。');
    return {course:value.course === null ? null : {courseId:value.course.courseId,title:value.course.title,status:value.course.status},missions,reviewQueue,reviewQueueHasMore:value.reviewQueueHasMore};
  }
  async function request(path = '', method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(base + path, {method, credentials:'include', cache:'no-store', signal:controller.signal, ...(body ? {headers:{'content-type':'application/json'},body:JSON.stringify(body)} : {})});
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? '主催者としてのログイン状態を確認してください。' : response.status === 409 ? '現在の状態では操作できません。開催日時と最新の状態を確認してください。' : '通信を完了できませんでした。');
      try { return await response.json(); } catch { throw new Error('応答を正しく読み取れませんでした。'); }
    } finally { clearTimeout(timeout); }
  }
  async function reload() {
    if (busy) return;
    busy = true; render(); message('企画の状態を読み込んでいます。');
    try { snapshot = parseSnapshot(await request()); uncertain = false; message('企画の状態を読み込みました。'); }
    catch (error) { uncertain = true; message('最新の情報を取得できませんでした。' + (snapshot ? '表示は前回取得した内容です。' : '') + '再読み込みしてください。', true); }
    finally { busy = false; render(); }
  }
  async function mutate(path, method, body, acknowledged, reflected, success, editedId) {
    if (busy || uncertain || !snapshot) return;
    busy = true; render(); message('操作を保存し、結果を確認しています。');
    try {
      const data = await request(path, method, body);
      if (!acknowledged(data)) throw new Error('保存結果を確認できませんでした。');
      const next = parseSnapshot(await request());
      if (!reflected(next)) throw new Error('更新後の状態を確認できませんでした。');
      snapshot = next;
      if (editedId) edits.delete(editedId);
      message(success);
    } catch (error) {
      uncertain = true;
      message('操作の結果を確認できませんでした。' + (error instanceof Error ? error.message : '') + '入力内容はこの画面に残っています。再読み込みして状態を確認してください。', true);
    } finally { busy = false; render(); statusNode.focus(); }
  }
  root.addEventListener('input', event => {
    const form = event.target.closest('form[data-organizer-edit]');
    if (form) edits.set(form.dataset.missionId, readFields(form));
  });
  root.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-organizer-edit]');
    if (!form) return;
    event.preventDefault();
    const id = form.dataset.missionId;
    const mission = snapshot && snapshot.missions.find(m => m.missionId === id);
    if (!mission || mission.status !== 'draft' || sessionClosed || snapshot.course.status === 'closed') return;
    const values = readFields(form);
    edits.set(id, values);
    const body = {action:'edit',title:values.title.trim(),target:values.target.trim(),goal_count:Number(values.goal_count)};
    if (!body.title || body.title.length > 160 || !body.target || body.target.length > 1200 || !Number.isFinite(body.goal_count) || body.goal_count <= 0) { message('タイトルは160文字以内、達成する内容は1200文字以内で入力し、目標件数を0より大きくしてください。',true); return; }
    const matches = m => m && m.missionId === id && m.status === 'draft' && m.title === body.title && m.target === body.target && m.goalCount === body.goal_count;
    await mutate('/missions/' + encodeURIComponent(id),'PATCH',body,data => matches(data && data.mission),next => matches(next.missions.find(m => m.missionId === id)),'下書きを保存しました。内容を確認して参加者に公開できます。',id);
  });
  root.addEventListener('click', async event => {
    const target = event.target.closest('button[data-organizer-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.organizerAction;
    const id = target.dataset.id;
    if (action === 'refresh') { await reload(); return; }
    if (action === 'copy') {
      try { await navigator.clipboard.writeText(id); message('照合用IDをコピーしました。'); }
      catch { const input = target.closest('[data-organizer-receipt-row]').querySelector('[data-organizer-receipt]'); input.focus(); input.select(); message('照合用IDを選択しました。コピーして使えます。'); }
      return;
    }
    if (busy || uncertain || !snapshot) return;
    if (action === 'review-accept' || action === 'review-reject') {
      if (!snapshot.reviewQueue.some(r => r.submissionId === id)) return;
      const reviewStatus = action === 'review-accept' ? 'accepted' : 'rejected';
      await mutate('/submissions/' + encodeURIComponent(id) + '/review','PATCH',{review_status:reviewStatus},data => data && data.submission && data.submission.submissionId === id && data.submission.reviewStatus === reviewStatus,next => !next.reviewQueue.some(r => r.submissionId === id),'受付番号 ' + id.slice(-12) + (reviewStatus === 'accepted' ? ' の内容を確認し、集計に反映しました。' : ' は今回の集計に含めない状態で保存しました。'));
      return;
    }
    if (sessionClosed || (snapshot.course && snapshot.course.status === 'closed')) return;
    if (action === 'prepare' && !snapshot.course && templateSelected) {
      let preparedId = '';
      await mutate('/course','POST',{action:'prepare_template'},data => {
        if (!data || !data.course || !validId(data.course.courseId) || data.course.status !== 'draft') return false;
        preparedId = data.course.courseId;
        return true;
      },next => next.course && next.course.courseId === preparedId && next.course.status === 'draft' && next.missions.length > 0,'企画の下書きを準備しました。各ミッションの内容を確認してください。');
    } else if (action === 'start' || action === 'pause-course') {
      if (!snapshot.course || (action === 'start' && !snapshot.missions.some(m => m.status === 'published'))) return;
      const status = action === 'start' ? 'live' : 'preflight';
      const courseId = snapshot.course.courseId;
      await mutate('/course','POST',{status},data => data && data.course && data.course.courseId === courseId && data.course.status === status,next => next.course && next.course.courseId === courseId && next.course.status === status,status === 'live' ? 'ミッションの受付を開始しました。設定済みの開催日時の条件も適用されます。' : 'ミッションの受付を停止しました。新しいミッションの提出を止めています。');
    } else if (action === 'publish' || action === 'pause') {
      const mission = snapshot.missions.find(m => m.missionId === id);
      if (!mission || (action === 'publish' ? !['draft','paused'].includes(mission.status) : mission.status !== 'published')) return;
      if (mission.status === 'draft' && differs(mission,edits.get(id))) { message('編集中の内容があります。先に「下書きを保存」を押してから公開してください。',true); statusNode.focus(); return; }
      const status = action === 'publish' ? 'published' : 'paused';
      await mutate('/missions/' + encodeURIComponent(id),'PATCH',{action},data => data && data.mission && data.mission.missionId === id && data.mission.status === status,next => next.missions.some(m => m.missionId === id && m.status === status),action === 'publish' ? 'ミッションを参加者に公開しました。' : 'ミッションを一時停止しました。');
    }
  });
  void reload();
})();`;
}
