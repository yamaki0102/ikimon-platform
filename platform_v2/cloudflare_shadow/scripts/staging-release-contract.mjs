export function stagingRuntimeMatches(runtime, expected, phase = "pre-materialization") {
  if (!runtime || runtime.ok !== true) return false;
  if (runtime.gitSha !== expected.gitSha || runtime.workerVersion !== expected.workerVersion) return false;
  if (phase === "pre-materialization") return true;
  if (phase !== "post-materialization") throw new Error(`Unknown staging runtime phase: ${phase}`);
  if (!expected.uiBundleHash || !expected.originalUiManifestHash) return false;
  return runtime.uiBundleHash === expected.uiBundleHash
    && runtime.originalUiManifestHash === expected.originalUiManifestHash;
}

export function assertStagingRuntimeContract(runtime, expected, phase = "pre-materialization") {
  if (!stagingRuntimeMatches(runtime, expected, phase)) {
    throw new Error(`staging_runtime_contract_failed:${phase}`);
  }
  return runtime;
}
