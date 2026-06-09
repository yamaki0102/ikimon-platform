import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type GuideVariant = {
  language: string;
  title: string;
  script: string;
  tts_script?: string;
  audio_url?: string;
};

type Seed = {
  sites?: Array<{
    certification_id?: string;
    payload?: {
      guide_stop?: {
        variants?: Record<string, GuideVariant>;
      };
    };
  }>;
};

const LANG_ORDER = ["ja", "en", "zh-TW", "zh-CN"] as const;
const seedPath = path.resolve(process.cwd(), "src/scripts/data/nature_symbiosis_sites.seed.json");
const outputRoot = path.resolve(process.cwd(), "../upload_package/public_html/assets/audio/guides/lenri");
const baseUrl = (process.env.IRODORI_TTS_BASE_URL ?? "http://127.0.0.1:8088").replace(/\/+$/, "");
const voice = process.env.IRODORI_TTS_VOICE ?? "none";
const apiKey = process.env.IRODORI_TTS_API_KEY ?? "";

function fileNameFor(lang: string): string {
  return `lenri-guide-${lang}.mp3`;
}

async function main(): Promise<void> {
  const seed = JSON.parse(await readFile(seedPath, "utf8")) as Seed;
  const lenri = seed.sites?.find((site) => site.certification_id === "aikan-renri-ikan-hq");
  const variants = lenri?.payload?.guide_stop?.variants;
  if (!variants) throw new Error("Lenri guide variants not found in nature_symbiosis_sites.seed.json");

  await mkdir(outputRoot, { recursive: true });

  for (const lang of LANG_ORDER) {
    const variant = variants[lang];
    if (!variant) throw new Error(`Missing guide variant: ${lang}`);
    const input = (variant.tts_script || variant.script || "").trim();
    if (!input) throw new Error(`Missing guide script: ${lang}`);

    const response = await fetch(`${baseUrl}/v1/audio/speech`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: "irodori-tts",
        input,
        voice,
        response_format: "mp3",
        speed: 0.96,
        irodori: {
          language: variant.language || lang,
          guide_id: "aikan-renri-ikan-hq",
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Irodori-TTS failed for ${lang}: ${response.status} ${body.slice(0, 300)}`);
    }

    const audio = Buffer.from(await response.arrayBuffer());
    if (audio.length < 1024) throw new Error(`Generated audio is unexpectedly small for ${lang}`);
    await writeFile(path.join(outputRoot, fileNameFor(lang)), audio);
    console.log(`[lenri-guide-audio] wrote ${fileNameFor(lang)} (${audio.length} bytes)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
