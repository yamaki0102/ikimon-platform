import type { Env } from "./core/env";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

const ALLOWED_VOICE_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

const MAX_VOICE_BASE64_LEN = 8 * 1024 * 1024;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export type RecordInputMode = "standard" | "memo" | "voice";

export function resolveRecordInputMode(url: URL): RecordInputMode {
  const raw = url.searchParams.get("mode");
  if (raw === "memo" || raw === "voice") return raw;
  return "standard";
}

export const ZUKAN_RECORD_INPUT_STYLES = `
  .zt-mode-bar{display:flex;flex-wrap:wrap;gap:4px;margin:0 0 12px;min-width:0;border-bottom:1px solid var(--line)}
  .zt-mode-tab,.zt-mode-tab:visited{min-height:44px;padding:8px 14px;display:inline-flex;align-items:center;justify-content:center;border-radius:0;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--muted);text-decoration:none;font-weight:700;font-size:15px}
  .zt-mode-tab[aria-current="page"],.zt-mode-tab[aria-current="page"]:visited{border-bottom-color:var(--teal);color:var(--teal)}
  .zt-field-input-row{display:flex;align-items:flex-start;gap:8px;min-width:0}
  .zt-field-input-row textarea,.zt-field-input-row input{flex:1;min-width:0}
  .zt-voice-mic-btn{min-height:44px;min-width:44px;padding:8px 12px;border-radius:10px;border:1px solid var(--teal);background:var(--mint);color:var(--teal);font:inherit;font-size:14px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap}
  .zt-voice-mic-btn[aria-pressed="true"]{background:#b42318;border-color:#b42318;color:#fff}
  .zt-voice-status{margin:6px 0 0;font-size:13px;color:var(--muted);min-height:20px}
  @media (prefers-reduced-motion:reduce){
    .zt-mode-bar,.zt-mode-bar *,.zt-voice-mic-btn{transition:none!important;animation:none!important}
  }
`;

export function renderRecordModeBarHtml(options: {
  lang: "ja" | "en" | "es" | "pt-br";
  prefix: string;
  activeMode: RecordInputMode;
}): string {
  const isEn = options.lang === "en";
  const tabs: Array<{ mode: RecordInputMode; href: string; label: string }> = [
    { mode: "standard", href: `${options.prefix}/record`, label: isEn ? "Photo / Camera" : "写真・カメラ" },
    { mode: "memo", href: `${options.prefix}/record?mode=memo`, label: isEn ? "Memo only" : "メモだけ" },
    { mode: "voice", href: `${options.prefix}/record?mode=voice`, label: isEn ? "Voice memo" : "声でメモ" },
  ];
  return `<nav class="zt-mode-bar" data-record-mode-bar="c3-c11-c12" aria-label="${isEn ? "Record input modes" : "記録の入力方法"}">
    ${tabs
      .map(
        (tab) =>
          `<a class="zt-mode-tab" href="${escapeHtml(tab.href)}"${options.activeMode === tab.mode ? ' aria-current="page"' : ""}>${escapeHtml(tab.label)}</a>`
      )
      .join("")}
  </nav>`;
}

export function renderRecordVoiceButtonHtml(options: {
  targetSelector: string;
  lang: "ja" | "en" | "es" | "pt-br";
}): string {
  const isEn = options.lang === "en";
  const label = isEn ? "Voice input" : "声で入力";
  return `<button type="button" class="zt-voice-mic-btn" data-voice-mic-target="${escapeHtml(options.targetSelector)}" aria-pressed="false">${escapeHtml(label)}</button>`;
}

export const ZUKAN_RECORD_INPUT_SCRIPT = `
  (() => {
    const mode = new URLSearchParams(location.search).get("mode") || "standard";
    const form = document.getElementById("record-form");
    const submitPanel = document.getElementById("record-submit-panel");
    if ((mode === "memo" || mode === "voice") && form) {
      form.hidden = false;
      if (submitPanel) submitPanel.hidden = false;
    }
    const statusEl = document.getElementById("record-voice-status");
    const micButtons = document.querySelectorAll("[data-voice-mic-target]");
    let activeRecorder = null;
    let activeStream = null;

    function appendText(target, text) {
      if (!target || !text) return;
      const cur = String(target.value || "").trim();
      target.value = cur ? cur + "\\n" + text : text;
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }

    for (const btn of micButtons) {
      btn.addEventListener("click", async () => {
        const selector = btn.getAttribute("data-voice-mic-target");
        const target = selector ? document.querySelector(selector) : null;
        if (!target) return;

        if (activeRecorder && activeRecorder.state === "recording") {
          activeRecorder.stop();
          btn.setAttribute("aria-pressed", "false");
          if (statusEl) statusEl.textContent = "文字にしています...";
          return;
        }

        if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === "function" && typeof MediaRecorder !== "undefined") {
          try {
            activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const chunks = [];
            const recorder = new MediaRecorder(activeStream);
            activeRecorder = recorder;
            recorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) chunks.push(ev.data);
            };
            recorder.onstop = async () => {
              try {
                if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
                const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
                const buf = await blob.arrayBuffer();
                const bytes = new Uint8Array(buf);
                let bin = "";
                for (let i = 0; i < bytes.length; i += 0x8000) {
                  bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
                }
                const resp = await fetch("/api/v1/record/voice-transcribe", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ mimeType: blob.type || "audio/webm", base64Data: btoa(bin) })
                });
                const payload = await resp.json().catch(() => null);
                if (resp.ok && payload && payload.transcript) {
                  appendText(target, payload.transcript);
                  if (statusEl) statusEl.textContent = "音声をメモに入れました。";
                } else if (statusEl) {
                  statusEl.textContent = "文字起こしに失敗しました。";
                }
              } catch {
                if (statusEl) statusEl.textContent = "文字起こしに失敗しました。";
              } finally {
                activeRecorder = null;
                activeStream = null;
              }
            };
            recorder.start();
            btn.setAttribute("aria-pressed", "true");
            if (statusEl) statusEl.textContent = "録音中です。もう一度押すと停止します。";
            return;
          } catch {
            // Fall through to Web Speech API
          }
        }

        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRec) {
          const rec = new SpeechRec();
          rec.lang = document.documentElement.lang || "ja-JP";
          rec.interimResults = false;
          btn.setAttribute("aria-pressed", "true");
          if (statusEl) statusEl.textContent = "音声を聞いています...";
          rec.onresult = (ev) => {
            const text = ev.results && ev.results[0] && ev.results[0][0] ? ev.results[0][0].transcript : "";
            appendText(target, text);
            if (statusEl) statusEl.textContent = "音声をメモに入れました。";
          };
          rec.onerror = () => {
            if (statusEl) statusEl.textContent = "音声入力を使えませんでした。";
          };
          rec.onend = () => {
            btn.setAttribute("aria-pressed", "false");
          };
          rec.start();
        } else if (statusEl) {
          statusEl.textContent = "この端末では音声入力を利用できません。";
        }
      });
    }
  })();
`;

export async function handleRecordVoiceTranscribe(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const payload = await request.json().catch(() => null) as {
    mimeType?: unknown;
    base64Data?: unknown;
    lang?: unknown;
  } | null;
  if (!payload || typeof payload.mimeType !== "string" || typeof payload.base64Data !== "string") {
    return jsonResponse({ ok: false, error: "invalid_audio_payload" }, 400);
  }

  const baseMime = payload.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!ALLOWED_VOICE_MIME_TYPES.has(baseMime)) {
    return jsonResponse({ ok: false, error: "unsupported_audio_mime" }, 400);
  }
  const base64Data = payload.base64Data.trim();
  if (!base64Data || base64Data.length > MAX_VOICE_BASE64_LEN) {
    return jsonResponse({ ok: false, error: "invalid_audio_size" }, 400);
  }

  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ ok: false, error: "voice_transcription_unavailable" }, 503);
  }

  try {
    const resp = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(10000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "自然観察の音声メモをそのまま自然な日本語（または話された言語）で文字起こししてください。JSON {\"transcript\":\"...\"} のみ返してください。",
                },
                { inlineData: { mimeType: baseMime, data: base64Data } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
            maxOutputTokens: 300,
          },
        }),
      }
    );
    if (!resp.ok) {
      return jsonResponse({ ok: false, error: "voice_transcription_failed" }, 502);
    }
    const result = await resp.json().catch(() => null) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    } | null;
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(rawText) as { transcript?: unknown };
    const transcript = typeof parsed?.transcript === "string" ? parsed.transcript.trim().slice(0, 2000) : "";
    if (!transcript) {
      return jsonResponse({ ok: false, error: "voice_transcription_empty" }, 422);
    }
    return jsonResponse({ ok: true, transcript, source: "gemini" }, 200);
  } catch {
    return jsonResponse({ ok: false, error: "voice_transcription_failed" }, 502);
  }
}
