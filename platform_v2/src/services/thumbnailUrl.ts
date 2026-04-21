export type ThumbnailPreset = "sm" | "md" | "lg";

export const THUMBNAIL_PRESET_SIZES: Record<ThumbnailPreset, number> = {
  sm: 192,
  md: 640,
  lg: 1280,
};

const THUMB_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

export function toThumbnailUrl(photoUrl: string | null | undefined, preset: ThumbnailPreset): string | null {
  if (!photoUrl) return null;
  if (!/^\/(uploads|data\/uploads)\//.test(photoUrl)) return photoUrl;
  if (!THUMB_EXT_RE.test(photoUrl)) return photoUrl;
  const rel = photoUrl.replace(/^\/(uploads|data\/uploads)\//, "");
  return `/thumb/${preset}/${rel}`;
}
