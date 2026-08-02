import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionNginx = readFileSync(
  new URL("../../ops/nginx/ikimon.life-v2-cutover.conf", import.meta.url),
  "utf8",
);
const stagingNginx = readFileSync(
  new URL("../../../ops/deploy/staging_ikimon_life_tls_reference.conf", import.meta.url),
  "utf8",
);

test("production nginx overwrites runtime public origin before localhost Fastify", () => {
  assert.match(productionNginx, /proxy_pass http:\/\/127\.0\.0\.1:3200;/);
  assert.match(
    productionNginx,
    /proxy_set_header X-Ikimon-Runtime-Public-Origin https:\/\/ikimon\.life;/,
  );
  assert.doesNotMatch(
    productionNginx,
    /proxy_set_header X-Ikimon-Runtime-Public-Origin \$http_/,
  );
});

test("staging nginx overwrites runtime public origin before localhost Fastify", () => {
  assert.match(stagingNginx, /proxy_pass http:\/\/127\.0\.0\.1:3200;/);
  assert.match(
    stagingNginx,
    /proxy_set_header X-Ikimon-Runtime-Public-Origin https:\/\/staging\.ikimon\.life;/,
  );
  assert.doesNotMatch(
    stagingNginx,
    /proxy_set_header X-Ikimon-Runtime-Public-Origin \$http_/,
  );
});
