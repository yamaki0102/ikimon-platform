import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  decodePublicationFeedCursor,
  getPublicationFeed,
  getPublicationFeedConfig,
  PUBLICATION_FEED_DEFAULT_LIMIT,
  PUBLICATION_FEED_MAX_LIMIT,
  PUBLICATION_FEED_CHANNEL_KEYS,
  type PublicationFeedChannelKey,
  type PublicationFeedLocale,
  type PublicationFeedResponse,
} from "../services/publicationFeed.js";

const PUBLICATION_FEED_CACHE_CONTROL = "public, max-age=60, stale-while-revalidate=300";

type PublicationFeedQuery = {
  channel?: unknown;
  limit?: unknown;
  cursor?: unknown;
  locale?: unknown;
};

export type PublicationFeedRouteDependencies = {
  getFeed?: (input: {
    feedKey: string;
    channel?: PublicationFeedChannelKey;
    locale?: PublicationFeedLocale;
    limit: number;
    cursor: ReturnType<typeof decodePublicationFeedCursor>;
  }) => Promise<PublicationFeedResponse>;
};

type ParsedPublicationFeedQuery = {
  channel?: PublicationFeedChannelKey;
  locale?: PublicationFeedLocale;
  limit: number;
  cursor: ReturnType<typeof decodePublicationFeedCursor>;
};

function singleQueryValue(value: unknown, name: string): string | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    if (value.length !== 1 || typeof value[0] !== "string") throw new Error(`invalid_${name}`);
    return value[0];
  }
  if (typeof value !== "string") throw new Error(`invalid_${name}`);
  return value;
}

function parsePublicationFeedQuery(
  query: PublicationFeedQuery,
  supportedChannels: readonly string[] = PUBLICATION_FEED_CHANNEL_KEYS,
): ParsedPublicationFeedQuery {
  const channelValue = singleQueryValue(query.channel, "publication_feed_channel");
  const limitValue = singleQueryValue(query.limit, "publication_feed_limit");
  const cursorValue = singleQueryValue(query.cursor, "publication_feed_cursor");
  const localeValue = singleQueryValue(query.locale, "publication_feed_locale");

  const channel = channelValue === undefined
    ? undefined
    : supportedChannels.includes(channelValue)
      ? channelValue as PublicationFeedChannelKey
      : (() => { throw new Error("invalid_publication_feed_channel"); })();

  const limit = limitValue === undefined
    ? PUBLICATION_FEED_DEFAULT_LIMIT
    : /^\d+$/.test(limitValue)
      ? Number(limitValue)
      : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > PUBLICATION_FEED_MAX_LIMIT) {
    throw new Error("invalid_publication_feed_limit");
  }

  const locale = localeValue === undefined
    ? undefined
    : localeValue === "ja" || localeValue === "en"
      ? localeValue
      : (() => { throw new Error("invalid_publication_feed_locale"); })();

  const cursor = decodePublicationFeedCursor(cursorValue);
  if (cursor && !supportedChannels.includes(cursor.channel)) {
    throw new Error("invalid_publication_feed_cursor");
  }

  return {
    channel,
    locale,
    limit,
    cursor,
  };
}

function etagForFeed(response: PublicationFeedResponse): string {
  const body = JSON.stringify(response);
  return `"${createHash("sha256").update(body, "utf8").digest("hex")}"`;
}

function ifNoneMatchMatches(value: unknown, etag: string): boolean {
  if (typeof value !== "string") return false;
  return value.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized === etag || normalized.replace(/^W\//, "") === etag;
  });
}

function setPublicationFeedHeaders(
  reply: FastifyReply,
  etag: string,
  allowedOrigin: string | null,
): void {
  reply
    .type("application/json; charset=utf-8")
    .header("Cache-Control", PUBLICATION_FEED_CACHE_CONTROL)
    .header("ETag", etag)
    .header("Vary", "Origin");
  if (allowedOrigin) reply.header("Access-Control-Allow-Origin", allowedOrigin);
}

function requestOrigin(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function registerPublicationFeedRoutes(
  app: FastifyInstance,
  dependencies: PublicationFeedRouteDependencies = {},
): Promise<void> {
  const loadFeed = dependencies.getFeed ?? getPublicationFeed;

  app.get<{ Params: { feedKey: string }; Querystring: PublicationFeedQuery }>(
    "/api/v1/publication-feeds/:feedKey",
    async (request, reply) => {
      const config = getPublicationFeedConfig(request.params.feedKey);
      if (!config) {
        reply.code(404).type("application/json; charset=utf-8");
        return { ok: false, error: "publication_feed_not_found" };
      }

      let parsed: ParsedPublicationFeedQuery;
      try {
        parsed = parsePublicationFeedQuery(request.query, config.channels.map((channel) => channel.key));
      } catch (error) {
        reply.code(400).type("application/json; charset=utf-8");
        return {
          ok: false,
          error: error instanceof Error ? error.message : "invalid_publication_feed_query",
        };
      }

      let response: PublicationFeedResponse;
      try {
        response = await loadFeed({
          feedKey: request.params.feedKey,
          channel: parsed.channel,
          locale: parsed.locale,
          limit: parsed.limit,
          cursor: parsed.cursor,
        });
      } catch (error) {
        request.log.error({ err: error, feedKey: request.params.feedKey }, "publication feed unavailable");
        reply.code(503).type("application/json; charset=utf-8").header("Cache-Control", "no-store");
        return { ok: false, error: "publication_feed_unavailable" };
      }

      const etag = etagForFeed(response);
      const origin = requestOrigin(request.headers.origin);
      const allowedOrigin = origin && config.allowedConsumerOrigins?.includes(origin) ? origin : null;
      setPublicationFeedHeaders(reply, etag, allowedOrigin);
      if (ifNoneMatchMatches(request.headers["if-none-match"], etag)) {
        reply.code(304).send();
        return;
      }
      return response;
    },
  );
}

export const __test__ = {
  etagForFeed,
  parsePublicationFeedQuery,
  ifNoneMatchMatches,
};
