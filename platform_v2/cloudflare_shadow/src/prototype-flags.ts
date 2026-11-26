import { PROTOTYPE_FLAGS } from "./flags/index.generated";

export { PROTOTYPE_FLAGS };

export type PrototypeFlag = (typeof PROTOTYPE_FLAGS)[number]["flag"];
export type PrototypeEnvironment = { readonly [K in PrototypeFlag]?: string };

export type FeatureRolloutState = "off" | "allowlist" | "all";
export type FeatureRollout = { readonly state: FeatureRolloutState; readonly allowlist?: readonly string[]; readonly expiresOn?: string; readonly removeBy?: string };
export type FeatureRolloutEnvironment = { readonly ZUKAN_FEATURE_ROLLOUTS?: string };
export type ViewerIdentity = { readonly userId?: string | null; readonly roleName?: string | null; readonly banned?: boolean | null };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};
const OFF: FeatureRollout = { state: "off" };

function rolloutFor(env: FeatureRolloutEnvironment, flag: string): FeatureRollout | undefined {
  if (env.ZUKAN_FEATURE_ROLLOUTS === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(env.ZUKAN_FEATURE_ROLLOUTS);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return OFF;
    if (!Object.hasOwn(value, flag)) return undefined;
    const candidate = (value as Record<string, unknown>)[flag];
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return OFF;
    const { state, allowlist, expiresOn, removeBy } = candidate as Record<string, unknown>;
    if (state !== "off" && state !== "allowlist" && state !== "all") return OFF;
    if (state === "allowlist") {
      if (!Array.isArray(allowlist) || !allowlist.every(item => typeof item === "string")) return OFF;
      if (!validDate(expiresOn) || !validDate(removeBy) || removeBy < expiresOn) return OFF;
    }
    return {
      state,
      ...(Array.isArray(allowlist) ? { allowlist: [...new Set(allowlist)] as string[] } : {}),
      ...(validDate(expiresOn) ? { expiresOn } : {}),
      ...(validDate(removeBy) ? { removeBy } : {}),
    };
  } catch { return OFF; }
}

function allowlisted(rollout: FeatureRollout, now: Date, principalId: string | null | undefined, role: string | null | undefined): boolean {
  if (rollout.state !== "allowlist" || typeof principalId !== "string" || principalId.length === 0) return false;
  if (rollout.expiresOn === undefined || now.toISOString().slice(0, 10) > rollout.expiresOn) return false;
  return rollout.allowlist?.includes(principalId) === true
    || (typeof role === "string" && role.length > 0 && rollout.allowlist?.includes(`role:${role}`) === true);
}

export function prototypeEnabled(env: object, flag: string): boolean {
  return (env as Record<string, unknown>)[flag] === "true";
}

/** Server-owned evaluation for authenticated features. A configured rollout replaces the legacy boolean and fails closed; anonymous callers are never enabled. */
export function prototypeEnabledForPrincipal(env: FeatureRolloutEnvironment, flag: string, principalId?: string | null, role?: string | null, now: Date = new Date()): boolean {
  const rollout = rolloutFor(env, flag);
  if (rollout === undefined) return prototypeEnabled(env, flag);
  if (typeof principalId !== "string" || principalId.length === 0) return false;
  if (rollout.state === "all") return true;
  return allowlisted(rollout, now, principalId, role);
}

/** Server-owned evaluation for public pages: stage "all" is on for logged-out viewers too; allowlist and off stay off for them. */
export function prototypeEnabledForViewer(env: FeatureRolloutEnvironment, flag: string, principalId?: string | null, role?: string | null, now: Date = new Date()): boolean {
  const rollout = rolloutFor(env, flag);
  if (rollout === undefined) return prototypeEnabled(env, flag);
  if (rollout.state === "all") return true;
  return allowlisted(rollout, now, principalId, role);
}

export function viewerFromSession(session: ViewerIdentity | null | undefined): { readonly principalId: string | null; readonly role: string | null } {
  if (!session || session.banned === true || typeof session.userId !== "string" || session.userId.length === 0) return { principalId: null, role: null };
  return { principalId: session.userId, role: typeof session.roleName === "string" && session.roleName.length > 0 ? session.roleName : null };
}

/** Preview of the logged-out page: only a logged-in viewer who is rolled in for this flag can ask for it with ?as=guest. */
export function viewAsGuest(request: Request, env: FeatureRolloutEnvironment, flag: string, session: ViewerIdentity | null | undefined, now: Date = new Date()): boolean {
  if (new URL(request.url).searchParams.get("as") !== "guest") return false;
  const { principalId, role } = viewerFromSession(session);
  return principalId !== null && prototypeEnabledForPrincipal(env, flag, principalId, role, now);
}

export function readPrototypeFlags(env: PrototypeEnvironment): Record<PrototypeFlag, boolean> {
  return Object.fromEntries(PROTOTYPE_FLAGS.map(({ flag }) => [flag, prototypeEnabled(env, flag)])) as Record<PrototypeFlag, boolean>;
}

export function readPrototypeFlagsForPrincipal(env: FeatureRolloutEnvironment, principalId?: string | null, role?: string | null): Record<PrototypeFlag, boolean> {
  return Object.fromEntries(PROTOTYPE_FLAGS.map(({ flag }) => [flag, prototypeEnabledForPrincipal(env, flag, principalId, role)])) as Record<PrototypeFlag, boolean>;
}

export function prototypeFlagInventoryMarkdown(): string {
  return "| flag | feature | owner lane | staging URL path |\n|---|---|---|---|\n"
    + PROTOTYPE_FLAGS.map(({ flag, feature, lane, path }) => `| ${flag} | ${feature} | ${lane} | ${path} |\n`).join("");
}
