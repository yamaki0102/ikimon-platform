import type { SiteLang } from "../i18n.js";
import type { HomePlace, LandingObservation } from "../services/readModels.js";
import { pickPlaceFocus } from "../ui/placeRevisit.js";

type NotesLoopStepCopy = {
  label: string;
  title: string;
  body: string;
  path: string;
  cta: string;
};

type NotesLibraryCopy = {
  pageTitle: string;
  activeNav: string;
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  actions: {
    record: string;
    guide: string;
    outcomes: string;
  };
  statsAria: string;
  stats: {
    observations: string;
    photos: string;
    named: string;
  };
  loop: {
    aria: string;
    eyebrow: string;
    title: string;
    lead: string;
    steps: NotesLoopStepCopy[];
  };
  sections: {
    ownEyebrow: string;
    publicEyebrow: string;
    ownTitle: string;
    publicTitle: string;
    placesEyebrow: string;
    placesTitle: string;
    placesLead: string;
    placesEmpty: string;
    nearbyEyebrow: string;
    nearbyTitle: string;
    nearbyLead: string;
  };
  controls: {
    aria: string;
    searchPlaceholder: string;
    filterAria: string;
    sourceLanesAria: string;
    all: string;
    photo: string;
    video: string;
    guide: string;
    scan: string;
    uncertain: string;
    identified: string;
  };
  sourceLabels: Record<NonNullable<LandingObservation["librarySourceKind"]>, string>;
  card: {
    fallbackName: string;
    fallbackPlace: string;
    uncertainBadge: string;
    namedBadge: string;
    menuAria: string;
    detail: string;
    delete: string;
    deleting: string;
    deleteConfirm: string;
    deleteFailedPrefix: string;
  };
  emptyLibrary: string;
  latestFallback: string;
  nearbyEmpty: string;
  footerNote: string;
};

export function notesLibraryCopy(lang: SiteLang): NotesLibraryCopy {
  const localized: Record<SiteLang, NotesLibraryCopy> = {
    ja: {
      pageTitle: "記録ライブラリ | ikimon",
      activeNav: "記録ライブラリ",
      heroEyebrow: "記録ライブラリ",
      heroTitle: "記録ライブラリ",
      heroLead: "写真・動画・音声・場所・時刻・メモをまとめて残した「記録」を見返す場所です。1件の記録から複数の対象ごとの記録を作れます。対象ごとの記録や同定は詳細で切り分け、ここでは場所・時間・証拠・再訪文脈を主役にします。",
      actions: {
        record: "記録する",
        guide: "ライブガイドを使う",
        outcomes: "ガイド成果を見る",
      },
      statsAria: "記録ライブラリの概要",
      stats: {
        observations: "記録",
        photos: "写真枚数",
        named: "対象化済み",
      },
      loop: {
        aria: "記録体験の流れ",
        eyebrow: "記録の流れ",
        title: "記録する → 記録を見返す → 対象ごとの記録に分ける → 同定で確かめる",
        lead: "記録ライブラリは倉庫ではなく、次の一歩を決める場所です。写真・動画・音声、ライブガイド、ガイド成果、マップを同じ循環として扱います。",
        steps: [
          { label: "記録", title: "写真・動画を残す", body: "見つけたもの、場所、時刻、メモを1件の記録として保存する。", path: "/record", cta: "記録する" },
          { label: "Guide", title: "名前より環境を読む", body: "分からない場面はライブガイドで、植生・水路・道ばたの変化を足跡にする。", path: "/guide", cta: "ガイドへ" },
          { label: "対象", title: "対象ごとの記録に分ける", body: "1件の記録の中から、生きもの・痕跡・音ごとに切り出す。", path: "/records?view=public", cta: "記録を見る" },
          { label: "同定", title: "名前を確かめる", body: "AI候補を手がかりに、人の同定で種類を判断する。", path: "/records?view=needs_id", cta: "同定へ" },
        ],
      },
      sections: {
        ownEyebrow: "My records",
        publicEyebrow: "Public sample",
        ownTitle: "自分の記録",
        publicTitle: "公開されている観察レコード",
        placesEyebrow: "Albums",
        placesTitle: "場所アルバム",
        placesLead: "よく行く場所をフォルダみたいに開く。",
        placesEmpty: "場所アルバムはまだありません。",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "近くの公開観察レコード",
        nearbyLead: "自分の記録とは分けて、地域の背景として薄く見る。",
      },
      controls: {
        aria: "記録ライブラリの絞り込み",
        searchPlaceholder: "場所・気づきで探す",
        filterAria: "表示切り替え",
        sourceLanesAria: "データの種類",
        all: "すべて",
        photo: "写真",
        video: "動画",
        guide: "ガイド",
        scan: "スキャン",
        uncertain: "同定待ち",
        identified: "観察レコードあり",
      },
      sourceLabels: {
        video: "動画",
        audio: "音",
        guide: "ガイド",
        scan: "スキャン",
        photo: "写真",
        note: "記録",
      },
      card: {
        fallbackName: "対象を整理中の記録",
        fallbackPlace: "場所未設定",
        uncertainBadge: "同定待ち",
        namedBadge: "観察レコードあり",
        menuAria: "記録メニュー",
        detail: "詳しく見る",
        delete: "削除する",
        deleting: "削除中...",
        deleteConfirm: "この記録を一覧と公開ページから削除します。よろしいですか？",
        deleteFailedPrefix: "削除できませんでした: ",
      },
      emptyLibrary: "まだ記録ライブラリに並べる記録がありません。",
      latestFallback: "記録が増えるほど、ここに月ごとの棚が育ちます。",
      nearbyEmpty: "まだ近くの公開観察レコードは表示できません。自分の記録ライブラリを主役にします。",
      footerNote: "記録の棚はこのページ、成長や地域への効き方はマイページに分けています。",
    },
    en: {
      pageTitle: "Observation Library | ikimon",
      activeNav: "Notes",
      heroEyebrow: "Observation Library",
      heroTitle: "Observation Library",
      heroLead: "A photo-first library for your records. Photos, videos, guide traces, and map discoveries stay organized by month so you can browse, search, and open the next record quickly.",
      actions: {
        record: "Record photos or video",
        guide: "Use live guide",
        outcomes: "View guide outcomes",
      },
      statsAria: "Observation library summary",
      stats: {
        observations: "Records",
        photos: "Photos",
        named: "Named",
      },
      loop: {
        aria: "Observation experience loop",
        eyebrow: "Experience loop",
        title: "Record, read, review, and walk again.",
        lead: "The library is not storage. It is the place that makes the next walk easier to choose by connecting photos, video, live guide traces, guide outcomes, and the map.",
        steps: [
          { label: "Record", title: "Save photos or video", body: "Keep the main subject, place, and time before details fade.", path: "/record", cta: "Record" },
          { label: "Guide", title: "Read the setting, not only the name", body: "When the name is unclear, use live guide to save vegetation, water, roadside, and habitat clues.", path: "/guide", cta: "Open guide" },
          { label: "Outcome", title: "Review what the walk produced", body: "See routes, representative cards, and next places as outcomes of the field walk.", path: "/guide/outcomes", cta: "View outcomes" },
          { label: "Map", title: "Return to the next place", body: "Compare the library with the map to notice gaps, seasons, and places worth revisiting.", path: "/map", cta: "Open map" },
        ],
      },
      sections: {
        ownEyebrow: "My observations",
        publicEyebrow: "Public sample",
        ownTitle: "My observation records",
        publicTitle: "Public observation records",
        placesEyebrow: "Albums",
        placesTitle: "Place albums",
        placesLead: "Open familiar places like folders.",
        placesEmpty: "No place albums yet.",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "Nearby public records",
        nearbyLead: "Keep them separate from your own shelf and read them as local background.",
      },
      controls: {
        aria: "Filter observation library",
        searchPlaceholder: "Search by name or place",
        filterAria: "Display filters",
        sourceLanesAria: "Data types",
        all: "All",
        photo: "Photos",
        video: "Video",
        guide: "Guide",
        scan: "Scan",
        uncertain: "Needs name",
        identified: "Has ID",
      },
      sourceLabels: {
        video: "Video",
        audio: "Sound",
        guide: "Guide",
        scan: "Scan",
        photo: "Photo",
        note: "Note",
      },
      card: {
        fallbackName: "Record checking its name",
        fallbackPlace: "Place not set",
        uncertainBadge: "Needs name",
        namedBadge: "Named",
        menuAria: "Observation menu",
        detail: "View details",
        delete: "Delete",
        deleting: "Deleting...",
        deleteConfirm: "Delete this observation from the list and public page?",
        deleteFailedPrefix: "Could not delete: ",
      },
      emptyLibrary: "No records in this observation library yet.",
      latestFallback: "As records grow, monthly shelves will appear here.",
      nearbyEmpty: "Nearby public records are not available yet. Your own library stays primary.",
      footerNote: "Observation shelves live here. Growth and local contribution stay on your profile.",
    },
    es: {
      pageTitle: "Biblioteca de observaciones | ikimon",
      activeNav: "Notes",
      heroEyebrow: "Biblioteca de observaciones",
      heroTitle: "Biblioteca de observaciones",
      heroLead: "Una biblioteca visual para tus registros. Fotos, videos, guías y hallazgos del mapa quedan ordenados por mes para mirar, buscar y abrir el siguiente registro con rapidez.",
      actions: {
        record: "Registrar foto o video",
        guide: "Usar guía en vivo",
        outcomes: "Ver resultados",
      },
      statsAria: "Resumen de la biblioteca de observaciones",
      stats: {
        observations: "Registros",
        photos: "Fotos",
        named: "Con nombre",
      },
      loop: {
        aria: "Ciclo de observación",
        eyebrow: "Experience loop",
        title: "Registra, lee, revisa y vuelve a caminar.",
        lead: "La biblioteca no es un almacén. Es el lugar que ayuda a elegir la próxima salida conectando fotos, videos, guías, resultados y mapa.",
        steps: [
          { label: "Record", title: "Guarda fotos o video", body: "Conserva el sujeto, el lugar y la hora antes de que se pierdan los detalles.", path: "/record", cta: "Registrar" },
          { label: "Guide", title: "Lee el entorno, no solo el nombre", body: "Si el nombre no está claro, guarda pistas de vegetación, agua, caminos y hábitat.", path: "/guide", cta: "Abrir guía" },
          { label: "Outcome", title: "Revisa lo que produjo la caminata", body: "Mira rutas, tarjetas representativas y próximos lugares como resultado de la salida.", path: "/guide/outcomes", cta: "Ver resultados" },
          { label: "Map", title: "Vuelve al siguiente lugar", body: "Compara la biblioteca con el mapa para notar vacíos, temporadas y sitios para volver.", path: "/map", cta: "Abrir mapa" },
        ],
      },
      sections: {
        ownEyebrow: "My observations",
        publicEyebrow: "Public sample",
        ownTitle: "Mis registros de observación",
        publicTitle: "Registros públicos de observación",
        placesEyebrow: "Albums",
        placesTitle: "Álbumes de lugares",
        placesLead: "Abre lugares conocidos como carpetas.",
        placesEmpty: "Aún no hay álbumes de lugares.",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "Registros públicos cercanos",
        nearbyLead: "Se mantienen separados de tu biblioteca y sirven como contexto local.",
      },
      controls: {
        aria: "Filtrar biblioteca de observaciones",
        searchPlaceholder: "Buscar por nombre o lugar",
        filterAria: "Filtros de vista",
        sourceLanesAria: "Tipos de datos",
        all: "Todo",
        photo: "Fotos",
        video: "Video",
        guide: "Guía",
        scan: "Escaneo",
        uncertain: "Sin nombre",
        identified: "Con ID",
      },
      sourceLabels: {
        video: "Video",
        audio: "Audio",
        guide: "Guía",
        scan: "Escaneo",
        photo: "Foto",
        note: "Nota",
      },
      card: {
        fallbackName: "Registro con nombre por confirmar",
        fallbackPlace: "Lugar no definido",
        uncertainBadge: "Sin nombre",
        namedBadge: "Con nombre",
        menuAria: "Menú de observación",
        detail: "Ver detalles",
        delete: "Eliminar",
        deleting: "Eliminando...",
        deleteConfirm: "¿Eliminar esta observación de la lista y de la página pública?",
        deleteFailedPrefix: "No se pudo eliminar: ",
      },
      emptyLibrary: "Aún no hay registros en esta biblioteca.",
      latestFallback: "A medida que crezcan los registros, aquí aparecerán estantes mensuales.",
      nearbyEmpty: "Aún no hay registros públicos cercanos disponibles. Tu biblioteca sigue siendo lo principal.",
      footerNote: "Los registros viven aquí. El crecimiento y la contribución local quedan en tu perfil.",
    },
    "pt-BR": {
      pageTitle: "Biblioteca de observações | ikimon",
      activeNav: "Notes",
      heroEyebrow: "Biblioteca de observações",
      heroTitle: "Biblioteca de observações",
      heroLead: "Uma biblioteca visual para seus registros. Fotos, vídeos, guias e descobertas do mapa ficam organizados por mês para navegar, buscar e abrir o próximo registro rapidamente.",
      actions: {
        record: "Registrar foto ou vídeo",
        guide: "Usar guia ao vivo",
        outcomes: "Ver resultados",
      },
      statsAria: "Resumo da biblioteca de observações",
      stats: {
        observations: "Registros",
        photos: "Fotos",
        named: "Com nome",
      },
      loop: {
        aria: "Ciclo de observação",
        eyebrow: "Experience loop",
        title: "Registre, leia, revise e caminhe de novo.",
        lead: "A biblioteca não é armazenamento. Ela ajuda a escolher a próxima saída conectando fotos, vídeos, guias, resultados e mapa.",
        steps: [
          { label: "Record", title: "Salve fotos ou vídeo", body: "Guarde o sujeito, o lugar e o horário antes que os detalhes se percam.", path: "/record", cta: "Registrar" },
          { label: "Guide", title: "Leia o ambiente, não só o nome", body: "Quando o nome não estiver claro, salve pistas de vegetação, água, caminho e habitat.", path: "/guide", cta: "Abrir guia" },
          { label: "Outcome", title: "Revise o que a caminhada gerou", body: "Veja rotas, cartões representativos e próximos lugares como resultado da saída.", path: "/guide/outcomes", cta: "Ver resultados" },
          { label: "Map", title: "Volte ao próximo lugar", body: "Compare a biblioteca com o mapa para notar lacunas, estações e locais para revisitar.", path: "/map", cta: "Abrir mapa" },
        ],
      },
      sections: {
        ownEyebrow: "My observations",
        publicEyebrow: "Public sample",
        ownTitle: "Meus registros de observação",
        publicTitle: "Registros públicos de observação",
        placesEyebrow: "Albums",
        placesTitle: "Álbuns de lugares",
        placesLead: "Abra lugares conhecidos como pastas.",
        placesEmpty: "Ainda não há álbuns de lugares.",
        nearbyEyebrow: "Nearby traces",
        nearbyTitle: "Registros públicos próximos",
        nearbyLead: "Eles ficam separados da sua biblioteca e servem como contexto local.",
      },
      controls: {
        aria: "Filtrar biblioteca de observações",
        searchPlaceholder: "Buscar por nome ou lugar",
        filterAria: "Filtros de visualização",
        sourceLanesAria: "Tipos de dados",
        all: "Todos",
        photo: "Fotos",
        video: "Vídeo",
        guide: "Guia",
        scan: "Scan",
        uncertain: "Sem nome",
        identified: "Com ID",
      },
      sourceLabels: {
        video: "Vídeo",
        audio: "Som",
        guide: "Guia",
        scan: "Scan",
        photo: "Foto",
        note: "Nota",
      },
      card: {
        fallbackName: "Registro com nome a confirmar",
        fallbackPlace: "Lugar não definido",
        uncertainBadge: "Sem nome",
        namedBadge: "Com nome",
        menuAria: "Menu da observação",
        detail: "Ver detalhes",
        delete: "Excluir",
        deleting: "Excluindo...",
        deleteConfirm: "Excluir esta observação da lista e da página pública?",
        deleteFailedPrefix: "Não foi possível excluir: ",
      },
      emptyLibrary: "Ainda não há registros nesta biblioteca.",
      latestFallback: "Conforme os registros crescem, prateleiras mensais aparecem aqui.",
      nearbyEmpty: "Ainda não há registros públicos próximos disponíveis. Sua biblioteca continua em primeiro plano.",
      footerNote: "Os registros ficam aqui. Crescimento e contribuição local ficam no seu perfil.",
    },
  };
  return localized[lang] ?? localized.ja;
}

export function formatNotesNumber(value: number, lang: SiteLang): string {
  const locale = lang === "ja" ? "ja-JP" : lang === "es" ? "es-ES" : lang === "pt-BR" ? "pt-BR" : "en-US";
  return new Intl.NumberFormat(locale).format(value);
}

export function notesItemCountLabel(count: number, lang: SiteLang): string {
  const value = formatNotesNumber(count, lang);
  if (lang === "ja") return `${value} 件`;
  if (lang === "es") return `${value} registros`;
  if (lang === "pt-BR") return `${value} registros`;
  return `${value} records`;
}

export function notesPlaceCountLabel(count: number, lang: SiteLang): string {
  const value = formatNotesNumber(count, lang);
  if (lang === "ja") return `${value} 場所`;
  if (lang === "es") return `${value} lugares`;
  if (lang === "pt-BR") return `${value} lugares`;
  return `${value} places`;
}

export function notesRecordUnitLabel(lang: SiteLang): string {
  if (lang === "ja") return "件";
  if (lang === "es") return "registros";
  if (lang === "pt-BR") return "registros";
  return "records";
}

export function notesPhotoCountLabel(count: number, lang: SiteLang): string {
  const value = formatNotesNumber(count, lang);
  if (lang === "ja") return `${value}枚`;
  if (lang === "es") return `${value} fotos`;
  if (lang === "pt-BR") return `${value} fotos`;
  return `${value} photos`;
}

export function notesPhotoAltIndex(index: number, lang: SiteLang): string {
  const value = formatNotesNumber(index, lang);
  if (lang === "ja") return `写真${value}`;
  if (lang === "es") return `foto ${value}`;
  if (lang === "pt-BR") return `foto ${value}`;
  return `photo ${value}`;
}

type ObservationFilterKey = "all" | "needs_id" | "ai" | "no_id" | "photo" | "video" | "identified" | "multi";

type ObservationIndexCopy = {
  activeNav: string;
  title: string;
  identifyTitle: string;
  footerNote: string;
  countSuffix: string;
  relatedActionsAria: string;
  mapAction: string;
  recordAction: string;
  recordActionAria: string;
  controlPanelAria: string;
  searchPlaceholder: string;
  searchLabel: string;
  toolbarAria: string;
  detailsSummary: string;
  resultPanelAria: string;
  emptyInitial: string;
  emptyFiltered: string;
  shortcutIdentify: string;
  shortcutConfirm: string;
  identifyAriaTemplate: string;
  status: {
    ai: string;
    awaiting: string;
    identified: string;
  };
  filters: Record<ObservationFilterKey, string>;
  advanced: {
    status: string;
    evidence: string;
    taxon: string;
    rank: string;
    date: string;
    ids: string;
    sort: string;
  };
  options: {
    all: string;
    noPhoto: string;
    species: string;
    genus: string;
    family: string;
    order: string;
    class: string;
    phylum: string;
    sevenDays: string;
    thirtyDays: string;
    ninetyDays: string;
    zeroIds: string;
    oneId: string;
    twoPlusIds: string;
    newest: string;
    oldest: string;
    leastId: string;
    mostId: string;
  };
  field: {
    aria: string;
    label: string;
    placeholder: string;
    clear: string;
    empty: string;
  };
  presets: {
    aria: string;
    placeholder: string;
    save: string;
    fallback: string;
    spotFallback: string;
    deleteSuffix: string;
  };
};

export function observationIndexCopy(lang: SiteLang): ObservationIndexCopy {
  const localized: Record<SiteLang, ObservationIndexCopy> = {
    ja: {
      activeNav: "見つける",
      title: "観察レコード一覧",
      identifyTitle: "名前を確かめる",
      footerNote: "公開されている観察レコードを、見つける・確かめる・記録する流れにつなげます。",
      countSuffix: "件",
      relatedActionsAria: "関連する操作",
      mapAction: "地図",
      recordAction: "+",
      recordActionAria: "記録する",
      controlPanelAria: "同定と観察の絞り込み",
      searchPlaceholder: "名前・場所・人",
      searchLabel: "観察を検索",
      toolbarAria: "観察レコードの表示切り替え",
      detailsSummary: "詳細",
      resultPanelAria: "観察カード",
      emptyInitial: "まだ表示できる観察レコードがありません。",
      emptyFiltered: "該当する観察がありません。",
      shortcutIdentify: "名前を確認",
      shortcutConfirm: "確認",
      identifyAriaTemplate: "{name}の名前を手伝う",
      status: { ai: "AI候補", awaiting: "名前待ち", identified: "名前あり" },
      filters: {
        all: "すべて",
        needs_id: "名前待ち",
        ai: "AI候補",
        no_id: "名前なし",
        photo: "写真あり",
        video: "動画あり",
        multi: "複数あり",
        identified: "名前あり",
      },
      advanced: { status: "状態", evidence: "証拠", taxon: "分類", rank: "階級", date: "日付", ids: "名前確認数", sort: "並び" },
      options: {
        all: "すべて",
        noPhoto: "写真なし",
        species: "種",
        genus: "属",
        family: "科",
        order: "目",
        class: "綱",
        phylum: "門",
        sevenDays: "7日",
        thirtyDays: "30日",
        ninetyDays: "90日",
        zeroIds: "0件",
        oneId: "1件",
        twoPlusIds: "2件以上",
        newest: "新しい順",
        oldest: "古い順",
        leastId: "同定少ない順",
        mostId: "同定多い順",
      },
      field: { aria: "登録エリア", label: "登録エリア", placeholder: "スポット名", clear: "解除", empty: "登録エリアなし" },
      presets: { aria: "保存条件", placeholder: "保存名（任意）", save: "保存", fallback: "条件", spotFallback: "スポット", deleteSuffix: "を削除" },
    },
    en: {
      activeNav: "Explore",
      title: "Observations",
      identifyTitle: "Identify",
      footerNote: "Browse public observations, check names, and move into your next record.",
      countSuffix: " records",
      relatedActionsAria: "Related actions",
      mapAction: "Map",
      recordAction: "+",
      recordActionAria: "Record an observation",
      controlPanelAria: "Filter observations and identifications",
      searchPlaceholder: "Name, place, person",
      searchLabel: "Search observations",
      toolbarAria: "Observation view filters",
      detailsSummary: "Filters",
      resultPanelAria: "Observation cards",
      emptyInitial: "No public observations are ready to show yet.",
      emptyFiltered: "No observations match these filters.",
      shortcutIdentify: "Identify",
      shortcutConfirm: "Check",
      identifyAriaTemplate: "Identify {name}",
      status: { ai: "AI candidate", awaiting: "Needs ID", identified: "Named" },
      filters: {
        all: "All",
        needs_id: "Needs ID",
        ai: "AI candidates",
        no_id: "No ID yet",
        photo: "Photos",
        video: "Videos",
        multi: "Multiple subjects",
        identified: "Named",
      },
      advanced: { status: "Status", evidence: "Evidence", taxon: "Taxon", rank: "Rank", date: "Date", ids: "IDs", sort: "Sort" },
      options: {
        all: "All",
        noPhoto: "No photo",
        species: "Species",
        genus: "Genus",
        family: "Family",
        order: "Order",
        class: "Class",
        phylum: "Phylum",
        sevenDays: "7 days",
        thirtyDays: "30 days",
        ninetyDays: "90 days",
        zeroIds: "0 IDs",
        oneId: "1 ID",
        twoPlusIds: "2+ IDs",
        newest: "Newest first",
        oldest: "Oldest first",
        leastId: "Fewest IDs",
        mostId: "Most IDs",
      },
      field: { aria: "Registered areas", label: "Registered areas", placeholder: "Spot name", clear: "Clear", empty: "No registered areas" },
      presets: { aria: "Saved filters", placeholder: "Preset name (optional)", save: "Save", fallback: "Filter", spotFallback: "Spot", deleteSuffix: " delete" },
    },
    es: {
      activeNav: "Explorar",
      title: "Observaciones",
      identifyTitle: "Identificar",
      footerNote: "Explora observaciones publicas, revisa nombres y pasa al siguiente registro.",
      countSuffix: " registros",
      relatedActionsAria: "Acciones relacionadas",
      mapAction: "Mapa",
      recordAction: "+",
      recordActionAria: "Registrar una observacion",
      controlPanelAria: "Filtros de observaciones e identificaciones",
      searchPlaceholder: "Nombre, lugar, persona",
      searchLabel: "Buscar observaciones",
      toolbarAria: "Filtros de vista de observaciones",
      detailsSummary: "Filtros",
      resultPanelAria: "Tarjetas de observacion",
      emptyInitial: "Aun no hay observaciones publicas listas para mostrar.",
      emptyFiltered: "Ninguna observacion coincide con estos filtros.",
      shortcutIdentify: "Identificar",
      shortcutConfirm: "Revisar",
      identifyAriaTemplate: "Identificar {name}",
      status: { ai: "Candidato IA", awaiting: "Necesita ID", identified: "Con nombre" },
      filters: {
        all: "Todas",
        needs_id: "Necesita ID",
        ai: "Candidatos IA",
        no_id: "Sin ID",
        photo: "Fotos",
        video: "Videos",
        multi: "Varios sujetos",
        identified: "Con nombre",
      },
      advanced: { status: "Estado", evidence: "Evidencia", taxon: "Taxon", rank: "Rango", date: "Fecha", ids: "IDs", sort: "Orden" },
      options: {
        all: "Todas",
        noPhoto: "Sin foto",
        species: "Especie",
        genus: "Genero",
        family: "Familia",
        order: "Orden",
        class: "Clase",
        phylum: "Filo",
        sevenDays: "7 dias",
        thirtyDays: "30 dias",
        ninetyDays: "90 dias",
        zeroIds: "0 IDs",
        oneId: "1 ID",
        twoPlusIds: "2+ IDs",
        newest: "Mas recientes",
        oldest: "Mas antiguas",
        leastId: "Menos IDs",
        mostId: "Mas IDs",
      },
      field: { aria: "Areas registradas", label: "Areas registradas", placeholder: "Nombre del punto", clear: "Quitar", empty: "Sin areas registradas" },
      presets: { aria: "Filtros guardados", placeholder: "Nombre del filtro (opcional)", save: "Guardar", fallback: "Filtro", spotFallback: "Punto", deleteSuffix: " eliminar" },
    },
    "pt-BR": {
      activeNav: "Explorar",
      title: "Observacoes",
      identifyTitle: "Identificar",
      footerNote: "Explore observacoes publicas, confira nomes e siga para o proximo registro.",
      countSuffix: " registros",
      relatedActionsAria: "Acoes relacionadas",
      mapAction: "Mapa",
      recordAction: "+",
      recordActionAria: "Registrar uma observacao",
      controlPanelAria: "Filtros de observacoes e identificacoes",
      searchPlaceholder: "Nome, lugar, pessoa",
      searchLabel: "Buscar observacoes",
      toolbarAria: "Filtros da lista de observacoes",
      detailsSummary: "Filtros",
      resultPanelAria: "Cartoes de observacao",
      emptyInitial: "Ainda nao ha observacoes publicas prontas para mostrar.",
      emptyFiltered: "Nenhuma observacao combina com estes filtros.",
      shortcutIdentify: "Identificar",
      shortcutConfirm: "Conferir",
      identifyAriaTemplate: "Identificar {name}",
      status: { ai: "Candidato de IA", awaiting: "Precisa de ID", identified: "Com nome" },
      filters: {
        all: "Todas",
        needs_id: "Precisa de ID",
        ai: "Candidatos IA",
        no_id: "Sem ID",
        photo: "Fotos",
        video: "Videos",
        multi: "Varios sujeitos",
        identified: "Com nome",
      },
      advanced: { status: "Status", evidence: "Evidencia", taxon: "Taxon", rank: "Nivel", date: "Data", ids: "IDs", sort: "Ordem" },
      options: {
        all: "Todas",
        noPhoto: "Sem foto",
        species: "Especie",
        genus: "Genero",
        family: "Familia",
        order: "Ordem",
        class: "Classe",
        phylum: "Filo",
        sevenDays: "7 dias",
        thirtyDays: "30 dias",
        ninetyDays: "90 dias",
        zeroIds: "0 IDs",
        oneId: "1 ID",
        twoPlusIds: "2+ IDs",
        newest: "Mais recentes",
        oldest: "Mais antigas",
        leastId: "Menos IDs",
        mostId: "Mais IDs",
      },
      field: { aria: "Areas registradas", label: "Areas registradas", placeholder: "Nome do ponto", clear: "Limpar", empty: "Sem areas registradas" },
      presets: { aria: "Filtros salvos", placeholder: "Nome do filtro (opcional)", save: "Salvar", fallback: "Filtro", spotFallback: "Ponto", deleteSuffix: " excluir" },
    },
  };
  return localized[lang] ?? localized.ja;
}

export function formatObservationIndexCount(count: number, copy: ObservationIndexCopy): string {
  return `${count}${copy.countSuffix}`;
}

export type RecordsWorkbenchView = "mine" | "public" | "identification_summary" | "needs_id" | "media" | "places";

export type RecordsWorkbenchCopy = {
  title: string;
  activeNav: string;
  searchLabel: string;
  mapLabel: string;
  recordLabel: string;
  empty: string;
  tabs: Record<RecordsWorkbenchView, string>;
  side: {
    title: string;
    latest: string;
    places: string;
    needsId: string;
    photos: string;
  };
};

export function buildPlaceNextLine(place: Pick<HomePlace, "nextLookFor" | "revisitReason" | "latestDisplayName">): string {
  const focus = pickPlaceFocus(place);
  return focus
    ? `次は ${focus}`
    : "次の散歩で小さな変化を1つ残す";
}

export function formatProfileNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}
