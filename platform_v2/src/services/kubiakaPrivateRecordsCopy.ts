import type { SiteLang } from "../i18n.js";

export type KubiakaAiState = "complete" | "working" | "failed" | "not_started" | "unknown";

export type KubiakaPrivateRecordsCopy = {
  languageLabel: string;
  skipToContent: string;
  privateLabel: string;
  latestEyebrow: string;
  acknowledgementEyebrow: string;
  nextEyebrow: string;
  startEyebrow: string;
  historyEyebrow: string;
  detailEyebrow: string;
  recordEyebrow: string;
  homeTitle: string;
  homeLead: string;
  countLabel: (count: number) => string;
  latestTitle: string;
  nextTitle: string;
  nextLead: string;
  emptyTitle: string;
  emptyLead: string;
  captureAction: string;
  recordsAction: string;
  detailAction: string;
  guideAction: string;
  recordsTitle: string;
  recordsLead: string;
  limitedNotice: (limit: number) => string;
  detailTitle: string;
  detailLead: string;
  savedLabel: string;
  photoCountLabel: (count: number) => string;
  aiLabel: string;
  aiStates: Record<KubiakaAiState, string>;
  acknowledgementTitle: string;
  acknowledgementLead: string;
  acknowledgementAction: string;
  notFoundTitle: string;
  notFoundLead: string;
  backAction: string;
  photoAlt: (index: number, total: number) => string;
};

export function classifyKubiakaAiStatus(value: unknown): KubiakaAiState {
  const status = String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["completed", "identified", "accepted", "reviewed"].includes(status)) {
    return "complete";
  }
  if (["pending", "queued", "processing", "running", "requested", "in_progress", "reviewing", "candidate_ready", "ai_judgement", "analyzing", "analysing"].includes(status)) {
    return "working";
  }
  if (["failed", "error", "cancelled", "canceled", "failed_retryable", "failed_terminal", "unavailable"].includes(status)) {
    return "failed";
  }
  if (["", "not_requested", "none", "disabled", "not_started"].includes(status)) {
    return "not_started";
  }
  return "unknown";
}

const englishCopy: KubiakaPrivateRecordsCopy = {
  languageLabel: "Language",
  skipToContent: "Skip to content",
  privateLabel: "Private record",
  latestEyebrow: "Latest",
  acknowledgementEyebrow: "Acknowledgement",
  nextEyebrow: "Next",
  startEyebrow: "Start",
  historyEyebrow: "Private history",
  detailEyebrow: "Private detail",
  recordEyebrow: "Private record",
  homeTitle: "My Kubiaka records",
  homeLead: "Your private cherry-tree photo records are kept here for you to revisit.",
  countLabel: (count) => `${count} private record${count === 1 ? "" : "s"}`,
  latestTitle: "Latest record",
  nextTitle: "Next action",
  nextLead: "Return after another safe observation, or review the photos already saved.",
  emptyTitle: "No private records yet",
  emptyLead: "Take one to six photos of a cherry tree to create your first private record.",
  captureAction: "Photograph a tree",
  recordsAction: "View all records",
  detailAction: "View record",
  guideAction: "View guide",
  recordsTitle: "Private record history",
  recordsLead: "Only your Kubiaka records are shown, newest first.",
  limitedNotice: (limit) => `Showing the newest ${limit} records.`,
  detailTitle: "Private record detail",
  detailLead: "This record remains private. This screen does not publish, share, or report it externally.",
  savedLabel: "Saved",
  photoCountLabel: (count) => `${count} photo${count === 1 ? "" : "s"}`,
  aiLabel: "AI processing",
  aiStates: {
    complete: "Completed",
    working: "In progress",
    failed: "Could not complete",
    not_started: "Not started",
    unknown: "Status being checked",
  },
  acknowledgementTitle: "Photos received",
  acknowledgementLead: "The acknowledgement link is still valid. The record is included in your private history.",
  acknowledgementAction: "Open saved record",
  notFoundTitle: "Record not found",
  notFoundLead: "This private record is unavailable or does not belong to the signed-in account.",
  backAction: "Back to my records",
  photoAlt: (index, total) => `Private record photo ${index} of ${total}`,
};

const japaneseCopy: KubiakaPrivateRecordsCopy = {
  languageLabel: "表示言語",
  skipToContent: "本文へ移動",
  privateLabel: "非公開記録",
  latestEyebrow: "最新",
  acknowledgementEyebrow: "受付確認",
  nextEyebrow: "次にできること",
  startEyebrow: "はじめる",
  historyEyebrow: "非公開履歴",
  detailEyebrow: "非公開詳細",
  recordEyebrow: "非公開記録",
  homeTitle: "自分のクビアカ記録",
  homeLead: "サクラを撮って保存した非公開記録を、あとからここで見返せます。",
  countLabel: (count) => `非公開記録 ${count}件`,
  latestTitle: "最新の記録",
  nextTitle: "次にできること",
  nextLead: "安全な場所で次のサクラを撮るか、保存済みの写真を見返せます。",
  emptyTitle: "まだ記録はありません",
  emptyLead: "サクラを1〜6枚撮ると、最初の非公開記録が保存されます。",
  captureAction: "サクラを撮る",
  recordsAction: "記録をすべて見る",
  detailAction: "記録を見る",
  guideAction: "説明を見る",
  recordsTitle: "非公開の記録履歴",
  recordsLead: "本人のクビアカ記録だけを、新しい順に表示しています。",
  limitedNotice: (limit) => `新しい記録から最大${limit}件を表示しています。`,
  detailTitle: "非公開記録の詳細",
  detailLead: "この記録は非公開です。この画面から公開・共有・外部通報は行いません。",
  savedLabel: "保存日時",
  photoCountLabel: (count) => `写真 ${count}枚`,
  aiLabel: "AI処理",
  aiStates: {
    complete: "完了",
    working: "処理中",
    failed: "完了できませんでした",
    not_started: "未開始",
    unknown: "状態を確認中",
  },
  acknowledgementTitle: "写真を受け付けました",
  acknowledgementLead: "これまでの受付リンクも利用できます。記録は非公開履歴に保存されています。",
  acknowledgementAction: "保存した記録を開く",
  notFoundTitle: "記録が見つかりません",
  notFoundLead: "この非公開記録は表示できないか、現在のアカウントの記録ではありません。",
  backAction: "自分の記録へ戻る",
  photoAlt: (index, total) => `非公開記録の写真 ${index}/${total}`,
};

const spanishCopy: KubiakaPrivateRecordsCopy = {
  languageLabel: "Idioma",
  skipToContent: "Saltar al contenido",
  privateLabel: "Registro privado",
  latestEyebrow: "Más reciente",
  acknowledgementEyebrow: "Confirmación",
  nextEyebrow: "Siguiente paso",
  startEyebrow: "Empezar",
  historyEyebrow: "Historial privado",
  detailEyebrow: "Detalle privado",
  recordEyebrow: "Registro privado",
  homeTitle: "Mis registros de Kubiaka",
  homeLead: "Aquí puedes volver a ver tus registros privados de fotos de cerezos.",
  countLabel: (count) => `${count} registro${count === 1 ? "" : "s"} privado${count === 1 ? "" : "s"}`,
  latestTitle: "Registro más reciente",
  nextTitle: "Siguiente paso",
  nextLead: "Vuelve después de otra observación segura o revisa las fotos que ya guardaste.",
  emptyTitle: "Aún no hay registros privados",
  emptyLead: "Toma de una a seis fotos de un cerezo para crear tu primer registro privado.",
  captureAction: "Fotografiar un cerezo",
  recordsAction: "Ver todos los registros",
  detailAction: "Ver registro",
  guideAction: "Ver guía",
  recordsTitle: "Historial de registros privados",
  recordsLead: "Solo se muestran tus registros de Kubiaka, del más reciente al más antiguo.",
  limitedNotice: (limit) => `Se muestran los ${limit} registros más recientes.`,
  detailTitle: "Detalle del registro privado",
  detailLead: "Este registro sigue siendo privado. Esta pantalla no lo publica, comparte ni comunica externamente.",
  savedLabel: "Guardado",
  photoCountLabel: (count) => `${count} foto${count === 1 ? "" : "s"}`,
  aiLabel: "Procesamiento con IA",
  aiStates: {
    complete: "Completado",
    working: "En curso",
    failed: "No se pudo completar",
    not_started: "No iniciado",
    unknown: "Comprobando el estado",
  },
  acknowledgementTitle: "Fotos recibidas",
  acknowledgementLead: "El enlace de recepción sigue siendo válido. El registro está incluido en tu historial privado.",
  acknowledgementAction: "Abrir el registro guardado",
  notFoundTitle: "Registro no encontrado",
  notFoundLead: "Este registro privado no está disponible o no pertenece a la cuenta conectada.",
  backAction: "Volver a mis registros",
  photoAlt: (index, total) => `Foto ${index} de ${total} del registro privado`,
};

const portugueseBrazilCopy: KubiakaPrivateRecordsCopy = {
  languageLabel: "Idioma",
  skipToContent: "Pular para o conteúdo",
  privateLabel: "Registro privado",
  latestEyebrow: "Mais recente",
  acknowledgementEyebrow: "Confirmação",
  nextEyebrow: "Próximo passo",
  startEyebrow: "Começar",
  historyEyebrow: "Histórico privado",
  detailEyebrow: "Detalhes privados",
  recordEyebrow: "Registro privado",
  homeTitle: "Meus registros de Kubiaka",
  homeLead: "Seus registros privados de fotos de cerejeiras ficam guardados aqui para você rever depois.",
  countLabel: (count) => `${count} registro${count === 1 ? "" : "s"} privado${count === 1 ? "" : "s"}`,
  latestTitle: "Registro mais recente",
  nextTitle: "Próxima ação",
  nextLead: "Volte depois de outra observação segura ou reveja as fotos já salvas.",
  emptyTitle: "Ainda não há registros privados",
  emptyLead: "Tire de uma a seis fotos de uma cerejeira para criar seu primeiro registro privado.",
  captureAction: "Fotografar uma cerejeira",
  recordsAction: "Ver todos os registros",
  detailAction: "Ver registro",
  guideAction: "Ver guia",
  recordsTitle: "Histórico de registros privados",
  recordsLead: "Somente seus registros de Kubiaka são exibidos, do mais recente para o mais antigo.",
  limitedNotice: (limit) => `Exibindo os ${limit} registros mais recentes.`,
  detailTitle: "Detalhes do registro privado",
  detailLead: "Este registro permanece privado. Esta tela não publica, compartilha nem envia o registro para fora.",
  savedLabel: "Salvo em",
  photoCountLabel: (count) => `${count} foto${count === 1 ? "" : "s"}`,
  aiLabel: "Processamento por IA",
  aiStates: {
    complete: "Concluído",
    working: "Em andamento",
    failed: "Não foi possível concluir",
    not_started: "Não iniciado",
    unknown: "Verificando o status",
  },
  acknowledgementTitle: "Fotos recebidas",
  acknowledgementLead: "O link de confirmação continua válido. O registro está incluído no seu histórico privado.",
  acknowledgementAction: "Abrir registro salvo",
  notFoundTitle: "Registro não encontrado",
  notFoundLead: "Este registro privado não está disponível ou não pertence à conta conectada.",
  backAction: "Voltar aos meus registros",
  photoAlt: (index, total) => `Foto ${index} de ${total} do registro privado`,
};

export function kubiakaPrivateRecordsCopy(lang: SiteLang): KubiakaPrivateRecordsCopy {
  switch (lang) {
    case "ja":
      return japaneseCopy;
    case "es":
      return spanishCopy;
    case "pt-BR":
      return portugueseBrazilCopy;
    case "en":
    default:
      return englishCopy;
  }
}
