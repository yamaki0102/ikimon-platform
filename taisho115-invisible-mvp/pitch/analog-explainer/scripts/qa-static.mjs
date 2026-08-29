import fs from "node:fs";
import path from "node:path";
import slides from "../src/slides.json" with { type: "json" };
import demoSlides from "../src/demo-slides.json" with { type: "json" };

const root = path.resolve(import.meta.dirname, "..");
const narrationDir = path.join(root, "public", "assets", "narration");
const demoNarrationDir = path.join(root, "public", "assets", "demo-narration");
const formalDir = path.join(root, "public", "assets", "formal");
const canonicalFormalDir = path.resolve(root, "..", "..", "public", "assets", "formal");
const required = [
  "index.html",
  "src/App.svelte",
  "src/app.css",
  "src/analytics.ts",
  "src/slides.json",
  "public/assets/narration/slide-manifest.json"
];

const errors = [];
let manifest = null;
let demoManifest = null;

function segments(slide, slideIndex) {
  const items =
    Array.isArray(slide.dialogue) && slide.dialogue.length
      ? slide.dialogue.map((line) => ({ text: String(line.text || "").trim(), speaker: line.speaker || "narrator" }))
      : (String(slide.narration)
          .match(/[^。！？!?]+[。！？!?]?/g)
          ?.map((item) => ({ text: item.trim(), speaker: "narrator" }))
          .filter((item) => item.text) ?? [{ text: slide.narration, speaker: "narrator" }]);

  return items.map((item, segmentIndex) => ({
    text: item.text,
    speaker: item.speaker,
    audio: `slide-${String(slideIndex + 1).padStart(2, "0")}-${String(segmentIndex + 1).padStart(2, "0")}.wav`
  }));
}

function wavDurationSeconds(file) {
  const buffer = fs.readFileSync(file);
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WAVE") {
    throw new Error(`${file} is not a RIFF/WAVE file`);
  }
  let offset = 12;
  let byteRate = null;
  let dataBytes = null;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.subarray(offset, offset + 4).toString("ascii");
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    if (chunkId === "fmt ") byteRate = buffer.readUInt32LE(chunkStart + 8);
    if (chunkId === "data") dataBytes = chunkSize;
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }
  if (!byteRate || !dataBytes) throw new Error(`${file} is missing fmt/data chunks`);
  return dataBytes / byteRate;
}

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
}

try {
  manifest = JSON.parse(fs.readFileSync(path.join(narrationDir, "slide-manifest.json"), "utf8"));
} catch {
  errors.push("slide narration manifest is not valid JSON");
}
try {
  demoManifest = JSON.parse(fs.readFileSync(path.join(demoNarrationDir, "slide-manifest.json"), "utf8"));
} catch {
  errors.push("demo narration manifest is not valid JSON");
}

let segmentCount = 0;
for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
  const slide = slides[slideIndex];
  if (!slide.narration || slide.narration.length < 30) errors.push(`${slide.id}: narration too short`);
  const slideSegments = segments(slide, slideIndex);
  if (slideSegments.length < 2) errors.push(`${slide.id}: needs multiple audio segments`);
  segmentCount += slideSegments.length;
  const slideAudio = path.join(narrationDir, "slides", `slide-${String(slideIndex + 1).padStart(2, "0")}.wav`);
  if (!fs.existsSync(slideAudio)) errors.push(`${slide.id}: slide audio missing ${path.basename(slideAudio)}`);
}

if (manifest?.mode !== "slide-level") errors.push("slide narration manifest mode must be slide-level");
if (manifest?.slides) {
  const naturalTiming = manifest.timingMode === "natural";
  const cpsValues = manifest.slides.map((item) => Number(item.cps)).filter(Number.isFinite);
  const minCps = Math.min(...cpsValues);
  const maxCps = Math.max(...cpsValues);
  const tempoDeviations = manifest.slides.map((item) => Number(item.tempoDeviation)).filter(Number.isFinite);
  const maxTempoDeviation = Math.max(...tempoDeviations);
  const allowedTempoDeviation = Number(manifest.maxTempoDeviation ?? 0.16) + 0.005;
  const cueCount = manifest.slides.reduce((total, slide) => total + (slide.segments?.length || 0), 0);
  if (manifest.slides.length !== slides.length) errors.push(`manifest slide count ${manifest.slides.length} !== expected ${slides.length}`);
  if (cueCount !== segmentCount) errors.push(`manifest cue count ${cueCount} !== expected ${segmentCount}`);
  if (maxCps - minCps > 0.05) errors.push(`slide narration speed variance too high: ${minCps} - ${maxCps} cps`);
  if (!naturalTiming && maxTempoDeviation > allowedTempoDeviation) {
    errors.push(`slide narration tempo correction too high: ${maxTempoDeviation} > ${allowedTempoDeviation}`);
  }
  if (naturalTiming && !String(manifest.audioSegmentation || "").startsWith("speaker-blocks")) {
    errors.push("natural narration must use speaker-block audio segmentation");
  }
  for (let slideIndex = 0; slideIndex < slides.length; slideIndex += 1) {
    const slide = slides[slideIndex];
    const expectedSegments = segments(slide, slideIndex);
    const manifestSlide = manifest.slides[slideIndex];
    if (!manifestSlide) continue;
    if (manifestSlide.slideId !== slide.id) errors.push(`manifest index ${slideIndex + 1} id mismatch: ${manifestSlide.slideId} !== ${slide.id}`);
    const slideAudio = path.join(narrationDir, manifestSlide.file);
    if (fs.existsSync(slideAudio)) {
      try {
        const actualDuration = wavDurationSeconds(slideAudio);
        const manifestDuration = Number(manifestSlide.duration);
        const lastCueEnd = Math.max(...(manifestSlide.segments ?? []).map((segment) => Number(segment.end)).filter(Number.isFinite));
        const tail = actualDuration - lastCueEnd;
        if (Math.abs(actualDuration - manifestDuration) > 0.08) {
          errors.push(`${slide.id}: manifest duration ${manifestDuration.toFixed(2)} does not match WAV ${actualDuration.toFixed(3)}`);
        }
        if (lastCueEnd > actualDuration + 0.03) {
          errors.push(`${slide.id}: final cue ${lastCueEnd.toFixed(3)} exceeds WAV duration ${actualDuration.toFixed(3)}`);
        }
        if (tail < 0.25) errors.push(`${slide.id}: audio tail too short after final cue ${tail.toFixed(3)}s`);
      } catch (error) {
        errors.push(`${slide.id}: failed to inspect WAV duration: ${error.message}`);
      }
    }
    for (let segmentIndex = 0; segmentIndex < expectedSegments.length; segmentIndex += 1) {
      const expected = expectedSegments[segmentIndex];
      const actual = manifestSlide.segments?.[segmentIndex];
      if (actual?.text !== expected.text) errors.push(`${slide.id}: segment ${segmentIndex + 1} audio text mismatch`);
      if (actual?.speaker && actual.speaker !== expected.speaker) errors.push(`${slide.id}: segment ${segmentIndex + 1} speaker mismatch`);
    }
    if (slide.id === "game-concept") {
      const cue1Gap = Number(manifestSlide.segments?.[1]?.start) - Number(manifestSlide.segments?.[0]?.end);
      const cue2Gap = Number(manifestSlide.segments?.[2]?.start) - Number(manifestSlide.segments?.[1]?.end);
      if (cue1Gap < 0.48 || cue2Gap < 0.48) {
        errors.push(`${slide.id}: speaker-change gaps must be about 0.5s, got ${cue1Gap.toFixed(2)}s and ${cue2Gap.toFixed(2)}s`);
      }
    }
  }
}

const app = fs.readFileSync(path.join(root, "src", "App.svelte"), "utf8");
const css = fs.readFileSync(path.join(root, "src", "app.css"), "utf8");
const narrationScript = fs.readFileSync(path.join(root, "scripts", "generate-slide-narration.mjs"), "utf8");
if (!app.includes("<svelte:options runes={true} />")) errors.push("Svelte runes mode is not enabled");
if (!app.includes("startViewTransition")) errors.push("View Transitions hook is missing");
if (!app.includes("bind:this={audioElement}")) errors.push("audio element binding missing");
if (!app.includes("activeSegment")) errors.push("segment-synced state missing");
if (!app.includes("slide-manifest.json")) errors.push("slide-level narration manifest is not loaded");
if (!app.includes("ontimeupdate={syncSegmentFromAudio}")) errors.push("audio time-synced segment update missing");
if (!app.includes("nextAudioSrc") || !app.includes("nextAudioElement")) errors.push("next slide narration preload is missing");
if (!app.includes("slideCompleteHoldMs") || !app.includes("2000")) errors.push("slide-complete hold must keep the current slide visible for 2 seconds");
if (!app.includes("slideChangeNarrationDelayMs") || !app.includes("1400")) errors.push("slide-change narration delay must be explicit");
if (!app.includes("trackEvent")) errors.push("analytics event tracking missing");
if (!app.includes("purchase_intent")) errors.push("purchase intent event missing");
if (!app.includes("share_complete")) errors.push("share completion event missing");
if (!app.includes("rulesNarrationPlaybackRate")) errors.push("rules narration playback rate must be explicit and deck-wide");
if (!app.includes("deckMode === \"demo\" ? demoNarrationPlaybackRate : rulesNarrationPlaybackRate")) {
  errors.push("narration playback rate must be selected once per deck mode, not per slide");
}
if (!app.includes("function segmentForSlide")) errors.push("inactive demo slides must use their own subtitle segment");
if (!app.includes("function demoSearchRevealed")) errors.push("search net reveal must be delayed until after dice cue");
if (!app.includes("demoNarrationVersion")) errors.push("demo narration assets must be cache-busted after script changes");
if (!app.includes("slides-demo-v2") || !app.includes("demoV2")) errors.push("demo v2 route detection is missing");
if (!app.includes("class=\"die-face\"") || /<span>[一二三四五六]<\/span>/.test(app)) {
  errors.push("dice must render as pip-based die faces, not kanji-number squares");
}
const piecePackMatch = app.match(/<div class="story-piece-pack"[\s\S]*?<b>コマ6個<\/b>[\s\S]*?<\/div>/);
const pieceCount = (piecePackMatch?.[0].match(/<span><\/span>/g) || []).length;
if (pieceCount !== 6) errors.push(`product overview must show 6 square pieces, got ${pieceCount}`);
if (!app.includes("demo-step-rail") || !app.includes("demoFlowSteps") || !app.includes("demoActiveFlowStep")) {
  errors.push("demo deck must show a left-side active step rail");
}
if (!app.includes("demo-gauge-card-image") || !app.includes("demo-gauge-marker") || !app.includes("assets/formal/gauge.webp") || !app.includes("警察状態")) {
  errors.push("demo deck must render fatigue and tip-off with the real gauge card image");
}
if (!app.includes("formatDemoPanelText") || !app.includes("formatTownNumbers") || !app.includes("formatDiceNumbers")) {
  errors.push("demo deck must format town labels and dice labels for review readability");
}
if (!/NARRATION_SEGMENT_GAP_SECONDS\s*\|\|\s*0\.5/.test(narrationScript)) {
  errors.push("speaker-change narration gap must default to about 0.5s");
}
if (!css.includes(".die-face[data-value=\"6\"]") || !css.includes("radial-gradient(circle at 68% 73%")) {
  errors.push("realistic dice pip CSS is missing");
}
if (narrationScript.includes("areverse,silenceremove")) {
  errors.push("rules narration must not trim trailing silence; it can clip low-energy word endings");
}
const raidSlide = slides.find((slide) => slide.id === "raid");
if (raidSlide?.dialogue?.some((line) => line.speaker !== "police")) {
  errors.push("slide 8 raid narration must remain police-only");
}
const conceptSource = JSON.stringify(slides);
const invisibilitySlide = slides.find((slide) => slide.id === "invisibility");
if (!invisibilitySlide?.points?.some((item) => item.includes("追い詰められた局面"))) {
  errors.push("concept deck must describe invisibility as a mid-game crisis escape, not a final getaway");
}
if (!invisibilitySlide?.narration?.includes("追い詰められた局面") || !invisibilitySlide?.narration?.includes("奥の手")) {
  errors.push("concept narration must align with the crisis-avoidance stealth feedback");
}
if (conceptSource.includes("●●●●") || conceptSource.includes("隠遁")) {
  errors.push("concept deck still contains an unresolved placeholder or obsolete genre wording");
}
if (!slides.find((slide) => slide.id === "product-overview")?.points?.includes("価格: 未定")) {
  errors.push("unknown product price must be stated honestly as 未定");
}
if (!app.includes("landscapeFitActive") || !css.includes(".rules-deck.portrait-preview-mode .slide.active")) {
  errors.push("responsive slide-fit safeguards are missing");
}

if (demoManifest?.slides) {
  if (demoManifest.slides.length !== demoSlides.length) {
    errors.push(`demo manifest slide count ${demoManifest.slides.length} !== demo slide count ${demoSlides.length}`);
  }
  for (let index = 0; index < demoSlides.length; index += 1) {
    const slide = demoSlides[index];
    const manifestSlide = demoManifest.slides[index];
    if (!manifestSlide) continue;
    if (manifestSlide.slideId !== slide.id) errors.push(`demo manifest index ${index + 1} id mismatch: ${manifestSlide.slideId} !== ${slide.id}`);
    const dialogue = slide.dialogue ?? [];
    const manifestSegments = manifestSlide.segments ?? [];
    if (manifestSegments.length !== dialogue.length) {
      errors.push(`${slide.id}: demo manifest segment count ${manifestSegments.length} !== dialogue count ${dialogue.length}`);
    }
    for (let segmentIndex = 0; segmentIndex < dialogue.length; segmentIndex += 1) {
      const expected = dialogue[segmentIndex]?.text;
      const actual = manifestSegments[segmentIndex]?.text;
      if (actual !== expected) errors.push(`${slide.id}: segment ${segmentIndex + 1} audio text mismatch`);
    }
  }
}

const restSlide = demoSlides.find((slide) => slide.id === "demo-rest");
const earlyRaidSlide = demoSlides.find((slide) => slide.id === "demo-raid-miss");
const finalGaugeSlide = demoSlides.find((slide) => slide.id === "demo-gauge-final");
const finalNetworkSlide = demoSlides.find((slide) => slide.id === "demo-network-final");
const round6Stealth1Slide = demoSlides.find((slide) => slide.id === "demo-round-6-stealth-1");
const round6Trace1Slide = demoSlides.find((slide) => slide.id === "demo-round-6-trace-1");
const round6Stealth2Slide = demoSlides.find((slide) => slide.id === "demo-round-6-stealth-2");
const round6Trace2Slide = demoSlides.find((slide) => slide.id === "demo-round-6-trace-2");
const round6IntelSlide = demoSlides.find((slide) => slide.id === "demo-round-6-intel");
const round7MoveSlide = demoSlides.find((slide) => slide.id === "demo-round-7-move");
const round7RaidSlide = demoSlides.find((slide) => slide.id === "demo-round-7-raid");
const round8MoveSlide = demoSlides.find((slide) => slide.id === "demo-round-8-move");
const captureSlide = demoSlides.find((slide) => slide.id === "demo-capture");
const summarySlide = demoSlides.find((slide) => slide.id === "demo-summary");
if (demoSlides.length < 29) errors.push(`demo slide count ${demoSlides.length} is too short for the full play script`);
if (restSlide?.demo?.gauge?.fatigue !== "1") errors.push("demo-rest must recover fatigue from 2 to 1, not 0");
if (!restSlide?.demo?.status?.some((item) => item.includes("2 -> 1") || item.includes("疲弊2を1"))) {
  errors.push("demo-rest must show fatigue 2 -> 1");
}
if (!earlyRaidSlide?.dialogue?.some((item) => item.text.includes("伊の壱丁目") && item.text.includes("過去にいましたか"))) {
  errors.push("early failed raid must explicitly ask whether 伊一 was visited in the past");
}
if (!earlyRaidSlide?.dialogue?.some((item) => item.text.includes("過去に訪れたこともない"))) {
  errors.push("early failed raid must include Zundamon's no-past-visit answer");
}
if (finalGaugeSlide?.demo?.gauge?.search !== "3 - 2 = 1枚まで") {
  errors.push("final police turn must show the last one-card search after fatigue 2");
}
if (JSON.stringify(finalGaugeSlide?.demo?.search ?? []) !== JSON.stringify([2]) || finalGaugeSlide?.demo?.answer !== "いない") {
  errors.push("final police turn must ask 阿三 and miss before the game ends");
}
if (!finalNetworkSlide?.dialogue?.some((item) => item.text.includes("R6") && item.text.includes("透明化") && item.text.includes("宇三丁目"))) {
  errors.push("final police view must explain that R6 stealth shifted the current position before the endgame");
}
if (!round6IntelSlide?.dialogue?.some((item) => item.text.includes("過去に通ったことはありますか"))) {
  errors.push("round 6 intel must ask whether the selected card was passed in the past");
}
if (!round6IntelSlide?.dialogue?.some((item) => item.text.includes("あります"))) errors.push("round 6 intel must include the answer 'あります'");
if (round6IntelSlide?.demo?.gauge?.fatigue !== "0" || round6IntelSlide?.demo?.gauge?.tip !== "+1") {
  errors.push("round 6 tip-off intel must keep fatigue 0 and show tip-off +1");
}
if (!round6IntelSlide?.dialogue?.some((item) => item.text.includes("いないということ") && item.text.includes("タレコミゲージ"))) {
  errors.push("round 6 must explain that intel is available when the search answer is no");
}
if (round7RaidSlide?.demo?.search?.length !== 3 || round7RaidSlide?.demo?.gauge?.fatigue !== "2") errors.push("round 7 must leave multiple candidates and fatigue 2 after the failed raid");
if (!round7RaidSlide?.dialogue?.some((item) => item.text.includes("阿四丁目") && item.text.includes("過去に通りましたか"))) {
  errors.push("round 7 failed raid must ask Zundamon about the target footprint");
}
if (!round7RaidSlide?.dialogue?.some((item) => item.text.includes("まだ通っていない"))) {
  errors.push("round 7 failed raid must include Zundamon's footprint answer");
}
if (round6Stealth1Slide?.demo?.current !== 11 || round6Stealth1Slide?.demo?.previous !== 15 || round6Stealth1Slide?.demo?.footprints?.length !== 6) {
  errors.push("round 6 stealth step 1 must move 江四 -> 宇四 and add 江四 as a footprint");
}
if (!round6Trace1Slide?.demo?.diceLabel?.includes("1回目") || round6Trace1Slide?.demo?.current !== 11 || round6Trace1Slide?.demo?.footprints?.length !== 6) {
  errors.push("round 6 must roll trace dice immediately after stealth step 1");
}
if (round6Stealth2Slide?.demo?.current !== 10 || round6Stealth2Slide?.demo?.previous !== 11 || round6Stealth2Slide?.demo?.footprints?.length !== 7) {
  errors.push("round 6 stealth step 2 must move 宇四 -> 宇三 and add 宇四 as a footprint");
}
if (!round6Trace2Slide?.demo?.diceLabel?.includes("2回目") || round6Trace2Slide?.demo?.current !== 10 || round6Trace2Slide?.demo?.footprints?.length !== 7) {
  errors.push("round 6 must roll trace dice immediately after stealth step 2");
}
if (JSON.stringify(round6IntelSlide?.demo?.search ?? []) !== JSON.stringify([3, 7, 11, 15])) errors.push("round 6 police must search the rightmost column");
if (round6IntelSlide?.demo?.target !== 11 || round6IntelSlide?.demo?.current !== 10) {
  errors.push("round 6 police must miss after stealth shifts the current position from 宇四 to 宇三");
}
if (!round6IntelSlide?.dialogue?.some((item) => item.text.includes("宇四丁目") && item.text.includes("足跡あり"))) {
  errors.push("round 6 police narration must explain that the missed search still reveals the passage point");
}
if (JSON.stringify(round7RaidSlide?.demo?.search ?? []) !== JSON.stringify([3, 7, 11])) errors.push("round 7 police must search the reachable upper-right column");
if (round7RaidSlide?.demo?.target !== 3 || round7RaidSlide?.demo?.current !== 7) {
  errors.push("round 7 police must raid 阿四 one move too early while the current position is 伊四");
}
if (round7MoveSlide?.demo?.current !== 7 || round7MoveSlide?.demo?.previous !== 10 || round7MoveSlide?.demo?.footprints?.length !== 8) {
  errors.push("round 7 normal move must go 宇三 -> 伊四 and bring the route to 9 visited cards");
}
if (!round6Stealth1Slide?.dialogue?.some((item) => item.text.includes("中盤") && item.text.includes("奥の手の透明化"))) {
  errors.push("round 6 move must present stealth as a mid-game crisis-avoidance trump card");
}
if (!round8MoveSlide?.dialogue?.some((item) => item.text.includes("通常移動")) || round8MoveSlide?.demo?.footprints?.length !== 9) {
  errors.push("round 8 must use normal movement and end at exactly 10 visited cards");
}
if (round8MoveSlide?.dialogue?.some((item) => item.text.includes("勝利なのだ") || item.text.includes("ぼくの勝ち"))) {
  errors.push("round 8 move must not declare victory before the final police turn");
}
if (captureSlide?.demo?.answer !== "逃げ切り") errors.push("demo capture slide must now resolve as an invisible-player escape");
if (!captureSlide?.dialogue?.some((item) => item.text.includes("警察手番"))) {
  errors.push("capture slide must declare victory only after the police turn ends");
}
if (!summarySlide?.dialogue?.some((item) => item.text.includes("タレコミ"))) errors.push("closing summary must mention tip-off gauge");
if (!summarySlide?.dialogue?.some((item) => item.text.includes("R6の透明化") && item.text.includes("痕跡ダイス") && item.text.includes("危機"))) {
  errors.push("closing summary must close on R6 stealth and per-move trace dice as crisis avoidance");
}
if (captureSlide?.dialogue?.some((item) => item.text.includes("R8の突入は近かった") || item.text.includes("疲弊が重くなったぶん")) || (captureSlide?.dialogue?.length ?? 0) !== 1) {
  errors.push("capture slide still contains the redundant closing review called out by feedback");
}
if (JSON.stringify(demoSlides).includes("2 -> 0")) {
  errors.push("demo slides still contain obsolete rest/full-recovery wording");
}
if (JSON.stringify(demoSlides).includes("3回外") || JSON.stringify(demoSlides).includes("内偵権")) {
  errors.push("demo slides still contain obsolete three-miss/intel-right wording");
}
if (JSON.stringify(demoSlides).includes("疲弊+1") || JSON.stringify(demoSlides).includes("内偵の疲弊が")) {
  errors.push("demo slides still imply tip-off intel always increases fatigue");
}
if (JSON.stringify(demoSlides).includes("結果: 足跡あり / 疲弊+2") || JSON.stringify(demoSlides).includes("demo-round-8-intel")) {
  errors.push("demo slides must not make raid penalties look like intel fatigue cost");
}
if (!JSON.stringify(demoSlides).includes("内偵なら通常+1") && !JSON.stringify(demoSlides).includes("内偵1回につき疲弊1")) {
  errors.push("demo slides must clarify that normal intel costs only 1 fatigue");
}

let traceZoroCount = 0;
for (const [index, slide] of demoSlides.entries()) {
  for (const line of slide.dialogue ?? []) {
    if (line.thought && /^(います|いません)/.test(line.text)) {
      errors.push(`${slide.id}: public yes/no answer must not be marked as thought`);
    }
  }
  const dice = slide.demo?.dice ?? [];
  const diceLabel = slide.demo?.diceLabel ?? (slide.demo?.boardMode?.startsWith("trace") ? "痕跡ダイス" : "");
  if (dice.length && !diceLabel && index >= 12) errors.push(`${slide.id}: demo dice must show who rolls`);
  if (dice.length === 2 && dice[0] === dice[1] && diceLabel.startsWith("痕跡")) traceZoroCount += 1;
}
if (traceZoroCount > 2) errors.push(`trace zoro count is too high: ${traceZoroCount}`);

const blockedIndex = 6;
const row = (index) => Math.floor(index / 4);
const col = (index) => index % 4;
const adjacent = (a, b) => Math.max(Math.abs(row(a) - row(b)), Math.abs(col(a) - col(b))) === 1;
const isRectangle = (cells) => {
  if (!cells?.length) return true;
  const rows = cells.map(row);
  const cols = cells.map(col);
  const minRow = Math.min(...rows);
  const maxRow = Math.max(...rows);
  const minCol = Math.min(...cols);
  const maxCol = Math.max(...cols);
  const expected = [];
  for (let r = minRow; r <= maxRow; r += 1) {
    for (let c = minCol; c <= maxCol; c += 1) expected.push(r * 4 + c);
  }
  return expected.length === cells.length && expected.every((cell) => cells.includes(cell));
};

for (const slide of demoSlides) {
  const state = slide.demo;
  if (!state) continue;
  if (state.current === blockedIndex) errors.push(`${slide.id}: current position is blocked 伊三`);
  if (state.previous === blockedIndex) errors.push(`${slide.id}: previous position is blocked 伊三`);
  if (state.current !== undefined && state.previous !== undefined && !adjacent(state.previous, state.current)) {
    errors.push(`${slide.id}: move is not adjacent, including diagonals`);
  }
  if (state.search?.includes(blockedIndex)) errors.push(`${slide.id}: search net includes blocked 伊三`);
  if (!isRectangle(state.search ?? [])) errors.push(`${slide.id}: search net must be a full rectangle`);
  const footprints = state.footprints ?? [];
  if (new Set(footprints).size !== footprints.length) errors.push(`${slide.id}: duplicate footprints`);
  if (footprints.includes(blockedIndex)) errors.push(`${slide.id}: footprint includes blocked 伊三`);
  if (state.current !== undefined && footprints.includes(state.current)) errors.push(`${slide.id}: current repeats a footprint`);
  const visitedCount = footprints.length + (state.current === undefined ? 0 : 1);
  if (visitedCount > 10) errors.push(`${slide.id}: route exceeds the 10-card win condition (${visitedCount})`);
}

const stealthSequence = demoSlides.filter((slide) => slide.id.startsWith("demo-round-6-stealth") || slide.id.startsWith("demo-round-6-trace"));
const finalStealthState = stealthSequence.at(-1)?.demo;
if (stealthSequence.length !== 4) {
  errors.push("review feedback requires a four-step R6 crisis-escape sequence: move, trace, move, trace");
} else if ((finalStealthState?.footprints?.length ?? 0) + 1 >= 10) {
  errors.push("stealth must remain a mid-game crisis escape and finish before the 10-card endgame");
}

const round8Move = demoSlides.find((slide) => slide.id === "demo-round-8-move")?.demo;
if (round8Move) {
  const used = new Set([...(round8Move.footprints ?? []), round8Move.current]);
  if ((round8Move.footprints ?? []).length !== 9 || used.size !== 10) errors.push("round 8 move must end with exactly 10 distinct visited cards");
  if (!round8Move.direction?.includes("通常移動")) errors.push("round 8 move must label normal movement after stealth was spent in R6");
  if (round8Move.answer === "逃げ切り") errors.push("round 8 movement must wait for the final police turn before declaring escape");
}

if (!css.includes(".demo-step-rail span.active")) errors.push("demo active step rail CSS is missing");
if (!css.includes(".demo-gauge-card-image") || !css.includes(".demo-gauge-marker") || !css.includes(".fatigue-4") || !css.includes(".tip-plus-1")) errors.push("demo gauge image card CSS is missing");
const sourceText = [app, css, fs.readFileSync(path.join(root, "src", "slides.json"), "utf8")].join("\n").toLowerCase();
const forbidden = ["rain", "lantern", "glow", "orb", "bokeh", "差し替え", "トンボ", "ライト", "雨"];
for (const word of forbidden) {
  if (sourceText.includes(word.toLowerCase())) errors.push(`forbidden/internal motif in source: ${word}`);
}

for (const file of ["book-cover-upright.webp", "case_lid.webp", "gauge.webp", "police_summary.webp", "blockade.webp", "town_01.webp", "footprint_01.webp"]) {
  if (!fs.existsSync(path.join(formalDir, file))) errors.push(`formal asset missing ${file}`);
}
if (!fs.existsSync(canonicalFormalDir)) {
  errors.push(`canonical game asset directory missing: ${canonicalFormalDir}`);
} else {
  for (const entry of fs.readdirSync(canonicalFormalDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const canonicalFile = path.join(canonicalFormalDir, entry.name);
    const slideFile = path.join(formalDir, entry.name);
    if (!fs.existsSync(slideFile)) {
      errors.push(`canonical game asset missing from slides: ${entry.name}`);
      continue;
    }
    if (!fs.readFileSync(canonicalFile).equals(fs.readFileSync(slideFile))) {
      errors.push(`slide asset drifted from canonical game asset: ${entry.name}`);
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`static qa ok: ${slides.length} slides, ${segmentCount} narration segments expected`);
