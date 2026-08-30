import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const slidesPath = path.join(root, "src", "demo-slides.json");
const slides = JSON.parse(fs.readFileSync(slidesPath, "utf8"));

const normalized = slides.map((slide, index) => {
  const dialogue = Array.isArray(slide.dialogue) ? slide.dialogue : [];
  return {
    ...slide,
    narration: dialogue.map((item) => item.text).join(" "),
    audio: `slide-${String(index + 1).padStart(2, "0")}.wav`
  };
});

fs.writeFileSync(slidesPath, `${JSON.stringify(normalized, null, 2)}\n`);
