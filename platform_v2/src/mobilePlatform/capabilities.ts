import {
  MOBILE_PLATFORM_CONTRACT_VERSION,
  assertProviderOpaqueManifest,
  type MobileCapabilityManifest,
} from "./productFamilyContract.js";

export const ZUKAN_MOBILE_CAPABILITY_MANIFEST = {
  contractVersion: MOBILE_PLATFORM_CONTRACT_VERSION,
  product: "zukan",
  capabilities: [
    { id: "field-session.start", version: "1", state: "available" },
    { id: "field-session.scene-digest", version: "1", state: "available" },
    { id: "field-session.audio-events", version: "1", state: "available" },
    { id: "field-session.recap", version: "1", state: "available" },
    { id: "sync.push", version: "1", state: "contract_only" },
    { id: "media.upload.intent", version: "1", state: "contract_only" },
    { id: "knowledge-exchange.nocosil-to-zukan", version: "1", state: "contract_only" },
  ],
} as const satisfies MobileCapabilityManifest;

assertProviderOpaqueManifest(ZUKAN_MOBILE_CAPABILITY_MANIFEST);

export const ZUKAN_PLATFORM_DISCOVERY = {
  schema: "ikimon.platform-discovery/v1",
  product: "zukan",
  mobileContractVersion: MOBILE_PLATFORM_CONTRACT_VERSION,
  capabilities: "/api/v1/mobile/capabilities",
  providerOpaque: true,
} as const;
