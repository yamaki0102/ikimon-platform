export const FIELD_PROFILE_POLICY_VERSION = "site_intelligence_p0_v1";

export type FieldProfileStatus = "draft" | "private" | "public_summary" | "manager_review" | "hidden";
export type FieldPublicLocationMode = "exact" | "site" | "grid_250m" | "grid_1km" | "municipality" | "hidden";
export type FieldProfileViewScope = "public" | "manager" | "internal";

export type FieldProfilePolicy = {
  profileStatus: FieldProfileStatus;
  defaultPublicLocationMode: FieldPublicLocationMode;
  publicProfileEnabled: boolean;
  profilePolicyVersion: string;
  profileNotes: string;
};

export type FieldProfilePolicyInput = {
  profileStatus?: unknown;
  defaultPublicLocationMode?: unknown;
  publicProfileEnabled?: unknown;
  profilePolicyVersion?: unknown;
  profileNotes?: unknown;
};

export type FieldProfileView = {
  profileStatus: FieldProfileStatus;
  publicLocationMode: FieldPublicLocationMode;
  publicProfileEnabled: boolean;
  profilePolicyVersion: string;
  profileNotes?: string;
  suppressionReason: "profile_not_public" | "profile_hidden" | "public_profile_disabled" | null;
};

const PROFILE_STATUSES: FieldProfileStatus[] = [
  "draft",
  "private",
  "public_summary",
  "manager_review",
  "hidden",
];

const PUBLIC_LOCATION_MODES: FieldPublicLocationMode[] = [
  "exact",
  "site",
  "grid_250m",
  "grid_1km",
  "municipality",
  "hidden",
];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function cleanNotes(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 600);
}

function cleanPolicyVersion(value: unknown): string {
  if (typeof value !== "string") return FIELD_PROFILE_POLICY_VERSION;
  const trimmed = value.trim();
  return trimmed || FIELD_PROFILE_POLICY_VERSION;
}

function publicLocationModeForView(mode: FieldPublicLocationMode): FieldPublicLocationMode {
  return mode === "exact" ? "site" : mode;
}

export function normalizeFieldProfilePolicy(input: FieldProfilePolicyInput): FieldProfilePolicy {
  return {
    profileStatus: pickEnum(input.profileStatus, PROFILE_STATUSES, "draft"),
    defaultPublicLocationMode: pickEnum(input.defaultPublicLocationMode, PUBLIC_LOCATION_MODES, "site"),
    publicProfileEnabled: input.publicProfileEnabled === true,
    profilePolicyVersion: cleanPolicyVersion(input.profilePolicyVersion),
    profileNotes: cleanNotes(input.profileNotes),
  };
}

export function resolveFieldProfileView(
  policy: FieldProfilePolicy,
  scope: FieldProfileViewScope,
): FieldProfileView {
  const suppressionReason =
    policy.profileStatus === "hidden"
      ? "profile_hidden"
      : policy.profileStatus !== "public_summary"
        ? "profile_not_public"
        : !policy.publicProfileEnabled
          ? "public_profile_disabled"
          : null;

  if (scope === "public") {
    return {
      profileStatus: policy.profileStatus,
      publicLocationMode: publicLocationModeForView(policy.defaultPublicLocationMode),
      publicProfileEnabled: suppressionReason === null,
      profilePolicyVersion: policy.profilePolicyVersion,
      suppressionReason,
    };
  }

  return {
    profileStatus: policy.profileStatus,
    publicLocationMode: policy.defaultPublicLocationMode,
    publicProfileEnabled: policy.publicProfileEnabled,
    profilePolicyVersion: policy.profilePolicyVersion,
    profileNotes: policy.profileNotes,
    suppressionReason,
  };
}
