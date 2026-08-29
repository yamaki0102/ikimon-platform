type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;
type ClarityFn = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    __taishoDeckAnalytics?: boolean;
  }
}

const GA_ID = import.meta.env.VITE_GA_ID || "G-NCL0M1VJZ2";
const CLARITY_ID = import.meta.env.VITE_CLARITY_ID || "wl2ezvfqbh";
const EVENT_ENDPOINT = import.meta.env.VITE_DECK_EVENT_ENDPOINT || "../deck-events";
const SESSION_KEY = "taisho115:deckSession";
const VARIANT_KEY = "taisho115:deckVariant";

function cleanParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key.slice(0, 40), typeof value === "string" ? value.slice(0, 120) : value])
  );
}

function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = `deck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(SESSION_KEY, next);
  return next;
}

export function getVariant() {
  const requested = new URLSearchParams(window.location.search).get("variant")?.toUpperCase();
  if (requested === "A" || requested === "B") {
    localStorage.setItem(VARIANT_KEY, requested);
    return requested;
  }
  const stored = localStorage.getItem(VARIANT_KEY);
  if (stored === "A" || stored === "B") return stored;
  const assigned = Math.random() < 0.5 ? "A" : "B";
  localStorage.setItem(VARIANT_KEY, assigned);
  return assigned;
}

function injectScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function initAnalytics(variant: string) {
  if (window.__taishoDeckAnalytics) return;
  window.__taishoDeckAnalytics = true;

  if (GA_ID) {
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtagShim(...args: unknown[]) {
        window.dataLayer?.push(args);
      };
    injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`);
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      send_page_view: false,
      page_title: "透明の法則 音声つき説明スライド",
      deck_variant: variant
    });
  }

  if (CLARITY_ID) {
    window.clarity =
      window.clarity ||
      function clarityShim(...args: unknown[]) {
        (window.clarity as ClarityFn).q?.push(args);
      };
    const clarityQueue = window.clarity as ClarityFn;
    clarityQueue.q = clarityQueue.q || [];
    injectScript(`https://www.clarity.ms/tag/${encodeURIComponent(CLARITY_ID)}`);
    window.clarity("set", "deck_variant", variant);
  }

  trackEvent("variant_assigned", { variant });
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  const variant = localStorage.getItem(VARIANT_KEY) || "unknown";
  const payload = {
    event: eventName,
    variant,
    sessionId: getSessionId(),
    path: window.location.pathname,
    title: document.title,
    occurredAt: new Date().toISOString(),
    params: cleanParams(params)
  };

  window.gtag?.("event", eventName, {
    deck_variant: variant,
    ...payload.params
  });
  window.clarity?.("event", eventName);
  for (const [key, value] of Object.entries(payload.params)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      window.clarity?.("set", key, String(value));
    }
  }

  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(EVENT_ENDPOINT, blob)) return;
    }
    void fetch(EVENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    });
  } catch {
    // External analytics still receive the event; local collection is best effort.
  }
}
