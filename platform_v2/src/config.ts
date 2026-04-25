import { resolveLegacyRoots } from "./legacy/legacyRoots.js";

export type AppConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  privilegedWriteApiKey?: string;
  oauthStateSecret?: string;
  geminiApiKey?: string;
  legacyDataRoot: string;
  legacyPublicRoot: string;
  legacyUploadsRoot: string;
  legacyMirrorRoot?: string;
  compatibilityWriteEnabled: boolean;
  cloudflare?: {
    accountId: string;
    streamApiToken: string;
    streamCustomerSubdomain: string;
  };
  oauth: {
    google?: {
      clientId: string;
      clientSecret: string;
    };
    twitter?: {
      clientId: string;
      clientSecret: string;
    };
  };
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
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const cfToken = process.env.CLOUDFLARE_STREAM_API_TOKEN?.trim();
  const cfSubdomain = process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim();
  const cloudflare = cfAccount && cfToken && cfSubdomain
    ? { accountId: cfAccount, streamApiToken: cfToken, streamCustomerSubdomain: cfSubdomain }
    : undefined;
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const twitterClientId = process.env.TWITTER_CLIENT_ID?.trim();
  const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET?.trim();

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parsePort(process.env.PORT),
    databaseUrl: process.env.DATABASE_URL,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim() || undefined,
    oauthStateSecret: process.env.V2_OAUTH_STATE_SECRET?.trim() || process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim() || undefined,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    legacyDataRoot: legacyRoots.legacyDataRoot,
    legacyPublicRoot: legacyRoots.publicRoot,
    legacyUploadsRoot: legacyRoots.uploadsRoot,
    legacyMirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    compatibilityWriteEnabled: parseBoolean(process.env.COMPATIBILITY_WRITE_ENABLED, true),
    cloudflare,
    oauth: {
      google: googleClientId && googleClientSecret
        ? { clientId: googleClientId, clientSecret: googleClientSecret }
        : undefined,
      twitter: twitterClientId && twitterClientSecret
        ? { clientId: twitterClientId, clientSecret: twitterClientSecret }
        : undefined,
    },
  };
}
