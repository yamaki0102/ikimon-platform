import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import slides from "../src/slides.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "assets", "narration");
const rawDir = path.join(root, ".runtime", "narration-gemini-raw");
const trimDir = path.join(root, ".runtime", "narration-trimmed");
const targetCps = Number(process.env.NARRATION_TARGET_CPS || 5.05);
const minSegmentSeconds = Number(process.env.NARRATION_MIN_SEGMENT_SECONDS || 1.55);
const tailPadSeconds = Number(process.env.NARRATION_TAIL_PAD_SECONDS || 0.14);
const model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const voiceName = process.env.GEMINI_TTS_VOICE || "Leda";

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(trimDir, { recursive: true });

function speechChars(text) {
  return Math.max(1, String(text).replace(/[\s\p{P}\p{S}]/gu, "").length);
}

function slideSegments(slide, slideIndex) {
  const sentences = String(slide.narration)
    .match(/[^。！？!?]+[。！？!?]?/g)
    ?.map((item) => item.trim())
    .filter(Boolean) ?? [slide.narration];

  return sentences.map((text, segmentIndex) => ({
    slideId: slide.id,
    id: `${slide.id}-${segmentIndex + 1}`,
    text,
    file: `slide-${String(slideIndex + 1).padStart(2, "0")}-${String(segmentIndex + 1).padStart(2, "0")}.wav`
  }));
}

function durationSeconds(file) {
  const raw = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], {
    encoding: "utf8"
  }).trim();
  return Number(raw);
}

function atempoChain(factor) {
  const values = [];
  let remaining = Math.max(0.0625, Math.min(16, factor));
  while (remaining > 2) {
    values.push(2);
    remaining /= 2;
  }
  while (remaining < 0.5) {
    values.push(0.5);
    remaining /= 0.5;
  }
  values.push(remaining);
  return values.map((value) => `atempo=${value.toFixed(3)}`).join(",");
}

function trimSilence(rawPath, trimPath) {
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    rawPath,
    "-af",
    "silenceremove=start_periods=1:start_duration=0.04:start_threshold=-50dB",
    "-ar",
    "24000",
    "-ac",
    "1",
    trimPath
  ]);
}

function normalize(trimPath, outPath, targetSpeechDuration) {
  const trimmedDuration = durationSeconds(trimPath);
  const factor = trimmedDuration / targetSpeechDuration;
  const filter = `${atempoChain(factor)},apad=pad_dur=${tailPadSeconds.toFixed(2)}`;
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    trimPath,
    "-filter:a",
    filter,
    "-ar",
    "24000",
    "-ac",
    "1",
    outPath
  ]);
  return trimmedDuration;
}

const manifest = [];
for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
  for (const segment of slideSegments(slides[slideIndex], slideIndex)) {
    const rawPath = path.join(rawDir, segment.file);
    const trimPath = path.join(trimDir, segment.file);
    const outPath = path.join(outDir, segment.file);
    await fs.access(rawPath);
    const chars = speechChars(segment.text);
    const targetSpeechDuration = Math.max(chars / targetCps, minSegmentSeconds);
    trimSilence(rawPath, trimPath);
    const trimmedDuration = normalize(trimPath, outPath, targetSpeechDuration);
    const duration = durationSeconds(outPath);
    const cps = chars / Math.max(0.1, duration - tailPadSeconds);
    const item = {
      id: segment.id,
      slideId: segment.slideId,
      file: segment.file,
      text: segment.text,
      chars,
      trimmedDuration: Number(trimmedDuration.toFixed(2)),
      targetSpeechDuration: Number(targetSpeechDuration.toFixed(2)),
      duration: Number(duration.toFixed(2)),
      cps: Number(cps.toFixed(2)),
      targetCps,
      minSegmentSeconds,
      tailPadSeconds,
      model,
      voiceName,
      normalizedFromRaw: true
    };
    manifest.push(item);
    console.log(`${segment.file}: ${item.duration}s, ${item.cps} cps`);
  }
}

await fs.writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), targetCps, minSegmentSeconds, tailPadSeconds, slides: manifest }, null, 2) + "\n"
);

console.table(manifest.map(({ id, file, duration, cps }) => ({ id, file, duration, cps })));
