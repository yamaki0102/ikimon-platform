import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function repositoryFile(path: string): string {
  const candidates = [
    resolve(process.cwd(), "..", path),
    resolve(process.cwd(), path),
  ];
  const selected = candidates.find((candidate) => existsSync(candidate));
  if (!selected) throw new Error(`repository_file_not_found:${path}`);
  return readFileSync(selected, "utf8");
}

test("ZUKAN product entry rejects biodiversity-only service framing", () => {
  const startHere = repositoryFile("docs/START_HERE.md");
  const spec = repositoryFile("docs/spec/zukan-product-architecture/SPEC.md");

  assert.match(startHere, /公開サービスの現行名は`ZUKAN`/u);
  assert.match(startHere, /地域の写真、資料、観察、活動、出来事/u);
  assert.match(startHere, /生物専門モデルはBiodiversity Domain Pack/u);
  assert.match(spec, /ZUKAN is not a biodiversity application/u);
  assert.match(spec, /Record \/ Claim separation/u);
  assert.match(spec, /ZUKAN is not an emergency reporting channel/u);
  assert.doesNotMatch(
    startHere,
    /ZUKANは(?:生き物|自然観察)(?:だけ|中心)のサービス/u,
  );
});

test("project manifest points to strategy and active product architecture", () => {
  const project = JSON.parse(repositoryFile("PROJECT.json")) as {
    display_name?: string;
    canonical?: Record<string, { repository?: string; path?: string }>;
  };

  assert.equal(project.display_name, "ZUKAN");
  assert.deepEqual(project.canonical?.zukan_service_definition, {
    repository: "yamaki0102/ikimon-business-strategy",
    path: "strategy/zukan-service-definition-master.md",
  });
  assert.deepEqual(project.canonical?.zukan_product_architecture_decision, {
    repository: "yamaki0102/ikimon-business-strategy",
    path: "decisions/2026-07-29-zukan-product-architecture-and-safety-boundary.md",
  });
  assert.deepEqual(project.canonical?.product_architecture, {
    repository: "yamaki0102/ikimon-platform",
    path: "docs/spec/zukan-product-architecture/SPEC.md",
  });
});
