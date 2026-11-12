const CORE_SITEMAP_PATHS = new Set(["/ja/contact", "/ja/privacy", "/ja/terms"]);

export function selectCoreMaterializationPaths({
  corePaths,
  queryVariantPaths,
  learnPaths,
  invasiveSpeciesPaths,
  siteMapPaths,
  stagingOnlyPaths = [],
}) {
  const siteMapCorePaths = siteMapPaths.filter((path) => CORE_SITEMAP_PATHS.has(path));
  return [...new Set([
    ...corePaths,
    ...queryVariantPaths,
    ...learnPaths,
    "/learn",
    ...siteMapCorePaths,
    ...invasiveSpeciesPaths,
    ...stagingOnlyPaths,
  ])];
}
