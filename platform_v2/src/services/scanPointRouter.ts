export const SCAN_POINT_TARGET_KINDS = [
  "area",
  "place",
  "natural_feature",
  "route_stop",
] as const;

export type ScanPointTargetKind = typeof SCAN_POINT_TARGET_KINDS[number];

export type ScanPointBinding = {
  scanPointId: string;
  publicRoute: string;
  targetKind: ScanPointTargetKind;
  targetId: string;
  visibility: "public" | "non_public";
  lifecycle: "active" | "stale";
  contentRevision: string;
};

export type ScanPointResolution =
  | {
      status: "resolved";
      scanPointId: string;
      publicRoute: string;
      targetKind: ScanPointTargetKind;
      targetId: string;
      contentRevision: string;
    }
  | {
      status: "not_found" | "stale" | "non_public";
      scanPointId: string;
      reason: string;
    };

function cleanIdentifier(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim();
  return normalized.length > 0 ? normalized : null;
}

function safePublicRoute(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const route = value.trim();
  if (!route.startsWith("/") || route.startsWith("//")) return null;
  if (/^[a-z]+:/i.test(route) || /[\r\n]/.test(route)) return null;
  return route;
}

export function resolveScanPointRoute(input: {
  scanPointId: unknown;
  bindings: readonly ScanPointBinding[];
}): ScanPointResolution {
  const scanPointId = cleanIdentifier(input.scanPointId);
  if (!scanPointId) {
    return {
      status: "not_found",
      scanPointId: "",
      reason: "invalid_scan_point_id",
    };
  }

  const matches = input.bindings.filter(
    (binding) => cleanIdentifier(binding.scanPointId) === scanPointId,
  );
  if (matches.length !== 1) {
    return {
      status: "not_found",
      scanPointId,
      reason: matches.length === 0 ? "scan_point_not_found" : "ambiguous_scan_point_binding",
    };
  }

  const binding = matches[0];
  if (!binding || binding.lifecycle === "stale") {
    return {
      status: "stale",
      scanPointId,
      reason: "scan_point_binding_stale",
    };
  }
  if (binding.visibility !== "public") {
    return {
      status: "non_public",
      scanPointId,
      reason: "scan_point_target_not_public",
    };
  }

  const targetId = cleanIdentifier(binding.targetId);
  const publicRoute = safePublicRoute(binding.publicRoute);
  const contentRevision = cleanIdentifier(binding.contentRevision);
  if (!targetId || !publicRoute || !contentRevision) {
    return {
      status: "stale",
      scanPointId,
      reason: "scan_point_binding_invalid",
    };
  }

  return {
    status: "resolved",
    scanPointId,
    publicRoute,
    targetKind: binding.targetKind,
    targetId,
    contentRevision,
  };
}
