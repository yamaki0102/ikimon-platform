export const FRONTEND_FOUNDATION_V1 = {
  version: "1.0.0",
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
