import type { PublicProgram } from "../../src/services/publicProgram";

type Language = "ja" | "en" | "es" | "pt-br";
const COPY = {
  ja: { title: "公開内容を確認", event: "イベント", observation: "観察会", rally: "スタンプラリー", stations: "立ち寄り地点", start: "開始", end: "終了", zone: "開催地の時刻帯", place: "場所", description: "説明", conditions: "参加条件", unset: "未設定", boundary: "NOCOSILから渡されたのは公開候補データだけです。ZUKANのログイン権限で、ここから作成します。", loginTitle: "主催者としてログインしてください", loginBoundary: "NOCOSILのログイン状態や権限は引き継ぎません。", login: "ZUKANにログインして確認する", publish: "ZUKANで作成して公開する", ready: "作成後も既存の編集・終了・Review導線を使えます。", pending: "ZUKANで権限と内容を確認しています…", unknown: "作成結果を確認できませんでした。もう一度押すと、同じ企画の作成・公開状態を確認します。", expired: "ログイン状態または権限を確認できません。ZUKANにログインして、同じ内容から続けてください。", conflict: "引き継いだ内容が既存の企画と一致しません。NOCOSILで内容を確認し、もう一度開いてください。" },
  en: { title: "Review publication", event: "Event", observation: "Observation event", rally: "Stamp rally", stations: "Stops", start: "Start", end: "End", zone: "Event time zone", place: "Place", description: "Description", conditions: "Participation conditions", unset: "Not set", boundary: "Only candidate public data came from NOCOSIL. Creation uses your ZUKAN permissions.", loginTitle: "Sign in as the organizer", loginBoundary: "NOCOSIL sign-in and permissions are not transferred.", login: "Sign in to ZUKAN and review", publish: "Create and publish in ZUKAN", ready: "After creation, you can use the existing edit, close and review actions.", pending: "Checking permissions and content in ZUKAN…", unknown: "Could not confirm the result. Try again to check creation and publication of the same program.", expired: "Your session or permissions could not be verified. Sign in to ZUKAN to continue with the same content.", conflict: "This content does not match the existing program. Check it in NOCOSIL and open the handoff again." },
  es: { title: "Revisar publicación", event: "Evento", observation: "Evento de observación", rally: "Ruta de sellos", stations: "Paradas", start: "Inicio", end: "Fin", zone: "Zona horaria del evento", place: "Lugar", description: "Descripción", conditions: "Condiciones de participación", unset: "Sin definir", boundary: "De NOCOSIL solo se han recibido datos candidatos a publicación. La creación usa tus permisos de ZUKAN.", loginTitle: "Inicia sesión como organizador", loginBoundary: "La sesión y los permisos de NOCOSIL no se transfieren.", login: "Iniciar sesión en ZUKAN y revisar", publish: "Crear y publicar en ZUKAN", ready: "Tras la creación puedes usar las opciones existentes de edición, cierre y revisión.", pending: "Comprobando permisos y contenido en ZUKAN…", unknown: "No se pudo confirmar el resultado. Vuelve a intentarlo para comprobar la creación y publicación del mismo programa.", expired: "No se pudieron verificar la sesión o los permisos. Inicia sesión en ZUKAN para continuar con el mismo contenido.", conflict: "El contenido no coincide con el programa existente. Revísalo en NOCOSIL y vuelve a abrir la transferencia." },
  "pt-br": { title: "Revisar publicação", event: "Evento", observation: "Evento de observação", rally: "Circuito de carimbos", stations: "Paradas", start: "Início", end: "Fim", zone: "Fuso horário do evento", place: "Local", description: "Descrição", conditions: "Condições de participação", unset: "Não definido", boundary: "Somente dados candidatos à publicação vieram do NOCOSIL. A criação usa suas permissões do ZUKAN.", loginTitle: "Entre como organizador", loginBoundary: "A sessão e as permissões do NOCOSIL não são transferidas.", login: "Entrar no ZUKAN e revisar", publish: "Criar e publicar no ZUKAN", ready: "Após a criação, você pode usar as opções existentes de edição, encerramento e revisão.", pending: "Verificando permissões e conteúdo no ZUKAN…", unknown: "Não foi possível confirmar o resultado. Tente novamente para verificar a criação e publicação do mesmo programa.", expired: "Não foi possível verificar a sessão ou as permissões. Entre no ZUKAN para continuar com o mesmo conteúdo.", conflict: "O conteúdo não corresponde ao programa existente. Confira no NOCOSIL e abra a transferência novamente." },
} satisfies Record<Language, Record<string, string>>;

export function publicProgramConfirmationTitle(lang: Language): string { return COPY[lang].title; }

export function publicProgramConfirmationError(lang: Language): { heading: string; body: string } {
  return {
    ja: { heading: "企画候補を読み込めません", body: "NOCOSILからもう一度、公開内容の確認を開いてください。" },
    en: { heading: "Could not load the program", body: "Open publication review again from NOCOSIL." },
    es: { heading: "No se pudo cargar el programa", body: "Vuelve a abrir la revisión de publicación desde NOCOSIL." },
    "pt-br": { heading: "Não foi possível carregar o programa", body: "Abra novamente a revisão de publicação a partir do NOCOSIL." },
  }[lang];
}

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
  readonly lang?: Language;
}): string {
  const { program } = input;
  const lang = input.lang ?? "ja";
  const copy = COPY[lang];
  const time = (value: string) => {
    if (!value) return copy.unset;
    const locale = lang === "pt-br" ? "pt-BR" : lang;
    const formatted = new Intl.DateTimeFormat(locale, { timeZone: program.timezone,
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(new Date(value));
    return '<time datetime="' + escapeHtml(value) + '">' + escapeHtml(formatted) + '</time>';
  };
  const profileLabel = program.profile === "stamp_rally"
    ? copy.rally
    : program.profile === "observation_event" ? copy.observation : copy.event;
  const stationItems = program.stations.map((station) => "<li>" + escapeHtml(station.name) + "</li>").join("");
  const stations = program.profile === "stamp_rally" ? "<h2>" + copy.stations + "</h2><ul>" + stationItems + "</ul>" : "";
  const summary = "<section class=\"evt-recap-shell\"><article class=\"evt-card\">"
    + "<span class=\"evt-eyebrow\">" + profileLabel + "</span>"
    + "<h1 class=\"evt-heading\">" + escapeHtml(program.title) + "</h1>"
    + "<dl><dt>" + copy.start + "</dt><dd>" + time(program.startsAt) + "</dd>"
    + "<dt>" + copy.end + "</dt><dd>" + time(program.endsAt) + "</dd>"
    + "<dt>" + copy.zone + "</dt><dd>" + escapeHtml(program.timezone) + "</dd>"
    + "<dt>" + copy.place + "</dt><dd>" + escapeHtml(program.placeLabel) + "</dd>"
    + "<dt>" + copy.description + "</dt><dd>" + escapeHtml(program.description || copy.unset) + "</dd>"
    + "<dt>" + copy.conditions + "</dt><dd>" + escapeHtml(program.conditions || copy.unset) + "</dd></dl>"
    + stations
    + "<p class=\"evt-lead\">" + copy.boundary + "</p>"
    + "</article></section>";
  if (!input.authenticated) {
    return summary
      + "<section class=\"evt-recap-shell\"><article class=\"evt-card\">"
      + "<h2>" + copy.loginTitle + "</h2>"
      + "<p class=\"evt-lead\">" + copy.loginBoundary + "</p>"
      + "<a class=\"evt-btn evt-btn-primary\" href=\"" + escapeHtml(input.loginHref) + "\">" + copy.login + "</a>"
      + "</article></section>";
  }

  const programJson = JSON.stringify(program)
    .replace(/</gu, "\\u003c")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
  const nextSuffix = program.profile === "stamp_rally" ? "rally" : "edit";
  return summary
    + "<section class=\"evt-recap-shell\"><article class=\"evt-card\">"
    + "<button type=\"button\" class=\"evt-btn evt-btn-primary\" data-program-confirm>" + copy.publish + "</button>"
    + "<p class=\"evt-lead\" data-program-confirm-status aria-live=\"polite\">" + copy.ready + "</p>"
    + "<div data-program-confirm-login hidden><a class=\"evt-btn\" href=\"" + escapeHtml(input.loginHref) + "\">" + copy.login + "</a></div>"
    + "</article></section>"
    + "<script>(function(){'use strict';"
    + "var button=document.querySelector('[data-program-confirm]');"
    + "var status=document.querySelector('[data-program-confirm-status]');"
    + "var login=document.querySelector('[data-program-confirm-login]');"
    + "var copy=" + JSON.stringify({ pending: copy.pending, unknown: copy.unknown, expired: copy.expired, conflict: copy.conflict }) + ";"
    + "var program=" + programJson + ";"
    + "if(!button)return;button.addEventListener('click',async function(){"
    + "if(button.disabled)return;button.disabled=true;if(login)login.hidden=true;if(status)status.textContent=copy.pending;"
    + "var completed=false;var controller=new AbortController();var timeout=setTimeout(function(){controller.abort();},15000);"
    + "try{var response=await fetch('/api/v1/programs/receive',{method:'POST',credentials:'same-origin',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({program:program,confirmPublication:true})});"
    + "if(response.status===401||response.status===403){if(status)status.textContent=copy.expired;if(login)login.hidden=false;return;}"
    + "if(response.status===409){if(status)status.textContent=copy.conflict;return;}"
    + "var result=await response.json();if(!response.ok||result.programId!==program.requestId||result.publicationState!=='public')throw new Error('program_result_unconfirmed');"
    + "completed=true;window.location.assign('/events/'+encodeURIComponent(result.programId)+'/" + nextSuffix + "');"
    + "}catch(error){completed=false;if(status)status.textContent=copy.unknown;}finally{clearTimeout(timeout);button.disabled=completed;}"
    + "});})();</script>";

}
