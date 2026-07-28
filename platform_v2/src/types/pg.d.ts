declare module "pg" {
  export type QueryResultRow = Record<string, unknown>;

  export type QueryResult<T extends QueryResultRow = QueryResultRow> = {
    rows: T[];
    rowCount: number | null;
  };

  export class PoolClient {
    query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
  }

  export class Pool {
    constructor(config?: {
      connectionString?: string;
      application_name?: string;
      connectionTimeoutMillis?: number;
      enableChannelBinding?: boolean;
      max?: number;
    });
    connect(): Promise<PoolClient>;
    query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
