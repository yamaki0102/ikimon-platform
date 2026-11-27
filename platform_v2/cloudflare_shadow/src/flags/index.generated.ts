import * as flag0 from "./BIOSECURITY_GENERIC_ENABLED";
import * as flag1 from "./BIOSECURITY_NAGAETSURU_ENABLED";
import * as flag2 from "./FIELD_CARD_ENABLED";
import * as flag3 from "./GUEST_TOP_V2_PROTOTYPE_ENABLED";
import * as flag4 from "./MAP_INVASIVE_LAYER_ENABLED";
import * as flag5 from "./OBSERVATION_CORRECTION_PROTOTYPE_ENABLED";
import * as flag6 from "./PLACE_PAGE_V3_PROTOTYPE_ENABLED";
import * as flag7 from "./PLACE_REGISTER_ENABLED";
import * as flag8 from "./RECORD_INLINE_EDIT_PROTOTYPE_ENABLED";
import * as flag9 from "./RECORD_PAGE_PER_MEDIA_PROTOTYPE_ENABLED";
import * as flag10 from "./RECORD_READER_MODES_ENABLED";
import * as flag11 from "./SPECIES_READER_LAYER_ENABLED";

export const FLAG_DEFINITIONS = [
  { ...flag0, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag1, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag2, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag3, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag4, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag5, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag6, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag7, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag8, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag9, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag10, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
  { ...flag11, scopes: ["wrangler.jsonc:vars","wrangler.jsonc:env.shadow.vars","wrangler.jsonc:env.staging.vars","wrangler.jsonc:env.production.vars"] },
] as const;

export const PROTOTYPE_FLAGS = [
  { flag: flag0.flag, feature: flag0.feature, lane: flag0.lane, path: flag0.path, stagingEnabled: flag0.staging },
  { flag: flag1.flag, feature: flag1.feature, lane: flag1.lane, path: flag1.path, stagingEnabled: flag1.staging },
  { flag: flag2.flag, feature: flag2.feature, lane: flag2.lane, path: flag2.path, stagingEnabled: flag2.staging },
  { flag: flag3.flag, feature: flag3.feature, lane: flag3.lane, path: flag3.path, stagingEnabled: flag3.staging },
  { flag: flag4.flag, feature: flag4.feature, lane: flag4.lane, path: flag4.path, stagingEnabled: flag4.staging },
  { flag: flag5.flag, feature: flag5.feature, lane: flag5.lane, path: flag5.path, stagingEnabled: flag5.staging },
  { flag: flag6.flag, feature: flag6.feature, lane: flag6.lane, path: flag6.path, stagingEnabled: flag6.staging },
  { flag: flag7.flag, feature: flag7.feature, lane: flag7.lane, path: flag7.path, stagingEnabled: flag7.staging },
  { flag: flag8.flag, feature: flag8.feature, lane: flag8.lane, path: flag8.path, stagingEnabled: flag8.staging },
  { flag: flag9.flag, feature: flag9.feature, lane: flag9.lane, path: flag9.path, stagingEnabled: flag9.staging },
  { flag: flag10.flag, feature: flag10.feature, lane: flag10.lane, path: flag10.path, stagingEnabled: flag10.staging },
  { flag: flag11.flag, feature: flag11.feature, lane: flag11.lane, path: flag11.path, stagingEnabled: flag11.staging },
] as const;
