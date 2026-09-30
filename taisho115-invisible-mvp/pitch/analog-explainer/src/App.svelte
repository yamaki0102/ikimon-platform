<svelte:options runes={true} />

<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    Captions,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileDown,
    Maximize2,
    Minimize2,
    Music,
    Pause,
    Play,
    RotateCcw,
    Share2,
    Volume2
  } from "@lucide/svelte";
  import {
    demoSlideSegments,
    demoSlides,
    slides,
    slideSegments,
    type DemoSpeaker,
    type Slide,
    type SlideSpeaker,
    type SlideVisual
  } from "./content";
  import { getVariant, initAnalytics, trackEvent } from "./analytics";
  import releaseAssets from "./release-assets.json";

  let activeIndex = $state(0);
  let activeSegment = $state(0);
  let autoplay = $state(false);
  let transcriptOpen = $state(false);
  let volume = $state(0.85);
  let bgmEnabled = $state(true);
  let bgmVolume = $state(0.16);
  let audioStatus = $state<"idle" | "playing" | "blocked">("idle");
  let audioElement = $state<HTMLAudioElement | null>(null);
  let nextAudioElement = $state<HTMLAudioElement | null>(null);
  let bgmElement = $state<HTMLAudioElement | null>(null);
  let variant = $state("A");
  let lastTrackedKey = "";
  let audioProgress = $state(0);
  let deckShell = $state<HTMLElement | null>(null);
  let presentationMode = $state(false);
  let fullscreenActive = $state(false);
  let fullscreenError = $state(false);
  let presentationChromeVisible = $state(false);
  let diceRollTick = $state(0);
  let diceRollKey = $state("");
  let diceRollSettled = $state(false);
  let diceRollTimer: number | undefined;
  let diceSettleTimer: number | undefined;
  let chromeHideTimer: number | undefined;
  let deckMode = $state<"rules" | "demo">("rules");
  let demoV2 = $state(false);
  let suppressAudioSync = $state(false);
  let lastChromePointer: { x: number; y: number } | null = null;
  let viewportWidth = $state(375);
  let viewportHeight = $state(667);
  let slideChangeSerial = 0;
  let playbackSerial = 0;
  const rulesNarrationPlaybackRate = 1.15;
  const demoNarrationPlaybackRate = 1.2;
  const demoNarrationVersion = "20260830-mobile-clarity-v2";
  const slideCompleteHoldMs = 2000;
  const slideChangeNarrationDelayMs = 1400;
  const segmentCueDelaySeconds = 0.32;

  type NarrationCue = {
    index: number;
    text: string;
    start: number;
    end: number;
    speaker?: SlideSpeaker;
    thought?: boolean;
    voiceName?: string;
  };

  type SlideNarration = {
    slideId: string;
    file: string;
    duration: number;
    cps: number;
    segments: NarrationCue[];
  };

  type NarrationManifest = {
    generatedAt: string;
    mode: "slide-level";
    targetCps: number;
    slides: SlideNarration[];
  };

  type PitchPreservingAudio = HTMLAudioElement & {
    preservesPitch?: boolean;
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };

  let narrationManifest = $state<NarrationManifest | null>(null);

  type ResponsiveLines = {
    desktop: string[];
    mobile: string[];
  };

  type SlideLineSet = {
    title?: ResponsiveLines;
    headline?: ResponsiveLines;
    headlineB?: ResponsiveLines;
  };

  const lineBreaks: Record<string, SlideLineSet> = {
    prologue: {
      title: {
        desktop: ["大正115年、", "架空の東京"],
        mobile: ["大正115年、", "架空の東京"]
      },
      headline: {
        desktop: ["世間は、怪盗 透明人間の", "話題でもちきりだ。"],
        mobile: ["世間は、", "怪盗 透明人間の", "話題でもちきりだ。"]
      }
    },
    "invisible-thief": {
      title: {
        desktop: ["見えないものに、", "なろうとする"],
        mobile: ["見えないものに、", "なろうとする"]
      },
      headline: {
        desktop: ["偶然に得た透明になる力で、", "この都の富を浄化する。"],
        mobile: ["透明になる力で、", "この都の富を", "浄化する。"]
      }
    },
    invisibility: {
      title: {
        desktop: ["存在そのものを、", "否定する"],
        mobile: ["存在そのものを、", "否定する"]
      },
      headline: {
        desktop: ["光、温度、音。", "すべてにおいて", "存在を消す。"],
        mobile: ["光、温度、音。", "存在を消す。"]
      }
    },
    "steal-and-run": {
      title: {
        desktop: ["街から街へ、", "宝を奪う"],
        mobile: ["街から街へ、", "宝を奪う"]
      },
      headline: {
        desktop: ["盗みに入る以上、", "多少のリスクは伴う。"],
        mobile: ["盗みに入る以上、", "リスクは伴う。"]
      }
    },
    police: {
      title: {
        desktop: ["見えないものを、", "見ようとする"],
        mobile: ["見えないものを、", "見ようとする"]
      },
      headline: {
        desktop: ["透明になる相手でも、", "屈服は許されない。"],
        mobile: ["透明になる相手でも、", "屈服は許されない。"]
      }
    },
    "search-net": {
      title: {
        desktop: ["街々に、", "捜査網を敷け"],
        mobile: ["街々に、", "捜査網を敷け"]
      },
      headline: {
        desktop: ["どのあたりにいるか。", "目星をつけるのが", "第一歩だ。"],
        mobile: ["どのあたりにいるか。", "目星をつけるのが", "第一歩だ。"]
      }
    },
    intel: {
      title: {
        desktop: ["一点を調べ、", "足取りを追う"],
        mobile: ["一点を調べ、", "足取りを追う"]
      },
      headline: {
        desktop: ["痕跡を丁寧に追えば、", "見えない現在地に", "近づける。"],
        mobile: ["痕跡を丁寧に追えば、", "現在地に近づける。"]
      }
    },
    raid: {
      title: {
        desktop: ["好機を逃さず、", "突入する"],
        mobile: ["好機を逃さず、", "突入する"]
      },
      headline: {
        desktop: ["ヤツがここにいる。", "そう思えば、迷うな。"],
        mobile: ["ヤツがここにいる。", "そう思えば、迷うな。"]
      }
    },
    "game-concept": {
      title: {
        desktop: ["逃げる透明人間と、", "追う警察"],
        mobile: ["逃げる透明人間と、", "追う警察"]
      },
      headline: {
        desktop: ["逃げるドキドキ、", "追い詰めるドキドキ。"],
        mobile: ["逃げるドキドキ、", "追い詰めるドキドキ。"]
      }
    },
    "product-overview": {
      title: {
        desktop: ["透明の", "法則"],
        mobile: ["透明の法則"]
      },
      headline: {
        desktop: ["カード36枚・コマ6個・", "ダイス2個。"],
        mobile: ["カード36枚・コマ6個・", "ダイス2個。"]
      }
    },
    cover: {
      title: {
        desktop: ["透明の", "法則"],
        mobile: ["透明の法則"]
      },
      headline: {
        desktop: ["見えない足跡を、", "向かい合って追う。"],
        mobile: ["見えない足跡を、", "向かい合って追う。"]
      },
      headlineB: {
        desktop: ["相手の「いません」が、", "急に気になりはじめる。"],
        mobile: ["相手の「いません」が、", "急に気になりはじめる。"]
      }
    },
    promise: {
      title: {
        desktop: ["短いのに、", "あとを引く"],
        mobile: ["短いのに、", "あとを引く"]
      },
      headline: {
        desktop: ["15-30分で終わる。", "でも、もう一回が", "言いやすい。"],
        mobile: ["15-30分で終わる。", "でも、もう一回が", "言いやすい。"]
      }
    },
    components: {
      title: {
        desktop: ["小さな箱に、", "追跡劇が", "入っている"],
        mobile: ["小さな箱に、", "追跡劇が入っている"]
      },
      headline: {
        desktop: ["街カード、足跡カード、", "ゲージ、ダイス、", "そして1枚の封鎖。"],
        mobile: ["街カード、足跡カード、", "ゲージ、ダイス、", "そして1枚の封鎖。"]
      }
    },
    setup: {
      title: {
        desktop: ["16枚の街に、", "逃げ道が隠れる"],
        mobile: ["16枚の街に、", "逃げ道が隠れる"]
      },
      headline: {
        desktop: ["小さな盤面なのに、", "どこにいるか", "分からない。"],
        mobile: ["小さな盤面なのに、", "どこにいるか", "分からない。"]
      }
    },
    loop: {
      title: {
        desktop: ["逃げる。", "痕跡が出る。", "囲む。", "問い詰める。"],
        mobile: ["逃げる。", "痕跡が出る。", "囲む。問い詰める。"]
      },
      headline: {
        desktop: ["毎ラウンドは、", "透明人間、痕跡、警察、", "判定の順で進む。"],
        mobile: ["毎ラウンドは、", "透明人間、痕跡、警察、", "判定の順で進む。"]
      }
    },
    invisible: {
      title: {
        desktop: ["逃げ道は、", "戻れない", "足跡になる"],
        mobile: ["逃げ道は、", "戻れない足跡になる"]
      },
      headline: {
        desktop: ["通常移動は1歩。", "透明化はゲーム中1回だけ、", "2歩続けて動ける。"],
        mobile: ["通常移動は1歩。", "透明化は", "ゲーム中1回だけ、", "2歩続けて動ける。"]
      }
    },
    trace: {
      title: {
        desktop: ["ヒントは、", "少しだけ漏れる"],
        mobile: ["ヒントは、", "少しだけ漏れる"]
      },
      headline: {
        desktop: ["場所は秘密。", "でも方角が出ると、", "空気が変わる。"],
        mobile: ["場所は秘密。", "でも方角が出ると、", "空気が変わる。"]
      }
    },
    network: {
      title: {
        desktop: ["囲める。", "でも、疲れる"],
        mobile: ["囲める。", "でも、疲れる"]
      },
      headline: {
        desktop: ["広く探すほど安心。", "攻め続けるほど", "苦しくなる。"],
        mobile: ["広く探すほど安心。", "攻め続けるほど", "苦しくなる。"]
      }
    },
    actions: {
      title: {
        desktop: ["いるなら", "突入。", "いないなら内偵。"],
        mobile: ["いるなら突入。", "いないなら内偵。"]
      },
      headline: {
        desktop: ["逮捕を狙うか、", "足跡を調べるか。", "強い手ほど警察は疲れる。"],
        mobile: ["逮捕を狙うか、", "足跡を調べるか。", "強い手ほど警察は疲れる。"]
      }
    },
    "table-talk": {
      title: {
        desktop: ["嘘はつけない。", "でも疑われる"],
        mobile: ["嘘はつけない。", "でも疑われる"]
      },
      headline: {
        desktop: ["「いません」の一言で、", "相手の顔を", "見てしまう。"],
        mobile: ["「いません」の一言で、", "相手の顔を", "見てしまう。"]
      }
    },
    cta: {
      title: {
        desktop: ["遊ぶ相手が、", "浮かんでくる"],
        mobile: ["遊ぶ相手が、", "浮かんでくる"]
      },
      headline: {
        desktop: ["もっと流れを", "知りたくなったら、", "デモへ。"],
        mobile: ["もっと流れを", "知りたくなったら、", "デモへ。"]
      },
      headlineB: {
        desktop: ["ルールを読む前に、", "誰と遊ぶかが", "浮かんでくる。"],
        mobile: ["ルールを読む前に、", "誰と遊ぶかが", "浮かんでくる。"]
      }
    }
  };

  const assetRoot = import.meta.env.BASE_URL;
  const formalAssetDir = releaseAssets.formal;
  const characterAssetDir = releaseAssets.characters;
  const demoBgmAssetDir = releaseAssets.demoBgm;
  const activeSlides = $derived(deckMode === "demo" ? demoSlides : slides);
  const activeSlideSegments = $derived(deckMode === "demo" ? demoSlideSegments : slideSegments);
  const deckTitle = $derived(deckMode === "demo" ? `透明の法則 デモプレイ解説${demoV2 ? " v2" : ""}` : "透明の法則");
  const companionHref = $derived(deckMode === "demo" ? "../slides/" : "../slides-demo/");
  const companionLabel = $derived(deckMode === "demo" ? "コンセプト説明スライドへ" : "デモプレイ解説へ");
  const current = $derived(activeSlides[activeIndex]);
  const currentSegments = $derived(activeSlideSegments[activeIndex]);
  const displaySegmentIndex = $derived(suppressAudioSync ? 0 : Math.min(activeSegment, currentSegments.length - 1));
  const currentSegment = $derived(currentSegments[displaySegmentIndex] ?? currentSegments[0]);
  const progress = $derived(((activeIndex + 1) / activeSlides.length) * 100);
  const segmentProgress = $derived(Math.max(((displaySegmentIndex + 1) / currentSegments.length) * 100, audioProgress));
  const narrationAssetDir = $derived(
    deckMode === "demo"
      ? releaseAssets.demoNarration
      : releaseAssets.rulesNarration
  );
  const audioSrc = $derived(narrationSrcFor(activeIndex));
  const nextAudioSrc = $derived(activeIndex < activeSlides.length - 1 ? narrationSrcFor(activeIndex + 1) : "");
  const bgmSrc = $derived(assetPath("assets/demo-bgm/dova-2-23-am-loop.webm"));
  const diceFaces = ["一", "二", "三", "四", "五", "六"];
  const demoFlowSteps = [
    { key: "invisible", label: "透明化 / 移動" },
    { key: "trace", label: "痕跡判定" },
    { key: "police-dice", label: "警察ダイス" },
    { key: "network", label: "捜査網" },
    { key: "police-action", label: "警察アクション" }
  ];
  const townNumberMap: Record<string, string> = {
    一: "壱",
    二: "弐",
    三: "参",
    四: "四"
  };
  const diceNumberMap: Record<string, string> = {
    一: "1",
    二: "2",
    三: "3",
    四: "4",
    五: "5",
    六: "6"
  };
  const presentationActive = $derived(presentationMode || fullscreenActive);
  const portraitPreviewActive = $derived(!presentationActive && viewportWidth <= 560 && viewportHeight > viewportWidth);
  const portraitPreviewScale = $derived(Math.max(0.32, Math.min(1, (viewportWidth - 16) / 667)));
  const portraitPreviewHeight = $derived(Math.round(375 * portraitPreviewScale));
  const landscapeFitActive = $derived(
    !presentationActive && viewportWidth <= 1180 && viewportWidth > viewportHeight && viewportHeight <= 620
  );
  const chromeManagedActive = $derived(presentationActive || landscapeFitActive);
  const fullscreenLabel = $derived(presentationActive ? "戻る" : "全画面");
  const deckShellClass = $derived(
    `deck-shell ${deckMode === "demo" ? "demo-deck" : "rules-deck"}${demoV2 ? " demo-v2" : ""}${presentationMode ? " presentation-mode" : ""}${fullscreenActive ? " fullscreen-active" : ""}${
      chromeManagedActive && presentationChromeVisible ? " presentation-chrome-visible" : ""
    }${chromeManagedActive && !presentationChromeVisible ? " presentation-chrome-hidden" : ""}${portraitPreviewActive ? " portrait-preview-mode" : ""}${
      landscapeFitActive ? " fullscreen-active landscape-fit-mode" : ""
    }`
  );

  function assetPath(path: string) {
    const versionedPath = path.startsWith("assets/formal/")
      ? path.replace("assets/formal", formalAssetDir)
      : path.startsWith("assets/characters/")
        ? path.replace("assets/characters", characterAssetDir)
        : path.startsWith("assets/demo-bgm/")
          ? path.replace("assets/demo-bgm", demoBgmAssetDir)
          : path;
    return `${assetRoot}${versionedPath}`;
  }

  function narrationSrcFor(index: number) {
    const cacheKey = deckMode === "demo" ? `?v=${demoNarrationVersion}` : "";
    return `${assetPath(`${narrationAssetDir}/slides/slide-${String(index + 1).padStart(2, "0")}.wav`)}${cacheKey}`;
  }

  function applyNarrationPlaybackSettings(element = audioElement) {
    if (!element) return;
    const pitchElement = element as PitchPreservingAudio;
    element.volume = volume;
    element.playbackRate = deckMode === "demo" ? demoNarrationPlaybackRate : rulesNarrationPlaybackRate;
    pitchElement.preservesPitch = true;
    pitchElement.mozPreservesPitch = true;
    pitchElement.webkitPreservesPitch = true;
  }

  const townCards = Array.from({ length: 16 }, (_, index) =>
    assetPath(`assets/formal/town_${String(index + 1).padStart(2, "0")}.webp`)
  );
  const footprintCards = Array.from({ length: 16 }, (_, index) =>
    assetPath(`assets/formal/footprint_${String(index + 1).padStart(2, "0")}.webp`)
  );

  function headlineFor(slide: Slide) {
    if (variant === "B" && slide.id === "cover") return "相手の「いません」が、急に気になりはじめる。";
    if (variant === "B" && slide.id === "cta") return "ルールを読む前に、誰と遊ぶかが浮かんでくる。";
    return slide.headline;
  }

  function bodyFor(slide: Slide) {
    if (variant === "B" && slide.id === "cover") {
      return "答えは正直。なのに、相手の間や目線まで読みたくなる。短く遊べる、会話の残る追跡ゲームです。";
    }
    return slide.body;
  }

  function fallbackLines(text: string): ResponsiveLines {
    return {
      desktop: [text],
      mobile: [text]
    };
  }

  function titleLinesFor(slide: Slide) {
    return lineBreaks[slide.id]?.title ?? fallbackLines(slide.title);
  }

  function headlineLinesFor(slide: Slide) {
    const preset =
      variant === "B" ? lineBreaks[slide.id]?.headlineB ?? lineBreaks[slide.id]?.headline : lineBreaks[slide.id]?.headline;
    return preset ?? fallbackLines(headlineFor(slide));
  }

  function ratingPointParts(point: string) {
    const match = point.match(/^(.+?[：:]\s*[★☆]+)\s+(.+)$/);
    if (!match) return null;
    return { rating: match[1], detail: match[2] };
  }

  function isRatingPoint(point: string) {
    return ratingPointParts(point) !== null;
  }

  function ratingPointLine(point: string) {
    return ratingPointParts(point)?.rating ?? point;
  }

  function ratingPointDetail(point: string) {
    return ratingPointParts(point)?.detail ?? "";
  }

  function revealedPointCount(pointCount: number, slideIndex: number) {
    if (slideIndex !== activeIndex) return 0;
    return Math.max(1, Math.ceil(((displaySegmentIndex + 1) / currentSegments.length) * pointCount));
  }

  function pointVisibleFor(slide: Slide, slideIndex: number, pointIndex: number) {
    if (slideIndex !== activeIndex) return false;
    const revealSegment = slide.demo?.pointRevealSegments?.[pointIndex];
    if (deckMode === "demo" && revealSegment !== undefined) return displaySegmentIndex >= revealSegment;
    return pointIndex < revealedPointCount(slide.points.length, slideIndex);
  }

  function spotlightPointFor(slide: Slide, slideIndex: number) {
    if (slideIndex !== activeIndex) return -1;
    let spotlight = -1;
    for (let index = 0; index < slide.points.length; index += 1) {
      if (pointVisibleFor(slide, slideIndex, index)) spotlight = index;
    }
    return spotlight;
  }

  function withTransition(update: () => void) {
    if (deckMode === "demo") {
      update();
      return;
    }
    const startViewTransition = (
      document as Document & { startViewTransition?: (callback: () => void) => void }
    ).startViewTransition;
    if (typeof startViewTransition === "function") {
      startViewTransition.call(document, update);
      return;
    }
    update();
  }

  function pauseAudio(options: { pauseBackground?: boolean } = {}) {
    const { pauseBackground = true } = options;
    playbackSerial += 1;
    audioElement?.pause();
    if (pauseBackground) pauseBgm();
    audioStatus = "idle";
  }

  function beginPlaybackRequest() {
    playbackSerial += 1;
    return playbackSerial;
  }

  function pauseBgm() {
    bgmElement?.pause();
  }

  async function playBgm() {
    if (deckMode !== "demo" || !bgmEnabled || !bgmElement) return;
    bgmElement.volume = bgmVolume;
    try {
      await bgmElement.play();
    } catch {
      // BGM is supportive only; narration should continue even if a browser blocks it.
    }
  }

  function toggleBgm() {
    bgmEnabled = !bgmEnabled;
    if (!bgmEnabled) {
      pauseBgm();
      trackEvent("bgm_toggle", { enabled: false });
      return;
    }
    if (audioStatus === "playing") void playBgm();
    trackEvent("bgm_toggle", { enabled: true });
  }

  function waitForAudioReady(element: HTMLAudioElement) {
    if (element.readyState >= 2) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timer);
        element.removeEventListener("canplay", onReady);
        element.removeEventListener("loadeddata", onReady);
        element.removeEventListener("error", onError);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error("audio load failed"));
      };
      const timer = window.setTimeout(() => {
        cleanup();
        resolve();
      }, 2500);
      element.addEventListener("canplay", onReady, { once: true });
      element.addEventListener("loadeddata", onReady, { once: true });
      element.addEventListener("error", onError, { once: true });
    });
  }

  $effect(() => {
    if (!nextAudioElement || !nextAudioSrc) return;
    nextAudioElement.load();
  });

  function sleep(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function orientationController() {
    return screen.orientation as ScreenOrientation & {
      lock?: (orientation: OrientationLockType) => Promise<void>;
      unlock?: () => void;
    };
  }

  async function lockLandscape() {
    try {
      await orientationController().lock?.("landscape" as OrientationLockType);
    } catch {
      // Some mobile browsers, notably iOS Safari, do not expose orientation lock.
    }
  }

  function unlockOrientation() {
    try {
      orientationController().unlock?.();
    } catch {
      // Orientation unlock is best-effort only.
    }
  }

  function shouldAutoEnterPresentation() {
    if (presentationMode || fullscreenActive || typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 980px), (pointer: coarse)").matches;
  }

  function clearChromeTimer() {
    if (chromeHideTimer) window.clearTimeout(chromeHideTimer);
    chromeHideTimer = undefined;
  }

  function hidePresentationChrome() {
    clearChromeTimer();
    presentationChromeVisible = false;
    lastChromePointer = null;
  }

  function revealPresentationChrome() {
    if (!chromeManagedActive) return;
    presentationChromeVisible = true;
    clearChromeTimer();
    chromeHideTimer = window.setTimeout(() => {
      presentationChromeVisible = false;
      chromeHideTimer = undefined;
    }, 2800);
  }

  function handlePresentationPointerMove(event: PointerEvent) {
    if (!chromeManagedActive || event.pointerType === "touch") return;
    if (lastChromePointer) {
      const dx = Math.abs(event.clientX - lastChromePointer.x);
      const dy = Math.abs(event.clientY - lastChromePointer.y);
      if (dx < 4 && dy < 4) return;
    }
    lastChromePointer = { x: event.clientX, y: event.clientY };
    revealPresentationChrome();
  }

  function handlePresentationTap(event: PointerEvent) {
    if (!chromeManagedActive) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button, a, input, label")) return;
    revealPresentationChrome();
  }

  async function enterPresentationMode(source = "manual") {
    presentationMode = true;
    hidePresentationChrome();
    fullscreenError = false;
    const target = deckShell ?? document.documentElement;
    const requestFullscreen = target.requestFullscreen?.bind(target);
    trackEvent("presentation_mode_enter", {
      source,
      fullscreen_supported: Boolean(requestFullscreen),
      already_fullscreen: Boolean(document.fullscreenElement)
    });
    if (document.fullscreenElement) {
      fullscreenActive = true;
      await lockLandscape();
      return;
    }
    if (!requestFullscreen) {
      fullscreenError = true;
      return;
    }
    try {
      await requestFullscreen({ navigationUI: "hide" } as FullscreenOptions);
      fullscreenActive = true;
      await lockLandscape();
    } catch {
      fullscreenError = true;
    }
  }

  async function exitPresentationMode(source = "manual") {
    trackEvent("presentation_mode_exit", { source, fullscreen_active: fullscreenActive });
    presentationMode = false;
    fullscreenError = false;
    hidePresentationChrome();
    unlockOrientation();
    if (!document.fullscreenElement) {
      fullscreenActive = false;
      return;
    }
    try {
      await document.exitFullscreen();
    } catch {
      fullscreenActive = Boolean(document.fullscreenElement);
    }
  }

  async function togglePresentationMode(source = "toolbar") {
    if (presentationMode || fullscreenActive) {
      await exitPresentationMode(source);
      return;
    }
    await enterPresentationMode(source);
  }

  function speechChars(text: string) {
    return Math.max(1, text.replace(/[\s\p{P}\p{S}]/gu, "").length);
  }

  function estimatedCues(slideIndex = activeIndex) {
    const segments = activeSlideSegments[slideIndex];
    const duration = audioElement && Number.isFinite(audioElement.duration) ? Math.max(0.1, audioElement.duration - 0.22) : segments.length;
    const weights = segments.map((segment) => Math.max(speechChars(segment.text) / 5, 1.35));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let cursor = 0;
    return segments.map((segment, segmentIndex) => {
      const start = cursor;
      cursor += (weights[segmentIndex] / total) * duration;
      return { index: segmentIndex, text: segment.text, start, end: cursor };
    });
  }

  function cuesFor(slideIndex = activeIndex) {
    const manifestSlide = narrationManifest?.slides?.[slideIndex];
    if (manifestSlide?.segments?.length) return manifestSlide.segments;
    return estimatedCues(slideIndex);
  }

  function cueStart(index: number) {
    return cuesFor(activeIndex)[index]?.start ?? 0;
  }

  function audioElementUsesCurrentSource(element: HTMLAudioElement) {
    const expected = new URL(audioSrc, window.location.href).href;
    const loadedSource = element.currentSrc || element.src;
    return !loadedSource || loadedSource === expected;
  }

  function syncSegmentFromAudio() {
    const element = audioElement;
    if (suppressAudioSync) return;
    if (!element || !Number.isFinite(element.duration) || element.duration <= 0) return;
    if (!audioElementUsesCurrentSource(element)) return;
    audioProgress = Math.max(0, Math.min(100, (element.currentTime / element.duration) * 100));
    const cues = cuesFor(activeIndex);
    let segmentIndex = 0;
    for (const cue of cues) {
      const delay = cue.index === 0 ? 0 : segmentCueDelaySeconds;
      if (element.currentTime >= cue.start + delay) segmentIndex = cue.index;
    }
    if (segmentIndex >= 0 && segmentIndex !== activeSegment) activeSegment = segmentIndex;
  }

  function beginSlideAudioReset() {
    suppressAudioSync = true;
    slideChangeSerial += 1;
    playbackSerial += 1;
    return slideChangeSerial;
  }

  async function settleAudioAfterSlideChange(serial: number) {
    await tick();
    if (serial !== slideChangeSerial) return false;
    const element = audioElement;
    if (element) {
      element.pause();
      try {
        element.currentTime = 0;
      } catch {
        // The new source can be unavailable for a tick on slower browsers.
      }
      element.load();
      applyNarrationPlaybackSettings(element);
    }
    activeSegment = 0;
    audioProgress = 0;
    suppressAudioSync = false;
    return true;
  }

  async function goTo(index: number, source = "nav") {
    const next = Math.max(0, Math.min(activeSlides.length - 1, index));
    if (next === activeIndex) return;
    const shouldResume = autoplay || audioStatus === "playing";
    trackEvent("slide_nav", {
      source,
      from_slide: activeSlides[activeIndex].id,
      to_slide: activeSlides[next].id,
      from_index: activeIndex + 1,
      to_index: next + 1
    });
    pauseAudio({ pauseBackground: !shouldResume });
    const serial = beginSlideAudioReset();
    withTransition(() => {
      activeIndex = next;
      activeSegment = 0;
      audioProgress = 0;
    });
    const settled = await settleAudioAfterSlideChange(serial);
    if (shouldResume) {
      if (!settled) return;
      const requestSerial = beginPlaybackRequest();
      await sleep(slideChangeNarrationDelayMs);
      if (serial !== slideChangeSerial || requestSerial !== playbackSerial || activeIndex !== next) return;
      await playCurrent("nav_resume", true, requestSerial);
    }
  }

  async function playCurrent(source = "manual", reload = false, requestSerial = beginPlaybackRequest()) {
    const element = audioElement;
    if (!element) return;
    const slideIndexAtStart = activeIndex;
    const slideIdAtStart = current.id;
    const isStalePlayback = () => requestSerial !== playbackSerial || activeIndex !== slideIndexAtStart || audioElement !== element;
    applyNarrationPlaybackSettings(element);
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (isStalePlayback()) return;
        if (reload || attempt > 0) {
          audioStatus = "idle";
          element.pause();
          element.load();
          await waitForAudioReady(element);
        }
        if (isStalePlayback()) return;
        if (!audioElementUsesCurrentSource(element)) return;
        if (attempt > 0 && activeSegment === 0) element.currentTime = 0;
        await element.play();
        await sleep(120);
        if (isStalePlayback()) return;
        if (!element.paused || audioElement !== element) break;
      }
      if (isStalePlayback()) return;
      if (element.paused) throw new Error("audio did not remain playing");
      audioStatus = "playing";
      await playBgm();
      if (isStalePlayback()) return;
      trackEvent("audio_play", {
        source,
        slide_id: slideIdAtStart,
        slide_index: slideIndexAtStart + 1,
        segment_index: activeSegment + 1
      });
    } catch {
      if (isStalePlayback()) return;
      autoplay = false;
      pauseBgm();
      audioStatus = "blocked";
      trackEvent("audio_blocked", { slide_id: slideIdAtStart, segment_index: activeSegment + 1 });
    }
  }

  async function toggleAudio() {
    if (!audioElement) return;
    if (audioElement.paused) {
      if (shouldAutoEnterPresentation()) await enterPresentationMode("audio_button");
      await playCurrent("button");
      return;
    }
    pauseAudio();
    trackEvent("audio_pause", { slide_id: current.id, segment_index: activeSegment + 1 });
  }

  async function toggleAutoplay() {
    const willStart = !autoplay;
    if (willStart && shouldAutoEnterPresentation()) await enterPresentationMode("autoplay_button");
    autoplay = willStart;
    trackEvent(autoplay ? "autoplay_start" : "autoplay_stop", {
      slide_id: current.id,
      slide_index: activeIndex + 1
    });
    if (autoplay) await playCurrent("autoplay");
    else pauseAudio();
  }

  async function handleAudioEnded() {
    audioStatus = "idle";
    activeSegment = currentSegments.length - 1;
    audioProgress = 100;
    trackEvent("audio_slide_complete", {
      slide_id: current.id,
      slide_index: activeIndex + 1,
      segment_count: currentSegments.length
    });
    if (!autoplay) {
      pauseBgm();
      return;
    }
    if (activeIndex >= activeSlides.length - 1) {
      autoplay = false;
      pauseBgm();
      trackEvent("deck_complete", { variant });
      return;
    }
    const completedIndex = activeIndex;
    await sleep(slideCompleteHoldMs);
    if (!autoplay || activeIndex !== completedIndex) {
      pauseBgm();
      return;
    }
    const serial = beginSlideAudioReset();
    withTransition(() => {
      activeIndex += 1;
      activeSegment = 0;
      audioProgress = 0;
    });
    const settled = await settleAudioAfterSlideChange(serial);
    if (!settled) return;
    const requestSerial = beginPlaybackRequest();
    await sleep(slideChangeNarrationDelayMs);
    if (serial !== slideChangeSerial || requestSerial !== playbackSerial) return;
    await playCurrent("autoplay_slide", true, requestSerial);
  }

  async function seekSegment(index: number) {
    const wasPlaying = Boolean(audioElement && !audioElement.paused);
    activeSegment = Math.max(0, Math.min(currentSegments.length - 1, index));
    if (audioElement) {
      audioElement.currentTime = cueStart(activeSegment);
      syncSegmentFromAudio();
    }
    trackEvent("segment_seek", {
      slide_id: current.id,
      slide_index: activeIndex + 1,
      segment_index: activeSegment + 1
    });
    if (wasPlaying || autoplay) await playCurrent("segment_seek");
  }

  function printDeck() {
    trackEvent("pdf_export_intent", { slide_id: current.id });
    window.print();
  }

  function restartDeck() {
    trackEvent("restart_deck", { from_slide: current.id });
    pauseAudio();
    const serial = beginSlideAudioReset();
    withTransition(() => {
      activeIndex = 0;
      activeSegment = 0;
      audioProgress = 0;
    });
    void settleAudioAfterSlideChange(serial);
  }

  function speakerName(speaker?: SlideSpeaker) {
    if (speaker === "narrator") return "ナレーション";
    if (speaker === "thief") return "怪盗 透明人間";
    if (speaker === "police") return "警察";
    if (speaker === "zundamon") return "ずんだもん";
    if (speaker === "metan") return "四国めたん";
    return "";
  }

  async function shareDeck() {
    const shareData = {
      title: deckMode === "demo" ? "透明の法則 デモプレイ解説" : "透明の法則 音声つき説明スライド",
      text:
        deckMode === "demo"
          ? "ずんだもん・四国めたんと一手ずつ追う、アナログゲーム「透明の法則」のデモプレイ解説。"
          : "見えない逃走者を、向かい合って追い詰めるアナログゲーム「透明の法則」。",
      url: window.location.href
    };
    trackEvent("share_intent", { slide_id: current.id });
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
      }
      trackEvent("share_complete", { slide_id: current.id });
    } catch {
      trackEvent("share_cancel", { slide_id: current.id });
    }
  }

  function visualClass(visual: SlideVisual) {
    return `visual visual-${visual}`;
  }

  function boardCells(mode: "plain" | "search" | "path") {
    const names = ["阿一", "阿二", "阿三", "阿四", "伊一", "伊二", "伊三", "伊四", "宇一", "宇二", "宇三", "宇四", "江一", "江二", "江三", "江四"];
    return names.map((name, index) => ({
      name,
      src: townCards[index],
      blocked: index === 6,
      path: mode === "path" && [1, 5, 10, 11].includes(index),
      search: mode === "search" && [4, 5, 8, 9].includes(index),
      current: mode === "path" && index === 11
    }));
  }

  function storyBoardCells(mode: "heist" | "police" | "search" | "intel" | "raid" | "duel") {
    const names = ["阿一", "阿二", "阿三", "阿四", "伊一", "伊二", "伊三", "伊四", "宇一", "宇二", "宇三", "宇四", "江一", "江二", "江三", "江四"];
    const config = {
      heist: {
        path: [0, 1, 5, 10, 15],
        current: [15],
        treasure: [0, 5, 10],
        footprint: [1, 5, 10],
        searched: [],
        target: [],
        intel: []
      },
      police: {
        path: [],
        current: [],
        treasure: [],
        footprint: [1, 5, 10],
        searched: [4, 5, 8, 9],
        target: [5],
        intel: [10]
      },
      search: {
        path: [],
        current: [],
        treasure: [],
        footprint: [1, 5],
        searched: [4, 5, 8, 9],
        target: [],
        intel: []
      },
      intel: {
        path: [],
        current: [],
        treasure: [],
        footprint: [1, 5, 10],
        searched: [8, 9, 12, 13],
        target: [],
        intel: [10]
      },
      raid: {
        path: [],
        current: [11],
        treasure: [],
        footprint: [1, 5, 10],
        searched: [3, 7, 11],
        target: [11],
        intel: []
      },
      duel: {
        path: [0, 1, 5, 10, 15],
        current: [15],
        treasure: [0, 5, 10],
        footprint: [1, 5, 10, 14],
        searched: [3, 7, 11],
        target: [11],
        intel: []
      }
    }[mode];
    return names.map((name, index) => ({
      name,
      src: townCards[index],
      blocked: index === 6,
      path: config.path.includes(index),
      current: config.current.includes(index),
      treasure: config.treasure.includes(index),
      footprint: config.footprint.includes(index),
      searched: config.searched.includes(index),
      target: config.target.includes(index),
      intel: config.intel.includes(index)
    }));
  }

  function demoBoardCells(slide: Slide) {
    const state = slide.demo;
    const search = new Set(state?.search ?? []);
    const footprints = new Set(state?.footprints ?? []);
    const showSearch = demoSearchRevealed(slide);
    const showTarget = demoTargetRevealed(slide);
    const names = ["阿一", "阿二", "阿三", "阿四", "伊一", "伊二", "伊三", "伊四", "宇一", "宇二", "宇三", "宇四", "江一", "江二", "江三", "江四"];
    return names.map((name, index) => ({
      name,
      src: townCards[index],
      blocked: index === 6,
      footprint: footprints.has(index),
      search: showSearch && search.has(index),
      current: state?.current === index && !state.hiddenCurrent,
      secretCurrent: state?.current === index && Boolean(state.hiddenCurrent),
      previous: state?.previous === index,
      target: showTarget && state?.target === index
    }));
  }

  function isActiveDemoSlide(slide: Slide) {
    return deckMode === "demo" && current.id === slide.id;
  }

  function isDemoPlaying(slide: Slide) {
    return isActiveDemoSlide(slide) && audioStatus === "playing";
  }

  function demoCueVisible(slide: Slide, minSegment = 0) {
    return isActiveDemoSlide(slide) && (audioStatus === "playing" || audioProgress > 0) && activeSegment >= minSegment;
  }

  function demoStageClass(slide: Slide) {
    return `demo-stage cue-${isActiveDemoSlide(slide) ? activeSegment : 0}${isDemoPlaying(slide) ? " cue-playing" : ""}`;
  }

  function demoStatusVisible(slide: Slide, statusIndex: number) {
    if (!isActiveDemoSlide(slide)) return true;
    return statusIndex <= displaySegmentIndex;
  }

  function demoCellIsEmphasized(slide: Slide, cell: ReturnType<typeof demoBoardCells>[number]) {
    if (!isDemoPlaying(slide)) return false;
    if (displaySegmentIndex === 0) return cell.previous || cell.current || cell.secretCurrent || cell.footprint;
    if (displaySegmentIndex === 1) return cell.search || cell.target;
    return cell.search || cell.current || cell.secretCurrent || cell.target || cell.footprint;
  }

  function demoGaugeForSlide(slide: Slide) {
    if (!slide.demo) return null;
    const scheduledGauge = slide.demo.gaugeBySegment ?? [];
    if (!isActiveDemoSlide(slide)) return scheduledGauge[0] ?? slide.demo.gauge;
    const timedGauge = [...scheduledGauge]
      .filter((item) => displaySegmentIndex >= item.segment)
      .sort((a, b) => b.segment - a.segment)[0];
    return timedGauge ?? scheduledGauge[0] ?? slide.demo.gauge;
  }

  function demoFatiguePoint(value?: string) {
    const fatigue = Number.parseInt(String(value ?? "0").replace(/[^\d-]/g, ""), 10);
    return Math.max(0, Math.min(6, Number.isFinite(fatigue) ? fatigue : 0));
  }

  function demoTipPoint(value?: string) {
    const text = String(value ?? "0");
    if (text.includes("+3")) return "plus-3";
    if (text.includes("+1")) return "plus-1";
    if (text.includes("白")) return "white-0";
    return "yellow-0";
  }

  function demoTurnInfo(slide: Slide) {
    if (slide.demo?.turnInfo) return slide.demo.turnInfo;
    const flow: Record<string, { turn: string; action: string; options: string; next: string }> = {
      "demo-cover": {
        turn: "導入",
        action: "今回のデモで見る範囲を確認",
        options: "移動 / 痕跡 / ゲージ / 捜査を順番に見る",
        next: "盤面の前提へ"
      },
      "demo-setup": {
        turn: "前提",
        action: "4×4の街・封鎖・ゲージを確認",
        options: "開始地点は秘密 / 疲弊0から開始",
        next: "透明人間の1手目へ"
      },
      "demo-move-1": {
        turn: "透明人間の手番",
        action: "隣の街へ1歩移動",
        options: "通常移動 / 透明化2歩 / 動けない道を避ける",
        next: "痕跡ダイスへ"
      },
      "demo-trace-1": {
        turn: "痕跡判定",
        action: "透明人間が痕跡ダイスを振る",
        options: "ゾロ目なら方角公開 / それ以外はなし",
        next: "警察のゲージ確認へ"
      },
      "demo-gauge-1": {
        turn: "警察の手番",
        action: "警察ダイス2個の大きい方から疲弊を引く",
        options: "二・四 -> 四、疲弊0で4枚まで",
        next: "四角形で質問へ"
      },
      "demo-network-yes": {
        turn: "警察の手番",
        action: "四角形の捜査網で現在地を質問",
        options: "いるなら突入 / 休憩 / 読む",
        next: "めたんは突入を選ぶ"
      },
      "demo-raid-miss": {
        turn: "警察の選択",
        action: "範囲内の1枚へ突入",
        options: "突入して逮捕を狙う / 外して情報を残す",
        next: "透明人間の次の移動へ"
      },
      "demo-move-2": {
        turn: "透明人間の手番",
        action: "もう1歩逃げて足跡を増やす",
        options: "安全な隣接先へ移動 / 過去の足跡には戻らない",
        next: "もう一度、痕跡判定へ"
      },
      "demo-trace-direction": {
        turn: "痕跡判定",
        action: "ゾロ目なので方角だけ公開する",
        options: "場所は言わない / 移動方向だけ伝える",
        next: "警察のゲージ確認へ"
      },
      "demo-gauge-2": {
        turn: "警察の手番",
        action: "もう一度、大きい出目から疲弊を引く",
        options: "三・四 -> 四、疲弊2で2枚まで",
        next: "2回目の質問へ"
      },
      "demo-network-yes-2": {
        turn: "警察の手番",
        action: "前の捜査網と南移動から2枚を質問",
        options: "いるなら突入 / 休憩",
        next: "疲弊を戻す判断へ"
      },
      "demo-rest": {
        turn: "警察の選択",
        action: "二択で突入せず疲弊を戻す",
        options: "休憩 / 突入 / 次の捜査網",
        next: "中盤の逃走へ"
      },
      "demo-mid-rounds": {
        turn: "ラウンド3-5",
        action: "逃走と捜査が続き足跡が増える",
        options: "移動 / 痕跡 / 捜査網 / 内偵",
        next: "勝利条件が近づく"
      },
      "demo-pressure-rounds": {
        turn: "ラウンド6-8",
        action: "透明化で危機を抜け、足跡10枚へつなぐ",
        options: "R6透明化 / R7・R8通常移動",
        next: "ラウンド8の警察最終手番へ"
      },
      "demo-gauge-final": {
        turn: "ラウンド8 警察",
        action: "警察ダイス2個から捜査網の上限を決める",
        options: "大きい出目 - 疲弊 = 上限枚数",
        next: "本命の捜査網へ"
      },
      "demo-final-decision": {
        turn: "勝負を分けた判断",
        action: "R6で透明化を切り、その後は通常移動で10地点へ",
        options: "危機回避 / 経路維持 / 最終質問回避",
        next: "要点まとめへ"
      },
      "demo-summary": {
        turn: "まとめ",
        action: "両者の勝ち方と透明化を三点で整理",
        options: "10地点 / 突入 / 透明化",
        next: "コンセプト説明スライドへ戻る"
      }
    };
    return flow[slide.id] ?? flow["demo-cover"];
  }

  function formatTownNumbers(text: string) {
    return text.replace(/([阿伊宇江])([一二三四])(丁目)?/g, (_, area: string, number: string, suffix = "") => {
      return `${area}${townNumberMap[number] ?? number}${suffix}`;
    });
  }

  function formatDiceNumbers(text: string) {
    return text
      .replace(/([一二三四五六])・([一二三四五六])/g, (_, left: string, right: string) => `${diceNumberMap[left]}・${diceNumberMap[right]}`)
      .replace(/(出目[:：]\s*)([一二三四五六])/g, (_, prefix: string, number: string) => `${prefix}${diceNumberMap[number]}`)
      .replace(/(警察ダイス[:：]\s*)([一二三四五六])/g, (_, prefix: string, number: string) => `${prefix}${diceNumberMap[number]}`)
      .replace(/(痕跡ダイス[:：]\s*)([一二三四五六])/g, (_, prefix: string, number: string) => `${prefix}${diceNumberMap[number]}`)
      .replace(/(採用[:：]\s*)([一二三四五六])/g, (_, prefix: string, number: string) => `${prefix}${diceNumberMap[number]}`);
  }

  function formatDemoPanelText(text = "") {
    return formatDiceNumbers(formatTownNumbers(text));
  }

  function demoStepLabel(slide: Slide) {
    const step = slide.demo?.step ?? "";
    const mapped: Record<string, string> = {
      DEMO: "導入",
      SETUP: "前提",
      TRACE: "痕跡判定",
      GAUGE: "警察ダイス",
      SEARCH: "捜査網",
      RAID: "警察アクション",
      REST: "休憩",
      SUMMARY: "まとめ"
    };
    if (mapped[step]) return mapped[step];
    if (/R\d+\s+STEALTH/.test(step)) return step.replace(/R(\d+)\s+STEALTH/, "ラウンド$1 透明化");
    if (/R\d+\s+POLICE/.test(step)) return step.replace(/R(\d+)\s+POLICE/, "ラウンド$1 警察");
    if (/R\d+\s+END/.test(step)) return step.replace(/R(\d+)\s+END/, "ラウンド$1 決着");
    return formatDemoPanelText(demoTurnInfo(slide).turn);
  }

  function demoActiveFlowStep(slide: Slide) {
    const mode = slide.demo?.boardMode;
    if (slide.id.includes("round-9-move") || slide.id.includes("final-decision")) return "invisible";
    if (mode === "move" || mode === "capture") return slide.demo?.speaker === "zundamon" ? "invisible" : "police-action";
    if (mode === "trace-none" || mode === "trace-direction") return "trace";
    if (mode === "gauge") return "police-dice";
    if (mode === "search" || mode === "search-no") return "network";
    if (mode === "raid-miss" || mode === "intel" || mode === "rest" || mode === "summary") return "police-action";
    return "invisible";
  }

  function shouldDiceRoll(slide: Slide) {
    return isDemoPlaying(slide) && Boolean(slide.demo?.dice?.length) && displaySegmentIndex === 0;
  }

  function isDiceRolling(slide: Slide) {
    return shouldDiceRoll(slide) && !diceRollSettled;
  }

  function segmentForSlide(slideIndex: number) {
    const segments = activeSlideSegments[slideIndex] ?? [];
    const segmentIndex = slideIndex === activeIndex ? displaySegmentIndex : 0;
    return segments[segmentIndex] ?? segments[0] ?? currentSegment;
  }

  function isThoughtSegment(segment = currentSegment) {
    return segment.speaker === "zundamon" && Boolean(segment.thought);
  }

  function speakerLabelFor(segment = currentSegment) {
    if (isThoughtSegment(segment)) return "ずんだもん 秘密情報";
    return speakerName(segment.speaker);
  }

  function demoDieFace(slide: Slide, die: string, dieIndex: number) {
    if (!isDiceRolling(slide)) return die;
    return diceFaces[(diceRollTick + dieIndex * 2) % diceFaces.length];
  }

  function dieValue(face: string | number) {
    const value = Number(face);
    if (Number.isFinite(value) && value >= 1 && value <= 6) return value;
    const index = diceFaces.indexOf(String(face));
    return index >= 0 ? index + 1 : 1;
  }

  function demoDieValue(slide: Slide, die: string, dieIndex: number) {
    return dieValue(demoDieFace(slide, die, dieIndex));
  }

  function demoDiceLabel(slide: Slide) {
    if (slide.demo?.diceLabel) return slide.demo.diceLabel;
    const mode = slide.demo?.boardMode;
    if (mode === "gauge" || mode === "search" || mode === "intel") return "警察ダイス: めたん";
    return "痕跡ダイス: ずんだもん";
  }

  function demoDiceVisible(slide: Slide) {
    if (!slide.demo?.dice?.length) return false;
    if (!isActiveDemoSlide(slide)) return false;
    const text = currentSegment.text;
    return /ダイス|出目|ゾロ目/.test(text) || (isPoliceDiceSlide(slide) && displaySegmentIndex <= 1);
  }

  function isPoliceDiceSlide(slide: Slide) {
    if (slide.demo?.diceLabel) return slide.demo.diceLabel.startsWith("警察");
    const mode = slide.demo?.boardMode;
    return mode === "gauge" || mode === "search" || mode === "intel";
  }

  function demoSearchRevealed(slide: Slide) {
    if (!isActiveDemoSlide(slide)) return true;
    if (isPoliceDiceSlide(slide) && slide.demo?.dice?.length && slide.demo?.search?.length) return activeSegment >= 2;
    return true;
  }

  function demoTargetRevealed(slide: Slide) {
    if (!isActiveDemoSlide(slide)) return true;
    return displaySegmentIndex >= (slide.demo?.targetRevealSegment ?? 0);
  }

  function demoQuestionRevealed(slide: Slide) {
    if (!isActiveDemoSlide(slide)) return true;
    if (isPoliceDiceSlide(slide) && slide.demo?.dice?.length && slide.demo?.search?.length) return displaySegmentIndex >= 3;
    return displaySegmentIndex >= 1;
  }

  function demoDirectionRevealed(slide: Slide) {
    if (!isActiveDemoSlide(slide)) return true;
    const revealSegment = slide.demo?.directionRevealSegment ?? slide.demo?.targetRevealSegment ?? 0;
    return displaySegmentIndex >= revealSegment;
  }

  function demoAnswerLabel(slide: Slide) {
    const answer = slide.demo?.answer;
    if (!answer) return "プレイ進行";
    if (!isActiveDemoSlide(slide)) return answer;
    const fallbackReveal =
      answer === "いる" || answer === "いない"
        ? isPoliceDiceSlide(slide) && slide.demo?.dice?.length && slide.demo?.search?.length
          ? 3
          : 1
        : slide.demo?.targetRevealSegment ?? 1;
    const revealSegment = slide.demo?.answerRevealSegment ?? fallbackReveal;
    return displaySegmentIndex >= revealSegment ? answer : "プレイ進行";
  }

  function isChosenPoliceDie(slide: Slide, die: string) {
    if (!isPoliceDiceSlide(slide)) return false;
    const dice = slide.demo?.dice ?? [];
    if (dice.length < 2 || isDiceRolling(slide)) return false;
    const max = Math.max(...dice.map((item) => dieValue(item)));
    return dieValue(die) === max;
  }

  function demoSearchQuestion(slide: Slide) {
    const answer = slide.demo?.answer;
    if (answer !== "いる" && answer !== "いない") return null;
    if (!slide.demo?.search?.length) return null;
    return {
      question: "この中にいますか?",
      answer: answer === "いる" ? "います" : "いません"
    };
  }

  function demoDecisionOptions(slide: Slide) {
    if (isActiveDemoSlide(slide) && displaySegmentIndex < (slide.demo?.decisionRevealSegment ?? 2)) return [];
    const answer = slide.demo?.answer;
    if (slide.id === "demo-network-yes" || answer === "いる") return ["突入する", "休憩する", "次に備えて読む"];
    if (slide.id === "demo-network-no" || answer === "いない") return ["捜査網内を内偵", "休憩する", "候補から外す"];
    if (slide.id === "demo-gauge-1") return ["二・四", "四を採用", "疲弊0", "4枚まで"];
    if (slide.id === "demo-gauge-2") return ["三・四", "四を採用", "疲弊2", "2枚まで"];
    if (slide.id === "demo-gauge-final") return ["1枚だけ質問", "外れたら終了", "警察の最終手番"];
    if (slide.id === "demo-final-decision") return ["R6透明化", "危機回避", "R7・R8通常移動"];
    return [];
  }


  function demoSpeakerClass(slide: Slide, speaker: DemoSpeaker) {
    const isCurrentSpeaker = isDemoPlaying(slide) && currentSegment.speaker === speaker;
    const isThinking = isCurrentSpeaker && isThoughtSegment();
    const isSpeaking = isCurrentSpeaker && !isThinking;
    return `demo-character ${speaker}${isSpeaking ? " speaking" : ""}${isThinking ? " thinking" : ""}`;
  }

  onMount(() => {
    const syncViewport = () => {
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
    };
    const syncFullscreenState = () => {
      fullscreenActive = Boolean(document.fullscreenElement);
      if (!fullscreenActive) {
        presentationMode = false;
        fullscreenError = false;
        hidePresentationChrome();
        unlockOrientation();
      }
    };
    const noteFullscreenError = () => {
      fullscreenError = true;
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("fullscreenerror", noteFullscreenError);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);
    variant = getVariant();
    initAnalytics(variant);
    const searchParams = new URLSearchParams(window.location.search);
    demoV2 = window.location.pathname.includes("slides-demo-v2") || searchParams.get("demoVersion") === "v2" || searchParams.has("v2");
    deckMode = window.location.pathname.includes("slides-demo") || searchParams.has("demo") ? "demo" : "rules";
    void fetch(
      `${assetPath(`${narrationAssetDir}/slide-manifest.json`)}${
        deckMode === "demo" ? `?v=${demoNarrationVersion}` : ""
      }`,
      {
        cache: "no-store"
      }
    )
      .then((response) => {
        if (!response.ok) throw new Error(`manifest ${response.status}`);
        return response.json();
      })
      .then((manifest: NarrationManifest) => {
        narrationManifest = manifest;
        trackEvent("narration_manifest_loaded", {
          mode: manifest.mode,
          slide_count: manifest.slides.length,
          target_cps: manifest.targetCps,
          playback_rate: deckMode === "demo" ? demoNarrationPlaybackRate : rulesNarrationPlaybackRate
        });
      })
      .catch(() => {
        trackEvent("narration_manifest_missing", { mode: "estimated" });
      });
    trackEvent("deck_view", {
      variant,
      deck_mode: deckMode,
      demo_version: demoV2 ? "v2" : "classic",
      playback_rate: deckMode === "demo" ? demoNarrationPlaybackRate : rulesNarrationPlaybackRate,
      slide_count: activeSlides.length,
      segment_count: activeSlideSegments.reduce((total, segments) => total + segments.length, 0)
    });
    return () => {
      clearChromeTimer();
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("fullscreenerror", noteFullscreenError);
    };
  });

  $effect(() => {
    const currentDiceKey = `${activeIndex}:${activeSegment}:${current.id}`;
    const shouldRoll = shouldDiceRoll(current);
    if (diceRollKey !== currentDiceKey) {
      diceRollKey = currentDiceKey;
      diceRollSettled = false;
    }
    if (!shouldRoll || diceRollSettled) {
      if (diceRollTimer !== undefined) {
        window.clearInterval(diceRollTimer);
        diceRollTimer = undefined;
      }
      if (!shouldRoll && diceSettleTimer !== undefined) {
        window.clearTimeout(diceSettleTimer);
        diceSettleTimer = undefined;
      }
      diceRollTick = 0;
      return;
    }
    diceRollTimer = window.setInterval(() => {
      diceRollTick = (diceRollTick + 1) % diceFaces.length;
    }, 110);
    diceSettleTimer = window.setTimeout(() => {
      diceRollSettled = true;
      diceSettleTimer = undefined;
    }, 980);
    return () => {
      if (diceRollTimer !== undefined) {
        window.clearInterval(diceRollTimer);
        diceRollTimer = undefined;
      }
      if (diceSettleTimer !== undefined) {
        window.clearTimeout(diceSettleTimer);
        diceSettleTimer = undefined;
      }
    };
  });

  $effect(() => {
    applyNarrationPlaybackSettings();
    if (bgmElement) bgmElement.volume = bgmVolume;
    if (!bgmEnabled) pauseBgm();
  });

  $effect(() => {
    const key = `${activeIndex}:${activeSegment}:${variant}`;
    if (key === lastTrackedKey) return;
    lastTrackedKey = key;
    trackEvent(activeSegment === 0 ? "slide_view" : "segment_view", {
      variant,
      slide_id: current.id,
      slide_index: activeIndex + 1,
      segment_index: activeSegment + 1,
      segment_count: currentSegments.length
    });
  });

  $effect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") goTo(activeIndex + 1, "keyboard");
      if (event.key === "ArrowLeft" || event.key === "PageUp") goTo(activeIndex - 1, "keyboard");
      if (event.key === " ") {
        event.preventDefault();
        void toggleAudio();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
</script>

<div
  bind:this={deckShell}
  class={deckShellClass}
  style={`--portrait-preview-scale:${portraitPreviewScale}; --portrait-preview-height:${portraitPreviewHeight}px;`}
  role="application"
  aria-label={deckTitle}
  onpointerdown={handlePresentationTap}
  onpointermove={handlePresentationPointerMove}
>
  <header class="deck-toolbar" aria-label="スライド操作">
    <div class="brand-chip">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>{deckMode === "demo" ? `透明の法則 / デモ${demoV2 ? " v2" : ""}` : "透明の法則"}</span>
    </div>
    <button type="button" class="icon-button" aria-label="前のスライド" title="前へ" onclick={() => goTo(activeIndex - 1)} disabled={activeIndex === 0}>
      <ChevronLeft size={18} />
    </button>
    <span class="slide-counter" aria-live="polite">{activeIndex + 1} / {activeSlides.length}</span>
    <button type="button" class="icon-button" aria-label="次のスライド" title="次へ" onclick={() => goTo(activeIndex + 1)} disabled={activeIndex === activeSlides.length - 1}>
      <ChevronRight size={18} />
    </button>
    <a class="control-link" href={companionHref} onclick={() => trackEvent("companion_deck_click", { from_mode: deckMode })}>
      <ExternalLink size={15} />
      <span>{companionLabel}</span>
    </a>
    <button type="button" class:active={autoplay} class="control-button" aria-label={autoplay ? "自動再生を停止" : "音声つき自動再生"} title="音声つき自動再生" onclick={() => void toggleAutoplay()}>
      {#if autoplay}<Pause size={16} />{:else}<Play size={16} />{/if}
      <span>{autoplay ? "停止" : "再生"}</span>
    </button>
    <button type="button" class:active={audioStatus === "playing"} class="icon-button" aria-label="現在スライドの音声" title="音声" onclick={() => void toggleAudio()}>
      {#if audioStatus === "playing"}<Pause size={18} />{:else}<Volume2 size={18} />{/if}
    </button>
    <label class="volume-control" title="音量">
      <span>音量</span>
      <input type="range" min="0" max="1" step="0.05" bind:value={volume} />
    </label>
    {#if deckMode === "demo"}
      <button type="button" class:active={bgmEnabled} class="icon-button" aria-label={bgmEnabled ? "BGMをオフ" : "BGMをオン"} title={bgmEnabled ? "BGMをオフ" : "BGMをオン"} onclick={toggleBgm}>
        <Music size={18} />
      </button>
      <label class="volume-control bgm-volume-control" title="BGM音量">
        <span>BGM</span>
        <input type="range" min="0" max="0.5" step="0.02" bind:value={bgmVolume} aria-label="BGM音量" />
      </label>
    {/if}
    <button type="button" class:active={transcriptOpen} class="icon-button" aria-label="字幕を開く" title="字幕" onclick={() => (transcriptOpen = !transcriptOpen)}>
      <Captions size={18} />
    </button>
    <button type="button" class="icon-button" aria-label="共有" title="共有" onclick={() => void shareDeck()}>
      <Share2 size={18} />
    </button>
    <button
      type="button"
      class:active={presentationActive}
      class="control-button fullscreen-button"
      aria-label={presentationActive ? "通常表示に戻る" : "全画面で見る"}
      title={presentationActive ? "通常表示に戻る" : "全画面で見る"}
      onclick={() => void togglePresentationMode("toolbar")}
    >
      {#if presentationActive}<Minimize2 size={16} />{:else}<Maximize2 size={16} />{/if}
      <span>{fullscreenLabel}</span>
    </button>
    <button type="button" class="icon-button" aria-label="PDF出力" title="PDF" onclick={printDeck}>
      <FileDown size={18} />
    </button>
  </header>

  <aside class="mobile-entry-summary" aria-label="このゲームの勝ち方">
    <strong>先に、勝ち方だけ</strong>
    <p><span>透明人間</span>異なる10地点＋最終手番を回避</p>
    <p><span>警察</span>捜査網で絞り、突入で逮捕</p>
  </aside>

  <button type="button" class="mobile-fullscreen-prompt" onclick={() => void enterPresentationMode("mobile_prompt")}>
    <span><Maximize2 size={18} />横長フルスクリーンで見る</span>
    <small>音声つき再生もこの表示で始まります</small>
  </button>

  <main class="slides-viewport" style={`--progress:${progress}%`}>
    {#each activeSlides as slide, index (slide.id)}
      <article
        class:active={index === activeIndex}
        class="slide"
        style={`--segment-progress:${index === activeIndex ? segmentProgress : 0}%`}
        data-segment={index === activeIndex ? displaySegmentIndex : 0}
        data-slide
        data-slide-id={slide.id}
        aria-hidden={index === activeIndex ? "false" : "true"}
      >
        <section class="slide-copy">
          <p class="kicker">{formatDemoPanelText(slide.kicker)}</p>
          <h1 aria-label={slide.title}>
            {#each titleLinesFor(slide).desktop as line}
              <span class="copy-line desktop-copy-line">{formatDemoPanelText(line)}</span>
            {/each}
            {#each titleLinesFor(slide).mobile as line}
              <span class="copy-line mobile-copy-line">{formatDemoPanelText(line)}</span>
            {/each}
          </h1>
          <h2 aria-label={headlineFor(slide)}>
            {#each headlineLinesFor(slide).desktop as line}
              <span class="copy-line desktop-copy-line">{formatDemoPanelText(line)}</span>
            {/each}
            {#each headlineLinesFor(slide).mobile as line}
              <span class="copy-line mobile-copy-line">{formatDemoPanelText(line)}</span>
            {/each}
          </h2>
          <p class="body-copy">{formatDemoPanelText(bodyFor(slide))}</p>
          <ul class="point-list">
            {#each slide.points as point, pointIndex}
              <li
                class:visible={pointVisibleFor(slide, index, pointIndex)}
                class:spotlight={pointIndex === spotlightPointFor(slide, index)}
                class:rating-point={isRatingPoint(point)}
              >
                {#if isRatingPoint(point)}
                  <span class="point-rating">{formatDemoPanelText(ratingPointLine(point))}</span>
                  <span class="point-detail">{formatDemoPanelText(ratingPointDetail(point))}</span>
                {:else}
                  {formatDemoPanelText(point)}
                {/if}
              </li>
            {/each}
          </ul>
          <div class="segment-timeline" aria-label="音声演出の区切り">
            {#each activeSlideSegments[index] as segment}
              <button
                type="button"
                class:active={index === activeIndex && segment.index === activeSegment}
                class:done={index === activeIndex && segment.index < activeSegment}
                aria-label={`音声区切り ${segment.index + 1}`}
                onclick={() => {
                  if (index === activeIndex) void seekSegment(segment.index);
                }}
              ></button>
            {/each}
          </div>
        </section>

        <section class={visualClass(slide.visual)} aria-label={`${slide.title} の説明図`}>
          {#if slide.visual === "demo"}
            <div class={demoStageClass(slide)} data-demo-mode={slide.demo?.boardMode ?? "setup"}>
              <div class="demo-screen-head">
                <span>{demoStepLabel(slide)}</span>
                {#if slide.demo?.note}
                  <small class:cue-on={demoCueVisible(slide, 1)} class="demo-head-note">{formatDemoPanelText(slide.demo.note)}</small>
                {/if}
                <b>{formatDemoPanelText(demoAnswerLabel(slide))}</b>
              </div>
              <div class="demo-step-rail" aria-label="進行ステップ">
                {#each demoFlowSteps as step}
                  <span class:active={demoActiveFlowStep(slide) === step.key}>{step.label}</span>
                {/each}
              </div>
              <div class="demo-board-wrap">
                <div class="real-board demo-board">
                  {#each demoBoardCells(slide) as cell}
                    <span
                      class:searched={cell.search}
                      class:blocked={cell.blocked}
                      class:footprint={cell.footprint}
                      class:current={cell.current}
                      class:secret-current={cell.secretCurrent}
                      class:previous={cell.previous}
                      class:target={cell.target}
                      class:cue-emphasis={demoCellIsEmphasized(slide, cell)}
                    >
                      <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${formatDemoPanelText(cell.name)}の街カード`} />
                      <small class="demo-town-label">{formatDemoPanelText(cell.name)}</small>
                      {#if cell.footprint}<i class="demo-footprint-mark" aria-hidden="true"></i>{/if}
                      {#if cell.current}<strong class="demo-current-mark">現在地</strong>{/if}
                      {#if cell.secretCurrent}<strong class="demo-secret-current-mark">解説用<br />現在地</strong>{/if}
                      {#if cell.target}<em class="demo-target-mark">指定</em>{/if}
                    </span>
                  {/each}
                </div>
                {#if slide.demo?.hiddenCurrent && slide.demo?.current !== undefined}
                  <div class="demo-secret-label">視聴者用表示。実際のゲームでは現在地も移動先も警察には見えない。</div>
                {/if}
                {#if slide.demo?.previous !== undefined && slide.demo?.current !== undefined && !slide.demo?.dice?.length}
                  <div class:cue-on={demoCueVisible(slide)} class="demo-route-label">移動: {formatDemoPanelText(demoBoardCells(slide)[slide.demo.previous]?.name ?? "")} -> {formatDemoPanelText(demoBoardCells(slide)[slide.demo.current]?.name ?? "")}</div>
                {/if}
                {#if slide.demo?.dice?.length && demoDiceVisible(slide)}
                  <div class:cue-on={demoCueVisible(slide)} class="demo-dice-pack">
                    <b>{formatDemoPanelText(demoDiceLabel(slide))}</b>
                    <div class:rolling={isDiceRolling(slide)} class="demo-dice-row">
                      {#each slide.demo.dice as die, dieIndex}<span class:chosen={isChosenPoliceDie(slide, die)} class="die-face" data-value={demoDieValue(slide, die, dieIndex)} aria-label={`${demoDieValue(slide, die, dieIndex)}の目`}></span>{/each}
                    </div>
                  </div>
                {/if}
                {#if slide.demo?.direction}
                  <div class:cue-on={demoCueVisible(slide) && demoDirectionRevealed(slide)} class="demo-direction-label">{formatDemoPanelText(slide.demo.direction)}</div>
                {/if}
                {#if (slide.demo?.answer === "いる" || slide.demo?.answer === "いない") && slide.demo?.search?.length}
                  <div class:cue-on={demoCueVisible(slide) && demoQuestionRevealed(slide)} class="demo-question-bubble" aria-label="捜査網の質問">
                    <b>警察「この中にいますか?」</b>
                    <span>透明人間「{slide.demo.answer === "いる" ? "います" : "いません"}」</span>
                  </div>
                {/if}
                {#if demoDecisionOptions(slide).length}
                  <div class:cue-on={demoCueVisible(slide, 2)} class="demo-decision-panel" aria-label="警察の選択肢">
                    <b>ここで選ぶ</b>
                    {#each demoDecisionOptions(slide) as option}<span>{formatDemoPanelText(option)}</span>{/each}
                  </div>
                {/if}
              </div>
              {#if demoGaugeForSlide(slide)}
                {@const gauge = demoGaugeForSlide(slide)}
                <div class:cue-on={demoCueVisible(slide, 1)} class="demo-gauge-panel" aria-label="警察状態カード">
                  <b>警察状態</b>
                  <figure class="demo-gauge-card-figure">
                    <div class="demo-gauge-card-wrap">
                      <img class="demo-gauge-card-image" src={assetPath("assets/formal/gauge.webp")} alt="疲弊ゲージとタレコミゲージのカード" />
                      <span class={`demo-gauge-marker fatigue-marker fatigue-${demoFatiguePoint(gauge?.fatigue)}`} aria-label={`疲弊ゲージの現在位置 ${formatDemoPanelText(gauge?.fatigue ?? "0")}`}></span>
                      <span class={`demo-gauge-marker tip-marker tip-${demoTipPoint(gauge?.tip)}`} aria-label={`タレコミゲージの現在位置 ${formatDemoPanelText(gauge?.tip ?? "0")}`}></span>
                    </div>
                    <figcaption class="demo-gauge-current">
                      <span><small>疲弊</small><strong>{formatDemoPanelText(gauge?.fatigue ?? "0")}</strong></span>
                      <span><small>タレコミ</small><strong>{formatDemoPanelText(gauge?.tip ?? "0")}</strong></span>
                    </figcaption>
                  </figure>
                  <div class="demo-gauge-text">
                    <strong>{formatDemoPanelText(gauge?.search ?? "")}</strong>
                  </div>
                </div>
              {/if}
              <div class="demo-cast" aria-label="VOICEVOX解説キャラクター">
                <div class={demoSpeakerClass(slide, "zundamon")} aria-label="ずんだもん">
                  <img class="character-base character-closed" src={assetPath("assets/characters/zundamon-sakamoto-ahiru-closed.png")} alt="ずんだもん立ち絵" />
                  <img class="character-base character-open" src={assetPath("assets/characters/zundamon-sakamoto-ahiru.png")} alt="" />
                </div>
                <div class:thought={isThoughtSegment(segmentForSlide(index))} class="demo-subtitle">
                  <small>{speakerLabelFor(segmentForSlide(index))}</small>
                  <p>{formatDemoPanelText(segmentForSlide(index).text)}</p>
                </div>
                <div class={demoSpeakerClass(slide, "metan")} aria-label="四国めたん">
                  <img class="character-base character-closed" src={assetPath("assets/characters/shikoku-metan-sakamoto-ahiru-closed.png")} alt="四国めたん立ち絵" />
                  <img class="character-base character-open" src={assetPath("assets/characters/shikoku-metan-sakamoto-ahiru.png")} alt="" />
                </div>
              </div>
              <div class="demo-credit" title="VOICEVOX:ずんだもん / VOICEVOX:四国めたん ・ 立ち絵: 坂本アヒル ・ BGM: 2:23 AM / しゃろう (DOVA-SYNDROME)">VOICEVOX / 坂本アヒル / DOVA-SYNDROME</div>
              <a class="demo-companion-link" href={companionHref}>
                <ExternalLink size={15} />
                <span>{companionLabel}</span>
              </a>
            </div>
          {:else if slide.visual === "story"}
            <div class={`story-stage story-${slide.id}`}>
              {#if slide.id === "prologue"}
                <div class="story-case-board">
                  <figure class="story-book-cover">
                    <img src={assetPath("assets/formal/book-cover-upright.webp")} alt="透明の法則の表紙デザイン" />
                  </figure>
                  <div class="story-case-note thief-note"><b>怪盗 透明人間</b><span>姿を消して宝を盗む</span></div>
                  <div class="story-case-note police-note"><b>捜査網</b><span>手がかりとタレコミを集める</span></div>
                  <div class="story-town-strip">
                    <img src={townCards[0]} alt="街カード" />
                    <img src={townCards[5]} alt="街カード" />
                    <img src={footprintCards[2]} alt="足跡カード" />
                  </div>
                </div>
              {:else if slide.id === "invisible-thief"}
                <div class="story-thief-table">
                  <figure class="story-card-large">
                    <img src={townCards[10]} alt="盗みに入った街カード" />
                  </figure>
                  <figure class="story-card-small treasure-left">
                    <img src={footprintCards[0]} alt="盗みの痕跡カード" />
                  </figure>
                  <div class="story-invisible-mark" aria-label="透明人間の現在地"></div>
                  <div class="story-declaration"><b>痕跡なし</b><span>追跡は無意味だ</span></div>
                </div>
              {:else if slide.id === "invisibility"}
                <div class="story-ability-scene">
                  <div class="story-invisible-figure" aria-label="透明化する怪盗"></div>
                  <div class="story-sense-row">
                    <span>光</span>
                    <span>温度</span>
                    <span>音</span>
                  </div>
                  <figure class="story-gauge-load">
                    <img src={assetPath("assets/formal/gauge.webp")} alt="能力負担を示すゲージカード" />
                    <figcaption>多用はできない</figcaption>
                  </figure>
                </div>
              {:else if slide.id === "steal-and-run"}
                <div class="story-board-scene">
                  <div class="story-board">
                    {#each storyBoardCells("heist") as cell}
                      <span class:path={cell.path} class:current={cell.current} class:treasure={cell.treasure} class:footprint={cell.footprint} class:blocked={cell.blocked}>
                        <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                      </span>
                    {/each}
                  </div>
                  <div class="story-dice"><span class="die-face" data-value="3" aria-label="3の目"></span><span class="die-face" data-value="3" aria-label="3の目"></span><b>痕跡</b></div>
                  <div class="story-route-label">宝を奪い、街を渡る</div>
                </div>
              {:else if slide.id === "police"}
                <div class="story-evidence-board">
                  <figure class="story-summary-card">
                    <img src={assetPath("assets/formal/police_summary.webp")} alt="警察用サマリカード" />
                  </figure>
                  <div class="story-board mini">
                    {#each storyBoardCells("police") as cell}
                      <span class:searched={cell.searched} class:target={cell.target} class:intel={cell.intel} class:footprint={cell.footprint} class:blocked={cell.blocked}>
                        <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                      </span>
                    {/each}
                  </div>
                  <div class="story-police-line"><b>違和感は残る</b><span>痕跡は消えない</span></div>
                </div>
              {:else if slide.id === "search-net"}
                <div class="story-board-scene">
                  <div class="story-board">
                    {#each storyBoardCells("search") as cell}
                      <span class:searched={cell.searched} class:footprint={cell.footprint} class:blocked={cell.blocked}>
                        <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                      </span>
                    {/each}
                  </div>
                  <img class="story-gauge-card" src={assetPath("assets/formal/gauge.webp")} alt="疲弊ゲージとタレコミゲージ" />
                  <div class="story-net-call">この中にいるか?</div>
                </div>
              {:else if slide.id === "intel"}
                <div class="story-intel-scene">
                  <div class="story-board mini">
                    {#each storyBoardCells("intel") as cell}
                      <span class:searched={cell.searched} class:intel={cell.intel} class:footprint={cell.footprint} class:blocked={cell.blocked}>
                        <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                      </span>
                    {/each}
                  </div>
                  <figure class="story-intel-card">
                    <img src={footprintCards[10]} alt="内偵で見つけた足跡カード" />
                    <figcaption>内偵</figcaption>
                  </figure>
                  <div class="story-tip-card"><b>タレコミ</b><span>足取りを追う</span></div>
                </div>
              {:else if slide.id === "raid"}
                <div class="story-raid-scene">
                  <div class="story-board">
                    {#each storyBoardCells("raid") as cell}
                      <span class:searched={cell.searched} class:target={cell.target} class:current={cell.current} class:footprint={cell.footprint} class:blocked={cell.blocked}>
                        <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                      </span>
                    {/each}
                  </div>
                  <div class="story-raid-stamp">突入</div>
                  <div class="story-capture-line">ここにいるなら、逮捕</div>
                </div>
              {:else if slide.id === "game-concept"}
                <div class="story-duel-scene">
                  <div class="story-win-card invisible-win"><b>透明人間</b><span>宝を回収して逃げ切る</span></div>
                  <div class="story-board mini">
                    {#each storyBoardCells("duel") as cell}
                      <span class:path={cell.path} class:searched={cell.searched} class:target={cell.target} class:current={cell.current} class:treasure={cell.treasure} class:footprint={cell.footprint} class:blocked={cell.blocked}>
                        <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                      </span>
                    {/each}
                  </div>
                  <div class="story-win-card police-win"><b>警察</b><span>突入の先で逮捕する</span></div>
                  <div class="story-dice duel-dice"><span class="die-face" data-value="5" aria-label="5の目"></span><span class="die-face" data-value="2" aria-label="2の目"></span><b>ダイス運が揺らす</b></div>
                </div>
              {:else if slide.id === "product-overview"}
                <div class="story-product-scene">
                  <figure class="story-product-cover">
                    <img src={assetPath("assets/formal/book-cover-upright.webp")} alt="透明の法則の表紙デザイン" />
                  </figure>
                  <div class="story-product-grid">
                    <figure><img src={townCards[4]} alt="街カード" /><figcaption>カード36枚</figcaption></figure>
                    <figure><img src={assetPath("assets/formal/gauge.webp")} alt="ゲージカード" /><figcaption>ゲージ</figcaption></figure>
                    <div class="story-piece-pack" aria-label="色付きの四角いコマ6個">
                      <span></span><span></span><span></span><span></span><span></span><span></span>
                      <b>コマ6個</b>
                    </div>
                    <div class="story-dice product-dice"><span class="die-face" data-value="1" aria-label="1の目"></span><span class="die-face" data-value="6" aria-label="6の目"></span><b>ダイス2個</b></div>
                  </div>
                  <div class="story-product-actions">
                    <button type="button" onclick={() => trackEvent("purchase_intent", { slide_id: "product-overview", variant })}>ブースで手に取る</button>
                    <button type="button" onclick={() => void shareDeck()}>共有する</button>
                  </div>
                </div>
              {/if}
            </div>
          {:else if slide.visual === "cover"}
            <div class="cover-stage">
              <figure class="product-flat book-cover-flat">
                <img src={assetPath("assets/formal/book-cover-upright.webp")} alt="透明の法則の表紙デザイン" />
              </figure>
              <div class="card-fan cover-fan" aria-hidden="true">
                <img src={townCards[0]} alt="" />
                <img src={footprintCards[0]} alt="" />
                <img src={assetPath("assets/formal/gauge.webp")} alt="" />
              </div>
              <div class="table-note">15-30分で、相手の読み方が見えてくる。</div>
            </div>
          {:else if slide.visual === "absence"}
            <div class="board-wrap network-wrap">
              <div class="real-board compact-board">
                {#each boardCells("search") as cell}
                  <span class:searched={cell.search} class:blocked={cell.blocked}>
                    <img src={cell.src} alt={`${cell.name}の街カード`} />
                  </span>
                {/each}
              </div>
              <div class="question-card">
                <b>この中にいますか?</b>
                <strong>いいえ</strong>
                <p>外れた範囲が、次の推理になる。</p>
              </div>
            </div>
          {:else if slide.visual === "components"}
            <div class="component-spread">
              <figure class="component-card main-card">
                <img src={townCards[4]} alt="街カード" />
                <figcaption>街カード 16枚</figcaption>
              </figure>
              <figure class="component-card main-card">
                <img src={footprintCards[8]} alt="足跡カード" />
                <figcaption>足跡カード 16枚</figcaption>
              </figure>
              <figure class="component-card wide-card">
                <img src={assetPath("assets/formal/gauge.webp")} alt="疲弊ゲージとタレコミゲージ" />
                <figcaption>ゲージ</figcaption>
              </figure>
              <figure class="component-card slim-card">
                <img src={assetPath("assets/formal/blockade.webp")} alt="封鎖中カード" />
                <figcaption>封鎖</figcaption>
              </figure>
            </div>
          {:else if slide.visual === "setup"}
            <div class="setup-board">
              <div class="axis-label top">阿 / 伊 / 宇 / 江</div>
              <div class="real-board">
                {#each boardCells("plain") as cell}
                  <span class:blocked={cell.blocked}>
                    <img src={cell.blocked ? assetPath("assets/formal/blockade.webp") : cell.src} alt={`${cell.name}の街カード`} />
                  </span>
                {/each}
              </div>
              <div class="axis-label side">壱丁目 - 四丁目</div>
            </div>
          {:else if slide.visual === "loop"}
            <div class="round-loop">
              <div><span>1</span><b>逃げる</b><p>透明人間が移動</p><img src={townCards[3]} alt="街カード" /></div>
              <div><span>2</span><b>痕跡</b><p>方角が漏れるか</p></div>
              <div><span>3</span><b>囲む</b><p>警察が捜査網を作る</p><img src={footprintCards[6]} alt="足跡カード" /></div>
              <div><span>4</span><b>判定</b><p>逃走か逮捕か</p></div>
            </div>
          {:else if slide.visual === "invisible"}
            <div class="board-wrap">
              <div class="real-board path-board">
                {#each boardCells("path") as cell}
                  <span class:path={cell.path} class:current={cell.current} class:blocked={cell.blocked}>
                    <img src={cell.src} alt={`${cell.name}の街カード`} />
                    {#if cell.path}<i class="path-dot" aria-hidden="true"></i>{/if}
                  </span>
                {/each}
              </div>
              <div class="ability-card">
                <b>透明化</b>
                <p>一度だけ、2歩続けて逃げる。</p>
              </div>
              <img class="footprint-side" src={footprintCards[10]} alt="足跡カード" />
            </div>
          {:else if slide.visual === "trace"}
            <div class="trace-panel">
              <div class="dice-row" aria-label="ゾロ目の例"><span class="die-face" data-value="5" aria-label="5の目"></span><span class="die-face" data-value="5" aria-label="5の目"></span></div>
              <figure class="trace-card">
                <img src={footprintCards[0]} alt="足跡カード" />
                <figcaption>方角だけが、場に落ちる。</figcaption>
              </figure>
              <div class="direction-card"><b>ゾロ目</b><strong>北へ移動</strong></div>
            </div>
          {:else if slide.visual === "network"}
            <div class="board-wrap network-wrap">
              <div class="real-board network-board">
                {#each boardCells("search") as cell}
                  <span class:searched={cell.search} class:blocked={cell.blocked}>
                    <img src={cell.src} alt={`${cell.name}の街カード`} />
                  </span>
                {/each}
              </div>
              <img class="gauge-card" src={assetPath("assets/formal/gauge.webp")} alt="疲弊ゲージとタレコミゲージ" />
              <div class="net-label">四角形で囲む</div>
            </div>
          {:else if slide.visual === "actions"}
            <div class="action-layout">
              <img class="summary-card" src={assetPath("assets/formal/police_summary.webp")} alt="警察用サマリカード" />
              <div class="action-stack">
                <div><b>突入</b><p>現在地なら逮捕</p><span>攻める</span></div>
                <div><b>内偵</b><p>過去の足跡を確認</p><span>読む</span></div>
                <div><b>休憩</b><p>疲弊を戻す</p><span>整える</span></div>
              </div>
            </div>
          {:else if slide.visual === "tension"}
            <div class="table-scene">
              <div class="player-side police-side">警察「この中にいる?」</div>
              <div class="table-cards">
                <img src={townCards[1]} alt="街カード" />
                <img src={townCards[5]} alt="街カード" />
                <img src={footprintCards[2]} alt="足跡カード" />
              </div>
              <div class="player-side invisible-side">透明人間「いない。」</div>
              <div class="hidden-route" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
            </div>
          {:else if slide.visual === "cta"}
            <div class="cta-stage">
              <figure class="product-flat book-cover-flat final-product">
                <img src={assetPath("assets/formal/book-cover-upright.webp")} alt="透明の法則の表紙デザイン" />
              </figure>
              <div class="cta-actions">
                <a href={companionHref} onclick={() => trackEvent("companion_deck_click", { from_mode: deckMode, slide_id: "cta" })}>
                  <ExternalLink size={17} />
                  <span>デモプレイ解説を見る</span>
                </a>
                <a href="../" onclick={() => trackEvent("online_demo_click", { slide_id: "cta" })}>
                  <ExternalLink size={17} />
                  <span>オンライン版も試す</span>
                </a>
                <button type="button" onclick={() => trackEvent("purchase_intent", { slide_id: "cta", variant })}>
                  ブースで手に取る
                </button>
                <button type="button" onclick={() => void shareDeck()}>
                  <Share2 size={17} />
                  <span>共有する</span>
                </button>
                <button type="button" class="ghost-button" onclick={restartDeck}>
                  <RotateCcw size={17} />
                  <span>もう一度見る</span>
                </button>
              </div>
            </div>
          {/if}
        </section>
      </article>
    {/each}
  </main>

  <aside class="transcript" hidden={!transcriptOpen}>
    <div class="transcript-head">
      <b>字幕 {activeIndex + 1}-{activeSegment + 1}</b>
      <button type="button" aria-label="字幕を閉じる" onclick={() => (transcriptOpen = false)}>×</button>
    </div>
    <p>{formatDemoPanelText(currentSegment.text)}</p>
    <small>{formatDemoPanelText(current.narration)}</small>
  </aside>

  {#if audioStatus === "blocked"}
    <p class="audio-hint">ブラウザが音声再生を止めました。再生ボタンをもう一度押してください。</p>
  {/if}

  {#if fullscreenError && presentationMode && !fullscreenActive}
    <p class="fullscreen-hint">全画面を開始できませんでした。画面を横向きにすると横長表示で見られます。</p>
  {/if}

  <audio
    bind:this={audioElement}
    src={audioSrc}
    preload="auto"
    onended={handleAudioEnded}
    onloadedmetadata={() => {
      applyNarrationPlaybackSettings();
      syncSegmentFromAudio();
    }}
    ontimeupdate={syncSegmentFromAudio}
    onplay={() => {
      if (audioElement && audioElementUsesCurrentSource(audioElement)) audioStatus = "playing";
    }}
    onpause={() => {
      if (audioStatus !== "blocked") audioStatus = "idle";
    }}
  ></audio>
  {#if nextAudioSrc}
    <audio bind:this={nextAudioElement} src={nextAudioSrc} preload="auto" aria-hidden="true"></audio>
  {/if}
  <audio
    bind:this={bgmElement}
    src={bgmSrc}
    preload="auto"
    loop
    aria-hidden="true"
  ></audio>
</div>
