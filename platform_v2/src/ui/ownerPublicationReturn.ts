import type { SiteLang } from "../i18n.js";
import { PUBLICATION_FEED_DEFINITIONS } from "../services/publicationFeedDefinitions.js";
import {
  projectOwnerPublicationReturn,
  type OwnerPublicationExclusionCode,
  type OwnerPublicationReviewState,
  type PublicationSyndicationInput,
} from "../services/publicationSyndication.js";
import { escapeHtml } from "./siteShell.js";

type OwnerPublicationReturnLabels = {
  title: string;
  review: string;
  publication: string;
  destinations: string;
  policyVersion: string;
  notReviewed: string;
  approved: string;
  changesRequested: string;
  held: string;
  rejected: string;
  withdrawn: string;
  notReady: string;
  eligible: string;
  published: string;
  excluded: string;
  configured: string;
  readBack: string;
  unavailable: string;
  noDestination: string;
  readonly: string;
  reason: string;
  exclusion: Record<string, string>;
  fallbackExclusion: string;
};

const LABELS: Record<SiteLang, OwnerPublicationReturnLabels> = {
  ja: {
    title: "公開と確認", review: "確認結果", publication: "公開状態", destinations: "公開先",
    policyVersion: "ポリシー版", notReviewed: "未確認", approved: "確認済み・承認", changesRequested: "修正依頼",
    held: "保留", rejected: "却下", withdrawn: "撤回", notReady: "公開準備中", eligible: "公開可能（未公開）",
    published: "公開確認済み", excluded: "公開対象外", configured: "設定済み・未公開", readBack: "公開確認済み",
    unavailable: "公開条件を確認できません", noDestination: "公開先がありません", readonly: "公開先設定（読み取り専用）",
    reason: "理由", fallbackExclusion: "必要な公開条件を満たしていません",
    exclusion: {
      record_not_public: "記録が公開範囲ではありません", review_not_approved: "人による確認の承認がありません",
      destination_not_configured: "公開先が設定されていません", destination_not_consented: "この公開先への同意がありません",
      syndication_consent_missing: "この公開先への同意がありません", syndication_consent_withdrawn: "公開同意が撤回されています",
      rights_not_exportable: "記録またはメディアの権利条件を満たしていません", record_withdrawn: "記録または公開同意が撤回されています",
      minor_status_unresolved: "未成年者区分を確認できません", guardian_authority_unresolved: "保護者権限を確認できません",
      guardian_authority_withdrawn: "保護者同意が撤回されています", guardian_authority_mismatch: "保護者権限を確認できません",
      syndication_purpose_mismatch: "公開目的を確認できません", syndication_policy_mismatch: "公開ポリシーを確認できません",
      syndication_term_missing: "公開同意の有効期間を確認できません", syndication_term_invalid: "公開同意の有効期間が不正です",
      syndication_not_yet_active: "公開同意の有効期間前です", syndication_expired: "公開同意の有効期間が終了しています",
      guardian_term_invalid: "保護者同意の有効期間を確認できません", guardian_not_yet_active: "保護者同意の有効期間前です",
      guardian_expired: "保護者同意の有効期間が終了しています",
    },
  },
  en: {
    title: "Review and publication", review: "Review status", publication: "Publication status", destinations: "Destinations",
    policyVersion: "Policy version", notReviewed: "Not reviewed", approved: "Reviewed and approved", changesRequested: "Changes requested",
    held: "On hold", rejected: "Rejected", withdrawn: "Withdrawn", notReady: "Not ready for publication", eligible: "Eligible (not published)",
    published: "Publication confirmed", excluded: "Excluded from publication", configured: "Configured (not published)", readBack: "Publication confirmed",
    unavailable: "Publication conditions could not be checked", noDestination: "No destination is configured", readonly: "Destination settings (read-only)",
    reason: "Reason", fallbackExclusion: "Required publication conditions are not met",
    exclusion: {
      record_not_public: "The record is not public", review_not_approved: "Human Review has not approved it",
      destination_not_configured: "No destination is configured", destination_not_consented: "Consent does not cover this destination",
      syndication_consent_missing: "Consent does not cover this destination", syndication_consent_withdrawn: "Publication consent was withdrawn",
      rights_not_exportable: "Record or media rights do not allow export", record_withdrawn: "The record or publication consent was withdrawn",
      minor_status_unresolved: "Minor status is unresolved", guardian_authority_unresolved: "Guardian authority is unresolved",
      guardian_authority_withdrawn: "Guardian consent was withdrawn", guardian_authority_mismatch: "Guardian authority could not be verified",
      syndication_purpose_mismatch: "The publication purpose could not be verified", syndication_policy_mismatch: "The publication policy could not be verified",
      syndication_term_missing: "The consent term could not be verified", syndication_term_invalid: "The consent term is invalid",
      syndication_not_yet_active: "The consent term has not started", syndication_expired: "The consent term has expired",
      guardian_term_invalid: "The guardian consent term could not be verified", guardian_not_yet_active: "The guardian consent term has not started",
      guardian_expired: "The guardian consent term has expired",
    },
  },
  es: {
    title: "Revisión y publicación", review: "Estado de revisión", publication: "Estado de publicación", destinations: "Destinos",
    policyVersion: "Versión de la política", notReviewed: "Sin revisar", approved: "Revisado y aprobado", changesRequested: "Cambios solicitados",
    held: "En espera", rejected: "Rechazado", withdrawn: "Retirado", notReady: "Aún no está listo", eligible: "Puede publicarse (aún no publicado)",
    published: "Publicación confirmada", excluded: "Excluido de la publicación", configured: "Configurado (sin publicar)", readBack: "Publicación confirmada",
    unavailable: "No se pudieron comprobar las condiciones", noDestination: "No hay un destino configurado", readonly: "Configuración del destino (solo lectura)",
    reason: "Motivo", fallbackExclusion: "No se cumplen las condiciones de publicación",
    exclusion: {
      record_not_public: "El registro no es público", review_not_approved: "La revisión humana no lo ha aprobado",
      destination_not_configured: "No hay un destino configurado", destination_not_consented: "El consentimiento no incluye este destino",
      syndication_consent_missing: "El consentimiento no incluye este destino", syndication_consent_withdrawn: "Se retiró el consentimiento de publicación",
      rights_not_exportable: "Los derechos del registro o del medio no permiten exportarlo", record_withdrawn: "Se retiró el registro o el consentimiento de publicación",
      minor_status_unresolved: "No se ha confirmado si es menor", guardian_authority_unresolved: "No se ha confirmado la autoridad del tutor",
      guardian_authority_withdrawn: "Se retiró el consentimiento del tutor", guardian_authority_mismatch: "No se pudo confirmar la autoridad del tutor",
      syndication_purpose_mismatch: "No se pudo confirmar el propósito de publicación", syndication_policy_mismatch: "No se pudo confirmar la política de publicación",
      syndication_term_missing: "No se pudo confirmar el periodo del consentimiento", syndication_term_invalid: "El periodo del consentimiento no es válido",
      syndication_not_yet_active: "El consentimiento aún no está vigente", syndication_expired: "El consentimiento ha caducado",
      guardian_term_invalid: "No se pudo confirmar el periodo del consentimiento del tutor", guardian_not_yet_active: "El consentimiento del tutor aún no está vigente",
      guardian_expired: "El consentimiento del tutor ha caducado",
    },
  },
  "pt-BR": {
    title: "Revisão e publicação", review: "Status da revisão", publication: "Status da publicação", destinations: "Destinos",
    policyVersion: "Versão da política", notReviewed: "Não revisado", approved: "Revisado e aprovado", changesRequested: "Alterações solicitadas",
    held: "Em espera", rejected: "Rejeitado", withdrawn: "Retirado", notReady: "Ainda não está pronto", eligible: "Pode ser publicado (ainda não publicado)",
    published: "Publicação confirmada", excluded: "Fora da publicação", configured: "Configurado (não publicado)", readBack: "Publicação confirmada",
    unavailable: "Não foi possível verificar as condições", noDestination: "Nenhum destino configurado", readonly: "Configuração do destino (somente leitura)",
    reason: "Motivo", fallbackExclusion: "As condições de publicação não foram atendidas",
    exclusion: {
      record_not_public: "O registro não é público", review_not_approved: "A revisão humana não aprovou o registro",
      destination_not_configured: "Nenhum destino configurado", destination_not_consented: "O consentimento não inclui este destino",
      syndication_consent_missing: "O consentimento não inclui este destino", syndication_consent_withdrawn: "O consentimento de publicação foi retirado",
      rights_not_exportable: "Os direitos do registro ou da mídia não permitem exportação", record_withdrawn: "O registro ou o consentimento de publicação foi retirado",
      minor_status_unresolved: "Não foi confirmado se a pessoa é menor de idade", guardian_authority_unresolved: "A autoridade do responsável não foi confirmada",
      guardian_authority_withdrawn: "O consentimento do responsável foi retirado", guardian_authority_mismatch: "Não foi possível confirmar a autoridade do responsável",
      syndication_purpose_mismatch: "Não foi possível confirmar a finalidade da publicação", syndication_policy_mismatch: "Não foi possível confirmar a política de publicação",
      syndication_term_missing: "Não foi possível confirmar a validade do consentimento", syndication_term_invalid: "O período do consentimento é inválido",
      syndication_not_yet_active: "O consentimento ainda não está vigente", syndication_expired: "O consentimento expirou",
      guardian_term_invalid: "Não foi possível confirmar a validade do consentimento do responsável", guardian_not_yet_active: "O consentimento do responsável ainda não está vigente",
      guardian_expired: "O consentimento do responsável expirou",
    },
  },
};

function reviewLabel(state: OwnerPublicationReviewState, copy: OwnerPublicationReturnLabels): string {
  switch (state) {
    case "approved": return copy.approved;
    case "changes_requested": return copy.changesRequested;
    case "held": return copy.held;
    case "rejected": return copy.rejected;
    case "withdrawn": return copy.withdrawn;
    default: return copy.notReviewed;
  }
}

function publicationLabel(state: "not_ready" | "eligible" | "published" | "excluded", copy: OwnerPublicationReturnLabels): string {
  switch (state) {
    case "eligible": return copy.eligible;
    case "published": return copy.published;
    case "excluded": return copy.excluded;
    default: return copy.notReady;
  }
}

function exclusionLabel(code: OwnerPublicationExclusionCode | null, copy: OwnerPublicationReturnLabels): string | null {
  if (!code) return null;
  return copy.exclusion[code] ?? copy.fallbackExclusion;
}

export type OwnerPublicationReturnRenderInput = {
  owner: boolean;
  recordVisibility: "public" | "limited" | "private";
  reviewDecision?: { state: string; source?: string; decidedAt?: string | null } | null;
  rights?: PublicationSyndicationInput;
  rightsUnavailable?: boolean;
  publishedDestinations?: readonly string[];
  now?: Date;
  lang: SiteLang;
};

export function renderOwnerPublicationReturn(input: OwnerPublicationReturnRenderInput): string {
  if (!input.owner) return "";
  const copy = LABELS[input.lang];
  const destinations = Object.values(PUBLICATION_FEED_DEFINITIONS).map((definition) => ({
    feedKey: definition.feedKey,
    label: input.lang === "ja" ? definition.scopeLabel.ja : definition.scopeLabel.en,
    sourceVersion: definition.publicationPolicyVersion,
    sourceEnvironment: "production" as const,
    readOnly: true as const,
  }));
  const result = projectOwnerPublicationReturn({
    owner: true,
    recordVisibility: input.recordVisibility,
    reviewDecision: input.reviewDecision,
    rights: input.rights ?? {},
    destinations,
    publishedDestinations: input.publishedDestinations,
    now: input.now,
  });
  if (!result) return "";

  const destinationItems = result.publication.destinations.map((destination) => {
    const status = input.rightsUnavailable
      ? copy.unavailable
      : destination.status === "published"
        ? copy.readBack
        : destination.status === "eligible"
          ? copy.configured
          : copy.excluded;
    const reason = input.rightsUnavailable ? null : exclusionLabel(destination.exclusionCode, copy);
    return `<li data-publication-destination-status="${escapeHtml(input.rightsUnavailable ? "unavailable" : destination.status)}"><strong>${escapeHtml(destination.label)}</strong><span>${escapeHtml(status)}</span><small>${escapeHtml(copy.readonly)} · ${escapeHtml(copy.policyVersion)}: ${escapeHtml(destination.sourceVersion)}${reason ? ` · ${escapeHtml(copy.reason)}: ${escapeHtml(reason)}` : ""}</small></li>`;
  }).join("");
  const overallPublicationState = input.rightsUnavailable ? "unavailable" : result.publication.state;
  const overallPublicationLabel = input.rightsUnavailable ? copy.unavailable : publicationLabel(result.publication.state, copy);
  const overallReason = input.rightsUnavailable ? null : exclusionLabel(result.publication.exclusionCode, copy);

  return `<section class="obs-publication-return" data-publication-return="owner-only" aria-labelledby="owner-publication-return-title">
    <h2 id="owner-publication-return-title">${escapeHtml(copy.title)}</h2>
    <dl><div><dt>${escapeHtml(copy.review)}</dt><dd data-publication-review-state="${escapeHtml(result.review.state)}">${escapeHtml(reviewLabel(result.review.state, copy))}</dd></div>
    <div><dt>${escapeHtml(copy.publication)}</dt><dd data-publication-state="${escapeHtml(overallPublicationState)}">${escapeHtml(overallPublicationLabel)}${overallReason ? `<small>${escapeHtml(copy.reason)}: ${escapeHtml(overallReason)}</small>` : ""}</dd></div></dl>
    <h3>${escapeHtml(copy.destinations)}</h3>
    ${destinationItems ? `<ul>${destinationItems}</ul>` : `<p>${escapeHtml(copy.noDestination)}</p>`}
  </section>`;
}

export const OWNER_PUBLICATION_RETURN_STYLES = `
.obs-publication-return{box-sizing:border-box;max-width:var(--ikimon-content-max);margin:0 auto 12px;padding:14px 16px;border:1px solid rgba(100,116,139,.2);border-radius:14px;background:#fff}
.obs-publication-return h2{margin:0 0 10px;font-size:16px;line-height:1.4}
.obs-publication-return h3{margin:14px 0 6px;font-size:15px;line-height:1.4}
.obs-publication-return dl{display:grid;gap:8px;margin:0}
.obs-publication-return dl>div{display:grid;grid-template-columns:minmax(92px,.7fr) minmax(0,1.3fr);gap:10px}
.obs-publication-return dt{color:#64748b}
.obs-publication-return dd{margin:0;color:#0f172a;font-weight:800;overflow-wrap:anywhere}
.obs-publication-return dd small{display:block;color:#64748b;font-size:13px;font-weight:500}
.obs-publication-return ul{display:grid;gap:7px;margin:0;padding:0;list-style:none}
.obs-publication-return li{display:grid;gap:2px;padding:9px 10px;border:1px solid rgba(100,116,139,.2);border-radius:11px;background:#fff}
.obs-publication-return li span{font-weight:800}
.obs-publication-return li small{color:#64748b;font-size:13px;overflow-wrap:anywhere}
@media(max-width:390px){.obs-publication-return{padding:13px 12px}.obs-publication-return dl>div{grid-template-columns:1fr;gap:2px}}
`;
