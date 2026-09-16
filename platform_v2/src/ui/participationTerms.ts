export type ParticipationFactState = "unknown" | "not_applicable" | "zero" | "known";

export interface ParticipationAmountFact {
  state: ParticipationFactState;
  amount: number | null;
  currency: string | null;
  unit: string | null;
  capAmount: number | null;
  capCurrency: string | null;
  capUnit: string | null;
  display: string | null;
  capDisplay: string | null;
}

export interface ParticipationRoleTerm {
  label: string | null;
  relationship: string | null;
  compensation: ParticipationAmountFact;
  expenses: ParticipationAmountFact;
  participantCost: ParticipationAmountFact;
}

export interface ParticipationTermsProjection {
  roles: ParticipationRoleTerm[];
  compensation: ParticipationAmountFact;
  expenses: ParticipationAmountFact;
  participantCost: ParticipationAmountFact;
}

export interface ParticipationTermsLabels {
  heading: string;
  roleLabel: string;
  relationshipLabel: string;
  compensationLabel: string;
  expensesLabel: string;
  participantCostLabel: string;
  unknownValue: string;
  notApplicableValue: string;
  zeroValue: string;
  capLabel: string;
  disclaimer: string;
}

const ROLE_KEYS = ["role", "roleLabel", "roleName", "title", "name"] as const;
const RELATIONSHIP_KEYS = [
  "relationship",
  "relationshipType",
  "engagementType",
  "workType",
  "employmentType",
  "contractType",
] as const;
const COMPENSATION_KEYS = [
  "compensation",
  "honorarium",
  "reward",
  "pay",
  "remuneration",
] as const;
const EXPENSE_KEYS = [
  "expenses",
  "expenseReimbursement",
  "reimbursement",
  "travelExpenses",
  "travel",
  "transportation",
] as const;
const PARTICIPANT_COST_KEYS = [
  "participantCost",
  "selfCost",
  "participantBurden",
  "entryFee",
  "participationFee",
  "cost",
] as const;
const DIRECT_TERM_KEYS = [
  ...ROLE_KEYS,
  ...RELATIONSHIP_KEYS,
  ...COMPENSATION_KEYS,
  ...EXPENSE_KEYS,
  ...PARTICIPANT_COST_KEYS.filter((key) => key !== "cost"),
] as const;
const TERM_CONTAINER_KEYS = ["participationTerms", "participation_terms", "terms"] as const;
const SOURCE_CONTAINER_KEYS = ["detail", "participation", "signup", "booking", "reservation", "info"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasOwn(source: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function firstOwn(source: Record<string, unknown>, keys: readonly string[]): { found: boolean; value: unknown } {
  for (const key of keys) {
    if (hasOwn(source, key)) return { found: true, value: source[key] };
  }
  return { found: false, value: undefined };
}

function readText(source: Record<string, unknown>, keys: readonly string[]): string | null {
  const found = firstOwn(source, keys);
  if (typeof found.value !== "string") return null;
  const value = found.value.trim();
  return value || null;
}

function readNumber(source: Record<string, unknown>, keys: readonly string[]): number | null {
  const found = firstOwn(source, keys);
  return typeof found.value === "number" && Number.isFinite(found.value) ? found.value : null;
}

function emptyFact(): ParticipationAmountFact {
  return {
    state: "unknown",
    amount: null,
    currency: null,
    unit: null,
    capAmount: null,
    capCurrency: null,
    capUnit: null,
    display: null,
    capDisplay: null,
  };
}

function normalizeState(value: unknown): ParticipationFactState | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  switch (normalized) {
    case "unknown":
    case "unconfirmed":
    case "not_confirmed":
    case "pending":
    case "未確認":
      return "unknown";
    case "not_applicable":
    case "na":
    case "n/a":
    case "非該当":
    case "該当なし":
      return "not_applicable";
    case "zero":
    case "zero_amount":
      return "zero";
    case "known":
    case "confirmed":
    case "published":
    case "specified":
    case "set":
    case "applicable":
      return "known";
    default:
      return null;
  }
}

function isZeroText(value: string): boolean {
  return /^0(?:[.,]0+)?\s*(?:円|¥|jpy)?$/i.test(value.trim());
}

function readCap(value: unknown): Pick<ParticipationAmountFact, "capAmount" | "capCurrency" | "capUnit" | "capDisplay"> {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { capAmount: value, capCurrency: null, capUnit: null, capDisplay: null };
  }
  if (typeof value === "string" && value.trim()) {
    return { capAmount: null, capCurrency: null, capUnit: null, capDisplay: value.trim() };
  }
  const cap = asRecord(value);
  if (!cap) return { capAmount: null, capCurrency: null, capUnit: null, capDisplay: null };
  return {
    capAmount: readNumber(cap, ["amount", "value", "number", "maximum", "max"]),
    capCurrency: readText(cap, ["currency", "currencyCode"]),
    capUnit: readText(cap, ["unit", "unitLabel"]),
    capDisplay: readText(cap, ["display", "label", "text"]),
  };
}

function readFact(value: unknown): ParticipationAmountFact {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { ...emptyFact(), state: value === 0 ? "zero" : "known", amount: value };
  }
  if (typeof value === "string") {
    const display = value.trim();
    if (!display) return emptyFact();
    const explicitState = normalizeState(display);
    return {
      ...emptyFact(),
      state: explicitState ?? (isZeroText(display) ? "zero" : "known"),
      display,
    };
  }

  const object = asRecord(value);
  if (!object) return emptyFact();
  const explicitState = normalizeState(readText(object, ["state", "valueState", "status"]));
  const amount = readNumber(object, ["amount", "value", "number", "valueAmount"]);
  const capSource = firstOwn(object, ["cap", "maximum", "max", "upperLimit"]);
  const cap = readCap(capSource.found ? capSource.value : undefined);
  const display = readText(object, ["display", "label", "text"]);
  const hasStructuredValue = amount !== null || cap.capAmount !== null || cap.capDisplay !== null || display !== null;
  const state = explicitState
    ?? (amount === 0 ? "zero" : hasStructuredValue ? "known" : "unknown");
  return {
    state,
    amount,
    currency: readText(object, ["currency", "currencyCode"]),
    unit: readText(object, ["unit", "unitLabel"]),
    ...cap,
    display,
  };
}

function readFactFromKeys(source: Record<string, unknown>, keys: readonly string[]): ParticipationAmountFact {
  const found = firstOwn(source, keys);
  return found.found ? readFact(found.value) : emptyFact();
}

function hasAnyKey(source: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.some((key) => hasOwn(source, key));
}

function hasFactData(fact: ParticipationAmountFact): boolean {
  return fact.state !== "unknown"
    || fact.amount !== null
    || fact.currency !== null
    || fact.unit !== null
    || fact.capAmount !== null
    || fact.capCurrency !== null
    || fact.capUnit !== null
    || fact.display !== null
    || fact.capDisplay !== null;
}

function parseRole(value: unknown): ParticipationRoleTerm | null {
  if (typeof value === "string") {
    const label = value.trim();
    return label ? {
      label,
      relationship: null,
      compensation: emptyFact(),
      expenses: emptyFact(),
      participantCost: emptyFact(),
    } : null;
  }
  const object = asRecord(value);
  if (!object) return null;
  const label = readText(object, ROLE_KEYS);
  const relationship = readText(object, RELATIONSHIP_KEYS);
  const compensation = readFactFromKeys(object, COMPENSATION_KEYS);
  const expenses = readFactFromKeys(object, EXPENSE_KEYS);
  const participantCost = readFactFromKeys(object, PARTICIPANT_COST_KEYS);
  const explicitFactKey = hasAnyKey(object, [
    ...COMPENSATION_KEYS,
    ...EXPENSE_KEYS,
    ...PARTICIPANT_COST_KEYS,
  ]);
  if (!label && !relationship && !explicitFactKey && !hasFactData(compensation) && !hasFactData(expenses) && !hasFactData(participantCost)) {
    return null;
  }
  return { label, relationship, compensation, expenses, participantCost };
}

function directTermSource(source: Record<string, unknown>): boolean {
  return hasAnyKey(source, DIRECT_TERM_KEYS);
}

function findTermContainers(config: Record<string, unknown>): Record<string, unknown>[] {
  const containers: Record<string, unknown>[] = [];
  const seen = new Set<Record<string, unknown>>();
  const add = (value: unknown): void => {
    const record = asRecord(value);
    if (record && !seen.has(record)) {
      seen.add(record);
      containers.push(record);
    }
  };

  const sources: Record<string, unknown>[] = [config];
  for (const key of SOURCE_CONTAINER_KEYS) {
    const nested = asRecord(config[key]);
    if (nested) sources.push(nested);
  }
  for (const source of sources) {
    for (const key of TERM_CONTAINER_KEYS) add(source[key]);
    if (source !== config && directTermSource(source)) add(source);
  }
  return containers;
}

function containerHasData(container: Record<string, unknown>): boolean {
  const roles = container.roles ?? container.roleTerms ?? container.participationRoles;
  if (Array.isArray(roles) && roles.length > 0) return true;
  if (directTermSource(container) || hasOwn(container, "cost")) return true;
  return false;
}

export function readParticipationTerms(config: Record<string, unknown>): ParticipationTermsProjection | null {
  const containers = findTermContainers(config);
  const container = containers.find(containerHasData);
  if (!container) return null;

  const rawRoles = container.roles ?? container.roleTerms ?? container.participationRoles;
  const roles = Array.isArray(rawRoles)
    ? rawRoles.map(parseRole).filter((role): role is ParticipationRoleTerm => role !== null)
    : [];
  if (roles.length === 0) {
    const directRole = parseRole(container);
    if (directRole && (directRole.label || directRole.relationship)) roles.push(directRole);
  }

  return {
    roles,
    compensation: readFactFromKeys(container, COMPENSATION_KEYS),
    expenses: readFactFromKeys(container, EXPENSE_KEYS),
    participantCost: readFactFromKeys(container, PARTICIPANT_COST_KEYS),
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-US")
    : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatAmount(
  amount: number | null,
  currency: string | null,
  unit: string | null,
): string {
  const number = amount === null ? "" : formatNumber(amount);
  const value = [number, currency].filter((part): part is string => Boolean(part)).join(currency === "円" || currency === "¥" ? "" : " ");
  return [value, unit].filter((part): part is string => Boolean(part)).join(" / ");
}

function formatFactValue(fact: ParticipationAmountFact, labels: ParticipationTermsLabels): string {
  if (fact.state === "unknown") return labels.unknownValue;
  if (fact.state === "not_applicable") return labels.notApplicableValue;

  const main = fact.display ?? (fact.state === "zero" && (fact.amount === 0 || fact.amount === null)
    && !fact.currency && !fact.unit
    ? labels.zeroValue
    : formatAmount(fact.amount ?? (fact.state === "zero" ? 0 : null), fact.currency, fact.unit));
  const cap = fact.capDisplay ?? formatAmount(fact.capAmount, fact.capCurrency, fact.capUnit);
  const readableMain = main || (fact.state === "zero" ? labels.zeroValue : "");
  if (!readableMain) return labels.unknownValue;
  return cap ? `${readableMain} / ${labels.capLabel} ${cap}` : readableMain;
}

function renderFact(label: string, value: string): string {
  return `
    <div class="zukan-participation-detail-fact">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRole(role: ParticipationRoleTerm, labels: ParticipationTermsLabels): string {
  return `
    <div class="zukan-participation-terms-role">
      <h3>${escapeHtml(role.label ?? labels.roleLabel)}</h3>
      <dl class="zukan-participation-detail-facts">
        ${renderFact(labels.relationshipLabel, role.relationship ?? labels.unknownValue)}
        ${renderFact(labels.compensationLabel, formatFactValue(role.compensation, labels))}
        ${renderFact(labels.expensesLabel, formatFactValue(role.expenses, labels))}
        ${renderFact(labels.participantCostLabel, formatFactValue(role.participantCost, labels))}
      </dl>
    </div>`;
}

export function renderParticipationTerms(
  config: Record<string, unknown>,
  labels: ParticipationTermsLabels,
): string {
  const projection = readParticipationTerms(config);
  if (!projection) return "";
  const content = projection.roles.length > 0
    ? projection.roles.map((role) => renderRole(role, labels)).join("")
    : `<dl class="zukan-participation-detail-facts">
        ${renderFact(labels.compensationLabel, formatFactValue(projection.compensation, labels))}
        ${renderFact(labels.expensesLabel, formatFactValue(projection.expenses, labels))}
        ${renderFact(labels.participantCostLabel, formatFactValue(projection.participantCost, labels))}
      </dl>`;
  return `
      <section class="zukan-participation-detail-section zukan-participation-terms" aria-labelledby="participation-terms-heading" data-participation-terms>
        <h2 id="participation-terms-heading">${escapeHtml(labels.heading)}</h2>
        ${content}
        <p class="zukan-participation-terms-disclaimer">${escapeHtml(labels.disclaimer)}</p>
      </section>`;
}

function summarizeRole(role: ParticipationRoleTerm, labels: ParticipationTermsLabels): string {
  const details: string[] = [];
  if (role.relationship) details.push(`${labels.relationshipLabel}: ${role.relationship}`);
  if (role.compensation.state !== "unknown") details.push(`${labels.compensationLabel}: ${formatFactValue(role.compensation, labels)}`);
  if (role.expenses.state !== "unknown") details.push(`${labels.expensesLabel}: ${formatFactValue(role.expenses, labels)}`);
  if (role.participantCost.state !== "unknown") details.push(`${labels.participantCostLabel}: ${formatFactValue(role.participantCost, labels)}`);
  const name = role.label ?? labels.roleLabel;
  return details.length > 0 ? `${name}（${details.join("、")}）` : name;
}

export function summarizeParticipationTerms(
  config: Record<string, unknown>,
  labels: ParticipationTermsLabels,
): string | null {
  const projection = readParticipationTerms(config);
  if (!projection) return null;
  if (projection.roles.length > 0) return projection.roles.map((role) => summarizeRole(role, labels)).join(" ｜ ");
  const details = [
    [labels.compensationLabel, projection.compensation],
    [labels.expensesLabel, projection.expenses],
    [labels.participantCostLabel, projection.participantCost],
  ] as const;
  const summary = details
    .filter(([, fact]) => fact.state !== "unknown")
    .map(([label, fact]) => `${label}: ${formatFactValue(fact, labels)}`)
    .join("、");
  return summary || null;
}
