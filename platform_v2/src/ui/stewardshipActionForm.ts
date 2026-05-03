// Stewardship action recording form (Relationship Score v0.1, Phase B+)

import type { SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

type FormCopy = {
  heading: string;
  lead: string;
  fields: {
    occurredAt: string;
    actionKind: string;
    description: string;
    descriptionHint: string;
    speciesStatus: string;
    speciesStatusHint: string;
    linkedVisit: string;
    linkedVisitHint: string;
  };
  actionKindOptions: Record<string, string>;
  speciesStatusOptions: Record<string, string>;
  submit: string;
  notice: string;
};

const COPY: Record<SiteLang, FormCopy> = {
  ja: {
    heading: "保全活動を記録",
    lead: "サイトでの管理・保全行動を記録します。Relationship Score の Stewardship 軸に反映されます。",
    fields: {
      occurredAt: "実施日時",
      actionKind: "活動の種類",
      description: "内容メモ",
      descriptionHint: "何をどこで、どのくらいやったか。観察データとの関連も書ける範囲で",
      speciesStatus: "対象生物のサイトでの扱い (任意)",
      speciesStatusHint: "侵略的・在来優占・撹乱の判定はサイトの位置情報を基準にしてください",
      linkedVisit: "関連する観察 (任意)",
      linkedVisitHint: "同じ日に観察記録がある場合は visit_id を入力",
    },
    actionKindOptions: {
      cleanup: "清掃",
      mowing: "草刈り",
      water_management: "水路・水管理",
      pruning: "剪定",
      planting: "植栽",
      harvesting: "収穫",
      tilling: "耕起",
      trampling: "踏み跡・踏圧",
      bare_ground: "裸地化",
      invasive_removal: "侵略的・撹乱種への対応",
      patrol: "巡回",
      signage: "看板・案内",
      monitoring: "モニタリング",
      external_program: "外部プログラム連携",
      restoration: "植生回復・修復",
      community_engagement: "教育・参加促進",
      other: "その他",
    },
    speciesStatusOptions: {
      "": "選択しない",
      invasive: "侵略的種としての扱い",
      dominant_native: "優占在来種としての扱い",
      disturbance: "撹乱対応",
      unknown: "未確定",
    },
    submit: "記録する",
    notice: "認証や成果証明ではなく、現場の運用を残すための記録です。サイトの位置情報を基準に判断してください。",
  },
  en: {
    heading: "Record stewardship action",
    lead: "Log management or stewardship work at this site. This feeds the Stewardship axis of the Relationship Score.",
    fields: {
      occurredAt: "Occurred at",
      actionKind: "Action type",
      description: "Description",
      descriptionHint: "What was done where, and how much. Cross-reference observation data if relevant.",
      speciesStatus: "Site-specific status of target species (optional)",
      speciesStatusHint: "Invasive / native-dominant / disturbance is judged from this site's location.",
      linkedVisit: "Linked observation visit (optional)",
      linkedVisitHint: "If an observation record exists for the same day, enter the visit_id.",
    },
    actionKindOptions: {
      cleanup: "Cleanup",
      mowing: "Mowing / vegetation cut",
      water_management: "Water / ditch management",
      pruning: "Pruning",
      planting: "Planting",
      harvesting: "Harvesting",
      tilling: "Tilling",
      trampling: "Trampling / footpath pressure",
      bare_ground: "Bare ground",
      invasive_removal: "Invasive / disturbance response",
      patrol: "Patrol",
      signage: "Signage / interpretation",
      monitoring: "Monitoring",
      external_program: "External program participation",
      restoration: "Restoration",
      community_engagement: "Education / community engagement",
      other: "Other",
    },
    speciesStatusOptions: {
      "": "Not specified",
      invasive: "Treated as invasive",
      dominant_native: "Treated as dominant native",
      disturbance: "Disturbance response",
      unknown: "Unknown",
    },
    submit: "Record",
    notice: "This is operational logging, not a certification or proof of outcomes. Judge species status by this site's location.",
  },
  es: {
    heading: "Registrar acción de cuidado",
    lead: "Registre el trabajo de gestión o cuidado en este sitio. Se refleja en el eje Cuidado del Indicador de Relación.",
    fields: {
      occurredAt: "Fecha y hora",
      actionKind: "Tipo de acción",
      description: "Descripción",
      descriptionHint: "Qué se hizo, dónde y cuánto. Relacione con datos de observación si aplica.",
      speciesStatus: "Estado de la especie objetivo en este sitio (opcional)",
      speciesStatusHint: "Invasora / nativa dominante / perturbación se juzga por la ubicación del sitio.",
      linkedVisit: "Observación vinculada (opcional)",
      linkedVisitHint: "Si hay un registro de observación del mismo día, ingrese el visit_id.",
    },
    actionKindOptions: {
      cleanup: "Limpieza",
      mowing: "Siega / corte de vegetación",
      water_management: "Gestión de agua / zanjas",
      pruning: "Poda",
      planting: "Plantación",
      harvesting: "Cosecha",
      tilling: "Labranza",
      trampling: "Pisoteo / presión de sendero",
      bare_ground: "Suelo desnudo",
      invasive_removal: "Respuesta a invasoras / perturbación",
      patrol: "Patrullaje",
      signage: "Señalización / interpretación",
      monitoring: "Monitoreo",
      external_program: "Participación en programa externo",
      restoration: "Restauración",
      community_engagement: "Educación / participación comunitaria",
      other: "Otro",
    },
    speciesStatusOptions: {
      "": "No especificado",
      invasive: "Tratada como invasora",
      dominant_native: "Tratada como nativa dominante",
      disturbance: "Respuesta a perturbación",
      unknown: "Desconocido",
    },
    submit: "Registrar",
    notice: "Es un registro operativo, no una certificación. Juzgue el estado de la especie por la ubicación del sitio.",
  },
  "pt-BR": {
    heading: "Registrar ação de cuidado",
    lead: "Registre o trabalho de manejo ou cuidado neste local. Reflete-se no eixo Cuidado do Indicador de Relação.",
    fields: {
      occurredAt: "Data e hora",
      actionKind: "Tipo de ação",
      description: "Descrição",
      descriptionHint: "O que foi feito, onde e quanto. Relacione com dados de observação, se aplicável.",
      speciesStatus: "Status da espécie-alvo neste local (opcional)",
      speciesStatusHint: "Invasora / nativa dominante / distúrbio é julgado pela localização do local.",
      linkedVisit: "Observação vinculada (opcional)",
      linkedVisitHint: "Se houver um registro de observação no mesmo dia, insira o visit_id.",
    },
    actionKindOptions: {
      cleanup: "Limpeza",
      mowing: "Roçada / corte de vegetação",
      water_management: "Manejo de água / valas",
      pruning: "Poda",
      planting: "Plantio",
      harvesting: "Colheita",
      tilling: "Preparo do solo",
      trampling: "Pisoteio / trilha",
      bare_ground: "Solo exposto",
      invasive_removal: "Resposta a invasoras / distúrbio",
      patrol: "Patrulha",
      signage: "Sinalização / interpretação",
      monitoring: "Monitoramento",
      external_program: "Participação em programa externo",
      restoration: "Restauração",
      community_engagement: "Educação / engajamento comunitário",
      other: "Outro",
    },
    speciesStatusOptions: {
      "": "Não especificado",
      invasive: "Tratada como invasora",
      dominant_native: "Tratada como nativa dominante",
      disturbance: "Resposta a distúrbio",
      unknown: "Desconhecido",
    },
    submit: "Registrar",
    notice: "É um registro operacional, não uma certificação. Julgue o status da espécie pela localização do local.",
  },
};

export function renderStewardshipActionForm(
  placeId: string,
  lang: SiteLang,
  options: { errorMessage?: string; successMessage?: string } = {}
): string {
  const copy = COPY[lang];
  const today = new Date().toISOString().slice(0, 10);

  const actionOptions = Object.entries(copy.actionKindOptions)
    .map(([value, label]) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
    )
    .join("");

  const speciesOptions = Object.entries(copy.speciesStatusOptions)
    .map(([value, label]) =>
      `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
    )
    .join("");

  const errorBlock = options.errorMessage
    ? `<p class="sa-error" role="alert">${escapeHtml(options.errorMessage)}</p>`
    : "";
  const successBlock = options.successMessage
    ? `<p class="sa-success" role="status">${escapeHtml(options.successMessage)}</p>`
    : "";

  return `<section class="section sa-section" aria-labelledby="sa-heading">
    <div class="sa-card">
      <h2 id="sa-heading" class="sa-heading">${escapeHtml(copy.heading)}</h2>
      <p class="sa-lead">${escapeHtml(copy.lead)}</p>
      ${errorBlock}
      ${successBlock}
      <form method="post" action="/sites/${escapeHtml(placeId)}/stewardship_actions" class="sa-form">
        <div class="sa-field">
          <label for="sa-occurred-at">${escapeHtml(copy.fields.occurredAt)}</label>
          <input id="sa-occurred-at" name="occurred_at" type="datetime-local" required value="${today}T09:00" />
        </div>
        <div class="sa-field">
          <label for="sa-action-kind">${escapeHtml(copy.fields.actionKind)}</label>
          <select id="sa-action-kind" name="action_kind" required>${actionOptions}</select>
        </div>
        <div class="sa-field">
          <label for="sa-description">${escapeHtml(copy.fields.description)}</label>
          <textarea id="sa-description" name="description" rows="4" placeholder="${escapeHtml(copy.fields.descriptionHint)}"></textarea>
          <small>${escapeHtml(copy.fields.descriptionHint)}</small>
        </div>
        <div class="sa-field">
          <label for="sa-species-status">${escapeHtml(copy.fields.speciesStatus)}</label>
          <select id="sa-species-status" name="species_status">${speciesOptions}</select>
          <small>${escapeHtml(copy.fields.speciesStatusHint)}</small>
        </div>
        <div class="sa-field">
          <label for="sa-linked-visit">${escapeHtml(copy.fields.linkedVisit)}</label>
          <input id="sa-linked-visit" name="linked_visit_id" type="text" placeholder="visit_id" />
          <small>${escapeHtml(copy.fields.linkedVisitHint)}</small>
        </div>
        <button type="submit" class="sa-submit">${escapeHtml(copy.submit)}</button>
      </form>
      <p class="sa-notice" role="note">${escapeHtml(copy.notice)}</p>
    </div>
  </section>`;
}

export const STEWARDSHIP_ACTION_FORM_STYLES = `
.sa-section { margin-top: 32px; }
.sa-card {
  padding: 28px 32px 24px;
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 4px 18px rgba(15,23,42,0.05);
  border: 1px solid rgba(15,23,42,0.06);
}
.sa-heading { margin: 0 0 8px; font-size: 20px; color: #0f172a; }
.sa-lead { margin: 0 0 16px; color: #475569; font-size: 13px; }
.sa-form { display: flex; flex-direction: column; gap: 14px; }
.sa-field { display: flex; flex-direction: column; gap: 4px; }
.sa-field label { font-weight: 600; font-size: 13px; color: #1e293b; }
.sa-field small { color: #64748b; font-size: 11px; }
.sa-field input,
.sa-field select,
.sa-field textarea {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
}
.sa-field textarea { resize: vertical; min-height: 96px; }
.sa-submit {
  align-self: flex-start;
  padding: 10px 20px;
  background: #059669;
  color: #ffffff;
  border: 0;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
}
.sa-submit:hover { background: #047857; }
.sa-error {
  padding: 10px 14px;
  border-radius: 10px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 13px;
}
.sa-success {
  padding: 10px 14px;
  border-radius: 10px;
  background: #d1fae5;
  color: #065f46;
  font-size: 13px;
}
.sa-notice {
  margin: 16px 0 0;
  padding: 10px 14px;
  background: #fffbeb;
  border-left: 3px solid #f59e0b;
  border-radius: 8px;
  color: #78350f;
  font-size: 12px;
}
`;
