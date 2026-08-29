import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import slides from "../src/slides.json" with { type: "json" };

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "public", "assets", "narration");
const slideOutDir = path.join(outDir, "slides");
const rawDir = path.join(root, ".runtime", "narration-slide-gemini-raw");
const trimDir = path.join(root, ".runtime", "narration-slide-trimmed");
const model = process.env.GEMINI_TTS_MODEL || "gemini-3.1-flash-tts-preview";
const targetCps = Number(process.env.NARRATION_TARGET_CPS || 5.6);
const tailPadSeconds = Number(process.env.NARRATION_TAIL_PAD_SECONDS || 0.35);
const segmentGapSeconds = Number(process.env.NARRATION_SEGMENT_GAP_SECONDS || 0.5);
const minSegmentSeconds = Number(process.env.NARRATION_MIN_SEGMENT_SECONDS || 0.85);
const maxTempoDeviation = Number(process.env.NARRATION_MAX_TEMPO_DEVIATION || 0.16);
const timingMode = process.env.NARRATION_TIMING_MODE || "natural";
const normalizeTiming = timingMode === "target-cps";
const requestTimeoutMs = Number(process.env.NARRATION_REQUEST_TIMEOUT_MS || 120000);
const maxRetryWaitMs = Number(process.env.NARRATION_MAX_RETRY_WAIT_MS || 180000);
const allowSynthesis = process.env.NARRATION_ALLOW_SYNTHESIS !== "0";
const allowLineFallback = process.env.NARRATION_LINE_FALLBACK !== "0";
const lineFallbackGapSeconds = Number(process.env.NARRATION_LINE_FALLBACK_GAP_SECONDS || 0.06);
const maxSynthesisAttempts = Math.max(1, Number(process.env.NARRATION_SYNTHESIS_ATTEMPTS || 4));
const failWideTempo = process.env.NARRATION_FAIL_WIDE_TEMPO === "1";
const force = process.env.NARRATION_FORCE === "1";
const speakerVoices = {
  narrator: process.env.GEMINI_TTS_VOICE_NARRATOR || process.env.GEMINI_TTS_VOICE || "Leda",
  thief: process.env.GEMINI_TTS_VOICE_THIEF || "Aoede",
  police: process.env.GEMINI_TTS_VOICE_POLICE || "Orus",
  zundamon: process.env.GEMINI_TTS_VOICE_ZUNDAMON || process.env.GEMINI_TTS_VOICE_NARRATOR || "Charon",
  metan: process.env.GEMINI_TTS_VOICE_METAN || process.env.GEMINI_TTS_VOICE_NARRATOR || "Charon"
};

await fs.mkdir(slideOutDir, { recursive: true });
await fs.mkdir(rawDir, { recursive: true });
await fs.mkdir(trimDir, { recursive: true });

function speechChars(text) {
  return Math.max(1, String(text).replace(/[\s\p{P}\p{S}]/gu, "").length);
}

function speakerFor(value) {
  return Object.hasOwn(speakerVoices, value) ? value : "narrator";
}

function voiceFor(speaker) {
  return speakerVoices[speakerFor(speaker)];
}

function safePart(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function textHash(text) {
  return createHash("sha1").update(String(text)).digest("hex").slice(0, 10);
}

function segmentAudioBase(slideIndex, segment, voiceName) {
  return `slide-${String(slideIndex + 1).padStart(2, "0")}-${String(segment.index + 1).padStart(2, "0")}-${safePart(segment.speaker)}-${safePart(voiceName)}-${textHash(segment.text)}`;
}

function blockAudioBase(slideIndex, block, voiceName) {
  return `slide-${String(slideIndex + 1).padStart(2, "0")}-block-${String(block.index + 1).padStart(2, "0")}-${safePart(block.speaker)}-${safePart(voiceName)}-${textHash(block.text)}`;
}

function slideSegments(slide) {
  if (Array.isArray(slide.dialogue) && slide.dialogue.length) {
    return slide.dialogue
      .map((line, index) => ({
        index,
        text: String(line.text || "").trim(),
        speaker: speakerFor(line.speaker),
        thought: Boolean(line.thought)
      }))
      .filter((line) => line.text);
  }

  return (
    String(slide.narration)
      .match(/[^。！？!?]+[。！？!?]?/g)
      ?.map((item) => item.trim())
      .filter(Boolean) ?? [slide.narration]
  ).map((text, index) => ({
    index,
    text,
    speaker: "narrator",
    thought: false
  }));
}

function audioBlocks(segments) {
  return segments.reduce((blocks, segment) => {
    const previous = blocks.at(-1);
    if (previous?.speaker === segment.speaker) {
      previous.segments.push(segment);
      previous.text = previous.segments.map((item) => item.text).join(" ");
      return blocks;
    }
    blocks.push({
      index: blocks.length,
      speaker: segment.speaker,
      segments: [segment],
      text: segment.text
    });
    return blocks;
  }, []);
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

function hasValidWavHeader(audio) {
  return audio.subarray(0, 4).toString("ascii") === "RIFF" && audio.subarray(8, 12).toString("ascii") === "WAVE" && audio.subarray(12, 16).toString("ascii") === "fmt ";
}

function coerceToWav(audio, mimeType) {
  if (hasValidWavHeader(audio)) return audio;
  const dataChunk = audio.indexOf(Buffer.from("data"));
  if (audio.subarray(0, 4).toString("ascii") === "RIFF" && dataChunk >= 0) {
    return wavFromPcm(audio.subarray(dataChunk + 8), parseRate(mimeType));
  }
  return wavFromPcm(audio, parseRate(mimeType));
}

function durationSeconds(file) {
  const raw = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], {
    encoding: "utf8"
  }).trim();
  return Number(raw);
}

async function fileExists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

function tempoStats(trimmedDuration, targetSpeechDuration) {
  const factor = trimmedDuration / targetSpeechDuration;
  return {
    factor,
    deviation: Math.abs(factor - 1)
  };
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
    "silenceremove=start_periods=1:start_duration=0.03:start_threshold=-48dB",
    "-ar",
    "24000",
    "-ac",
    "1",
    trimPath
  ]);
}

function normalizeAudio(trimPath, outPath, targetSpeechDuration) {
  const trimmedDuration = durationSeconds(trimPath);
  const factor = trimmedDuration / targetSpeechDuration;
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    trimPath,
    "-filter:a",
    atempoChain(factor),
    "-ar",
    "24000",
    "-ac",
    "1",
    outPath
  ]);
  return trimmedDuration;
}

async function ensureSilence(duration, label) {
  const file = path.join(trimDir, `silence-${safePart(label)}-${duration.toFixed(2)}.wav`);
  if (await fileExists(file)) return file;
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=24000:cl=mono",
    "-t",
    duration.toFixed(2),
    "-ar",
    "24000",
    "-ac",
    "1",
    file
  ]);
  return file;
}

function concatLine(file) {
  return `file '${path.resolve(file).replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

async function concatAudio(files, outPath) {
  const listPath = path.join(trimDir, `${path.basename(outPath, ".wav")}.concat.txt`);
  await fs.writeFile(listPath, files.map(concatLine).join("\n") + "\n");
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-ar",
    "24000",
    "-ac",
    "1",
    outPath
  ]);
}

async function prepareAudio({ rawPath, trimPath, targetSpeechDuration, text, label, voiceName }) {
  const rawExists = await fileExists(rawPath);
  const attemptCount = normalizeTiming && (force || !rawExists) ? maxSynthesisAttempts : 1;
  let best = null;

  for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
    const generatedAttempt = force || !rawExists || attempt > 1;
    const candidateRaw = generatedAttempt ? rawPath.replace(/\.wav$/u, `.attempt-${attempt}.wav`) : rawPath;
    const candidateTrim = trimPath.replace(/\.wav$/u, `.attempt-${attempt}.wav`);

    if (generatedAttempt) {
      if (!allowSynthesis) throw new Error(`${label}: missing raw audio and NARRATION_ALLOW_SYNTHESIS=0`);
      process.stdout.write(`  ${label}: synth ${model}/${voiceName} ...\n`);
      const data = await synthesizeWithRetry(text, `${label}#${attempt}`, voiceName);
      await fs.writeFile(candidateRaw, data);
      process.stdout.write(`  ${label}: synth ok\n`);
    }

    trimSilence(candidateRaw, candidateTrim);
    const trimmedDuration = durationSeconds(candidateTrim);
    const stats = tempoStats(trimmedDuration, targetSpeechDuration);

    if (!best || stats.deviation < best.deviation) {
      best = { rawPath: candidateRaw, trimPath: candidateTrim, trimmedDuration, ...stats, attempt };
    }

    if (!normalizeTiming || stats.deviation <= maxTempoDeviation) break;
    if (!generatedAttempt) break;
  }

  if (!best) throw new Error(`No narration candidate prepared for ${label}`);

  if (best.rawPath !== rawPath) await fs.copyFile(best.rawPath, rawPath);
  if (best.trimPath !== trimPath) await fs.copyFile(best.trimPath, trimPath);

  if (normalizeTiming && best.deviation > maxTempoDeviation) {
    const message = `${label}: wide tempo adjustment ${best.factor.toFixed(3)} (target max deviation ${maxTempoDeviation})`;
    if (failWideTempo) throw new Error(message);
    process.stderr.write(`warning: ${message}\n`);
  }

  return best;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesize(text, voiceName) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY, GOOGLE_API_KEY, or GOOGLE_GENAI_API_KEY is required when a new TTS file must be synthesized.");
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
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
  if (!inlineData?.data) {
    const error = new Error(`No audio data returned. finishReason=${json.candidates?.[0]?.finishReason || "unknown"}`);
    error.status = 503;
    error.retryDelayMs = 8000;
    throw error;
  }
  const audio = Buffer.from(inlineData.data, "base64");
  const mimeType = inlineData.mimeType || inlineData.mime_type || "";
  return coerceToWav(audio, mimeType);
}

async function synthesizeWithRetry(text, label, voiceName) {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await synthesize(text, voiceName);
    } catch (error) {
      const retryable =
        error.name === "AbortError" || error.name === "TimeoutError" || error.status === 429 || error.status === 500 || error.status === 503;
      if (!retryable || attempt === maxAttempts) throw error;
      const waitMs = error.retryDelayMs ? Math.min(error.retryDelayMs, maxRetryWaitMs) : Math.min(maxRetryWaitMs, 15000 * attempt);
      process.stdout.write(`${label}: rate limited; waiting ${Math.round(waitMs / 1000)}s ... `);
      await sleep(waitMs);
    }
  }
  throw new Error(`Failed to synthesize ${label}`);
}

const gapFile = await ensureSilence(segmentGapSeconds, "gap");
const lineFallbackGapFile = await ensureSilence(lineFallbackGapSeconds, "line-fallback-gap");
const tailFile = await ensureSilence(tailPadSeconds, "tail");
const manifest = [];
for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
  const slide = slides[slideIndex];
  const file = `slide-${String(slideIndex + 1).padStart(2, "0")}.wav`;
  const outPath = path.join(slideOutDir, file);
  const segments = slideSegments(slide);
  const blocks = audioBlocks(segments);
  const concatFiles = [];
  const manifestSegments = [];
  let cursor = 0;
  let slideChars = 0;
  let maxPreparedDeviation = 0;
  let maxPreparedFactor = 1;
  let maxPreparedAttempt = 1;
  let fallbackBlockCount = 0;
  const voiceNames = new Set();

  process.stdout.write(`Generating ${file} ...\n`);
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex += 1) {
    const block = blocks[blockIndex];
    const voiceName = voiceFor(block.speaker);
    voiceNames.add(voiceName);
    const chars = speechChars(block.text);
    const targetSpeechDuration = Math.max(chars / targetCps, minSegmentSeconds);
    const segmentBase = blockAudioBase(slideIndex, block, voiceName);
    const rawPath = path.join(rawDir, `${segmentBase}.wav`);
    const trimPath = path.join(trimDir, `${segmentBase}.trim.wav`);
    const normPath = path.join(trimDir, `${segmentBase}.norm.wav`);
    const label = `${file}/block-${blockIndex + 1}/${block.speaker}/${voiceName}`;

    if (allowLineFallback && !force && !(await fileExists(rawPath))) {
      fallbackBlockCount += 1;
      process.stdout.write(`  ${label}: using existing line-audio fallback (${block.segments.length} cues)\n`);
      for (let blockSegmentIndex = 0; blockSegmentIndex < block.segments.length; blockSegmentIndex += 1) {
        const segment = block.segments[blockSegmentIndex];
        const segmentVoiceName = voiceFor(segment.speaker);
        voiceNames.add(segmentVoiceName);
        const segmentChars = speechChars(segment.text);
        const segmentTargetDuration = Math.max(segmentChars / targetCps, minSegmentSeconds);
        const segmentBase = segmentAudioBase(slideIndex, segment, segmentVoiceName);
        const segmentRawPath = path.join(rawDir, `${segmentBase}.wav`);
        const segmentTrimPath = path.join(trimDir, `${segmentBase}.trim.wav`);
        const segmentNormPath = path.join(trimDir, `${segmentBase}.norm.wav`);
        const segmentLabel = `${file}/${segment.index + 1}/${segment.speaker}/${segmentVoiceName}`;
        const prepared = await prepareAudio({
          rawPath: segmentRawPath,
          trimPath: segmentTrimPath,
          targetSpeechDuration: segmentTargetDuration,
          text: segment.text,
          label: segmentLabel,
          voiceName: segmentVoiceName
        });
        const trimmedDuration = durationSeconds(segmentTrimPath);
        const segmentAudioPath = normalizeTiming ? segmentNormPath : segmentTrimPath;
        if (normalizeTiming) normalizeAudio(segmentTrimPath, segmentNormPath, segmentTargetDuration);
        const segmentDuration = durationSeconds(segmentAudioPath);
        const start = cursor;
        const end = cursor + segmentDuration;
        concatFiles.push(segmentAudioPath);
        slideChars += segmentChars;
        manifestSegments.push({
          index: segment.index,
          text: segment.text,
          speaker: segment.speaker,
          thought: segment.thought || undefined,
          voiceName: segmentVoiceName,
          start: Number(start.toFixed(2)),
          end: Number(end.toFixed(2)),
          chars: segmentChars,
          audioBlockIndex: blockIndex,
          audioBlockSegmentCount: block.segments.length,
          audioSource: "line-fallback",
          trimmedDuration: Number(trimmedDuration.toFixed(2)),
          targetSpeechDuration: Number(segmentTargetDuration.toFixed(2)),
          tempoFactor: Number(prepared.factor.toFixed(3)),
          tempoDeviation: Number(prepared.deviation.toFixed(3)),
          synthesisAttempt: prepared.attempt
        });
        cursor = end;
        maxPreparedDeviation = Math.max(maxPreparedDeviation, prepared.deviation);
        if (Math.abs(prepared.factor - 1) > Math.abs(maxPreparedFactor - 1)) maxPreparedFactor = prepared.factor;
        maxPreparedAttempt = Math.max(maxPreparedAttempt, prepared.attempt);

        if (blockSegmentIndex < block.segments.length - 1) {
          concatFiles.push(lineFallbackGapFile);
          cursor += lineFallbackGapSeconds;
        }
      }
    } else {
      const prepared = await prepareAudio({ rawPath, trimPath, targetSpeechDuration, text: block.text, label, voiceName });
      const trimmedDuration = durationSeconds(trimPath);
      const blockAudioPath = normalizeTiming ? normPath : trimPath;
      if (normalizeTiming) normalizeAudio(trimPath, normPath, targetSpeechDuration);
      const blockDuration = durationSeconds(blockAudioPath);
      process.stdout.write(
        `  ${label}: ${blockDuration.toFixed(2)}s ${normalizeTiming ? "target-cps" : "natural"} block, ${block.segments.length} cues\n`
      );

      concatFiles.push(blockAudioPath);
      const start = cursor;
      const end = cursor + blockDuration;
      const blockChars = block.segments.reduce((sum, segment) => sum + speechChars(segment.text), 0);
      let cueCursor = start;
      for (let blockSegmentIndex = 0; blockSegmentIndex < block.segments.length; blockSegmentIndex += 1) {
        const segment = block.segments[blockSegmentIndex];
      const segmentChars = speechChars(segment.text);
      const isLastInBlock = blockSegmentIndex === block.segments.length - 1;
      const cueEnd = isLastInBlock ? end : cueCursor + (segmentChars / blockChars) * blockDuration;
      slideChars += segmentChars;
      manifestSegments.push({
        index: segment.index,
        text: segment.text,
        speaker: segment.speaker,
        thought: segment.thought || undefined,
        voiceName,
        start: Number(cueCursor.toFixed(2)),
        end: Number(cueEnd.toFixed(2)),
        chars: segmentChars,
        audioBlockIndex: blockIndex,
        audioBlockSegmentCount: block.segments.length,
        audioSource: "speaker-block",
        trimmedDuration: Number(trimmedDuration.toFixed(2)),
        targetSpeechDuration: Number(targetSpeechDuration.toFixed(2)),
        tempoFactor: Number(prepared.factor.toFixed(3)),
        tempoDeviation: Number(prepared.deviation.toFixed(3)),
        synthesisAttempt: prepared.attempt
      });
      cueCursor = cueEnd;
    }
      cursor = end;
      maxPreparedDeviation = Math.max(maxPreparedDeviation, prepared.deviation);
      if (Math.abs(prepared.factor - 1) > Math.abs(maxPreparedFactor - 1)) maxPreparedFactor = prepared.factor;
      maxPreparedAttempt = Math.max(maxPreparedAttempt, prepared.attempt);
    }

    if (blockIndex < blocks.length - 1) {
      concatFiles.push(gapFile);
      cursor += segmentGapSeconds;
    }
  }

  concatFiles.push(tailFile);
  await concatAudio(concatFiles, outPath);
  const duration = durationSeconds(outPath);
  const item = {
    slideId: slide.id,
    file: `slides/${file}`,
    text: segments.map((segment) => segment.text).join(" "),
    chars: slideChars,
    duration: Number(duration.toFixed(2)),
    cps: Number(targetCps.toFixed(2)),
    model,
    voiceNames: [...voiceNames],
    timingMode,
    audioBlockCount: blocks.length,
    fallbackBlockCount,
    tempoFactor: Number(maxPreparedFactor.toFixed(3)),
    tempoDeviation: Number(maxPreparedDeviation.toFixed(3)),
    synthesisAttempt: maxPreparedAttempt,
    segmentGapSeconds,
    lineFallbackGapSeconds,
    tailPadSeconds,
    segments: manifestSegments
  };
  manifest.push(item);
  process.stdout.write(`${file}: ${item.duration}s, ${item.cps} cps, ${segments.length} cues, ${blocks.length} audio blocks, voices ${item.voiceNames.join("/")}\n`);
}

await fs.writeFile(
  path.join(outDir, "slide-manifest.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      mode: "slide-level",
      targetCps,
      tailPadSeconds,
      segmentGapSeconds,
      maxTempoDeviation,
      model,
      timingMode,
      audioSegmentation: manifest.some((slide) => slide.fallbackBlockCount > 0) ? "speaker-blocks-with-line-fallback" : "speaker-blocks",
      allowLineFallback,
      lineFallbackGapSeconds,
      speakerVoices,
      slides: manifest
    },
    null,
    2
  ) + "\n"
);

console.table(
  manifest.map(({ slideId, file, duration, cps, tempoFactor, tempoDeviation, segments, audioBlockCount, fallbackBlockCount, voiceNames }) => ({
    slideId,
    file,
    duration,
    cps,
    tempoFactor,
    tempoDeviation,
    cues: segments.length,
    audioBlocks: audioBlockCount,
    fallbacks: fallbackBlockCount,
    voices: voiceNames.join("/")
  }))
);
