const OGP_DEFAULT_PATH = "/assets/brand/zukan-ogp-default.png";

export function zukanOgpDefaultAssetUrl(
  materializationToken: string | undefined = process.env.DEV_DUMMY_ADMIN_TOKEN,
): string {
  return materializationToken === "materialize-admin-preview"
    ? `https://staging.ikimon.life${OGP_DEFAULT_PATH}`
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
