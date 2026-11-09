/** Canonical design tokens for the ik and ZUKAN foundations. */

// ik foundation tokens and shared interaction styles.
export const FRONTEND_FOUNDATION_V1 = {
  version: "1.1.0",
  motion: {
    fast: "160ms",
    normal: "220ms",
    slow: "320ms",
    easeStandard: "cubic-bezier(0.2, 0, 0.2, 1)",
    easeEnter: "cubic-bezier(0, 0, 0.2, 1)",
    easeExit: "cubic-bezier(0.4, 0, 1, 1)",
  },
  radius: {
    sm: "10px",
    md: "16px",
    lg: "24px",
    pill: "999px",
  },
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
  },
  tapTarget: "44px",
  focusRing: "3px",
} as const;

export const FRONTEND_FOUNDATION_CSS = `
:root {
  --ik-motion-fast: 160ms;
  --ik-motion-normal: 220ms;
  --ik-motion-slow: 320ms;
  --ik-ease-standard: cubic-bezier(0.2, 0, 0.2, 1);
  --ik-ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --ik-ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --ik-radius-sm: 10px;
  --ik-radius-md: 16px;
  --ik-radius-lg: 24px;
  --ik-radius-pill: 999px;
  --ik-space-xs: 4px;
  --ik-space-sm: 8px;
  --ik-space-md: 12px;
  --ik-space-lg: 16px;
  --ik-space-xl: 24px;
  --ik-space-xxl: 32px;
  --ik-tap-target: 44px;
  --ik-focus-ring: 3px;
}

.ik-ui-action {
  min-height: var(--ik-tap-target);
  transition:
    transform var(--ik-motion-fast) var(--ik-ease-standard),
    opacity var(--ik-motion-fast) var(--ik-ease-standard),
    background-color var(--ik-motion-normal) var(--ik-ease-standard),
    border-color var(--ik-motion-normal) var(--ik-ease-standard),
    box-shadow var(--ik-motion-normal) var(--ik-ease-standard);
}
.ik-ui-action:active { transform: scale(.98); }
.ik-ui-action:focus-visible {
  outline: var(--ik-focus-ring) solid currentColor;
  outline-offset: 3px;
}
.ik-ui-surface {
  border-radius: var(--ik-radius-md);
  transition:
    transform var(--ik-motion-normal) var(--ik-ease-standard),
    box-shadow var(--ik-motion-normal) var(--ik-ease-standard);
}
.ik-ui-enter {
  animation: ik-ui-enter var(--ik-motion-slow) var(--ik-ease-enter) both;
}
@keyframes ik-ui-enter {
  from { opacity: 0; transform: translateY(8px) scale(.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .ik-ui-action,
  .ik-ui-surface { transition-duration: 0.01ms !important; }
  .ik-ui-enter { animation: none !important; }
}
`;

// ZUKAN semantic design tokens and shared visual styles.
/**
 * Shared visual foundation for ZUKAN's materialized Node pages and native
 * Worker readers. Keep this dependency-free: individual renderers retain
 * their layout and state semantics, while consuming the same visual meaning.
 */
export const ZUKAN_DESIGN_FOUNDATION_STYLES = `
:root{
  color-scheme:light;
  --zukan-action-primary:#245c3a;
  --zukan-action-hover:#1c492e;
  --zukan-action-active:#153923;
  --zukan-action-capture:#b94f18;
  --zukan-action-capture-hover:#963f13;
  --zukan-action-capture-active:#78320f;
  --zukan-on-action-primary:#ffffff;
  --zukan-text-primary:#17251b;
  --zukan-text-secondary:#40564a;
  --zukan-surface-base:#fff9ec;
  --zukan-surface-subtle:#fff9ec;
  --zukan-border-control:#52685a;
  --zukan-border-decorative:#dde2dc;
  --zukan-link:#245c3a;
  --zukan-link-visited:#663399;
  --zukan-status-success:#146c43;
  --zukan-status-warning:#8a4b00;
  --zukan-status-error:#b42318;
  --zukan-status-info:#0055ad;
  --zukan-focus-yellow-300:#ffffff;
  --zukan-focus-outline:#087f7c;
  --zukan-font-sans:"Noto Sans JP","Hiragino Sans","Yu Gothic UI",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --zukan-space-1:4px;
  --zukan-space-2:8px;
  --zukan-space-3:12px;
  --zukan-space-4:16px;
  --zukan-space-6:24px;
  --zukan-space-8:32px;
  --zukan-space-10:40px;
  --zukan-space-14:56px;
  --zukan-radius-control:4px;
  --zukan-radius-content:8px;
  --zukan-control-min:44px;
  --zukan-content-max:1200px;
}
:root[data-zukan-theme="dark"]{
  color-scheme:dark;
  --zukan-action-primary:#86d9a2;
  --zukan-action-hover:#66e6f2;
  --zukan-action-active:#66e6f2;
  --zukan-action-capture:#b94f18;
  --zukan-action-capture-hover:#963f13;
  --zukan-action-capture-active:#78320f;
  --zukan-on-action-primary:#082014;
  --zukan-text-primary:#f2f8f3;
  --zukan-text-secondary:#c3d5c7;
  --zukan-surface-base:#111a14;
  --zukan-surface-subtle:#1b261e;
  --zukan-border-control:#91a096;
  --zukan-border-decorative:#39463d;
  --zukan-link:#a7f3c0;
  --zukan-link-visited:#a7f3c0;
  --zukan-status-success:#69d09a;
  --zukan-status-warning:#ffc36b;
  --zukan-status-error:#ff8b82;
  --zukan-status-info:#8abfff;
  --zukan-focus-yellow-300:#111a14;
  --zukan-focus-outline:#66e6f2;
}
[data-zukan-theme="dark"] :is(.zukan-app-brand img,.brand-lockup-img){content:url("/assets/brand/zukan-lockup-dark.svg")}
[data-zukan-theme="dark"] :is(.site-header,.zukan-app-header){background:var(--zukan-surface-base)!important}
body[data-zukan-design],body[data-zukan-app-experience]{
  background:var(--zukan-surface-base);
  color:var(--zukan-text-primary);
  font-family:var(--zukan-font-sans);
  font-size:16px;
  line-height:1.7;
}
body[data-zukan-design] *,body[data-zukan-app-experience] *{box-sizing:border-box}
body[data-zukan-design] :is(button,input,textarea,select),body[data-zukan-app-experience] :is(button,input,textarea,select){font:inherit}
body[data-zukan-design] :is(button,[role=button],input:not([type=hidden],[type=checkbox],[type=radio]),select,textarea,summary),body[data-zukan-app-experience] :is(button,[role=button],input:not([type=hidden],[type=checkbox],[type=radio]),select,textarea,summary){min-height:var(--zukan-control-min)}
body[data-zukan-design] :is(h1,h2,h3),body[data-zukan-app-experience] :is(h1,h2,h3){overflow-wrap:anywhere;text-wrap:balance;line-height:1.35}
body[data-zukan-design] :is(a,button,input,textarea,select,summary):focus-visible,body[data-zukan-app-experience] :is(a,button,input,textarea,select,summary):focus-visible{outline:2px solid var(--zukan-focus-outline);outline-offset:2px;box-shadow:0 0 0 4px var(--zukan-focus-yellow-300)}
body[data-zukan-design] a:not([class]),body[data-zukan-app-experience] a:not([class]){color:var(--zukan-link);text-decoration-thickness:max(1px,.08em);text-underline-offset:.15em}
body[data-zukan-design] a:not([class]):visited,body[data-zukan-app-experience] a:not([class]):visited{color:var(--zukan-link-visited)}
body[data-zukan-design] :is([role=status],[role=alert],[data-zukan-ui-state]){display:block;border-inline-start:4px solid var(--zukan-status-info);padding:var(--zukan-space-3);border-radius:var(--zukan-radius-content);background:var(--zukan-surface-subtle)}
body[data-zukan-design] [role=alert],body[data-zukan-design] [data-zukan-ui-state=error]{border-inline-start-color:var(--zukan-status-error)}
body[data-zukan-design] [data-zukan-ui-state=warning],body[data-zukan-design] [data-zukan-ui-state=permission]{border-inline-start-color:var(--zukan-status-warning)}
body[data-zukan-design] [data-zukan-ui-state=success]{border-inline-start-color:var(--zukan-status-success)}
@media(forced-colors:active){body[data-zukan-design] :focus-visible,body[data-zukan-app-experience] :focus-visible{outline:2px solid CanvasText;outline-offset:2px;box-shadow:none}}
@media(prefers-reduced-motion:reduce){body[data-zukan-design] *,body[data-zukan-app-experience] *{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important;transition-duration:.01ms!important}}
`;

export type FrontendFoundationPattern =
  | "action"
  | "async-action"
  | "loading"
  | "success"
  | "error"
  | "empty"
  | "toast"
  | "modal"
  | "sheet"
  | "dropdown"
  | "tabs"
  | "search"
  | "validation"
  | "skeleton"
  | "confirmation";

export const FRONTEND_FOUNDATION_PATTERNS: readonly FrontendFoundationPattern[] = [
  "action", "async-action", "loading", "success", "error", "empty",
  "toast", "modal", "sheet", "dropdown", "tabs", "search",
  "validation", "skeleton", "confirmation",
];
