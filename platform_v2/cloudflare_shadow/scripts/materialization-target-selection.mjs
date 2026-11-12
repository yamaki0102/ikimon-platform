export function selectCoreMaterializationPaths({
  corePaths,
  queryVariantPaths,
  learnPaths,
  invasiveSpeciesPaths,
  sitemapStaticPaths = [],
  stagingOnlyPaths = [],
}) {
  return [...new Set([
    ...corePaths,
    ...queryVariantPaths,
    ...learnPaths,
    "/learn",
    ...sitemapStaticPaths,
    ...invasiveSpeciesPaths,
    ...stagingOnlyPaths,
  ])];
}
