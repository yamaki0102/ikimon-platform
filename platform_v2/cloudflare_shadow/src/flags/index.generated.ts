import * as flag0 from "./GUEST_TOP_V2_PROTOTYPE_ENABLED";
import * as flag1 from "./OBSERVATION_CORRECTION_PROTOTYPE_ENABLED";
import * as flag2 from "./RECORD_INLINE_EDIT_PROTOTYPE_ENABLED";
import * as flag3 from "./RECORD_PAGE_PER_MEDIA_PROTOTYPE_ENABLED";

export const FLAG_DEFINITIONS = [
  { ...flag0, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag1, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag2, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag3, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
] as const;

export const PROTOTYPE_FLAGS = [
  { flag: flag0.flag, feature: flag0.feature, lane: flag0.lane, path: flag0.path, stagingEnabled: flag0.staging },
  { flag: flag1.flag, feature: flag1.feature, lane: flag1.lane, path: flag1.path, stagingEnabled: flag1.staging },
  { flag: flag2.flag, feature: flag2.feature, lane: flag2.lane, path: flag2.path, stagingEnabled: flag2.staging },
  { flag: flag3.flag, feature: flag3.feature, lane: flag3.lane, path: flag3.path, stagingEnabled: flag3.staging },
] as const;
