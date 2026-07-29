import type { SiteLang } from "../i18n.js";

export type KubiakaExperienceCopy = {
  pageTitle: string;
  description: string;
  activeNav: string;
  brand: string;
  scopeLabel: string;
  pilotLabel: string;
  hero: {
    eyebrow: string;
    headingLines: readonly [string, string];
    lead: string;
    cta: string;
    note: string;
  };
  trustItems: readonly string[];
  visual: {
    badge: string;
    label: string;
    note: string;
  };
  flow: {
    eyebrow: string;
    title: string;
    lead: string;
    steps: ReadonlyArray<{
      number: string;
      title: string;
      body: string;
    }>;
  };
  receipt: {
    eyebrow: string;
    title: string;
    lead: string;
    previewLabel: string;
    accepted: string;
    status: string;
    body: string;
    next: string;
  };
  about: {
    eyebrow: string;
    title: string;
    body: string;
    scientificNameLabel: string;
    scientificName: string;
  };
  safety: {
    eyebrow: string;
    title: string;
    items: readonly string[];
  };
  faq: {
    eyebrow: string;
    title: string;
    items: ReadonlyArray<{
      question: string;
      answer: string;
    }>;
  };
  footerNote: string;
};

const COPY = {
  ja: {
    pageTitle: "クビアカ見守り | ZUKAN",
    description: "近くのサクラをいつも通り撮るだけ。専門知識や追加撮影を求めず、まず地域の記録として受け取るZUKANの見守り体験です。",
    activeNav: "クビアカ見守り",
    brand: "ZUKAN",
    scopeLabel: "クビアカ見守り",
    pilotLabel: "限定公開",
    hero: {
      eyebrow: "サクラの今を、地域の記録に",
      headingLines: ["近くのサクラを", "撮ってみよう。"],
      lead: "虫を見つけなくても大丈夫。幹や太い枝が入るように、いつもの一枚を撮るだけです。",
      cta: "サクラを撮る",
      note: "写真は1枚から。追加撮影は求めません。",
    },
    trustItems: ["追加撮影なし", "専門知識なし", "場所はそのまま公開しない"],
    visual: {
      badge: "いつもの1枚でOK",
      label: "サクラの幹と枝が入れば十分",
      note: "虫を探し回る必要はありません",
    },
    flow: {
      eyebrow: "HOW TO",
      title: "探すより、今を残す。",
      lead: "特別な調査ではありません。無理なく見つけたサクラを、普段のスマホで残します。",
      steps: [
        { number: "01", title: "サクラを見つける", body: "公園や道沿いなど、無理なく近づける木で大丈夫。立入禁止の場所には入りません。" },
        { number: "02", title: "いつも通り撮る", body: "木から少し離れ、幹と太い枝が一緒に入る一枚を。拡大や追加撮影は不要です。" },
        { number: "03", title: "自分だけの受け取りへ", body: "まず「記録が残った」ことを確認。分かったことと分からないことを分けて返します。" },
      ],
    },
    receipt: {
      eyebrow: "PRIVATE RECEIPT",
      title: "送ったあと、自分だけの受け取りへ。",
      lead: "記録の保存、確認中、見えた範囲を混ぜずに表示します。",
      previewLabel: "受け取り画面のイメージ",
      accepted: "記録を受け取りました",
      status: "写真1枚・確認待ち",
      body: "この時点では、クビアカツヤカミキリの有無は判断していません。",
      next: "自動確認を有効にした段階では、写真から見えた範囲だけを同じ画面に追加します。",
    },
    about: {
      eyebrow: "ABOUT",
      title: "クビアカツヤカミキリって？",
      body: "サクラなどの木に関わる外来昆虫です。ZUKANでは、見つけた人に判断や通報を背負わせず、まず地域の写真を丁寧に残します。",
      scientificNameLabel: "学名",
      scientificName: "Aromia bungii",
    },
    safety: {
      eyebrow: "PROMISE",
      title: "勝手に公開・通報しません。",
      items: [
        "投稿した場所を、そのまま公開地図に載せません。",
        "AIの候補を「確認済み」と表示しません。",
        "行政・研究者・土地管理者への外部送信は、別の承認がない限り行いません。",
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "気になること",
      items: [
        { question: "虫が写っていなくてもいい？", answer: "はい。サクラの今を残すことが最初の目的です。" },
        { question: "何枚撮ればいい？", answer: "1枚からで大丈夫です。追加の写真を求める前提にはしません。" },
        { question: "場所は公開される？", answer: "この入口では公開地図に載せません。公開範囲は受け取り画面で明確にします。" },
        { question: "写真だけで確定できる？", answer: "できない場合があります。自動判定、レビュー、専門家確認は別の状態として扱います。" },
      ],
    },
    footerNote: "ZUKAN クビアカ見守り — Receipt-first, Map-later.",
  },
  en: {
    pageTitle: "Kubiaka Watch | ZUKAN",
    description: "Photograph a nearby cherry tree as you normally would. ZUKAN receives the record first, without requiring expertise, extra shots, or a public map.",
    activeNav: "Kubiaka Watch",
    brand: "ZUKAN",
    scopeLabel: "Kubiaka Watch",
    pilotLabel: "private pilot",
    hero: {
      eyebrow: "A cherry tree today becomes a local record",
      headingLines: ["Photograph a", "nearby cherry tree."],
      lead: "You do not need to find an insect. One ordinary photo showing the trunk and larger branches is enough to begin.",
      cta: "Photograph a cherry tree",
      note: "Start with one photo. No extra shots are required.",
    },
    trustItems: ["No extra shots", "No expertise needed", "Location is not published as-is"],
    visual: { badge: "One ordinary photo", label: "The trunk and larger branches are enough", note: "There is no need to search for an insect" },
    flow: {
      eyebrow: "HOW TO",
      title: "Record the moment, rather than hunt for signs.",
      lead: "This is not a specialist survey. Use your usual phone and a cherry tree you can approach safely.",
      steps: [
        { number: "01", title: "Find a cherry tree", body: "A tree in a park or along a street is fine. Do not enter restricted or unsafe areas." },
        { number: "02", title: "Take a normal photo", body: "Stand back enough to include the trunk and larger branches. No zoomed detail or extra shots are required." },
        { number: "03", title: "Open your private receipt", body: "First confirm that the record was saved. What is known and what is still unknown remain separate." },
      ],
    },
    receipt: {
      eyebrow: "PRIVATE RECEIPT",
      title: "After sending, return to a receipt that is yours.",
      lead: "Saved, checking, and visible findings are shown as different states.",
      previewLabel: "Receipt preview",
      accepted: "Your record was received",
      status: "1 photo · waiting for review",
      body: "At this point, the presence or absence of Aromia bungii has not been determined.",
      next: "When automated review is enabled, only findings visible in the photo will be added to the same receipt.",
    },
    about: {
      eyebrow: "ABOUT",
      title: "What is Aromia bungii?",
      body: "It is an invasive longhorn beetle associated with trees including cherry trees. ZUKAN begins by preserving local photos without making the contributor responsible for diagnosis or reporting.",
      scientificNameLabel: "Scientific name",
      scientificName: "Aromia bungii",
    },
    safety: {
      eyebrow: "PROMISE",
      title: "No automatic publication or reporting.",
      items: [
        "The submitted location is not placed directly on a public map.",
        "An AI candidate is never displayed as a confirmed finding.",
        "Nothing is sent to authorities, researchers, or land managers without a separate approval path.",
      ],
    },
    faq: {
      eyebrow: "FAQ",
      title: "Questions",
      items: [
        { question: "Is a photo useful without an insect?", answer: "Yes. The first purpose is to preserve the current state of the cherry tree." },
        { question: "How many photos are needed?", answer: "One is enough to begin. The experience is not built around requesting extra photos." },
        { question: "Will the location be public?", answer: "Not through this entry. Publication scope will be stated clearly on the receipt." },
        { question: "Can a photo confirm the species?", answer: "Not always. Automated assessment, review, and specialist confirmation remain separate states." },
      ],
    },
    footerNote: "ZUKAN Kubiaka Watch — Receipt-first, Map-later.",
  },
  es: {
    pageTitle: "Vigilancia Kubiaka | ZUKAN",
    description: "Fotografía un cerezo cercano como siempre. ZUKAN recibe primero el registro, sin exigir conocimientos, fotos adicionales ni un mapa público.",
    activeNav: "Vigilancia Kubiaka",
    brand: "ZUKAN",
    scopeLabel: "Vigilancia Kubiaka",
    pilotLabel: "piloto privado",
    hero: {
      eyebrow: "El cerezo de hoy se convierte en memoria local",
      headingLines: ["Fotografía un", "cerezo cercano."],
      lead: "No necesitas encontrar un insecto. Basta una foto normal donde se vean el tronco y las ramas principales.",
      cta: "Fotografiar un cerezo",
      note: "Empieza con una foto. No pedimos tomas adicionales.",
    },
    trustItems: ["Sin fotos adicionales", "Sin conocimientos previos", "La ubicación no se publica tal cual"],
    visual: { badge: "Una foto normal basta", label: "El tronco y las ramas principales son suficientes", note: "No hace falta buscar insectos" },
    flow: {
      eyebrow: "CÓMO FUNCIONA",
      title: "Guarda el momento, no persigas señales.",
      lead: "No es un estudio especializado. Usa tu teléfono habitual y un cerezo al que puedas acercarte con seguridad.",
      steps: [
        { number: "01", title: "Encuentra un cerezo", body: "Puede estar en un parque o junto a una calle. No entres en zonas restringidas o inseguras." },
        { number: "02", title: "Haz una foto normal", body: "Aléjate un poco para incluir el tronco y las ramas principales. No necesitas zoom ni más fotos." },
        { number: "03", title: "Abre tu recibo privado", body: "Primero confirma que el registro se guardó. Lo conocido y lo desconocido se muestran por separado." },
      ],
    },
    receipt: {
      eyebrow: "RECIBO PRIVADO",
      title: "Después de enviar, vuelve a tu propio recibo.",
      lead: "Guardado, en revisión y hallazgos visibles se muestran como estados distintos.",
      previewLabel: "Vista previa del recibo",
      accepted: "Recibimos tu registro",
      status: "1 foto · pendiente de revisión",
      body: "En este momento no se ha determinado la presencia o ausencia de Aromia bungii.",
      next: "Cuando se active la revisión automática, solo se añadirán al recibo los indicios visibles en la foto.",
    },
    about: {
      eyebrow: "ACERCA DE",
      title: "¿Qué es Aromia bungii?",
      body: "Es un escarabajo longicornio invasor relacionado con árboles como los cerezos. ZUKAN empieza conservando fotos locales sin cargar a la persona con el diagnóstico o el aviso.",
      scientificNameLabel: "Nombre científico",
      scientificName: "Aromia bungii",
    },
    safety: {
      eyebrow: "COMPROMISO",
      title: "Sin publicación ni aviso automáticos.",
      items: [
        "La ubicación enviada no se coloca directamente en un mapa público.",
        "Una sugerencia de IA nunca se muestra como confirmación.",
        "No se envía nada a autoridades, investigadores o gestores sin una vía de aprobación separada.",
      ],
    },
    faq: {
      eyebrow: "PREGUNTAS",
      title: "Dudas frecuentes",
      items: [
        { question: "¿Sirve una foto sin insecto?", answer: "Sí. El primer objetivo es conservar el estado actual del cerezo." },
        { question: "¿Cuántas fotos necesito?", answer: "Una basta para empezar. La experiencia no se basa en pedir fotos adicionales." },
        { question: "¿La ubicación será pública?", answer: "No desde esta entrada. El alcance de publicación se indicará claramente en el recibo." },
        { question: "¿Una foto puede confirmar la especie?", answer: "No siempre. Evaluación automática, revisión y confirmación experta son estados diferentes." },
      ],
    },
    footerNote: "Vigilancia Kubiaka de ZUKAN — Primero el recibo, después el mapa.",
  },
  "pt-BR": {
    pageTitle: "Observação Kubiaka | ZUKAN",
    description: "Fotografe uma cerejeira próxima como de costume. O ZUKAN recebe primeiro o registro, sem exigir conhecimento, fotos extras ou mapa público.",
    activeNav: "Observação Kubiaka",
    brand: "ZUKAN",
    scopeLabel: "Observação Kubiaka",
    pilotLabel: "piloto privado",
    hero: {
      eyebrow: "A cerejeira de hoje vira memória local",
      headingLines: ["Fotografe uma", "cerejeira próxima."],
      lead: "Você não precisa encontrar um inseto. Uma foto comum mostrando o tronco e os galhos principais já é suficiente.",
      cta: "Fotografar uma cerejeira",
      note: "Comece com uma foto. Não pedimos imagens adicionais.",
    },
    trustItems: ["Sem fotos extras", "Sem conhecimento prévio", "A localização não é publicada como está"],
    visual: { badge: "Uma foto comum basta", label: "Tronco e galhos principais são suficientes", note: "Não é preciso procurar insetos" },
    flow: {
      eyebrow: "COMO FUNCIONA",
      title: "Registre o momento, sem caçar sinais.",
      lead: "Não é uma pesquisa especializada. Use seu celular habitual e uma cerejeira que possa ser acessada com segurança.",
      steps: [
        { number: "01", title: "Encontre uma cerejeira", body: "Pode ser em um parque ou ao lado de uma rua. Não entre em áreas restritas ou inseguras." },
        { number: "02", title: "Tire uma foto normal", body: "Afaste-se um pouco para incluir o tronco e os galhos principais. Não é necessário zoom nem outras fotos." },
        { number: "03", title: "Abra seu recibo privado", body: "Primeiro confirme que o registro foi salvo. O que se sabe e o que ainda não se sabe ficam separados." },
      ],
    },
    receipt: {
      eyebrow: "RECIBO PRIVADO",
      title: "Depois de enviar, volte ao seu próprio recibo.",
      lead: "Salvo, em análise e achados visíveis aparecem como estados diferentes.",
      previewLabel: "Prévia do recibo",
      accepted: "Recebemos seu registro",
      status: "1 foto · aguardando análise",
      body: "Neste momento, a presença ou ausência de Aromia bungii ainda não foi determinada.",
      next: "Quando a análise automática for ativada, apenas o que estiver visível na foto será adicionado ao mesmo recibo.",
    },
    about: {
      eyebrow: "SOBRE",
      title: "O que é Aromia bungii?",
      body: "É um besouro longicórnio invasor associado a árvores como cerejeiras. O ZUKAN começa preservando fotos locais sem colocar sobre a pessoa a responsabilidade de diagnosticar ou notificar.",
      scientificNameLabel: "Nome científico",
      scientificName: "Aromia bungii",
    },
    safety: {
      eyebrow: "COMPROMISSO",
      title: "Sem publicação ou aviso automáticos.",
      items: [
        "A localização enviada não é colocada diretamente em um mapa público.",
        "Uma sugestão da IA nunca aparece como confirmação.",
        "Nada é enviado a autoridades, pesquisadores ou gestores sem um fluxo de aprovação separado.",
      ],
    },
    faq: {
      eyebrow: "DÚVIDAS",
      title: "Perguntas frequentes",
      items: [
        { question: "Uma foto sem inseto é útil?", answer: "Sim. O primeiro objetivo é preservar o estado atual da cerejeira." },
        { question: "Quantas fotos são necessárias?", answer: "Uma já basta para começar. A experiência não é baseada em pedir fotos extras." },
        { question: "A localização ficará pública?", answer: "Não por esta entrada. O escopo de publicação será informado claramente no recibo." },
        { question: "Uma foto pode confirmar a espécie?", answer: "Nem sempre. Avaliação automática, revisão e confirmação especializada continuam sendo estados diferentes." },
      ],
    },
    footerNote: "Observação Kubiaka do ZUKAN — Primeiro o recibo, depois o mapa.",
  },
} satisfies Record<SiteLang, KubiakaExperienceCopy>;

export function getKubiakaExperienceCopy(lang: SiteLang): KubiakaExperienceCopy {
  return COPY[lang] ?? COPY.ja;
}
