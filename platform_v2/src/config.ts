import { resolveLegacyRoots } from "./legacy/legacyRoots.js";

export type AppConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  privilegedWriteApiKey?: string;
  geminiApiKey?: string;
  legacyDataRoot: string;
  legacyPublicRoot: string;
  legacyUploadsRoot: string;
  legacyMirrorRoot?: string;
  compatibilityWriteEnabled: boolean;
};

function parsePort(rawPort: string | undefined): number {
  const fallback = 3200;
  if (!rawPort) {
    return fallback;
  }

  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port) || port <= 0) {
    return fallback;
  }

  return port;
}

function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (rawValue === undefined) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

export function loadConfig(): AppConfig {
  const baseRoot = process.cwd();
  const legacyRoots = resolveLegacyRoots(baseRoot, {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    uploadsRoot: process.env.LEGACY_UPLOADS_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parsePort(process.env.PORT),
    databaseUrl: process.env.DATABASE_URL,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim() || undefined,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    legacyDataRoot: legacyRoots.legacyDataRoot,
    legacyPublicRoot: legacyRoots.publicRoot,
    legacyUploadsRoot: legacyRoots.uploadsRoot,
    legacyMirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    compatibilityWriteEnabled: parseBoolean(process.env.COMPATIBILITY_WRITE_ENABLED, true),
  };
}
