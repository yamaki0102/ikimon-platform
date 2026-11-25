import {
  APP_EXPERIENCE_STYLES,
  renderAppExperienceHeader,
  renderAppExperienceNavigation,
  renderAppExperienceQuickCamera
} from "../../src/ui/appExperience";

export type WaitlistLang = "ja" | "en" | "es" | "pt-br";

type WaitlistCopy = {
  htmlLang: string;
  title: string;
  eyebrow: string;
  heading: string;
  lead: string;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  submitting: string;
  successNew: string;
  successAlready: string;
  invalidEmail: string;
  errorGeneric: string;
  loginPrompt: string;
  loginLink: string;
  note: string;
};

const WAITLIST_COPY: Record<WaitlistLang, WaitlistCopy> = {
  ja: {
    htmlLang: "ja",
    title: "ウェイティングリスト | Ikimon Zukan",
    eyebrow: "ウェイティングリスト",
    heading: "新規登録は順番にご案内しています",
    lead: "現在、一般の新規アカウント作成を一時停止しています。メールアドレスをご登録いただくと、準備が整い次第順番にご案内します。",
    emailLabel: "メールアドレス",
    emailPlaceholder: "you@example.com",
    submit: "ウェイティングリストに登録",
    submitting: "登録中...",
    successNew: "ウェイティングリストに登録しました。ご案内までお待ちください。",
    successAlready: "このメールアドレスはすでにウェイティングリストに登録されています。",
    invalidEmail: "有効なメールアドレスを入力してください。",
    errorGeneric: "登録できませんでした。しばらくしてからもう一度お試しください。",
    loginPrompt: "すでにアカウントをお持ちですか？",
    loginLink: "ログインはこちら",
    note: "公開マップ・生き物の記録の閲覧は登録なしでもご利用いただけます。"
  },
  en: {
    htmlLang: "en",
    title: "Waitlist | Ikimon Zukan",
    eyebrow: "Waitlist",
    heading: "New sign-ups open in order",
    lead: "Public account registration is currently paused. Leave your email address to join the waitlist and we will notify you when your spot opens.",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    submit: "Join the waitlist",
    submitting: "Submitting...",
    successNew: "You are on the waitlist. Thank you for your patience.",
    successAlready: "This email address is already on the waitlist.",
    invalidEmail: "Please enter a valid email address.",
    errorGeneric: "Could not submit right now. Please try again shortly.",
    loginPrompt: "Already have an account?",
    loginLink: "Sign in",
    note: "You can still browse public maps and wildlife records without signing in."
  },
  es: {
    htmlLang: "es",
    title: "Lista de espera | Ikimon Zukan",
    eyebrow: "Lista de espera",
    heading: "Los nuevos registros se abren por orden",
    lead: "El registro público está pausado temporalmente. Deja tu correo electrónico para unirte a la lista de espera.",
    emailLabel: "Correo electrónico",
    emailPlaceholder: "tu@ejemplo.com",
    submit: "Unirse a la lista de espera",
    submitting: "Enviando...",
    successNew: "Te has unido a la lista de espera.",
    successAlready: "Este correo ya está en la lista de espera.",
    invalidEmail: "Introduce un correo electrónico válido.",
    errorGeneric: "No se pudo completar el registro. Inténtalo de nuevo más tarde.",
    loginPrompt: "¿Ya tienes una cuenta?",
    loginLink: "Iniciar sesión",
    note: "Aún puedes explorar los mapas y registros públicos sin registrarte."
  },
  "pt-br": {
    htmlLang: "pt-br",
    title: "Lista de espera | Ikimon Zukan",
    eyebrow: "Lista de espera",
    heading: "Novos cadastros abrem por ordem",
    lead: "O cadastro público está temporariamente pausado. Deixe seu e-mail para entrar na lista de espera.",
    emailLabel: "E-mail",
    emailPlaceholder: "voce@exemplo.com",
    submit: "Entrar na lista de espera",
    submitting: "Enviando...",
    successNew: "Você entrou na lista de espera.",
    successAlready: "Este e-mail já está na lista de espera.",
    invalidEmail: "Digite um e-mail válido.",
    errorGeneric: "Não foi possível enviar agora. Tente novamente em instantes.",
    loginPrompt: "Já tem uma conta?",
    loginLink: "Entrar",
    note: "Você ainda pode explorar mapas e registros públicos sem conta."
  }
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeWaitlistLang(value: string | null | undefined): WaitlistLang {
  if (value === "en" || value === "es" || value === "pt-br") return value;
  return "ja";
}

export function renderZukanWaitlistPage(
  rawLang: string,
  options?: { cspNonce?: string; sourcePath?: string }
): string {
  const lang = normalizeWaitlistLang(rawLang);
  const copy = WAITLIST_COPY[lang];
  const cspNonce = options?.cspNonce ?? "";
  const sourcePath = options?.sourcePath ?? `/${lang}/waitlist`;
  const loginHref = `/${lang}/login`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(copy.htmlLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(copy.title)}</title>
  <style nonce="${escapeHtml(cspNonce)}">
    ${APP_EXPERIENCE_STYLES}
    .waitlist-shell {
      max-width: 520px;
      margin: 28px auto 96px;
      padding: 0 16px;
    }
    .waitlist-card {
      background: #ffffff;
      border: 0;
      border-radius: 0;
      padding: 8px 4px;
      box-shadow: none;
    }
    .waitlist-eyebrow {
      display: inline-block;
      font-size: 14px;
      font-weight: 700;
      color: #143f2e;
      background: #e8efea;
      border-radius: 999px;
      padding: 4px 12px;
      margin-bottom: 12px;
    }
    .waitlist-card h1 {
      margin: 0 0 10px;
      font-size: 1.75rem;
      line-height: 1.4;
      color: var(--ink, #17211b);
    }
    .waitlist-lead {
      margin: 0 0 20px;
      font-size: 1rem;
      line-height: 1.8;
      color: #4f5d54;
    }
    .waitlist-form {
      display: grid;
      gap: 12px;
    }
    .waitlist-label {
      display: grid;
      gap: 6px;
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--ink, #17211b);
    }
    .waitlist-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 52px;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid #dde2dc;
      font-size: 1rem;
      background: #fff;
      color: #17211b;
    }
    .waitlist-hp {
      position: absolute;
      left: -9999px;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .waitlist-submit {
      appearance: none;
      border: 0;
      border-radius: 16px;
      min-height: 52px;
      padding: 13px 18px;
      font-size: 1.05rem;
      font-weight: 700;
      cursor: pointer;
      background: #143f2e;
      color: #ffffff;
    }
    .waitlist-submit:disabled {
      opacity: 0.65;
      cursor: wait;
    }
    .waitlist-status {
      min-height: 1.4em;
      font-size: 0.92rem;
      line-height: 1.5;
      margin-top: 12px;
    }
    .waitlist-status[data-tone="ok"] {
      color: #143f2e;
      font-weight: 700;
      background: #e8efea;
      border-radius: 14px;
      padding: 14px 16px;
    }
    .waitlist-status[data-tone="error"] {
      color: #991b1b;
      font-weight: 600;
    }
    .waitlist-footer {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--border, #e4ebe5);
      display: grid;
      gap: 8px;
      font-size: 0.88rem;
      color: var(--muted, #4b5a51);
    }
    .waitlist-footer a {
      color: #143f2e;
      font-weight: 700;
    }
  </style>
</head>
<body>
  ${renderAppExperienceHeader(lang, -1, false, "waitlist-main", { currentPath: sourcePath })}
  <main id="waitlist-main" class="waitlist-shell">
    <section class="waitlist-card" aria-labelledby="waitlist-heading">
      <span class="waitlist-eyebrow">${escapeHtml(copy.eyebrow)}</span>
      <h1 id="waitlist-heading">${escapeHtml(copy.heading)}</h1>
      <p class="waitlist-lead">${escapeHtml(copy.lead)}</p>
      <form id="zukan-waitlist-form" class="waitlist-form" action="/api/v1/waitlist" method="post" novalidate>
        <label class="waitlist-label">
          <span>${escapeHtml(copy.emailLabel)}</span>
          <input
            class="waitlist-input"
            type="email"
            name="email"
            required
            autocomplete="email"
            placeholder="${escapeHtml(copy.emailPlaceholder)}"
          >
        </label>
        <input class="waitlist-hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="waitlist-submit" type="submit">${escapeHtml(copy.submit)}</button>
      </form>
      <div id="zukan-waitlist-status" class="waitlist-status" role="status" aria-live="polite"></div>
      <div class="waitlist-footer">
        <div>${escapeHtml(copy.loginPrompt)} <a href="${escapeHtml(loginHref)}">${escapeHtml(copy.loginLink)}</a></div>
        <div>${escapeHtml(copy.note)}</div>
      </div>
    </section>
  </main>
  ${renderAppExperienceNavigation(lang, -1, "bottom")}${renderAppExperienceQuickCamera(lang, { nonce: cspNonce })}
  <script nonce="${escapeHtml(cspNonce)}">
    (function () {
      var form = document.getElementById("zukan-waitlist-form");
      var statusEl = document.getElementById("zukan-waitlist-status");
      if (!form || !statusEl) return;
      var submitBtn = form.querySelector("button[type=submit]");
      var emailInput = form.querySelector("input[name=email]");
      var hpInput = form.querySelector("input[name=website]");
      var copy = ${JSON.stringify({
        submit: copy.submit,
        submitting: copy.submitting,
        successNew: copy.successNew,
        successAlready: copy.successAlready,
        invalidEmail: copy.invalidEmail,
        errorGeneric: copy.errorGeneric
      })};
      form.addEventListener("submit", async function (event) {
        event.preventDefault();
        var email = emailInput ? String(emailInput.value || "").trim() : "";
        if (!email || email.indexOf("@") < 1) {
          statusEl.dataset.tone = "error";
          statusEl.textContent = copy.invalidEmail;
          return;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = copy.submitting;
        }
        statusEl.dataset.tone = "";
        statusEl.textContent = "";
        try {
          var res = await fetch("/api/v1/waitlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              email: email,
              locale: ${JSON.stringify(lang)},
              sourcePath: ${JSON.stringify(sourcePath)},
              website: hpInput ? String(hpInput.value || "") : ""
            })
          });
          var data = await res.json().catch(function () { return {}; });
          if (!res.ok || !data || data.ok !== true) {
            statusEl.dataset.tone = "error";
            statusEl.textContent = data && data.error === "invalid_email" ? copy.invalidEmail : copy.errorGeneric;
          } else {
            statusEl.dataset.tone = "ok";
            statusEl.textContent = data.alreadyRegistered ? copy.successAlready : copy.successNew;
            if (!data.alreadyRegistered && emailInput) emailInput.value = "";
          }
        } catch (_err) {
          statusEl.dataset.tone = "error";
          statusEl.textContent = copy.errorGeneric;
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = copy.submit;
          }
        }
      });
    })();
  </script>
</body>
</html>`;
}
