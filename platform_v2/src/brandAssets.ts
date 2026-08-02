const OGP_DEFAULT_PATH = "/assets/brand/zukan-ogp-default.png";
const PUBLIC_ASSET_ORIGIN_BY_TARGET_ENV = {
  production: "https://ikimon.life",
  staging: "https://staging.ikimon.life",
} as const;
const ALLOWED_PUBLIC_ASSET_ORIGINS = new Set(Object.values(PUBLIC_ASSET_ORIGIN_BY_TARGET_ENV));

export function resolveZukanPublicAssetOrigin(
  configuredOrigin: string | undefined = process.env.ZUKAN_PUBLIC_ASSET_ORIGIN,
  argv: readonly string[] = process.argv,
): string {
  const rawConfiguredOrigin = String(configuredOrigin ?? "").trim();
  if (rawConfiguredOrigin) {
    const normalizedOrigin = rawConfiguredOrigin.replace(/\/+$/, "");
    return ALLOWED_PUBLIC_ASSET_ORIGINS.has(normalizedOrigin) ? normalizedOrigin : "";
  }

  const targetEnvIndex = argv.lastIndexOf("--target-env");
  const targetEnv = targetEnvIndex >= 0 ? argv[targetEnvIndex + 1] : undefined;
  return targetEnv === "staging" || targetEnv === "production"
    ? PUBLIC_ASSET_ORIGIN_BY_TARGET_ENV[targetEnv]
    : "";
}

export function zukanOgpDefaultAssetUrl(
  publicAssetOrigin: string | undefined = resolveZukanPublicAssetOrigin(),
): string {
  const normalizedOrigin = String(publicAssetOrigin ?? "").trim().replace(/\/+$/, "");
  return ALLOWED_PUBLIC_ASSET_ORIGINS.has(normalizedOrigin)
    ? `${normalizedOrigin}${OGP_DEFAULT_PATH}`
    : OGP_DEFAULT_PATH;
}

export const BRAND_ASSETS = {
  mark192: "/assets/brand/zukan-app-icon-192.png",
  mark512: "/assets/brand/zukan-app-icon-512.png",
  mark192Maskable: "/assets/brand/zukan-app-icon-192-maskable.png",
  mark512Maskable: "/assets/brand/zukan-app-icon-512-maskable.png",
  appleTouchIcon: "/assets/brand/zukan-apple-touch-icon.png",
  favicon32: "/assets/brand/zukan-favicon-32.png",
  wordmarkBlack: "/assets/brand/zukan-wordmark.svg",
  lockupBlack: "/assets/brand/zukan-lockup.svg",
  get ogpDefault(): string {
    return zukanOgpDefaultAssetUrl();
  },
} as const;
