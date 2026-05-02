import { getPool } from "../db.js";
import { cleanupStagingFixtures } from "../services/stagingFixtureCleanup.js";

type CleanupOptions = {
  fixturePrefix: string | null;
  apply: boolean;
};

function parseArgs(argv: string[]): CleanupOptions {
  const options: CleanupOptions = {
    fixturePrefix: null,
    apply: false,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.apply = false;
      continue;
    }
    if (arg.startsWith("--fixture-prefix=")) {
      const value = arg.slice("--fixture-prefix=".length).trim();
      options.fixturePrefix = value || null;
    }
  }

  return options;
}

async function main(): Promise<void> {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await cleanupStagingFixtures({
      fixturePrefix: options.fixturePrefix,
      dryRun: !options.apply,
    });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await getPool().end();
  }
}

void main();
