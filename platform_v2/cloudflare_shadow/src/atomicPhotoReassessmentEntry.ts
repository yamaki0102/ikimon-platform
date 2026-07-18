type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<unknown>;
  raw<T = unknown[]>(options?: unknown): Promise<T[]>;
};

type D1DatabaseLike = {
  prepare(sql: string): D1StatementLike;
  batch<T = unknown>(statements: D1StatementLike[]): Promise<T[]>;
  [key: PropertyKey]: unknown;
};

type WorkerEnv = Record<string, unknown> & {
  OBS_DB?: D1DatabaseLike;
};

type TaggedStatement = {
  inner: D1StatementLike;
  sql: string;
};

type AtomicBatchState = {
  intentAppended: boolean;
};

export type AtomicPhotoDelegate = (envValue: unknown) => Promise<Response>;

const PHOTO_UPLOAD_PATH = /^\/api\/v1\/observations\/([^/]+)\/photos\/upload\/?$/;
const ASSET_LEDGER_INSERT = /\binsert\s+into\s+asset_ledger\b/i;

const REASSESSMENT_UPSERT_SQL = `INSERT INTO observation_reassessment_requests (
  request_id, observation_id, request_kind, actor_user_id, request_state,
  source_payload_json, created_at, updated_at
) VALUES (?, ?, 'standard', ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(observation_id, request_kind, actor_user_id) DO UPDATE SET
  request_state = 'pending',
  source_payload_json = excluded.source_payload_json,
  updated_at = CURRENT_TIMESTAMP`;

function boundProperty(target: object, property: PropertyKey, receiver: object): unknown {
  const value = Reflect.get(target, property, receiver);
  return typeof value === "function" ? value.bind(target) : value;
}

export function createAtomicPhotoReassessmentDatabase(
  database: D1DatabaseLike,
  input: { observationId: string; ownerUserId: string },
  state: AtomicBatchState,
): D1DatabaseLike {
  const statementMetadata = new WeakMap<object, TaggedStatement>();

  const wrapStatement = (inner: D1StatementLike, sql: string): D1StatementLike => {
    const proxy = new Proxy(inner as object, {
      get(target, property, receiver) {
        if (property === "bind") {
          return (...values: unknown[]) => wrapStatement(inner.bind(...values), sql);
        }
        return boundProperty(target, property, receiver);
      },
    }) as D1StatementLike;
    statementMetadata.set(proxy as object, { inner, sql });
    return proxy;
  };

  return new Proxy(database as object, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return (sql: string) => wrapStatement(database.prepare(sql), sql);
      }
      if (property === "batch") {
        return async <T = unknown>(statements: D1StatementLike[]): Promise<T[]> => {
          const tagged = statements.map((statement) => (
            statementMetadata.get(statement as object) ?? { inner: statement, sql: "" }
          ));
          if (tagged.some((statement) => ASSET_LEDGER_INSERT.test(statement.sql))) {
            const requestId = `reassess:${input.observationId}:standard:${input.ownerUserId}`;
            const payload = JSON.stringify({
              source: "cloudflare_photo_upload_atomic_reassessment",
              transactionalIntent: true,
            });
            tagged.push({
              inner: database.prepare(REASSESSMENT_UPSERT_SQL).bind(
                requestId,
                input.observationId,
                input.ownerUserId,
                payload,
              ),
              sql: REASSESSMENT_UPSERT_SQL,
            });
            state.intentAppended = true;
          }
          return database.batch<T>(tagged.map((statement) => statement.inner));
        };
      }
      return boundProperty(target, property, receiver);
    },
  }) as D1DatabaseLike;
}

async function ownerForObservation(database: D1DatabaseLike, observationId: string): Promise<string | null> {
  const row = await database
    .prepare("SELECT owner_user_id FROM observations WHERE observation_id = ? LIMIT 1")
    .bind(observationId)
    .first<{ owner_user_id?: unknown }>();
  const ownerUserId = typeof row?.owner_user_id === "string" ? row.owner_user_id.trim() : "";
  return ownerUserId || null;
}

function photoUploadObservationId(request: Request): string | null {
  if (request.method !== "POST") return null;
  const match = PHOTO_UPLOAD_PATH.exec(new URL(request.url).pathname);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

async function withReassessmentReceipt(response: Response, state: AtomicBatchState): Promise<Response> {
  if (!response.ok || !state.intentAppended) return response;
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return response;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify({
    ...(body as Record<string, unknown>),
    reassessment: {
      state: "pending",
      kind: "standard",
      source: "cloudflare_photo_upload_atomic_reassessment",
    },
  }), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function withAtomicPhotoReassessment(
  request: Request,
  envValue: unknown,
  delegate: AtomicPhotoDelegate,
): Promise<Response> {
  const observationId = photoUploadObservationId(request);
  const env = envValue as WorkerEnv;
  if (!observationId || !env.OBS_DB) {
    return delegate(envValue);
  }

  let ownerUserId: string | null;
  try {
    ownerUserId = await ownerForObservation(env.OBS_DB, observationId);
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "photo_reassessment_preflight_failed" }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
  if (!ownerUserId) {
    return delegate(envValue);
  }

  const state: AtomicBatchState = { intentAppended: false };
  const proxiedEnv: WorkerEnv = {
    ...env,
    OBS_DB: createAtomicPhotoReassessmentDatabase(env.OBS_DB, { observationId, ownerUserId }, state),
  };
  const response = await delegate(proxiedEnv);
  return withReassessmentReceipt(response, state);
}
