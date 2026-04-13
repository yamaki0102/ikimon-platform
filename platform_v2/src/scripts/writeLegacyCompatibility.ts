import path from "node:path";
import { getPool } from "../db.js";
import {
  writeLegacyObservation,
  writeLegacyTrack,
  writeLegacyUser,
  type LegacyCompatibilityOptions,
} from "../legacy/compatibilityWriter.js";
import { resolveLegacyRoots } from "../legacy/legacyRoots.js";

type Options = LegacyCompatibilityOptions & {
  entityType: "user" | "observation" | "track";
  id: string;
};

function parseArgs(argv: string[]): Options {
  const resolvedRoots = resolveLegacyRoots(process.cwd(), {
    mirrorRoot: process.env.LEGACY_MIRROR_ROOT,
    legacyDataRoot: process.env.LEGACY_DATA_ROOT,
    publicRoot: process.env.LEGACY_PUBLIC_ROOT,
  });
  const options: Options = {
    entityType: "observation",
    id: "",
    legacyDataRoot: resolvedRoots.legacyDataRoot,
    publicRoot: resolvedRoots.publicRoot,
  };

  for (const arg of argv) {
    if (arg.startsWith("--entity-type=")) {
      const value = arg.slice("--entity-type=".length);
      if (value === "user" || value === "observation" || value === "track") {
        options.entityType = value;
      }
      continue;
    }

    if (arg.startsWith("--id=")) {
      options.id = arg.slice("--id=".length);
      continue;
    }

    if (arg.startsWith("--legacy-data-root=")) {
      options.legacyDataRoot = path.resolve(arg.slice("--legacy-data-root=".length));
      continue;
    }

    if (arg.startsWith("--public-root=")) {
      options.publicRoot = path.resolve(arg.slice("--public-root=".length));
      continue;
    }

    if (arg.startsWith("--mirror-root=")) {
      const mirrorRoots = resolveLegacyRoots(process.cwd(), {
        mirrorRoot: arg.slice("--mirror-root=".length),
      });
      options.legacyDataRoot = mirrorRoots.legacyDataRoot;
      options.publicRoot = mirrorRoots.publicRoot;
    }
  }

  if (options.id.trim() === "") {
    throw new Error("--id is required");
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  let result;

  if (options.entityType === "user") {
    result = await writeLegacyUser(options.id, options);
  } else if (options.entityType === "track") {
    result = await writeLegacyTrack(options.id, options);
  } else {
    result = await writeLegacyObservation(options.id, options);
  }

  console.log(JSON.stringify(result, null, 2));
  await getPool().end();
}

void main();
