// Biodiversity Freshness OS: monthly AI budget gate.
//
// Enforces tiered degradation when monthly Hot-layer spend approaches the cap:
//   < 80%  : normal     (no restriction)
//   80-95% : constrained (Pro escalation disabled, Slack warning)
//   95-99% : strict     (Hot pinned to Flash Lite, Warm goes dry-run)
//   99-100%: freeze     (Hot returns cache hits only)
//   > 100% : reject     (logAiCost() refuses non-cache inserts)
//
// Override: env AI_BUDGET_OVERRIDE=1 forces normal regardless of usage.

import { summarizeMonthlyCost, type AiCostLayer } from "./aiCostLogger.js";

export type BudgetState = "normal" | "constrained" | "strict" | "freeze" | "reject";

export type BudgetSnapshot = {
  state: BudgetState;
  ratio: number;
  totalCostJpy: number;
  monthlyBudgetJpy: number;
  callCount: number;
  cacheHitRatio: number;
  escalationRatio: number;
};

const DEFAULT_MONTHLY_BUDGET_JPY = 10_000;
const ESCALATION_RATIO_CAP = 0.05; // §5.3: monthly Pro escalations ≤ 5%

function readMonthlyBudgetJpy(): number {
  const raw = process.env.AI_HOT_MONTHLY_BUDGET_JPY?.trim();
  if (!raw) return DEFAULT_MONTHLY_BUDGET_JPY;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MONTHLY_BUDGET_JPY;
  return parsed;
}

function isOverrideActive(): boolean {
  const raw = process.env.AI_BUDGET_OVERRIDE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function deriveState(ratio: number): BudgetState {
  if (ratio < 0.80) return "normal";
  if (ratio < 0.95) return "constrained";
  if (ratio < 0.99) return "strict";
  if (ratio < 1.00) return "freeze";
  return "reject";
}

export async function snapshotBudget(layer: AiCostLayer = "hot"): Promise<BudgetSnapshot> {
  const monthlyBudgetJpy = readMonthlyBudgetJpy();
  if (isOverrideActive()) {
    return {
      state: "normal",
      ratio: 0,
      totalCostJpy: 0,
      monthlyBudgetJpy,
      callCount: 0,
      cacheHitRatio: 0,
      escalationRatio: 0,
    };
  }
  const summary = await summarizeMonthlyCost(layer);
  const ratio = monthlyBudgetJpy > 0 ? summary.totalCostJpy / monthlyBudgetJpy : 1;
  return {
    state: deriveState(ratio),
    ratio,
    totalCostJpy: summary.totalCostJpy,
    monthlyBudgetJpy,
    callCount: summary.callCount,
    cacheHitRatio: summary.callCount > 0 ? summary.cacheHits / summary.callCount : 0,
    escalationRatio: summary.callCount > 0 ? summary.escalations / summary.callCount : 0,
  };
}

export class AiBudgetExceededError extends Error {
  constructor(public readonly snapshot: BudgetSnapshot, message: string) {
    super(message);
    this.name = "AiBudgetExceededError";
  }
}

export async function assertAllowed(layer: AiCostLayer = "hot"): Promise<BudgetSnapshot> {
  const snapshot = await snapshotBudget(layer);
  if (snapshot.state === "reject") {
    throw new AiBudgetExceededError(
      snapshot,
      `AI ${layer} budget exhausted: ${snapshot.totalCostJpy.toFixed(2)} / ${snapshot.monthlyBudgetJpy} JPY (set AI_BUDGET_OVERRIDE=1 to force)`
    );
  }
  return snapshot;
}

export async function assertEscalationAllowed(layer: AiCostLayer = "hot"): Promise<BudgetSnapshot> {
  const snapshot = await snapshotBudget(layer);
  if (snapshot.state !== "normal") {
    throw new AiBudgetExceededError(
      snapshot,
      `AI ${layer} escalation blocked: budget state=${snapshot.state} ratio=${(snapshot.ratio * 100).toFixed(1)}%`
    );
  }
  if (snapshot.escalationRatio >= ESCALATION_RATIO_CAP) {
    throw new AiBudgetExceededError(
      snapshot,
      `AI ${layer} escalation cap hit: ${(snapshot.escalationRatio * 100).toFixed(1)}% > ${(ESCALATION_RATIO_CAP * 100).toFixed(0)}%`
    );
  }
  return snapshot;
}

export function isCacheOnlyState(state: BudgetState): boolean {
  return state === "freeze" || state === "reject";
}

export function isWarmDryRunState(state: BudgetState): boolean {
  return state === "strict" || state === "freeze" || state === "reject";
}
