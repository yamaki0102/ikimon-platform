import type { FastifyInstance } from "fastify";
import { getForwardedBasePath } from "../httpBasePath.js";
import { detectLangFromUrl } from "../i18n.js";
import { createContactProof } from "../services/contactSubmit.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function option(value: string, label: string): string {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

const MONITORING_STYLES = `
.mb-wrap{width:100%;max-width:1120px;box-sizing:border-box;margin:0 auto;padding:32px 18px 72px;color:#17211d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.mb-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(300px,.8fr);gap:22px;align-items:start;margin:8px 0 24px}
.mb-eyebrow{margin:0 0 8px;color:#0f766e;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0}
.mb-hero h1{margin:0;font-size:clamp(28px,3.4vw,42px);line-height:1.15;letter-spacing:0}
.mb-lead{margin:14px 0 0;color:#46554f;font-size:16px;line-height:1.8}
.mb-panel{border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:18px}
.mb-panel h2{margin:0 0 12px;font-size:19px}
.mb-notice{border:1px solid #f4c76f;background:#fff8e7;color:#5f4307;border-radius:8px;padding:13px 14px;line-height:1.75;font-size:13px}
.mb-price{display:grid;gap:10px}
.mb-price-row{display:flex;justify-content:space-between;gap:14px;border:1px solid #dbe7e2;border-radius:8px;background:#fff;padding:12px 14px}
.mb-price-row strong{font-size:20px;color:#0f5132}
.mb-note{font-size:12px;color:#64746d;line-height:1.7}
.mb-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.72fr);gap:18px;align-items:start}
.mb-form{display:grid;gap:14px}
.mb-field{display:grid;gap:6px;font-size:13px;color:#43514b;font-weight:700}
.mb-field input,.mb-field select,.mb-field textarea{width:100%;box-sizing:border-box;border:1px solid #cbd8d2;border-radius:7px;padding:10px 11px;font:inherit;color:#17211d;background:#fff}
.mb-field textarea{min-height:118px;resize:vertical}
.mb-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.mb-check{display:flex;gap:9px;align-items:flex-start;justify-content:flex-start;font-size:13px;line-height:1.6;color:#34433d}
.mb-check input[type="checkbox"]{width:18px!important;min-width:18px;height:18px;flex:0 0 18px;margin:3px 0 0;appearance:auto}
.mb-button{min-height:42px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #0f766e;border-radius:7px;background:#0f766e;color:#fff;font-weight:800;text-decoration:none;padding:0 15px;cursor:pointer}
.mb-status{min-height:20px;font-size:13px;color:#0f766e;font-weight:800}
.mb-list{margin:0;padding-left:18px;color:#46554f;line-height:1.8;font-size:13px}
@media (min-width:900px){.mb-nowrap{white-space:nowrap}}
@media (max-width:760px){.mb-hero,.mb-grid,.mb-two{grid-template-columns:1fr}.mb-wrap{padding-top:18px}.mb-hero h1{font-size:30px}}
`;

function renderMonitoringLeadForm(contactProof: string): string {
  return `
<main class="mb-wrap">
  <section class="mb-hero">
    <div>
      <p class="mb-eyebrow">IKIMON Monitoring</p>
      <h1>地域の観察記録を、<span class="mb-nowrap">継続できるモニタリングへ。</span></h1>
      <p class="mb-lead">IKIMON Monitoring は、地域・企業・自治体の観察記録を、根拠付き確定記録、候補記録、観察努力量、次のモニタリング計画へ整理するためのサービスとして準備中です。</p>
    </div>
    <aside class="mb-price" aria-label="価格">
      <div class="mb-notice"><strong>提供準備中・先行相談受付</strong><br>このフォームは契約申込みの正式受付、請求、地域育成価格の承認ではありません。内容を確認し、準備状況や個別相談についてIKIMONからメールでご連絡します。</div>
      <div class="mb-price-row"><span>標準価格</span><strong>100万円/年</strong></div>
      <div class="mb-price-row"><span>地域育成価格候補</span><strong>50万円/年</strong></div>
      <p class="mb-note">地域育成価格は、過疎地域・条件不利地域など公的基準を参考に、契約前にIKIMON管理者が確認します。地域の継続体制が整った場合、標準価格へ移行する可能性があります。</p>
    </aside>
  </section>
  <section class="mb-grid">
    <form class="mb-panel mb-form" data-monitoring-lead-form>
      <h2>先行相談フォーム</h2>
      <input type="hidden" name="contactProof" value="${escapeHtml(contactProof)}" />
      <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />
      <input type="text" name="spamTrap" tabindex="-1" autocomplete="off" style="position:absolute;left:-10000px" aria-hidden="true" />
      <div class="mb-two">
        <label class="mb-field">組織名<input name="organizationName" required maxlength="200" /></label>
        <label class="mb-field">組織種別<select name="applicantKind" required>
          ${option("自治体", "自治体")}
          ${option("企業", "企業")}
          ${option("NPO/地域団体", "NPO/地域団体")}
          ${option("学校/教育機関", "学校/教育機関")}
          ${option("認定パートナー候補", "認定パートナー候補")}
          ${option("その他", "その他")}
        </select></label>
      </div>
      <div class="mb-two">
        <label class="mb-field">担当者名<input name="contactName" required maxlength="160" /></label>
        <label class="mb-field">メールアドレス<input name="contactEmail" required type="email" maxlength="220" /></label>
      </div>
      <div class="mb-two">
        <label class="mb-field">都道府県 任意<input name="prefecture" maxlength="80" /></label>
        <label class="mb-field">市区町村 任意<input name="municipality" maxlength="120" /></label>
      </div>
      <label class="mb-field">対象地域・対象フィールド<input name="targetAreaLabel" required maxlength="500" placeholder="例: 〇〇市北部の里山、工場緑地、学校周辺" /></label>
      <label class="mb-field">想定価格区分<select name="pricePlanChoice" required>
        ${option("標準価格 100万円/年", "標準価格 100万円/年")}
        ${option("地域育成価格候補 50万円/年", "地域育成価格候補 50万円/年")}
        ${option("未定・相談したい", "未定・相談したい")}
      </select></label>
      <label class="mb-field">相談内容 / 利用目的<textarea name="useCase" required maxlength="4000" placeholder="どの地域で、誰が記録し、どんな資料や判断に使いたいかを書いてください。"></textarea></label>
      <label class="mb-field">パートナーコード 任意<input name="partnerCode" maxlength="64" /></label>
      <label class="mb-check"><input type="checkbox" name="supportExpectationAck" required /> 標準サポートはメール/フォーム対応を予定しており、Zoom・電話サポートは標準に含まれないことを理解しました。</label>
      <label class="mb-check"><input type="checkbox" name="noGuaranteeAck" required /> 補助金採択、認証取得、TNFD対応完了、希少種発見、専門家同定相当は保証されないことを理解しました。</label>
      <label class="mb-check"><input type="checkbox" name="recordBoundaryAck" required /> 確定記録と候補記録は分けて扱われ、候補記録は正式な種リスト/指標に自動では混ざらないことを理解しました。</label>
      <button class="mb-button" type="submit">先行相談を送る</button>
      <div class="mb-status" data-monitoring-lead-status></div>
    </form>
    <aside class="mb-panel">
      <h2>準備中の内容</h2>
      <ul class="mb-list">
        <li>契約対象地域ごとの記録・地図・アナリティクス</li>
        <li>確定記録、候補記録、根拠不足候補の分離</li>
        <li>観察努力量と空白地帯の整理</li>
        <li>PDF/CSV の標準出力</li>
        <li>認定パートナーによる地域伴走</li>
      </ul>
      <h2 style="margin-top:22px">標準には含まれないもの</h2>
      <ul class="mb-list">
        <li>現地調査の代行</li>
        <li>申請書作成や採択保証</li>
        <li>認証取得やTNFD対応完了の保証</li>
        <li>専門家同定と同等であることの保証</li>
      </ul>
    </aside>
  </section>
</main>
${leadScript()}`;
}

function leadScript(): string {
  return `<script>
(function(){
  var form = document.querySelector('[data-monitoring-lead-form]');
  if (!form) return;
  var status = document.querySelector('[data-monitoring-lead-status]');
  function value(name){ var el = form.elements[name]; return el && typeof el.value === 'string' ? el.value : ''; }
  function checked(name){ var el = form.elements[name]; return Boolean(el && el.checked); }
  function lines(items){ return items.map(function(item){ return item[0] + ': ' + item[1]; }).join('\\n'); }
  form.addEventListener('submit', async function(event){
    event.preventDefault();
    if (status) status.textContent = '送信中です';
    var message = [
      'IKIMON Monitoring 先行相談',
      '',
      lines([
        ['組織種別', value('applicantKind')],
        ['対象地域', value('targetAreaLabel')],
        ['都道府県', value('prefecture')],
        ['市区町村', value('municipality')],
        ['想定価格区分', value('pricePlanChoice')],
        ['パートナーコード', value('partnerCode') || 'なし'],
        ['準備中/非契約フォーム理解', 'はい'],
        ['メール/フォームサポート理解', checked('supportExpectationAck') ? 'はい' : 'いいえ'],
        ['保証しない事項理解', checked('noGuaranteeAck') ? 'はい' : 'いいえ'],
        ['確定/候補記録の分離理解', checked('recordBoundaryAck') ? 'はい' : 'いいえ']
      ]),
      '',
      '相談内容:',
      value('useCase')
    ].join('\\n');
    try {
      var res = await fetch('/api/v1/contact/submit', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          category: 'partnership',
          name: value('contactName'),
          email: value('contactEmail'),
          organization: value('organizationName'),
          message: message,
          sourceUrl: location.href,
          userAgent: navigator.userAgent,
          website: value('website'),
          spamTrap: value('spamTrap'),
          contactProof: value('contactProof')
        })
      });
      var data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'submit_failed');
      form.reset();
      if (status) status.textContent = '送信しました。準備状況と個別相談についてメールでご連絡します。';
    } catch (error) {
      var message = error && error.message ? error.message : 'submit_failed';
      var display = '送信に失敗しました。時間をおいてもう一度お試しください。';
      if (message === 'contact_antispam_failed') display = '数秒待ってから、もう一度送信してください。';
      if (message === 'invalid_email') display = 'メールアドレスを確認してください。';
      if (message === 'message_too_short') display = '相談内容をもう少し詳しく入力してください。';
      if (status) status.textContent = display;
    }
  });
})();
</script>`;
}

export async function registerMonitoringBusinessRoutes(app: FastifyInstance): Promise<void> {
  app.get("/for-business/monitoring/apply", async (request, reply) => {
    const basePath = requestBasePath(request as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(requestUrl(request));
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      lang,
      title: "IKIMON Monitoring 先行相談 — ZUKAN",
      description: "地域・企業・自治体向け IKIMON Monitoring の提供準備中ページと先行相談フォーム。",
      currentPath: "/for-business/monitoring/apply",
      extraStyles: MONITORING_STYLES,
      body: renderMonitoringLeadForm(createContactProof()),
    });
  });
}

export const monitoringBusinessRouteContract = {
  publicApplyPath: "/for-business/monitoring/apply",
  submitEndpoint: "/api/v1/contact/submit",
  readinessCopy: [
    "提供準備中・先行相談受付",
    "契約申込みの正式受付、請求、地域育成価格の承認ではありません",
    "先行相談を送る",
  ],
  requiredAcknowledgementCopy: [
    "メール/フォーム対応",
    "保証されない",
    "確定記録と候補記録",
  ],
} as const;
