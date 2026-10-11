/** Explicitly approved public editions only. Never populate from private account data. */
export interface PersonPublication {
  readonly publicId: string;
  readonly slug: string;
  readonly edition: string;
  readonly locale: "ja";
  readonly state: "published" | "withdrawn";
  readonly authority: "subject_explicit";
  /** Already consented PUBLIC display name, never the private account/legal name. */
  readonly name: string;
  /** The viewer must never infer identity mode from another product account. */
  readonly identityMode?: "real_name" | "alias" | "anonymous";
  /** New editions default to unlisted. Existing approved editions must opt in. */
  readonly discoverability?: "indexed" | "unlisted";
  readonly latinName: string;
  readonly headline: string;
  readonly summary: string;
  readonly paragraphs: readonly string[];
  readonly activities: readonly { readonly title: string; readonly text: string }[];
  readonly links: readonly { readonly label: string; readonly href: string }[];
  readonly updatedOn: string;
}

// Source-managed first edition. This is public publication content, not a second
// personal account store. NOCOSIL account editing/synchronization is not implied.
export const PERSON_PUBLICATIONS: readonly PersonPublication[] = [
  {
    publicId: "7f35a4b15b8b4a5185cc85a4783b46eb",
    slug: "takeshi-yamaki",
    edition: "2026-10-11.1",
    locale: "ja",
    state: "published",
    authority: "subject_explicit",
    name: "八巻 毅",
    identityMode: "real_name",
    discoverability: "indexed",
    latinName: "Takeshi Yamaki",
    headline: "マーケター / FDE",
    summary: "浜松を拠点に、マーケティング・企画・AIやソフトウェアを活用した実行支援に取り組んでいます。",
    paragraphs: [
      "IKIMON株式会社の代表取締役。事業の目的から考え、情報発信や仕組みづくりを、実際に使われるところまでつなぐ仕事をしています。",
      "地域の人や事業、自然との関わりを大切にしながら、NOCOSILとZUKANの企画・開発に取り組んでいます。",
    ],
    activities: [
      { title: "マーケティング・企画", text: "伝える相手と目的を整理し、Webサイトやコンテンツ、日々の運用まで一緒に考えます。" },
      { title: "AI・ソフトウェア", text: "現場の課題をもとに、AIの活用や業務の仕組みづくりを進めます。" },
      { title: "地域のプロジェクト", text: "人・企業・団体の活動と地域の情報をつなぎ、継続して使える形にしていきます。" },
    ],
    links: [
      { label: "IKIMON株式会社", href: "https://ikimon.co.jp/company/" },
      { label: "NOCOSIL", href: "https://nocosil.com/" },
      { label: "ZUKAN", href: "https://zukan.earth/ja" },
    ],
    updatedOn: "2026-10-11",
  },
];
