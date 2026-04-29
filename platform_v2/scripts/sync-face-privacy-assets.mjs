import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const platformRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(platformRoot, "..");
const packageRoot = join(platformRoot, "node_modules", "@mediapipe", "tasks-vision");
const targetRoot = join(repoRoot, "upload_package", "public_html", "assets", "face-privacy");
const targetMediaPipeRoot = join(targetRoot, "mediapipe");
const targetWasmRoot = join(targetMediaPipeRoot, "wasm");

const files = [
  ["vision_bundle.mjs", join(packageRoot, "vision_bundle.mjs"), join(targetMediaPipeRoot, "vision_bundle.mjs")],
  ["vision_wasm_internal.js", join(packageRoot, "wasm", "vision_wasm_internal.js"), join(targetWasmRoot, "vision_wasm_internal.js")],
  ["vision_wasm_internal.wasm", join(packageRoot, "wasm", "vision_wasm_internal.wasm"), join(targetWasmRoot, "vision_wasm_internal.wasm")],
  ["vision_wasm_module_internal.js", join(packageRoot, "wasm", "vision_wasm_module_internal.js"), join(targetWasmRoot, "vision_wasm_module_internal.js")],
  ["vision_wasm_module_internal.wasm", join(packageRoot, "wasm", "vision_wasm_module_internal.wasm"), join(targetWasmRoot, "vision_wasm_module_internal.wasm")],
  ["vision_wasm_nosimd_internal.js", join(packageRoot, "wasm", "vision_wasm_nosimd_internal.js"), join(targetWasmRoot, "vision_wasm_nosimd_internal.js")],
  ["vision_wasm_nosimd_internal.wasm", join(packageRoot, "wasm", "vision_wasm_nosimd_internal.wasm"), join(targetWasmRoot, "vision_wasm_nosimd_internal.wasm")],
];

if (!existsSync(packageRoot)) {
  throw new Error("Missing @mediapipe/tasks-vision. Run npm install in platform_v2 first.");
}

const modelPath = join(targetRoot, "blaze_face_short_range.tflite");
if (!existsSync(modelPath)) {
  throw new Error("Missing local face model at upload_package/public_html/assets/face-privacy/blaze_face_short_range.tflite.");
}

mkdirSync(targetWasmRoot, { recursive: true });
for (const [label, src, dest] of files) {
  if (!existsSync(src)) {
    throw new Error(`Missing MediaPipe asset: ${label}`);
  }
  if (label.endsWith(".js")) {
    const normalized = readFileSync(src, "utf8")
      .replace(/[ \t]+(\r?\n)/g, "$1")
      .replace(/(\r?\n)+$/g, "\n");
    writeFileSync(dest, normalized, "utf8");
  } else {
    copyFileSync(src, dest);
  }
}

console.log(`Synced ${files.length} face privacy runtime assets to ${targetRoot}`);
