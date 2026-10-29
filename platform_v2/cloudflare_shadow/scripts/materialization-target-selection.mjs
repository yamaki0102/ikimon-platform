export function selectCoreMaterializationPaths({
  corePaths,
  queryVariantPaths,
  learnPaths,
  invasiveSpeciesPaths,
  siteMapPaths,
  stagingOnlyPaths = [],
}) {
  const siteMapCorePaths = siteMapPaths.filter((path) => path === "/ja/contact");
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
