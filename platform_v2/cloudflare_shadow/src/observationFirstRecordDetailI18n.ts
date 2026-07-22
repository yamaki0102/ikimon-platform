export type ObservationRecordLang = "ja" | "en" | "es" | "pt-br";

export type ObservationFirstRecordDetailCopy = {
  documentSuffix: string;
  back: string;
  menu: string;
  records: string;
  home: string;
  language: string;
  media: string;
  enlargePhoto: string;
  openVideo: string;
  openAudio: string;
  mediaNavigation: string;
  natureRecord: string;
  publicLocation: string;
  visibility: Record<"public" | "limited" | "private", string>;
  edit: string;
  share: string;
  updatedNotice: string;
  found: string;
  aiFound: string;
  candidateTemplate: string;
  openDetails: string;
  openAll: string;
  recordName: string;
  photoCandidate: string;
  distinguishingPoints: string;
  shootingAdvice: string;
  proposals: string;
  proposeName: string;
  proposedName: string;
  proposalNote: string;
  saveProposal: string;
  loginToPropose: string;
  acceptName: string;
  placeSummary: string;
  photoInference: string;
  environmentFields: Record<"contact_surface" | "surrounding_cover" | "environment_condition" | "human_change", string>;
  environmentValues: Record<string, string>;
  environmentHeadlines: Record<string, string>;
  note: string;
  manage: string;
  addSubject: string;
  subjectName: string;
  subjectNameExample: string;
  subjectType: string;
  context: string;
  add: string;
  subjectTypes: Record<"unknown_subject" | "organism" | "group" | "trace" | "sound" | "pet", string>;
  contexts: Record<"unknown" | "wild" | "pet" | "captive" | "cultivated", string>;
  separateSubject: string;
  separateName: string;
  separate: string;
  notVisible: string;
  restore: string;
  combineWith: string;
  combine: string;
  assignMedia: string;
  assignMediaLead: string;
  assign: string;
  receiveProposals: string;
  pauseProposals: string;
  captureInfo: string;
  capturedAt: string;
  place: string;
  scope: string;
  mediaCount: string;
  photo: string;
  video: string;
  audio: string;
  related: string;
  relatedRecord: string;
  protectedLocation: string;
};

const ja: ObservationFirstRecordDetailCopy = {
  documentSuffix: "ikimon", back: "戻る", menu: "メニュー", records: "記録を見る", home: "ホーム", language: "言語",
  media: "写真・動画・音", enlargePhoto: "写真を大きく見る", openVideo: "動画を開く", openAudio: "音声を開く", mediaNavigation: "メディアを切り替える",
  natureRecord: "自然の記録", publicLocation: "安全な場所", visibility: { public: "公開", limited: "限定公開", private: "非公開" },
  edit: "詳しい編集", share: "共有", updatedNotice: "変更を記録しました。", found: "この記録で見つかったもの", aiFound: "AIが見つけたもの", candidateTemplate: "{name}かもしれません",
  openDetails: "詳しく見る", openAll: "すべて見る", recordName: "この記録の名前", photoCandidate: "写真からの候補",
  distinguishingPoints: "見分けるポイント", shootingAdvice: "もう少し詳しく調べるには", proposals: "名前の提案", proposeName: "名前を提案する",
  proposedName: "名前", proposalNote: "根拠・補足", saveProposal: "提案を記録", loginToPropose: "ログインして名前を提案する", acceptName: "この名前を採用",
  placeSummary: "この場所のようす", photoInference: "写真から読み取った候補です",
  environmentFields: { contact_surface: "地面・接しているもの", surrounding_cover: "周囲", environment_condition: "環境", human_change: "人の影響" },
  environmentValues: {
    grassland_urban_edge: "草地と市街地の境界", urban: "市街地", woodland: "林の中", water_edge: "水辺", wetland: "湿地", coast: "海岸",
    soil_gravel_litter: "土・礫・枯れ草", soil: "土", plant: "植物", water: "水面・水中", rock: "岩・石", artificial: "人工物",
    low_grass: "低い草地", trees_shrubs: "樹木・低木", bare_ground: "裸地", snow: "雪", built_surface: "舗装・構造物",
    open_dry: "開けて乾き気味", sunny: "日当たり", shaded: "日陰", wet: "湿り気あり", flowing: "流れあり", windy: "風あり",
    trampling_mowing: "踏圧・草刈り跡", mowing: "草刈り", trampling: "踏圧", planting: "植栽・管理", construction: "造成・工事", release: "放流・放逐", none_visible: "目立つ変化なし"
  },
  environmentHeadlines: { grassland_urban_edge: "草地と市街地の境界のようです", urban: "市街地のようです", woodland: "林の中のようです", water_edge: "水辺のようです", wetland: "湿地のようです", coast: "海岸のようです" },
  note: "観察メモ", manage: "記録を詳しくする", addSubject: "写っている対象を追加", subjectName: "対象の呼び名", subjectNameExample: "例：葉の上の幼虫",
  subjectType: "対象の種類", context: "環境", add: "追加する", subjectTypes: { unknown_subject: "まだ不明", organism: "生きもの", group: "複数の生きもの", trace: "痕跡", sound: "音", pet: "ペット" },
  contexts: { unknown: "未設定", wild: "野外", pet: "ペット", captive: "飼育", cultivated: "栽培" },
  separateSubject: "別の対象として分ける", separateName: "分ける対象の呼び名", separate: "分ける", notVisible: "この対象は写っていない", restore: "この対象を戻す",
  combineWith: "まとめる対象", combine: "別の対象とまとめる", assignMedia: "写真を対象へ割り当てる", assignMediaLead: "写真・動画・音と対象の関係を整理できます。", assign: "割り当てる",
  receiveProposals: "名前の提案を受け付ける", pauseProposals: "名前の提案を停止する", captureInfo: "撮影情報", capturedAt: "撮影日時", place: "場所", scope: "公開範囲", mediaCount: "メディア",
  photo: "写真", video: "動画", audio: "音声", related: "つながる記録", relatedRecord: "近くの自然の記録", protectedLocation: "位置情報は公開範囲に合わせて保護されています"
};

const en: ObservationFirstRecordDetailCopy = {
  ...ja,
  documentSuffix: "ikimon", back: "Back", menu: "Menu", records: "Records", home: "Home", language: "Language",
  media: "Photos, video and sound", enlargePhoto: "View full-size photo", openVideo: "Open video", openAudio: "Open audio", mediaNavigation: "Choose media",
  natureRecord: "Nature record", publicLocation: "Safe location", visibility: { public: "Public", limited: "Limited", private: "Private" }, edit: "Detailed edit", share: "Share", updatedNotice: "Changes saved.",
  found: "Found in this record", aiFound: "What AI found", candidateTemplate: "Possibly {name}", openDetails: "View details", openAll: "View all", recordName: "Name for this record", photoCandidate: "Candidate from the photo",
  distinguishingPoints: "What to look for", shootingAdvice: "A photo that could help", proposals: "Name suggestions", proposeName: "Suggest a name", proposedName: "Name", proposalNote: "Reason or note", saveProposal: "Save suggestion", loginToPropose: "Log in to suggest a name", acceptName: "Use this name",
  placeSummary: "About this place", photoInference: "A possibility inferred from the photo", environmentFields: { contact_surface: "Ground or surface", surrounding_cover: "Surroundings", environment_condition: "Conditions", human_change: "Human influence" },
  environmentValues: {
    grassland_urban_edge: "grassland and urban edge", urban: "urban area", woodland: "woodland", water_edge: "water's edge", wetland: "wetland", coast: "coast",
    soil_gravel_litter: "soil, gravel and leaf litter", soil: "soil", plant: "plant", water: "water", rock: "rock or stone", artificial: "built surface",
    low_grass: "low grass", trees_shrubs: "trees and shrubs", bare_ground: "bare ground", snow: "snow", built_surface: "paving or structures",
    open_dry: "open and fairly dry", sunny: "sunny", shaded: "shaded", wet: "damp", flowing: "flowing water", windy: "windy",
    trampling_mowing: "trampling or mowing", mowing: "mowing", trampling: "trampling", planting: "planting or maintenance", construction: "construction", release: "release", none_visible: "no obvious change"
  },
  environmentHeadlines: { grassland_urban_edge: "It may be where grassland meets the city", urban: "It appears to be an urban area", woodland: "It appears to be woodland", water_edge: "It appears to be near water", wetland: "It appears to be a wetland", coast: "It appears to be on the coast" },
  note: "Observation note", manage: "Add detail to this record", addSubject: "Add something visible", subjectName: "Short name", subjectNameExample: "Example: larva on the leaf", subjectType: "Type", context: "Context", add: "Add",
  subjectTypes: { unknown_subject: "Not sure yet", organism: "Organism", group: "Group", trace: "Trace", sound: "Sound", pet: "Pet" }, contexts: { unknown: "Not set", wild: "Wild", pet: "Pet", captive: "Captive", cultivated: "Cultivated" },
  separateSubject: "Separate as another subject", separateName: "Name for the new subject", separate: "Separate", notVisible: "This subject is not visible", restore: "Restore this subject", combineWith: "Combine with", combine: "Combine subjects",
  assignMedia: "Assign media to subjects", assignMediaLead: "Organize how photos, video and sound support each subject.", assign: "Assign", receiveProposals: "Allow name suggestions", pauseProposals: "Pause name suggestions",
  captureInfo: "Capture information", capturedAt: "Captured", place: "Place", scope: "Visibility", mediaCount: "Media", photo: "Photo", video: "Video", audio: "Audio", related: "Connected records", relatedRecord: "Nearby nature record", protectedLocation: "Location is protected according to the sharing scope"
};

const es: ObservationFirstRecordDetailCopy = {
  ...en,
  back: "Volver", menu: "Menú", records: "Registros", home: "Inicio", language: "Idioma", media: "Fotos, vídeo y sonido", enlargePhoto: "Ver foto ampliada", openVideo: "Abrir vídeo", openAudio: "Abrir audio", mediaNavigation: "Cambiar contenido",
  natureRecord: "Registro de naturaleza", publicLocation: "Lugar seguro", visibility: { public: "Público", limited: "Limitado", private: "Privado" }, edit: "Edición detallada", share: "Compartir", updatedNotice: "Cambios guardados.",
  found: "Encontrado en este registro", aiFound: "Lo que encontró la IA", candidateTemplate: "Podría ser {name}", openDetails: "Ver detalles", openAll: "Ver todo", recordName: "Nombre de este registro", photoCandidate: "Candidato a partir de la foto",
  distinguishingPoints: "En qué fijarse", shootingAdvice: "Una foto que podría ayudar", proposals: "Propuestas de nombre", proposeName: "Proponer un nombre", proposedName: "Nombre", proposalNote: "Motivo o nota", saveProposal: "Guardar propuesta", loginToPropose: "Inicia sesión para proponer un nombre", acceptName: "Usar este nombre",
  placeSummary: "Cómo es este lugar", photoInference: "Posibilidad inferida a partir de la foto", environmentFields: { contact_surface: "Suelo o superficie", surrounding_cover: "Entorno", environment_condition: "Condiciones", human_change: "Influencia humana" },
  environmentValues: {
    grassland_urban_edge: "borde entre pastizal y ciudad", urban: "zona urbana", woodland: "bosque", water_edge: "orilla del agua", wetland: "humedal", coast: "costa",
    soil_gravel_litter: "tierra, grava y hojarasca", soil: "tierra", plant: "planta", water: "agua", rock: "roca o piedra", artificial: "superficie construida",
    low_grass: "hierba baja", trees_shrubs: "árboles y arbustos", bare_ground: "suelo desnudo", snow: "nieve", built_surface: "pavimento o estructuras",
    open_dry: "abierto y bastante seco", sunny: "soleado", shaded: "con sombra", wet: "húmedo", flowing: "agua corriente", windy: "con viento",
    trampling_mowing: "pisoteo o siega", mowing: "siega", trampling: "pisoteo", planting: "plantación o mantenimiento", construction: "obras", release: "liberación", none_visible: "sin cambios evidentes"
  },
  environmentHeadlines: { grassland_urban_edge: "Parece el límite entre pastizal y ciudad", urban: "Parece una zona urbana", woodland: "Parece un bosque", water_edge: "Parece estar junto al agua", wetland: "Parece un humedal", coast: "Parece una costa" },
  note: "Nota de observación", manage: "Completar este registro", addSubject: "Añadir algo visible", subjectName: "Nombre breve", subjectNameExample: "Ejemplo: larva sobre la hoja", subjectType: "Tipo", context: "Contexto", add: "Añadir",
  subjectTypes: { unknown_subject: "Aún no se sabe", organism: "Ser vivo", group: "Grupo", trace: "Rastro", sound: "Sonido", pet: "Mascota" }, contexts: { unknown: "Sin definir", wild: "Silvestre", pet: "Mascota", captive: "En cautividad", cultivated: "Cultivado" },
  separateSubject: "Separar como otro sujeto", separateName: "Nombre del nuevo sujeto", separate: "Separar", notVisible: "Este sujeto no aparece", restore: "Restaurar este sujeto", combineWith: "Combinar con", combine: "Combinar sujetos",
  assignMedia: "Asignar contenido a los sujetos", assignMediaLead: "Organiza la relación de las fotos, vídeos y sonidos con cada sujeto.", assign: "Asignar", receiveProposals: "Permitir propuestas de nombre", pauseProposals: "Pausar propuestas de nombre",
  captureInfo: "Información de captura", capturedAt: "Fecha y hora", place: "Lugar", scope: "Visibilidad", mediaCount: "Contenido", photo: "Foto", video: "Vídeo", audio: "Audio", related: "Registros relacionados", relatedRecord: "Registro natural cercano", protectedLocation: "La ubicación está protegida según el alcance de publicación"
};

const ptBr: ObservationFirstRecordDetailCopy = {
  ...en,
  back: "Voltar", menu: "Menu", records: "Registros", home: "Início", language: "Idioma", media: "Fotos, vídeo e som", enlargePhoto: "Ver foto ampliada", openVideo: "Abrir vídeo", openAudio: "Abrir áudio", mediaNavigation: "Trocar mídia",
  natureRecord: "Registro da natureza", publicLocation: "Local seguro", visibility: { public: "Público", limited: "Limitado", private: "Privado" }, edit: "Edição detalhada", share: "Compartilhar", updatedNotice: "Alterações salvas.",
  found: "Encontrado neste registro", aiFound: "O que a IA encontrou", candidateTemplate: "Pode ser {name}", openDetails: "Ver detalhes", openAll: "Ver tudo", recordName: "Nome deste registro", photoCandidate: "Candidato a partir da foto",
  distinguishingPoints: "O que observar", shootingAdvice: "Uma foto que pode ajudar", proposals: "Sugestões de nome", proposeName: "Sugerir um nome", proposedName: "Nome", proposalNote: "Motivo ou observação", saveProposal: "Salvar sugestão", loginToPropose: "Entre para sugerir um nome", acceptName: "Usar este nome",
  placeSummary: "Como é este lugar", photoInference: "Possibilidade inferida a partir da foto", environmentFields: { contact_surface: "Solo ou superfície", surrounding_cover: "Entorno", environment_condition: "Condições", human_change: "Influência humana" },
  environmentValues: {
    grassland_urban_edge: "borda entre gramado e cidade", urban: "área urbana", woodland: "mata", water_edge: "beira d'água", wetland: "área úmida", coast: "costa",
    soil_gravel_litter: "solo, cascalho e folhas secas", soil: "solo", plant: "planta", water: "água", rock: "rocha ou pedra", artificial: "superfície construída",
    low_grass: "grama baixa", trees_shrubs: "árvores e arbustos", bare_ground: "solo exposto", snow: "neve", built_surface: "pavimento ou estruturas",
    open_dry: "aberto e relativamente seco", sunny: "ensolarado", shaded: "sombreado", wet: "úmido", flowing: "água corrente", windy: "com vento",
    trampling_mowing: "pisoteio ou corte", mowing: "corte de grama", trampling: "pisoteio", planting: "plantio ou manejo", construction: "obras", release: "soltura", none_visible: "sem mudança evidente"
  },
  environmentHeadlines: { grassland_urban_edge: "Parece ser a borda entre gramado e cidade", urban: "Parece ser uma área urbana", woodland: "Parece ser uma mata", water_edge: "Parece estar perto da água", wetland: "Parece ser uma área úmida", coast: "Parece ser uma costa" },
  note: "Nota de observação", manage: "Completar este registro", addSubject: "Adicionar algo visível", subjectName: "Nome curto", subjectNameExample: "Exemplo: larva sobre a folha", subjectType: "Tipo", context: "Contexto", add: "Adicionar",
  subjectTypes: { unknown_subject: "Ainda não se sabe", organism: "Ser vivo", group: "Grupo", trace: "Vestígio", sound: "Som", pet: "Animal de estimação" }, contexts: { unknown: "Não definido", wild: "Silvestre", pet: "Animal de estimação", captive: "Em cativeiro", cultivated: "Cultivado" },
  separateSubject: "Separar como outro sujeito", separateName: "Nome do novo sujeito", separate: "Separar", notVisible: "Este sujeito não aparece", restore: "Restaurar este sujeito", combineWith: "Combinar com", combine: "Combinar sujeitos",
  assignMedia: "Atribuir mídia aos sujeitos", assignMediaLead: "Organize como fotos, vídeos e sons apoiam cada sujeito.", assign: "Atribuir", receiveProposals: "Permitir sugestões de nome", pauseProposals: "Pausar sugestões de nome",
  captureInfo: "Informações da captura", capturedAt: "Data e hora", place: "Local", scope: "Visibilidade", mediaCount: "Mídia", photo: "Foto", video: "Vídeo", audio: "Áudio", related: "Registros relacionados", relatedRecord: "Registro natural próximo", protectedLocation: "A localização está protegida de acordo com o nível de compartilhamento"
};

const copies: Record<ObservationRecordLang, ObservationFirstRecordDetailCopy> = { ja, en, es, "pt-br": ptBr };

export function observationFirstRecordDetailCopy(lang: ObservationRecordLang): ObservationFirstRecordDetailCopy {
  return copies[lang];
}
