export interface RuntimeIdentityEnv {
  ENVIRONMENT?: string | null;
  IKIMON_GIT_SHA?: string | null;
  GITHUB_SHA?: string | null;
  IKIMON_WORKER_VERSION?: string | null;
  IKIMON_UI_BUNDLE_HASH?: string | null;
  IKIMON_UI_MANIFEST_HASH?: string | null;
  IKIMON_DEPLOYED_AT?: string | null;
  CF_VERSION_METADATA?: ShadowGeneratedEnv["CF_VERSION_METADATA"] | null;
}

export interface RuntimeIdentity {
  environment: string | null;
  origin: string;
  gitSha: string | null;
  sourceSha: string | null;
  workerVersion: string | null;
  workerVersionId: string | null;
  workerVersionTag: string | null;
  workerVersionTimestamp: string | null;
  uiBundleHash: string | null;
  originalUiManifestHash: string | null;
  deployedAt: string | null;
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildRuntimeIdentity(env: RuntimeIdentityEnv, origin: string): RuntimeIdentity {
  const gitSha = clean(env.IKIMON_GIT_SHA) ?? clean(env.GITHUB_SHA);
  const metadata = env.CF_VERSION_METADATA ?? null;
  return {
    environment: clean(env.ENVIRONMENT),
    origin,
    gitSha,
    sourceSha: gitSha,
    workerVersion: clean(env.IKIMON_WORKER_VERSION),
    workerVersionId: clean(metadata?.id),
    workerVersionTag: clean(metadata?.tag),
    workerVersionTimestamp: clean(metadata?.timestamp),
    uiBundleHash: clean(env.IKIMON_UI_BUNDLE_HASH),
    originalUiManifestHash: clean(env.IKIMON_UI_MANIFEST_HASH),
    deployedAt: clean(env.IKIMON_DEPLOYED_AT),
  };
}

export function runtimeIdentityHeaders(identity: RuntimeIdentity): Record<string, string> {
  const headers: Record<string, string> = {};
  if (identity.gitSha) headers["x-ikimon-deploy-sha"] = identity.gitSha;
  if (identity.uiBundleHash) headers["x-ikimon-ui-bundle"] = identity.uiBundleHash;
  if (identity.workerVersion) headers["x-ikimon-worker-version"] = identity.workerVersion;
  if (identity.workerVersionId) headers["x-cloudflare-worker-version"] = identity.workerVersionId;
  if (identity.workerVersionTag) headers["x-cloudflare-worker-version-tag"] = identity.workerVersionTag;
  return headers;
}
