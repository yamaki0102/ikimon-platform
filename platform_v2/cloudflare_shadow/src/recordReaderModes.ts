import { FIELD_CARD_PROMPT, FIELD_CARD_QUESTION, type FieldCardGroup } from "./fieldCard";
import { isWeakTaxonLabel } from "./taxonNameResolver";
import { inferTaxonGroupForLabel } from "./zukanMapTaxonGroup";

export const RECORD_READER_MODES_FLAG = "RECORD_READER_MODES_ENABLED";

export type RecordReaderMode = "child" | "parent";

const esc = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const INSECT_ORDERS = new Set(["lepidoptera", "coleoptera", "odonata", "hemiptera", "hymenoptera", "diptera", "orthoptera", "mantodea", "チョウ目", "コウチュウ目", "トンボ目", "カメムシ目", "ハチ目", "ハエ目", "バッタ目"]);
const BIRD_ORDERS = new Set(["passeriformes", "charadriiformes", "anseriformes", "pelecaniformes", "accipitriformes", "columbiformes", "piciformes", "strigiformes", "スズメ目", "チドリ目", "カモ目", "ペリカン目", "タカ目", "ハト目", "キツツキ目", "フクロウ目"]);
const PLANT_CLASSES = new Set(["magnoliopsida", "liliopsida", "pinopsida", "polypodiopsida", "bryopsida", "被子植物", "単子葉植物", "双子葉植物", "シダ植物", "コケ植物"]);

export function resolveRecordReaderGroup(input: {
  taxonName?: string | null;
  taxonOrder?: string | null;
  taxonClass?: string | null;
  taxonKingdom?: string | null;
}): FieldCardGroup {
  const order = (input.taxonOrder ?? "").trim().toLowerCase();
  if (order) {
    if (INSECT_ORDERS.has(order)) return "insect";
    if (BIRD_ORDERS.has(order)) return "bird";
  }
  const cls = (input.taxonClass ?? "").trim().toLowerCase();
  if (cls === "insecta" || cls === "昆虫綱" || cls === "昆虫類") return "insect";
  if (cls === "aves" || cls === "鳥綱" || cls === "鳥類") return "bird";
  if (PLANT_CLASSES.has(cls)) return "plant";
  const kingdom = (input.taxonKingdom ?? "").trim().toLowerCase();
  if (kingdom === "plantae" || kingdom === "viridiplantae" || kingdom === "植物界") return "plant";

  const name = (input.taxonName ?? "").trim();
  if (name && !isWeakTaxonLabel(name)) {
    const inferred = inferTaxonGroupForLabel(name);
    if (inferred === "insect" || inferred === "plant" || inferred === "bird") return inferred;
  }
  return "generic";
}

export function recordReaderModeCopy(group: FieldCardGroup): {
  childLabel: string;
  parentLabel: string;
  childQuestion: string;
  parentPrompt: string;
} {
  return {
    childLabel: "こども",
    parentLabel: "おや",
    childQuestion: FIELD_CARD_QUESTION[group],
    parentPrompt: FIELD_CARD_PROMPT[group],
  };
}

export const RECORD_READER_MODES_STYLES = `
.of-reader-modes{margin-top:16px;padding:16px;border:1px solid #d5e2d8;border-radius:16px;background:#f8fbf8;display:grid;gap:10px}
.of-rm-tabs{display:inline-flex;gap:4px;padding:3px;border-radius:999px;background:#e6efe8;justify-self:start}
.of-rm-tab{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:transparent;color:#33473c;font:inherit;font-size:14px;font-weight:800;cursor:pointer}
.of-rm-tab.is-active{background:#143F2E;color:#fff}
.of-rm-name{margin:0;font-size:16px;font-weight:800;color:#17211B}
.of-rm-copy{margin:0;font-size:15px;line-height:1.75;color:#17211B;font-weight:600}
`;

export function renderRecordReaderModesHtml(options: {
  enabled: boolean;
  group: FieldCardGroup;
  initialMode?: RecordReaderMode;
  speciesHeading?: string | null;
}): string {
  if (!options.enabled) return "";
  const copy = recordReaderModeCopy(options.group);
  const mode: RecordReaderMode = options.initialMode === "parent" ? "parent" : "child";
  const cleanSpecies = (options.speciesHeading ?? "").trim();
  const showName = Boolean(cleanSpecies && !isWeakTaxonLabel(cleanSpecies));
  return `<section class="of-reader-modes" data-record-reader-modes aria-label="読み方の切り替え">
<div class="of-rm-tabs" role="tablist" aria-label="読み方">
  <button type="button" role="tab" class="of-rm-tab${mode === "child" ? " is-active" : ""}" data-reader-mode-tab="child" aria-selected="${mode === "child" ? "true" : "false"}">${copy.childLabel}</button>
  <button type="button" role="tab" class="of-rm-tab${mode === "parent" ? " is-active" : ""}" data-reader-mode-tab="parent" aria-selected="${mode === "parent" ? "true" : "false"}">${copy.parentLabel}</button>
</div>
${showName ? `<h3 class="of-rm-name" data-reader-mode-name>${esc(cleanSpecies)}</h3>` : ""}
<p class="of-rm-copy" data-reader-mode-panel="child"${mode === "child" ? "" : " hidden"}>${esc(copy.childQuestion)}</p>
<p class="of-rm-copy" data-reader-mode-panel="parent"${mode === "parent" ? "" : " hidden"}>${esc(copy.parentPrompt)}</p>
</section>`;
}

export function renderRecordReaderModesScript(enabled: boolean): string {
  if (!enabled) return "";
  return `<script>(()=>{document.querySelectorAll('[data-record-reader-modes]').forEach((root)=>{const tabs=[...root.querySelectorAll('[data-reader-mode-tab]')];const panels=[...root.querySelectorAll('[data-reader-mode-panel]')];const setMode=(next)=>{tabs.forEach((tab)=>{const active=tab.getAttribute('data-reader-mode-tab')===next;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',active?'true':'false');});panels.forEach((panel)=>{panel.hidden=panel.getAttribute('data-reader-mode-panel')!==next;});};tabs.forEach((tab)=>tab.addEventListener('click',()=>setMode(tab.getAttribute('data-reader-mode-tab')||'child')));});})();</script>`;
}
