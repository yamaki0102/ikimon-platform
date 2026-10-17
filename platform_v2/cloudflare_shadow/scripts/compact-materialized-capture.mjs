import { transformSync } from "esbuild";

// This runs only after app.inject/onSend has applied source-choice and draft
// recovery patches. Those patches intentionally match the readable source.
// Keep syntax and identifier transforms off: this change removes delivery
// whitespace without changing names, folding branches or moving expressions.
export function compactMaterializedCapture(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)];
  const captures = scripts.filter(([, attributes, source]) =>
    !/\bsrc\s*=/iu.test(attributes)
    && !/\btype\s*=/iu.test(attributes)
    && /\bconst\s+CAMERA_START_TIMEOUT_MS\s*=\s*10000\s*;/u.test(source)
    && /\bconst\s+DB_NAME\s*=\s*['"]ikimon-record-draft['"]\s*;/u.test(source)
    && source.includes("[data-global-record-camera-sheet]")
    && source.includes("[data-global-record-trigger]"));
  if (captures.length === 0) return html;
  if (captures.length !== 1) throw new Error("materialized_capture_script_ambiguous");
  const capture = captures[0];
  const source = capture[2];
  const { code } = transformSync(source, {
    loader: "js",
    platform: "browser",
    charset: "utf8",
    minifyWhitespace: true,
    minifyIdentifiers: false,
    minifySyntax: false,
    legalComments: "inline",
  });
  // Do not rely on the minifier's current default to escape HTML script ends.
  const safeCode = code.replace(/<\/script/giu, "<\\/script");
  const openingLength = capture[0].indexOf(">") + 1;
  const start = capture.index + openingLength;
  return html.slice(0, start) + safeCode + html.slice(start + source.length);
}
