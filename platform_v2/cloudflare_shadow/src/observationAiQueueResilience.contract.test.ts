import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("every ZUKAN media queue consumer has a dedicated dead-letter queue and explicit retry limit", async () => {
  const config = JSON.parse(await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")) as {
    queues: { consumers: Array<Record<string, unknown>> };
    env: Record<string, { queues: { consumers: Array<Record<string, unknown>> } }>;
  };
  const expected = new Map([
    ["ikimon-shadow-media-jobs", "ikimon-shadow-media-jobs-dlq"],
    ["ikimon-staging-media-jobs", "ikimon-staging-media-jobs-dlq"],
    ["ikimon-prod-media-jobs", "ikimon-prod-media-jobs-dlq"],
  ]);
  const consumers = [config.queues, ...Object.values(config.env).map((entry) => entry.queues)]
    .flatMap((queues) => queues.consumers)
    .filter((consumer) => expected.has(String(consumer.queue)));
  assert.ok(consumers.length >= 4);
  for (const consumer of consumers) {
    assert.equal(consumer.max_retries, 3);
    assert.equal(consumer.dead_letter_queue, expected.get(String(consumer.queue)));
    assert.equal(consumer.max_concurrency, undefined);
  }
});
