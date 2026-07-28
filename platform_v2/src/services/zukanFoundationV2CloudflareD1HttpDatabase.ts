import type {
  FoundationD1Database,
  FoundationD1PreparedStatement,
} from "./zukanFoundationV2D1Repository.js";

type D1HttpValue = string | number | null;
type D1HttpQuery = {
  sql: string;
  params?: D1HttpValue[];
};
type D1HttpQueryResult = {
  success?: boolean;
  results?: unknown[];
};
type CloudflareApiEnvelope<T> = {
  success?: boolean;
  result?: T;
  errors?: Array<{ code?: number }>;
};

export type FoundationD1DatabaseIdentity = {
  uuid: string;
  name: string;
};

export type FoundationD1HttpFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

export type FoundationD1HttpDatabaseOptions = {
  accountId: string;
  databaseId: string;
  expectedDatabaseName: string;
  apiToken: string;
  fetcher?: FoundationD1HttpFetch;
  requestTimeoutMs?: number;
};

function assertFoundationD1HttpOptions(
  options: FoundationD1HttpDatabaseOptions,
): void {
  if (!/^[0-9a-f]{32}$/u.test(options.accountId)) {
    throw new Error("foundation_d1_account_id_invalid");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(options.databaseId)) {
    throw new Error("foundation_d1_database_id_invalid");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u.test(options.expectedDatabaseName)) {
    throw new Error("foundation_d1_database_name_invalid");
  }
  if (options.apiToken.trim().length < 16) {
    throw new Error("foundation_d1_api_token_missing");
  }
  const timeout = options.requestTimeoutMs ?? 30_000;
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 30_000) {
    throw new Error("foundation_d1_request_timeout_invalid");
  }
}

function cloudflareErrorCode<T>(envelope: CloudflareApiEnvelope<T>): string {
  const codes = (envelope.errors ?? [])
    .map((error) => error.code)
    .filter((code): code is number => Number.isInteger(code));
  return codes.length > 0 ? codes.join(",") : "unknown";
}

class CloudflareD1HttpPreparedStatement implements FoundationD1PreparedStatement {
  private values: D1HttpValue[] = [];

  constructor(
    readonly owner: CloudflareD1HttpDatabase,
    readonly query: string,
  ) {}

  bind(...values: D1HttpValue[]): FoundationD1PreparedStatement {
    this.values = [...values];
    return this;
  }

  toHttpQuery(): D1HttpQuery {
    return this.values.length === 0
      ? { sql: this.query }
      : { sql: this.query, params: [...this.values] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const result = await this.owner.executeSingle(this.toHttpQuery());
    return (result.results?.[0] as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const result = await this.owner.executeSingle(this.toHttpQuery());
    return { results: (result.results ?? []) as T[] };
  }

  async run(): Promise<unknown> {
    return this.owner.executeSingle(this.toHttpQuery());
  }
}

export class CloudflareD1HttpDatabase implements FoundationD1Database {
  private readonly fetcher: FoundationD1HttpFetch;
  private readonly requestTimeoutMs: number;
  private readonly databaseEndpoint: string;

  constructor(private readonly options: FoundationD1HttpDatabaseOptions) {
    assertFoundationD1HttpOptions(options);
    this.fetcher = options.fetcher ?? ((input, init) => fetch(input, init));
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.databaseEndpoint = `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/d1/database/${options.databaseId}`;
  }

  prepare(query: string): FoundationD1PreparedStatement {
    if (query.trim().length === 0) {
      throw new Error("foundation_d1_query_empty");
    }
    return new CloudflareD1HttpPreparedStatement(this, query);
  }

  async batch(statements: FoundationD1PreparedStatement[]): Promise<unknown[]> {
    if (statements.length === 0) {
      throw new Error("foundation_d1_batch_empty");
    }
    const queries = statements.map((statement) => {
      if (
        !(statement instanceof CloudflareD1HttpPreparedStatement)
        || statement.owner !== this
      ) {
        throw new Error("foundation_d1_batch_statement_owner_mismatch");
      }
      return statement.toHttpQuery();
    });
    const results = await this.request<D1HttpQueryResult[]>(
      `${this.databaseEndpoint}/query`,
      "POST",
      { batch: queries },
    );
    if (!Array.isArray(results) || results.length !== queries.length) {
      throw new Error("foundation_d1_batch_result_count_mismatch");
    }
    for (const result of results) {
      if (result.success !== true) {
        throw new Error("foundation_d1_batch_query_failed");
      }
    }
    return results;
  }

  async executeSingle(query: D1HttpQuery): Promise<D1HttpQueryResult> {
    const results = await this.request<D1HttpQueryResult[]>(
      `${this.databaseEndpoint}/query`,
      "POST",
      query,
    );
    if (!Array.isArray(results) || results.length !== 1) {
      throw new Error("foundation_d1_single_result_count_mismatch");
    }
    const result = results[0]!;
    if (result.success !== true) {
      throw new Error("foundation_d1_single_query_failed");
    }
    return result;
  }

  async assertExpectedDatabaseIdentity(): Promise<FoundationD1DatabaseIdentity> {
    const identity = await this.request<FoundationD1DatabaseIdentity>(
      this.databaseEndpoint,
      "GET",
    );
    if (
      identity.uuid !== this.options.databaseId
      || identity.name !== this.options.expectedDatabaseName
    ) {
      throw new Error("foundation_d1_database_identity_mismatch");
    }
    return identity;
  }

  private async request<T>(
    url: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetcher(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.options.apiToken}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
      });
      let envelope: CloudflareApiEnvelope<T>;
      try {
        envelope = await response.json() as CloudflareApiEnvelope<T>;
      } catch {
        throw new Error("foundation_d1_api_response_invalid_json");
      }
      if (!response.ok || envelope.success !== true || envelope.result === undefined) {
        throw new Error(
          `foundation_d1_api_request_failed:${response.status}:${cloudflareErrorCode(envelope)}`,
        );
      }
      return envelope.result;
    } finally {
      clearTimeout(timeout);
    }
  }
}
