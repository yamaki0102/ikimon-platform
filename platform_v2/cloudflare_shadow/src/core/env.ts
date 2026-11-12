import type { RuntimeIdentityEnv } from "../runtimeIdentity";

export type D1Value = string | number | null;

export interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string; cacheControl?: string }; customMetadata?: Record<string, string> }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<unknown>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

export interface R2Object {
  size?: number;
  httpMetadata?: { contentType?: string };
}

export interface R2ObjectBody {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  checksums?: { sha256?: string | ArrayBuffer };
}

export interface R2ListResult {
  objects: R2ObjectSummary[];
  truncated?: boolean;
  cursor?: string;
}

export interface R2ObjectSummary {
  key: string;
  size: number;
  etag?: string;
  uploaded?: Date | string;
  checksums?: Record<string, string>;
}

export interface Queue<T = unknown> {
  send(message: T): Promise<void>;
}

export interface SendEmailBinding {
  send(message: {
    from: string | { name: string; email: string };
    to: string | { name: string; email: string } | Array<string | { name: string; email: string }>;
    subject: string;
    text?: string;
    html?: string;
    headers?: Record<string, string>;
  }): Promise<unknown>;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  readonly access?: {
    readonly aud: string;
    getIdentity(): Promise<{
      email?: string;
      name?: string;
      user_uuid?: string;
      [key: string]: unknown;
    } | undefined>;
  };
}

export interface ScheduledController {
  cron?: string;
  scheduledTime?: number;
}

export interface ImagesInfo {
  format?: string;
  fileSize?: number;
  width?: number;
  height?: number;
}

export interface ImagesOutput {
  response(): Response;
}

export interface ImagesTransformation {
  transform(options: Record<string, unknown>): ImagesTransformation;
  output(options: { format: string; quality?: number | string; anim?: boolean }): Promise<ImagesOutput>;
}

export interface ImagesBinding {
  input(stream: ReadableStream): ImagesTransformation;
  info(stream: ReadableStream): Promise<ImagesInfo>;
}

export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface Env {
  GENRE_PORTALS_ENABLED?: string;
  JOURNEY_SESSION_HMAC_SECRET?: string;
  NOCOSIL_REVISION_RECEIVER_ENABLED?: string;
  NOCOSIL_PUBLIC_RECEIVER_ENABLED?: string;
  NOCOSIL_INTEGRATION_HMAC_SECRET?: string;
  ZUKAN_QUIET_HOME_MODE?: string;
  CORE_DB: D1Database;
  OBS_DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  IMAGES?: ImagesBinding;
  AI?: WorkersAiBinding;
  MEDIA_QUEUE: Queue<MediaJob>;
  ALERT_QUEUE?: Queue<AlertDeliveryJob>;
  ALERT_EMAIL?: SendEmailBinding;
  ENVIRONMENT: string;
  PUBLIC_LOCATION_CELL_PRECISION: string;
  INTERNAL_AUTH_TOKEN?: string;
  ALERT_EMAIL_FROM?: string;
  ALERT_DELIVERY_BATCH_SIZE?: string;
  ALERT_EMAIL_ALLOWED_RECIPIENTS?: string;
  BIOSECURITY_ENABLED?: string;
  BIOSECURITY_EMAIL_ENABLED?: string;
  BIOSECURITY_STORAGE_BUDGET_BYTES?: string;
  BIOSECURITY_PHOTO_HINTS_ENABLED?: string;
  BIOSECURITY_PHOTO_HINT_DAILY_TOKENS?: string;
  OBSERVATION_DB_NAME?: string;
  OBSERVATION_ARCHIVE_TARGET?: string;
  OBSERVATION_DUAL_WRITE_MODE?: string;
  OBSERVATION_READ_CUTOVER_MODE?: string;
  OBSERVATION_EVENT_APPLICATION_CODES?: string;
  OBSERVATION_EVENT_GUEST_MEDIA_CODES?: string;
  ZUKAN_FOUNDATION_V2_SHADOW_READ_MODE?: string;
  ZUKAN_FOUNDATION_V2_DUAL_WRITE_MODE?: string;
  ZUKAN_FOUNDATION_V2_WRITE_KILL_SWITCH?: string;
  ZUKAN_FOUNDATION_V2_ALLOWED_TENANTS?: string;
  ZUKAN_FOUNDATION_V2_ALLOWED_OPERATIONS?: string;
  ZUKAN_FOUNDATION_V2_MAX_ENTITIES?: string;
  LEGACY_HOST_REDIRECT_MODE?: string;
  PUBLIC_DERIVED_IMAGE_TRANSFORM_MODE?: string;
  V2_PRIVILEGED_WRITE_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CONTACT_FORM_SECRET?: string;
  CONTACT_ADMIN_TO?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  TWITTER_CLIENT_ID?: string;
  TWITTER_CLIENT_SECRET?: string;
  V2_OAUTH_STATE_SECRET?: string;
  CLOUDFLARE_STREAM_WEBHOOK_SECRET?: string;
  MPC_DISABLED?: string;
  MPC_STAC_API_URL?: string;
  MPC_DATA_API_URL?: string;
  SENTINEL_ENVIRONMENT_BATCH_SIZE?: string;
  SENTINEL_ENVIRONMENT_DAYS_BACK?: string;
  SENTINEL_ENVIRONMENT_MAX_CLOUD?: string;
  OVERPASS_API_URL?: string;
  IKIMON_GIT_SHA?: string;
  GITHUB_SHA?: string;
  IKIMON_WORKER_VERSION?: string;
  IKIMON_UI_BUNDLE_HASH?: string;
  IKIMON_UI_MANIFEST_HASH?: string;
  IKIMON_DEPLOYED_AT?: string;
  CF_VERSION_METADATA?: RuntimeIdentityEnv["CF_VERSION_METADATA"];
}

export interface AlertDeliveryJob {
  topic: "alert_delivery.drain";
  source: "cron" | "manual" | "queue";
  limit?: number;
}

export interface MediaJob {
  outboxId: string;
  topic: "media.process" | "readmodel.refresh" | "observation.reassess";
  targetId: string;
}
