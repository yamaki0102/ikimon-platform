import * as flag0 from "./GUEST_TOP_V2_PROTOTYPE_ENABLED";

export const FLAG_DEFINITIONS = [
  { ...flag0, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
] as const;

export const PROTOTYPE_FLAGS = [
  { flag: flag0.flag, feature: flag0.feature, lane: flag0.lane, path: flag0.path, stagingEnabled: flag0.staging },
] as const;
