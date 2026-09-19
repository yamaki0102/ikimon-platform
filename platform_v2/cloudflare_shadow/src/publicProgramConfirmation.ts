import type { PublicProgram } from "../../src/services/publicProgram";

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/\x27/gu, "&#39;");
}

export function renderPublicProgramConfirmationBody(input: {
  readonly program: PublicProgram;
  readonly authenticated: boolean;
  readonly loginHref: string;
}): string {
  const { program } = input;
  const profileLabel = program.profile === "stamp_rally"
    ? "スタンプラリー"
    : program.profile === "observation_event" ? "観察会" : "イベント";
  const stationItems = program.stations.map((station) => "<li>" + escapeHtml(station.name) + "</li>").join("");
  const stations = program.profile === "stamp_rally" ? "<h2>立ち寄り地点</h2><ul>" + stationItems + "</ul>" : "";  const summary = "<section class=\"evt-recap-shell\"><article class=\"evt-card\">"
    + "<span class=\"evt-eyebrow\">" + profileLabel + "</span>"
    + "<h1 class=\"evt-heading\">" + escapeHtml(program.title) + "</h1>"
    + "<dl><dt>開始</dt><dd>" + escapeHtml(program.startsAt) + "</dd>"
    + "<dt>終了</dt><dd>" + escapeHtml(program.endsAt || "未設定") + "</dd>"
    + "<dt>場所</dt><dd>" + escapeHtml(program.placeLabel) + "</dd>"
    + "<dt>説明</dt><dd>" + escapeHtml(program.description || "未設定") + "</dd>"
    + "<dt>参加条件</dt><dd>" + escapeHtml(program.conditions || "未設定") + "</dd></dl>"
    + stations
    + "<p class=\"evt-lead\">NOCOSILから渡されたのは公開候補データだけです。ZUKANのログイン権限で、ここから作成します。</p>"
    + "</article></section>";
  if (!input.authenticated) {
    return summary
      + "<section class=\"evt-recap-shell\"><article class=\"evt-card\">"
      + "<h2>主催者としてログインしてください</h2>"
      + "<p class=\"evt-lead\">NOCOSILのログイン状態や権限は引き継ぎません。</p>"
      + "<a class=\"evt-btn evt-btn-primary\" href=\"" + escapeHtml(input.loginHref) + "\">ZUKANにログインして確認する</a>"
      + "</article></section>";
  }

  const programJson = JSON.stringify(program)
    .replace(/</gu, "\\u003c")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
  const nextSuffix = program.profile === "stamp_rally" ? "rally" : "edit";
  return summary
    + "<section class=\"evt-recap-shell\"><article class=\"evt-card\">"
    + "<button type=\"button\" class=\"evt-btn evt-btn-primary\" data-program-confirm>ZUKANで作成して公開する</button>"
    + "<p class=\"evt-lead\" data-program-confirm-status aria-live=\"polite\">作成後も既存の編集・終了・Review導線を使えます。</p>"
    + "</article></section>"
    + "<script>(function(){'use strict';"
    + "var button=document.querySelector('[data-program-confirm]');"
    + "var status=document.querySelector('[data-program-confirm-status]');"
    + "var program=" + programJson + ";"
    + "if(!button)return;button.addEventListener('click',async function(){"
    + "if(button.disabled)return;button.disabled=true;if(status)status.textContent='ZUKANで権限と内容を確認しています…';"
    + "try{var response=await fetch('/api/v1/programs/receive',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({program:program,confirmPublication:true})});"
    + "var result=await response.json();if(!response.ok||!result.programId)throw new Error(result.error||'program_receive_failed');"
    + "window.location.assign('/events/'+encodeURIComponent(result.programId)+'/" + nextSuffix + "');"
    + "}catch(error){button.disabled=false;if(status)status.textContent='作成できませんでした。内容を確認してもう一度試してください。';}"
    + "});})();</script>";

}
