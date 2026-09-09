/* Generated binding excerpt from Wrangler 4.130.0 / workerd 1.20260908.1. */
/* Source: npx wrangler types --env shadow --config wrangler.jsonc. */
/* Bounded CF_VERSION_METADATA contract; do not overwrite with full repository types until baseline tsc is resolved. */
interface ShadowGeneratedEnv {
  CF_VERSION_METADATA: WorkerVersionMetadata;
}

/** Wrangler-generated version_metadata binding contract. */
type WorkerVersionMetadata = {
  /** The ID of the Worker Version using this binding. */
  id: string;
  /** The tag of the Worker Version using this binding. */
  tag: string;
  /** The timestamp of the Worker Version upload. */
  timestamp: string;
};
