import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import slides from "../src/slides.json" with { type: "json" };

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENAI_API_KEY is required.");
}

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "assets", "narration");
const rawDir = path.join(root, ".runtime", "narration-gemini-raw");
const model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const voiceName = process.env.GEMINI_TTS_VOICE || "Leda";
const targetCps = Number(process.env.NARRATION_TARGET_CPS || 5.45);
const force = process.env.NARRATION_FORCE === "1";

await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(rawDir, { recursive: true });

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

function parseRate(mimeType) {
  const match = /rate=(\d+)/i.exec(mimeType || "");
  return match ? Number(match[1]) : 24000;
}

function wavFromPcm(pcm, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function durationSeconds(file) {
  const raw = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], {
    encoding: "utf8"
  }).trim();
  return Number(raw);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadPreviousManifest() {
  try {
    const payload = JSON.parse(await fs.readFile(path.join(outDir, "manifest.json"), "utf8"));
    return new Map((payload.slides || []).map((item) => [item.file, item]));
  } catch {
    return new Map();
  }
}

function normalizeAudio(rawPath, outPath, chars) {
  const targetDuration = chars / targetCps;
  const rawDuration = durationSeconds(rawPath);
  const factor = Math.max(0.5, Math.min(2, rawDuration / targetDuration));
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    rawPath,
    "-filter:a",
    `atempo=${factor.toFixed(3)}`,
    "-ar",
    "24000",
    "-ac",
    "1",
    outPath
  ]);
}

async function synthesize(segment) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: segment.text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    })
  });

  const raw = await response.text();
  if (!response.ok) {
    const error = new Error(`${response.status} ${response.statusText}: ${raw.slice(0, 600)}`);
    error.status = response.status;
    const retryDelay = /"retryDelay"\s*:\s*"(\d+)s"/.exec(raw)?.[1] || /retry in (\d+)s/i.exec(raw)?.[1];
    error.retryDelayMs = retryDelay ? (Number(retryDelay) + 3) * 1000 : null;
    throw error;
  }

  const json = JSON.parse(raw);
  const part = json.candidates?.[0]?.content?.parts?.find((item) => item.inlineData || item.inline_data);
  const inlineData = part?.inlineData || part?.inline_data;
  if (!inlineData?.data) throw new Error(`No audio data returned for ${segment.id}`);
  const audio = Buffer.from(inlineData.data, "base64");
  const mimeType = inlineData.mimeType || inlineData.mime_type || "";
  return mimeType.includes("wav") ? audio : wavFromPcm(audio, parseRate(mimeType));
}

async function synthesizeWithRetry(segment) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await synthesize(segment);
    } catch (error) {
      const status = error.status;
      const retryable = status === 429 || status === 500 || status === 503;
      if (!retryable || attempt === maxAttempts) throw error;
      const waitMs = error.retryDelayMs || Math.min(180000, 15000 * attempt);
      process.stdout.write(`rate limited; waiting ${Math.round(waitMs / 1000)}s ... `);
      await sleep(waitMs);
    }
  }
  throw new Error(`Failed to synthesize ${segment.id}`);
}

const manifest = [];
const previousManifest = await loadPreviousManifest();
for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
  for (const segment of slideSegments(slides[slideIndex], slideIndex)) {
    process.stdout.write(`Generating ${segment.file} ... `);
    const rawPath = path.join(rawDir, segment.file);
    const outPath = path.join(outDir, segment.file);
    const chars = speechChars(segment.text);
    const previous = previousManifest.get(segment.file);
    if (!force && previous?.text === segment.text && previous?.model === model && previous?.voiceName === voiceName) {
      try {
        const duration = durationSeconds(outPath);
        const cps = chars / duration;
        manifest.push({ ...previous, chars, duration: Number(duration.toFixed(2)), cps: Number(cps.toFixed(2)) });
        process.stdout.write(`kept ${Number(duration.toFixed(2))}s, ${Number(cps.toFixed(2))} cps\n`);
        continue;
      } catch {
        process.stdout.write("existing file invalid; regenerating ... ");
      }
    }
    const data = await synthesizeWithRetry(segment);
    await fs.writeFile(rawPath, data);
    normalizeAudio(rawPath, outPath, chars);
    const duration = durationSeconds(outPath);
    const cps = chars / duration;
    manifest.push({
      id: segment.id,
      slideId: segment.slideId,
      file: segment.file,
      text: segment.text,
      chars,
      duration: Number(duration.toFixed(2)),
      cps: Number(cps.toFixed(2)),
      model,
      voiceName
    });
    process.stdout.write(`${Number(duration.toFixed(2))}s, ${Number(cps.toFixed(2))} cps\n`);
  }
}

await fs.writeFile(
  path.join(outDir, "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), targetCps, slides: manifest }, null, 2) + "\n"
);

console.table(manifest.map(({ id, file, duration, cps, model, voiceName }) => ({ id, file, duration, cps, model, voiceName })));
