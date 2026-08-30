import slidesJson from "./slides.json";
import demoSlidesJson from "./demo-slides.json";

export type SlideVisual =
  | "story"
  | "cover"
  | "absence"
  | "components"
  | "setup"
  | "loop"
  | "invisible"
  | "trace"
  | "network"
  | "actions"
  | "tension"
  | "cta"
  | "demo";

export type DemoSpeaker = "zundamon" | "metan";
export type SlideSpeaker = DemoSpeaker | "narrator" | "thief" | "police";

export interface DialogueLine {
  speaker: SlideSpeaker;
  text: string;
  thought?: boolean;
}

export interface DemoState {
  step: string;
  speaker: DemoSpeaker;
  boardMode:
    | "setup"
    | "move"
    | "trace-none"
    | "trace-direction"
    | "gauge"
    | "search"
    | "raid-miss"
    | "search-no"
    | "intel"
    | "rest"
    | "capture"
    | "summary";
  current?: number;
  previous?: number;
  hiddenCurrent?: boolean;
  search?: number[];
  footprints?: number[];
  target?: number;
  answer?: string;
  dice?: string[];
  diceLabel?: string;
  direction?: string;
  gauge?: {
    fatigue: string;
    tip?: string;
    search: string;
  };
  gaugeBySegment?: {
    segment: number;
    fatigue: string;
    tip?: string;
    search: string;
  }[];
  targetRevealSegment?: number;
  directionRevealSegment?: number;
  answerRevealSegment?: number;
  decisionRevealSegment?: number;
  pointRevealSegments?: number[];
  turnInfo?: {
    turn: string;
    action: string;
    options: string;
    next: string;
  };
  note?: string;
  status?: string[];
}

export interface Slide {
  id: string;
  kicker: string;
  title: string;
  headline: string;
  body: string;
  points: string[];
  visual: SlideVisual;
  audio: string;
  narration: string;
  dialogue?: DialogueLine[];
  demo?: DemoState;
}

export const slides = slidesJson as Slide[];
export const demoSlides = demoSlidesJson as Slide[];

export interface NarrationSegment {
  index: number;
  text: string;
  audio: string;
  speaker?: SlideSpeaker;
  thought?: boolean;
}

export function getSlideSegments(slide: Slide, slideIndex: number): NarrationSegment[] {
  if (slide.dialogue?.length) {
    return slide.dialogue.map((line, segmentIndex) => ({
      index: segmentIndex,
      text: line.text,
      speaker: line.speaker,
      thought: line.thought,
      audio: `slide-${String(slideIndex + 1).padStart(2, "0")}-${String(segmentIndex + 1).padStart(2, "0")}.wav`
    }));
  }

  const sentences =
    slide.narration
      .match(/[^。！？!?]+[。！？!?]?/g)
      ?.map((item) => item.trim())
      .filter(Boolean) ?? [slide.narration];

  return sentences.map((text, segmentIndex) => ({
    index: segmentIndex,
    text,
    audio: `slide-${String(slideIndex + 1).padStart(2, "0")}-${String(segmentIndex + 1).padStart(2, "0")}.wav`
  }));
}

export const slideSegments = slides.map((slide, index) => getSlideSegments(slide, index));
export const demoSlideSegments = demoSlides.map((slide, index) => getSlideSegments(slide, index));
