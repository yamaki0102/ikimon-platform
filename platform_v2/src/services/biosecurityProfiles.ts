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
}];

export function biosecurityProfile(id: unknown): BiosecurityProfile | null {
  return BIOSECURITY_PROFILES.find(profile => profile.id === id) ?? null;
}
