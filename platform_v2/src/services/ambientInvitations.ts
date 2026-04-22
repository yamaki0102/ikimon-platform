import type { SiteLang } from "../i18n.js";

export type CueBasisType =
  | "same_place_history"
  | "same_frame_hint"
  | "other_observer"
  | "missing_detail"
  | "seasonal_timing"
  | "fresh_start";

export type CueBasis = {
  type: CueBasisType;
  detail: string;
};

export type AmbientInvitationKind =
  | "same_place_memory"
  | "same_frame_comparison"
  | "cross_visitor_link"
  | "evidence_hint"
  | "seasonal_gap";

export type AmbientInvitation = {
  kind: AmbientInvitationKind;
  headline: string;
  whyItMatters: string;
  tryIfYouWant: string;
  basis: CueBasis[];
};

export type PhotoHint = {
  focus: string;
  whyItHelps: string;
  tryIfYouWant: string;
  basis: CueBasis[];
};

export type AmbientCueSet = {
  primaryInvitation: AmbientInvitation;
  secondaryInvitation: AmbientInvitation | null;
  photoHint: PhotoHint;
};

type LandingCueInput = {
  primaryPlaceName: string | null;
  primaryPlaceVisits: number;
  recentDisplayName: string | null;
  recentPlaceName: string | null;
  ambientObserverCount: number;
  ambientDisplayName: string | null;
};

type HomeCueInput = {
  primaryPlaceName: string | null;
  primaryPlaceVisits: number;
  recentDisplayName: string | null;
  recentPlaceName: string | null;
  nearbyObserverCount: number;
};

type ObservationCueInput = {
  displayName: string;
  placeName: string;
  identificationCount: number;
  hasScientificName: boolean;
  photoCount: number;
  samePlaceObservationCount: number;
  samePlaceOtherObserverCount: number;
};

function basis(type: CueBasisType, detail: string): CueBasis {
  return { type, detail };
}

function genericPhotoHint(lang: SiteLang, subject: string | null): PhotoHint {
  if (lang === "ja") {
    return {
      focus: subject ? `${subject} を撮るなら、全体と気になった部分を 1 枚ずつ` : "全体のようすと、気になった部分を 1 枚ずつ",
      whyItHelps: "あとで見返したときに、何を見ていたのかが分かりやすくなります。名前がまだ曖昧でも大丈夫です。",
      tryIfYouWant: "やってみるなら、今の 1 枚に加えて、模様や葉先など気になったところをもう 1 枚だけ。",
      basis: [basis("same_frame_hint", subject ? `${subject} has a visible follow-up angle.` : "A second angle helps later comparison.")],
    };
  }

  return {
    focus: subject ? `For ${subject}, keep one full-frame shot and one closer detail.` : "Keep one full-frame shot and one closer detail.",
    whyItHelps: "It makes it easier to remember what caught your eye later, even when the name is still uncertain.",
    tryIfYouWant: "If you feel like it, add one more close-up of the part that feels important.",
    basis: [basis("same_frame_hint", subject ? `${subject} has a visible follow-up angle.` : "A second angle helps later comparison.")],
  };
}

export function buildLandingCueSet(lang: SiteLang, input: LandingCueInput): AmbientCueSet {
  const isJa = lang === "ja";
  const primaryPlace = input.primaryPlaceName ?? input.recentPlaceName ?? null;
  const recentName = input.recentDisplayName ?? null;

  const primaryInvitation: AmbientInvitation = primaryPlace
    ? {
        kind: "same_place_memory",
        headline: isJa ? `${primaryPlace} のつづきは、次の 1 枚で見えやすくなる` : `One more page from ${primaryPlace} makes the story easier to see`,
        whyItMatters: isJa
          ? "同じ道でも、時間や季節が少し違うだけで見えてくるものが変わります。最初の 1 枚があると、未来の自分が見比べやすくなります。"
          : "Even on the same path, a small shift in season or timing changes what becomes visible. One page now gives future-you something to compare.",
        tryIfYouWant: isJa
          ? `${primaryPlace} をまた通るときに、前と同じあたりから 1 枚だけ残してみる。`
          : `If you pass ${primaryPlace} again, keep just one shot from roughly the same spot.`,
        basis: [basis("same_place_history", input.primaryPlaceVisits > 0 ? `${primaryPlace} already appears in your place history.` : `${primaryPlace} is already part of the nearby notebook.`)],
      }
    : {
        kind: "same_place_memory",
        headline: isJa ? "いつもの道の 1 枚は、あとから効いてくる" : "One page from an ordinary path can matter later",
        whyItMatters: isJa
          ? "毎日通る場所ほど、あとで見返したときの違いが分かりやすくなります。最初から特別な場所でなくて大丈夫です。"
          : "Ordinary paths are often the easiest to compare later. It does not have to be a special destination.",
        tryIfYouWant: isJa
          ? "今度通るときに、木陰や水辺など、少し気になった場所を 1 枚だけ残してみる。"
          : "Next time you pass by, keep one shot of a tree line, puddle, or any small place that catches your eye.",
        basis: [basis("fresh_start", "No personal place history yet.")],
      };

  const secondaryInvitation: AmbientInvitation = input.ambientObserverCount > 0
    ? {
        kind: "cross_visitor_link",
        headline: isJa ? "別の人の 1 枚とつながると、その場所の見え方が厚くなる" : "Another person's page can thicken the picture of a place",
        whyItMatters: isJa
          ? "同じ場所でも、歩く時間や視点が違うと残る情報が変わります。旅先でも、地元でも、その重なりに価値があります。"
          : "The same place looks different when another person arrives at a different time or with a different eye. That overlap has value.",
        tryIfYouWant: isJa
          ? "やってみるなら、近くで誰かが残していた場所を、自分の角度でも 1 枚だけ残してみる。"
          : "If you want to try, add your own angle to a place someone else already recorded nearby.",
        basis: [basis("other_observer", input.ambientDisplayName ? `${input.ambientDisplayName} and others are active nearby.` : "Other observers are active nearby.")],
      }
    : {
        kind: "same_frame_comparison",
        headline: isJa ? "同じあたりからもう 1 枚あると、見比べる楽しみが増える" : "One more frame from roughly the same angle makes comparison easier",
        whyItMatters: isJa
          ? "記録は、完璧な固定点でなくても大丈夫です。同じあたりから撮れているだけで、あとで見比べる材料になります。"
          : "It does not have to be a perfect fixed point. A roughly similar angle is already enough to compare later.",
        tryIfYouWant: isJa
          ? "今度見かけたら、前に撮った向きに少し寄せて 1 枚だけ。"
          : "If you see it again, lean a little toward the previous angle and keep one more page.",
        basis: [basis("same_frame_hint", recentName ? `${recentName} suggests a comparable angle.` : "A similar frame can be compared later.")],
      };

  return {
    primaryInvitation,
    secondaryInvitation,
    photoHint: genericPhotoHint(lang, recentName),
  };
}

export function buildHomeCueSet(lang: SiteLang, input: HomeCueInput): AmbientCueSet {
  const isJa = lang === "ja";
  const placeName = input.primaryPlaceName ?? input.recentPlaceName ?? null;
  const recentName = input.recentDisplayName ?? null;

  const primaryInvitation: AmbientInvitation = placeName
    ? {
        kind: "same_place_memory",
        headline: isJa ? `${placeName} は、前回のつづきを見つけやすい場所` : `${placeName} is a good place to pick up the thread`,
        whyItMatters: isJa
          ? "前回の 1 枚があると、同じ場所でも何が違って見えたかを思い出しやすくなります。"
          : "With one earlier page, it becomes easier to notice what changed in the same place.",
        tryIfYouWant: isJa
          ? `${placeName} をまた通るなら、前と同じあたりから 1 枚だけ。`
          : `If you walk through ${placeName} again, keep one more shot from roughly the same area.`,
        basis: [basis("same_place_history", input.primaryPlaceVisits > 0 ? `${placeName} has ${input.primaryPlaceVisits} recorded visits.` : `${placeName} appears in your recent pages.`)],
      }
    : {
        kind: "same_place_memory",
        headline: isJa ? "前回のつづきは、身近な場所ほど始めやすい" : "The easiest sequel often starts close to home",
        whyItMatters: isJa
          ? "特別な観察会でなくても、普段通る道の 1 枚が、あとで見比べる起点になります。"
          : "You do not need a special trip. A regular path can become the starting point for later comparison.",
        tryIfYouWant: isJa ? "今度の散歩で、気になった場所を 1 枚だけ残してみる。" : "On your next walk, keep one page from a place that catches your eye.",
        basis: [basis("fresh_start", "No saved personal place yet.")],
      };

  const secondaryInvitation: AmbientInvitation = input.nearbyObserverCount > 1
    ? {
        kind: "cross_visitor_link",
        headline: isJa ? "ほかの人の記録があると、その場所の見え方が広がる" : "Other people's pages widen the view of a place",
        whyItMatters: isJa
          ? "同じ場所でも、違う季節や違う時間に残された 1 枚があると、見えてくるものが増えます。"
          : "One more page from a different season or a different person can reveal something new about the same place.",
        tryIfYouWant: isJa ? "気になる場所があれば、自分の角度でも 1 枚だけ残してみる。" : "If a place catches your eye, add your own angle with just one page.",
        basis: [basis("other_observer", `${input.nearbyObserverCount} observers are active in the nearby stream.`)],
      }
    : {
        kind: "same_frame_comparison",
        headline: isJa ? "同じあたりからもう 1 枚あると、前回の見え方とつながりやすい" : "One more page from a similar angle makes the last one easier to compare",
        whyItMatters: isJa
          ? "きっちり揃っていなくても、近い角度が 2 枚あるだけで、違いを読み取りやすくなります。"
          : "Even a loose match is enough. Two nearby angles already make comparison easier.",
        tryIfYouWant: isJa ? "やってみるなら、前と同じ向きに少し寄せて 1 枚だけ。" : "If you want to try, lean a little toward the previous angle and keep one more page.",
        basis: [basis("same_frame_hint", recentName ? `${recentName} has a likely follow-up angle.` : "A similar angle would help later comparison.")],
      };

  return {
    primaryInvitation,
    secondaryInvitation,
    photoHint: genericPhotoHint(lang, recentName),
  };
}

export function buildObservationCueSet(lang: SiteLang, input: ObservationCueInput): AmbientCueSet {
  const isJa = lang === "ja";
  const unresolved = input.identificationCount === 0 || !input.hasScientificName;

  const primaryInvitation: AmbientInvitation = unresolved
    ? {
        kind: "evidence_hint",
        headline: isJa ? "この記録は、ここから少しずつ絞っていける" : "This record can be narrowed down step by step",
        whyItMatters: isJa
          ? "分からないまま残すことにも価値があります。次にどこを見ると進みやすいかが見えていれば、無理に断定しなくて大丈夫です。"
          : "There is value in leaving it unresolved for now. If the next visible clue is clear, there is no need to force certainty.",
        tryIfYouWant: isJa
          ? `${input.placeName} でまた見かけたら、全体に加えて決め手になりそうな部分を 1 枚だけ。`
          : `If you see it again in ${input.placeName}, keep one more page of the part that looks decisive.`,
        basis: [basis("missing_detail", input.photoCount > 0 ? "The current record has room for one more angle." : "The record still needs a first clear angle.")],
      }
    : input.samePlaceOtherObserverCount > 0
      ? {
          kind: "cross_visitor_link",
          headline: isJa ? "この場所には、別の視点からつながる余地がある" : "This place has room for another angle to connect",
          whyItMatters: isJa
            ? "同じ場所でも、別の人や別の時間の 1 枚があると、この記録の意味が厚くなります。"
            : "Another page from a different person or a different moment can deepen what this record means.",
          tryIfYouWant: isJa ? "今度通るときに、似た場所を自分の視点でも 1 枚だけ。" : "Next time you pass by, add one more page from your own angle.",
          basis: [basis("other_observer", `${input.samePlaceOtherObserverCount} other observers have records from the same place.`)],
        }
      : {
          kind: "same_place_memory",
          headline: isJa ? `${input.placeName} は、前後の変化を感じ取りやすい場所` : `${input.placeName} is good for noticing before-and-after shifts`,
          whyItMatters: isJa
            ? "この 1 枚があると、あとで同じ場所を見たときに違いへ気づきやすくなります。"
            : "With this page saved, it becomes easier to notice what changed when you look at the same place later.",
          tryIfYouWant: isJa ? "また通るなら、同じあたりから 1 枚だけ残してみる。" : "If you pass here again, keep one more page from roughly the same area.",
          basis: [basis("same_place_history", `${input.samePlaceObservationCount} records already belong to this place.`)],
        };

  const secondaryInvitation: AmbientInvitation = input.samePlaceObservationCount > 1
    ? {
        kind: "seasonal_gap",
        headline: isJa ? "同じ場所でも、時期が違うと見え方が変わる" : "The same place changes with the season",
        whyItMatters: isJa
          ? "1 回では分からないことも、時期の違う 1 枚があると読み取りやすくなります。"
          : "A second page from another time often reveals what a single visit cannot.",
        tryIfYouWant: isJa ? "今度の別の時間帯や季節に、同じあたりを 1 枚だけ。" : "At another time or season, keep one more page from roughly the same area.",
        basis: [basis("seasonal_timing", `${input.samePlaceObservationCount} records exist for the same place.`)],
      }
    : {
        kind: "same_frame_comparison",
        headline: isJa ? "同じあたりからもう 1 枚あると、今回の記録が読みやすくなる" : "One more page from a similar angle would make this record easier to read",
        whyItMatters: isJa
          ? "構図が少し近いだけでも、どこが違うのかを思い出しやすくなります。"
          : "Even a loosely similar frame helps you remember what changed.",
        tryIfYouWant: isJa ? "やってみるなら、今回の向きに少し寄せて 1 枚だけ。" : "If you want to try, lean a little toward this angle and keep one more page.",
        basis: [basis("same_frame_hint", `${input.displayName} has at least one comparable frame now.`)],
      };

  return {
    primaryInvitation,
    secondaryInvitation,
    photoHint: genericPhotoHint(lang, input.displayName),
  };
}
