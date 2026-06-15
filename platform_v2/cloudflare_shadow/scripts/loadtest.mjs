const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, value = "1"] = arg.replace(/^--/, "").split("=");
  return [key, value];
}));

const url = args.get("url") ?? "http://127.0.0.1:8787";
const records = Number(args.get("records") ?? "10000");
const mediaPerRecord = Number(args.get("media") ?? "3");
const concurrency = Number(args.get("concurrency") ?? "20");

let next = 0;
let ok = 0;
let failed = 0;
const startedAt = Date.now();

async function worker() {
  while (next < records) {
    const index = next++;
    try {
      const draft = await postJson(`${url}/api/v0/draft-observations`, {
        userId: `load-user-${index % 100}`,
        observedAt: new Date().toISOString(),
        exactLat: 34.7 + ((index % 100) / 1000),
        exactLng: 137.7 + ((index % 100) / 1000),
        locationAccuracyM: 12,
        visibility: index % 3 === 0 ? "public" : "private",
        media: Array.from({ length: mediaPerRecord }, (_, mediaIndex) => ({
          mime: "image/jpeg",
          bytes: 850000 + mediaIndex,
          sha256: `synthetic-${index}-${mediaIndex}`
        }))
      });
      await postJson(`${url}/api/v0/observations/finalize`, {
        draftId: draft.draftId,
        taxonLabel: "synthetic field record",
        note: "load profile"
      });
      ok++;
    } catch (error) {
      failed++;
      if (failed < 10) console.error(error);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const elapsedSec = (Date.now() - startedAt) / 1000;
console.log(JSON.stringify({
  records,
  mediaPerRecord,
  ok,
  failed,
  elapsedSec,
  recordsPerSecond: ok / elapsedSec
}, null, 2));

async function postJson(endpoint, body) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${endpoint}: ${await response.text()}`);
  }
  return response.json();
}
