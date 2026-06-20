#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const EXCLUDED_SPECS = new Set([
  "e2e/map.staging.spec.ts",
  "e2e/map-performance.staging.spec.ts",
  "e2e/notes-map-regression.staging.spec.ts",
  "e2e/sitemap-registry-visual.staging.spec.ts",
  "e2e/existing-user-review.staging.spec.ts",
]);

const SPEC_WEIGHT_SECONDS = new Map([
  ["e2e/authority.staging.spec.ts", 10.5],
  ["e2e/guide-fallback.staging.spec.ts", 5.1],
  ["e2e/guide-offline-queue.staging.spec.ts", 16.3],
  ["e2e/home.staging.spec.ts", 11.5],
  ["e2e/identification-workbench.staging.spec.ts", 8.0],
  ["e2e/invasive-species.staging.spec.ts", 9.0],
  ["e2e/observation-events.staging.spec.ts", 5.9],
  ["e2e/observation-grounding.staging.spec.ts", 6.1],
  ["e2e/observation-media-regression.staging.spec.ts", 5.6],
  ["e2e/observation-package.staging.spec.ts", 1.0],
  ["e2e/observation-rally.staging.spec.ts", 5.7],
  ["e2e/observation-scene-read-model.staging.spec.ts", 8.6],
  ["e2e/place-memory.staging.spec.ts", 3.9],
  ["e2e/profile-mobile.staging.spec.ts", 3.0],
  ["e2e/record-funnel.staging.spec.ts", 13.3],
  ["e2e/service-loop.staging.spec.ts", 24.5],
]);

const DEFAULT_WEIGHT_SECONDS = 8.0;

function parseArgs(argv) {
  const options = {
    explain: false,
    json: false,
    validate: false,
    total: null,
    shard: null,
  };

  for (const arg of argv) {
    if (arg === "--explain") {
      options.explain = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--validate") {
      options.validate = true;
    } else if (arg.startsWith("--total=")) {
      options.total = parsePositiveInt(arg.slice("--total=".length), "--total");
    } else if (arg.startsWith("--shard=")) {
      options.shard = parseShard(arg.slice("--shard=".length));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.shard && options.total && options.shard.total !== options.total) {
    throw new Error(`--shard total (${options.shard.total}) must match --total (${options.total})`);
  }

  if (!options.total && options.shard) {
    options.total = options.shard.total;
  }

  if (!options.total) {
    options.total = 2;
  }

  return options;
}

function parsePositiveInt(value, label) {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Number(value);
}

function parseShard(value) {
  const match = value.match(/^([1-9]\d*)\/([1-9]\d*)$/);
  if (!match) {
    throw new Error("--shard must use the form index/total, for example --shard=1/2");
  }
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (index > total) {
    throw new Error("--shard index cannot be greater than total");
  }
  return { index, total };
}

function listStagingSpecs() {
  const e2eDir = path.join(process.cwd(), "e2e");
  return fs.readdirSync(e2eDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".staging.spec.ts"))
    .map((entry) => `e2e/${entry.name}`)
    .filter((spec) => !EXCLUDED_SPECS.has(spec))
    .sort((a, b) => a.localeCompare(b));
}

function buildPlan(specs, total) {
  const originalOrder = new Map(specs.map((spec, index) => [spec, index]));
  const shards = Array.from({ length: total }, (_, index) => ({
    index: index + 1,
    estimatedSeconds: 0,
    specs: [],
  }));

  const weightedSpecs = specs
    .map((spec) => ({
      spec,
      weight: SPEC_WEIGHT_SECONDS.get(spec) ?? DEFAULT_WEIGHT_SECONDS,
    }))
    .sort((a, b) => {
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return a.spec.localeCompare(b.spec);
    });

  for (const item of weightedSpecs) {
    shards.sort((a, b) => {
      if (a.estimatedSeconds !== b.estimatedSeconds) {
        return a.estimatedSeconds - b.estimatedSeconds;
      }
      if (a.specs.length !== b.specs.length) {
        return a.specs.length - b.specs.length;
      }
      return a.index - b.index;
    });
    shards[0].specs.push(item.spec);
    shards[0].estimatedSeconds += item.weight;
  }

  return shards
    .sort((a, b) => a.index - b.index)
    .map((shard) => ({
      ...shard,
      estimatedSeconds: Number(shard.estimatedSeconds.toFixed(1)),
      specs: shard.specs.sort((a, b) => originalOrder.get(a) - originalOrder.get(b)),
    }));
}

function validatePlan(specs, shards) {
  const planned = shards.flatMap((shard) => shard.specs);
  const unique = new Set(planned);
  if (unique.size !== planned.length) {
    throw new Error("Shard plan contains duplicate specs");
  }
  const missing = specs.filter((spec) => !unique.has(spec));
  if (missing.length > 0) {
    throw new Error(`Shard plan is missing specs: ${missing.join(", ")}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const specs = listStagingSpecs();
  const shards = buildPlan(specs, options.total);
  validatePlan(specs, shards);

  if (options.validate) {
    const summary = shards
      .map((shard) => `shard ${shard.index}/${options.total}: ${shard.estimatedSeconds}s, ${shard.specs.length} specs`)
      .join("\n");
    console.error(summary);
  }

  if (options.json) {
    const payload = {
      excludedSpecs: Array.from(EXCLUDED_SPECS).sort(),
      defaultWeightSeconds: DEFAULT_WEIGHT_SECONDS,
      shards,
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (options.explain) {
    for (const shard of shards) {
      console.error(`shard ${shard.index}/${options.total}: estimated ${shard.estimatedSeconds}s`);
      for (const spec of shard.specs) {
        const weight = SPEC_WEIGHT_SECONDS.get(spec) ?? DEFAULT_WEIGHT_SECONDS;
        console.error(`  ${spec} (${weight}s)`);
      }
    }
  }

  if (options.shard) {
    const selected = shards[options.shard.index - 1];
    for (const spec of selected.specs) {
      console.log(spec);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
