import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";
import { getReadinessSnapshot } from "../services/readiness.js";

type EndpointCheck = {
  path: string;
  stagingStatus: number | "error";
  productionStatus: number | "error";
  match: boolean;
};

const STAGING_BASE = process.env.STAGING_BASE_URL ?? "https://staging.ikimon.life";
const PRODUCTION_BASE = process.env.PRODUCTION_BASE_URL ?? "https://ikimon.life";

const ENDPOINTS: string[] = [
  "/",
  "/map",
  "/learn",
  "/learn/field-loop?lang=ja",
  "/learn/authority-policy?lang=ja",
  "/learn/glossary?lang=ja",
  "/learn/methodology?lang=ja",
  "/faq?lang=ja",
  "/about?lang=ja",
  "/for-business?lang=ja",
  "/for-business/pricing?lang=ja",
  "/privacy",
  "/terms",
  "/contact",
  "/health",
  "/sitemap.xml",
  "/robots.txt",
];

async function checkEndpoint(
  pathToCheck: string,
): Promise<EndpointCheck> {
  const stagingUrl = STAGING_BASE + pathToCheck;
  const productionUrl = PRODUCTION_BASE + pathToCheck;
  const [staging, production] = await Promise.all([
    fetch(stagingUrl, { method: "GET", redirect: "manual" })
      .then((r) => r.status)
      .catch(() => "error" as const),
    fetch(productionUrl, { method: "GET", redirect: "manual" })
      .then((r) => r.status)
      .catch(() => "error" as const),
  ]);
  const match =
    staging !== "error"
    && production !== "error"
    && (staging === production
      || (staging >= 200 && staging < 400 && production >= 200 && production < 400));
  return { path: pathToCheck, stagingStatus: staging, productionStatus: production, match };
}

type AuthorityRankFill = {
  totalActive: number;
  withRank: number;
  withoutRank: number;
  percentWithRank: number;
};

async function getAuthorityRankFill(): Promise<AuthorityRankFill> {
  const pool = getPool();
  const { rows } = await pool.query<{ total: string; with_rank: string }>(
    `select count(*)::text as total,
            count(*) filter (where scope_taxon_rank is not null)::text as with_rank
       from specialist_authorities
      where status = 'active'`,
  );
  const total = Number(rows[0]?.total ?? 0);
  const withRank = Number(rows[0]?.with_rank ?? 0);
  return {
    totalActive: total,
    withRank,
    withoutRank: total - withRank,
    percentWithRank: total === 0 ? 100 : Math.round((withRank / total) * 1000) / 10,
  };
}

type CorpusCounts = {
  occurrences: number;
  identifications: number;
  identificationsWithAcceptedRank: number;
  distinctSpeciesKeys: number;
  photoAssets: number;
};

async function getCorpusCounts(): Promise<CorpusCounts> {
  const pool = getPool();
  const { rows } = await pool.query<{
    occurrences: string;
    identifications: string;
    ids_with_accepted_rank: string;
    distinct_species: string;
    photo_assets: string;
  }>(
    `select
        (select count(*) from occurrences)::text as occurrences,
        (select count(*) from identifications)::text as identifications,
        (select count(*) from identifications where accepted_rank is not null)::text as ids_with_accepted_rank,
        (select count(distinct gbif_species_key) from occurrences where gbif_species_key is not null)::text as distinct_species,
        (select count(*) from evidence_assets where asset_role = 'observation_photo')::text as photo_assets`,
  );
  const row = rows[0];
  return {
    occurrences: Number(row?.occurrences ?? 0),
    identifications: Number(row?.identifications ?? 0),
    identificationsWithAcceptedRank: Number(row?.ids_with_accepted_rank ?? 0),
    distinctSpeciesKeys: Number(row?.distinct_species ?? 0),
    photoAssets: Number(row?.photo_assets ?? 0),
  };
}

function formatTable(checks: EndpointCheck[]): string {
  const header = `| path | staging | production | match |\n|---|---|---|---|`;
  const body = checks
    .map((c) => `| \`${c.path}\` | ${c.stagingStatus} | ${c.productionStatus} | ${c.match ? "✅" : "❌"} |`)
    .join("\n");
  return `${header}\n${body}`;
}

async function main(): Promise<void> {
  const started = new Date().toISOString();
  const [readiness, endpoints, authorityFill, corpus] = await Promise.all([
    getReadinessSnapshot().catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
    Promise.all(ENDPOINTS.map(checkEndpoint)),
    getAuthorityRankFill().catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
    getCorpusCounts().catch((err) => ({ error: err instanceof Error ? err.message : String(err) })),
  ]);

  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "..", "..", "..");
  const reportsDir = path.resolve(repoRoot, "platform_v2", "ops", "reports");
  await mkdir(reportsDir, { recursive: true });
  const stamp = started.replace(/[:T]/g, "-").slice(0, 19);
  const filePath = path.join(reportsDir, `replacement-readiness-${stamp}.md`);

  const endpointMatches = endpoints.filter((e) => e.match).length;
  const endpointMismatches = endpoints.filter((e) => !e.match).length;

  const md = `# Replacement Readiness — ${started}

## Summary

- Endpoints checked: ${endpoints.length}
- Matches: ${endpointMatches}
- Mismatches: ${endpointMismatches}
- Staging base: \`${STAGING_BASE}\`
- Production base: \`${PRODUCTION_BASE}\`

## Endpoint parity

${formatTable(endpoints)}

## Authority rank fill

${JSON.stringify(authorityFill, null, 2)}

## Corpus counts (staging)

${JSON.stringify(corpus, null, 2)}

## Readiness snapshot (staging)

${"```json\n" + JSON.stringify(readiness, null, 2) + "\n```"}

## Recommendation

${
  endpointMismatches === 0
    ? "All checked endpoints match. Next step: review authority rank fill (>90% before canary), then decide on canary vs. full cutover."
    : `${endpointMismatches} endpoint(s) do not match. Investigate mismatches before considering cutover.`
}
`;

  await writeFile(filePath, md, "utf8");

  const summary = {
    reportPath: filePath,
    endpointsChecked: endpoints.length,
    endpointMatches,
    endpointMismatches,
    authorityRankPercent: "percentWithRank" in authorityFill ? authorityFill.percentWithRank : null,
  };
  console.log(JSON.stringify(summary, null, 2));

  await getPool().end();
}

void main();
