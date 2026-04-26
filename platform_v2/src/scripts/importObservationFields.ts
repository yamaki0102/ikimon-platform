import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertCertifiedField, type FieldSource } from "../services/observationFieldRegistry.js";

interface SeedSite {
  certification_id: string;
  name: string;
  name_kana?: string;
  prefecture?: string;
  city?: string;
  lat: number;
  lng: number;
  radius_m?: number;
  area_ha?: number;
  summary?: string;
  official_url?: string;
  polygon?: Record<string, unknown>;
}

interface SeedFile {
  _note?: string;
  _source_url?: string;
  sites: SeedSite[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));

async function importSeed(filePath: string, source: FieldSource): Promise<{ inserted: number; skipped: number }> {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as SeedFile;
  if (!Array.isArray(data.sites)) throw new Error(`bad seed: ${filePath}`);
  let inserted = 0;
  let skipped = 0;
  for (const site of data.sites) {
    if (!site.name || !Number.isFinite(site.lat) || !Number.isFinite(site.lng)) {
      skipped++;
      continue;
    }
    try {
      await upsertCertifiedField({
        source,
        name: site.name,
        nameKana: site.name_kana ?? "",
        summary: site.summary ?? "",
        prefecture: site.prefecture ?? "",
        city: site.city ?? "",
        lat: site.lat,
        lng: site.lng,
        radiusM: site.radius_m ?? 1000,
        polygon: site.polygon ?? null,
        areaHa: site.area_ha ?? null,
        certificationId: site.certification_id,
        officialUrl: site.official_url ?? data._source_url ?? "",
        ownerUserId: null,
        payload: { import_source: filePath, imported_at: new Date().toISOString() },
      });
      inserted++;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[import-fields] failed: ${site.certification_id}`, err);
      skipped++;
    }
  }
  return { inserted, skipped };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const overrideFile = args.find((a) => a.startsWith("--file="))?.split("=")[1];
  const overrideSourceRaw = args.find((a) => a.startsWith("--source="))?.split("=")[1];
  const overrideSource = (["nature_symbiosis_site", "tsunag", "protected_area", "oecm"] as FieldSource[])
    .find((s) => s === overrideSourceRaw);

  if (overrideFile && overrideSource) {
    const result = await importSeed(resolve(process.cwd(), overrideFile), overrideSource);
    // eslint-disable-next-line no-console
    console.log(`[${overrideSource}] inserted=${result.inserted} skipped=${result.skipped}`);
    return;
  }

  const targets: Array<{ file: string; source: FieldSource }> = [
    { file: resolve(__dirname, "data", "nature_symbiosis_sites.seed.json"), source: "nature_symbiosis_site" },
    { file: resolve(__dirname, "data", "tsunag_sites.seed.json"), source: "tsunag" },
  ];

  for (const target of targets) {
    const result = await importSeed(target.file, target.source);
    // eslint-disable-next-line no-console
    console.log(`[${target.source}] inserted=${result.inserted} skipped=${result.skipped}`);
  }
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[import-fields] fatal", err);
    process.exit(1);
  });
