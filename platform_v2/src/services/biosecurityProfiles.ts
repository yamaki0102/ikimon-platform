export interface BiosecurityCopy {
  notePlaceholder: string;
  stepLead: string;
  photoGuide: [{ heading: string; body: string }, { heading: string; body: string }];
  notConfirmedNote: string;
  shareLabel: string;
  envDisclosureTail: string;
}

export const DEFAULT_BIOSECURITY_COPY: BiosecurityCopy = {
  notePlaceholder: "虫や木のようすなど、わかることだけ",
  stepLead: "気になる虫や木を、写真で残せます。",
  photoGuide: [
    { heading: "気になる虫を見つけたら", body: "虫の全体と、気になるところ。近づきすぎず、安全な場所から撮りましょう。" },
    { heading: "木くずや木の変化を見つけたら", body: "気になるところと、木の全体。無理に触ったり、木の中を調べたりしなくて大丈夫です。" },
  ],
  notConfirmedNote: "写真を残しても、虫の名前や被害の有無は確定しません。対応方法は公式の案内を確認してください。",
  shareLabel: "ZUKAN 外来種の記録（虫の名前や被害は未確認）",
  envDisclosureTail: "虫の名前や被害は確定しません。",
};

export interface BiosecurityProfile {
  id: string;
  version: string;
  title: string;
  guideHeading?: string;
  summary: string;
  signals: Array<{ value: string; label: string }>;
  safety: string[];
  guideUrl: string;
  sourceCheckedAt: string;
  featureFlag?: string;
  copy?: Partial<BiosecurityCopy>;
}

/** Profiles specialize guidance; they never create a separate Record, storage or AI pipeline. */
export const BIOSECURITY_PROFILES: readonly BiosecurityProfile[] = [{
  id: "kubiaka", version: "1.0.0", title: "クビアカツヤカミキリの見守り",
  guideHeading: "気になる虫や木を見つけたら",
  summary: "気になる虫や木の変化を、写真1枚から残せます。種類が分からなくても大丈夫です。",
  signals: [
    { value: "adult_insect", label: "気になる虫" },
    { value: "frass", label: "木くず・痕跡" },
    { value: "tree_damage", label: "木の異変" },
    { value: "unknown", label: "分からない" },
  ],
  safety: [
    "危険な場所に入らず、今ある写真から残せます。",
    "見つけた虫や被害の疑いのある木を移動させないでください。対応方法は地域の公式案内を確認してください。",
    "記録の保存は、種類の確定や自治体への正式な通報とは異なります。",
  ],
  guideUrl: "https://www.maff.go.jp/j/syouan/syokubo/keneki/k_kokunai/kubiaka/kubiaka.html",
  sourceCheckedAt: "2026-10-12",
}, {
  id: "nagaetsuru", version: "1.0.0", title: "ナガエツルノゲイトウの見守り",
  guideHeading: "水辺で気になる草を見つけたら",
  summary: "水辺に広がる気になる草を、写真1枚から残せます。名前が分からなくても大丈夫です。",
  featureFlag: "BIOSECURITY_NAGAETSURU_ENABLED",
  signals: [
    { value: "water_mat", label: "水辺に茂っている" },
    { value: "white_flower", label: "白い丸い花" },
    { value: "stem_leaf", label: "茎や葉" },
    { value: "unknown", label: "分からない" },
  ],
  safety: [
    "抜いたり、持ち帰ったりしないでください。特定外来生物（茎・根を含む）で、運搬は法律で禁止されています。",
    "ちぎれた茎からも増えます。踏み荒らしたり、流したりしないでください。",
    "水辺は危険です。近づきすぎず、安全な場所から撮りましょう。",
    "記録の保存は、種類の確定や自治体への正式な通報とは異なります。",
  ],
  copy: {
    notePlaceholder: "草のようすや広がり、水辺の場所など、わかることだけ",
    stepLead: "水辺で気になる草を、写真で残せます。",
    photoGuide: [
      { heading: "花を見つけたら", body: "白い丸い花と、花の柄（1〜4cmほど長い）が分かるように。似た草があり、柄の長さが目印です。" },
      { heading: "茂みを見つけたら", body: "広がりの全体と、水辺のどこにあるか。葉が向かい合ってつくところも撮れると役立ちます。" },
    ],
    notConfirmedNote: "写真を残しても、草の名前は確定しません。対応方法は公式の案内を確認してください。",
    shareLabel: "ZUKAN 外来種の記録（草の名前は未確認）",
    envDisclosureTail: "草の名前は確定しません。",
  },
  guideUrl: "https://www.env.go.jp/nature/intro/2outline/list.html",
  sourceCheckedAt: "2026-11-27",
}, {
  id: "gairai", version: "1.0.0", title: "気になる外来種の見守り",
  guideHeading: "外来種かもしれない生きものを見つけたら",
  summary: "外来種かもしれない生きものを、写真1枚から残せます。種類が分からなくても大丈夫です。",
  featureFlag: "BIOSECURITY_GENERIC_ENABLED",
  signals: [
    { value: "plant", label: "草や木" },
    { value: "insect", label: "虫" },
    { value: "water_animal", label: "魚や水の生きもの" },
    { value: "other_animal", label: "そのほかの動物" },
    { value: "unknown", label: "分からない" },
  ],
  safety: [
    "生きたまま持ち帰ったり、別の場所へ動かしたりしないでください。特定外来生物は、運ぶことが法律で禁止されています。",
    "かまれたり刺されたりする生きものもいます。素手で触らず、安全な場所から撮りましょう。",
    "水辺や草むらでは足元に気をつけてください。",
    "記録の保存は、種類の確定や自治体への正式な通報とは異なります。",
  ],
  copy: {
    notePlaceholder: "見た目や数、いた場所など、わかることだけ",
    stepLead: "外来種かもしれない生きものを、写真で残せます。今ある写真でも大丈夫です。",
    photoGuide: [
      { heading: "生きものを見つけたら", body: "全体と、色や形など気になるところ。近づきすぎず撮りましょう。" },
      { heading: "増えている場所を見つけたら", body: "広がりの全体と、まわりのようす。水辺や道ばたなど、どこにいたかが分かると役立ちます。" },
    ],
    notConfirmedNote: "写真を残しても、種類や外来種かどうかは確定しません。対応方法は公式の案内を確認してください。",
    shareLabel: "ZUKAN 外来種の記録（種類は未確認）",
    envDisclosureTail: "候補は間違うこともあり、種類は確定しません。",
  },
  guideUrl: "https://www.env.go.jp/nature/intro/2outline/list.html",
  sourceCheckedAt: "2026-11-27",
}];

export function biosecurityProfile(id: unknown, flagOn: (flag: string) => boolean = () => false): BiosecurityProfile | null {
  const profile = BIOSECURITY_PROFILES.find(item => item.id === id);
  return profile && (!profile.featureFlag || flagOn(profile.featureFlag)) ? profile : null;
}

export function availableBiosecurityProfiles(flagOn: (flag: string) => boolean = () => false): BiosecurityProfile[] {
  return BIOSECURITY_PROFILES.filter(profile => !profile.featureFlag || flagOn(profile.featureFlag));
}

export function biosecurityCopy(profile: BiosecurityProfile): BiosecurityCopy {
  return { ...DEFAULT_BIOSECURITY_COPY, ...profile.copy };
}
