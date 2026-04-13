import path from "node:path";

export type LegacyRoots = {
  legacyDataRoot: string;
  uploadsRoot: string;
  publicRoot: string;
};

type LegacyRootEnv = {
  legacyDataRoot?: string;
  uploadsRoot?: string;
  publicRoot?: string;
  mirrorRoot?: string;
};

function resolveFromMirrorRoot(mirrorRoot: string): LegacyRoots {
  const resolvedMirrorRoot = path.resolve(mirrorRoot);
  return {
    legacyDataRoot: path.join(resolvedMirrorRoot, "data"),
    uploadsRoot: path.join(resolvedMirrorRoot, "uploads"),
    publicRoot: path.join(resolvedMirrorRoot, "public"),
  };
}

export function resolveLegacyRoots(baseRoot: string, env: LegacyRootEnv = {}): LegacyRoots {
  if (env.mirrorRoot && env.mirrorRoot.trim() !== "") {
    const fromMirror = resolveFromMirrorRoot(env.mirrorRoot);
    return {
      legacyDataRoot: env.legacyDataRoot ? path.resolve(env.legacyDataRoot) : fromMirror.legacyDataRoot,
      uploadsRoot: env.uploadsRoot ? path.resolve(env.uploadsRoot) : fromMirror.uploadsRoot,
      publicRoot: env.publicRoot ? path.resolve(env.publicRoot) : fromMirror.publicRoot,
    };
  }

  return {
    legacyDataRoot: env.legacyDataRoot
      ? path.resolve(env.legacyDataRoot)
      : path.resolve(baseRoot, "../upload_package/data"),
    uploadsRoot: env.uploadsRoot
      ? path.resolve(env.uploadsRoot)
      : path.resolve(baseRoot, "../upload_package/public_html/uploads"),
    publicRoot: env.publicRoot
      ? path.resolve(env.publicRoot)
      : path.resolve(baseRoot, "../upload_package/public_html"),
  };
}
