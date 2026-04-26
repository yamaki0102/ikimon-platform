import { resolveLegacyRoots } from "./legacy/legacyRoots.js";

export type AppConfig = {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  privilegedWriteApiKey?: string;
  oauthStateSecret?: string;
  geminiApiKey?: string;
  deepseekApiKey?: string;
  profileDigest: {
    provider: "disabled" | "deepseek";
    model: string;
    maxInputTokens: number;
    maxOutputTokens: number;
    monthlyBudgetJpy: number;
    assumedJpyPerUsd: number;
  };
  legacyDataRoot: string;
  legacyPublicRoot: string;
  legacyUploadsRoot: string;
  legacyMirrorRoot?: string;
  compatibilityWriteEnabled: boolean;
  cloudflare?: {
    accountId: string;
    streamApiToken: string;
    streamCustomerSubdomain: string;
    streamWebhookSecret?: string;
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

function parsePositiveNumber(rawValue: string | undefined, fallback: number): number {
  if (rawValue === undefined) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parseProfileDigestProvider(rawValue: string | undefined, hasDeepseekKey: boolean): "disabled" | "deepseek" {
  const normalized = rawValue?.trim().toLowerCase();
  if (normalized === "deepseek") {
    return "deepseek";
  }
  if (normalized === "disabled" || normalized === "off" || normalized === "0") {
    return "disabled";
  }
  if (hasDeepseekKey) {
    return "deepseek";
  }
  return "disabled";
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
  const cfWebhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET?.trim();
  const cloudflare = cfAccount && cfToken && cfSubdomain
    ? { accountId: cfAccount, streamApiToken: cfToken, streamCustomerSubdomain: cfSubdomain, streamWebhookSecret: cfWebhookSecret || undefined }
    : undefined;
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const twitterClientId = process.env.TWITTER_CLIENT_ID?.trim();
  const twitterClientSecret = process.env.TWITTER_CLIENT_SECRET?.trim();
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY?.trim() || undefined;

  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: parsePort(process.env.PORT),
    databaseUrl: process.env.DATABASE_URL,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim() || undefined,
    oauthStateSecret: process.env.V2_OAUTH_STATE_SECRET?.trim() || process.env.V2_PRIVILEGED_WRITE_API_KEY?.trim() || undefined,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    deepseekApiKey,
    profileDigest: {
      provider: parseProfileDigestProvider(process.env.PROFILE_DIGEST_LLM_PROVIDER, Boolean(deepseekApiKey)),
      model: process.env.PROFILE_DIGEST_MODEL?.trim() || "deepseek-v4-flash",
      maxInputTokens: Math.floor(parsePositiveNumber(process.env.PROFILE_DIGEST_MAX_INPUT_TOKENS, 2000)),
      maxOutputTokens: Math.floor(parsePositiveNumber(process.env.PROFILE_DIGEST_MAX_OUTPUT_TOKENS, 300)),
      monthlyBudgetJpy: parsePositiveNumber(process.env.PROFILE_DIGEST_MONTHLY_BUDGET_JPY, 1000),
      assumedJpyPerUsd: parsePositiveNumber(process.env.PROFILE_DIGEST_ASSUMED_JPY_PER_USD, 150),
    },
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
